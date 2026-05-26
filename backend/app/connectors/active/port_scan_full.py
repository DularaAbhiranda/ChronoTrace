"""Full 1-65535 TCP connect-scan with service-aware banner grabbing.

Uses a chunked worker-pool to avoid exhausting the OS ephemeral-port pool
(Windows has ~16K dynamic ports; firing 65K concurrent connects breaks the
network stack for ALL other connectors in the process).

Strategy:
  - 50 persistent workers pull from a port queue
  - Process ports in chunks of 5000 with short pauses to let TIME_WAIT sockets recycle
  - Service-aware banner grab on connected sockets

Against Cloudflare-fronted targets the full range will still mostly drop —
that's the edge firewall, not a bug in the scanner.
"""
import asyncio
import hashlib
import logging
import socket
import ssl
from datetime import datetime, timezone
from typing import List, Optional
from app.models.event import NormalizedEvent, EventSource, EventType, Confidence

log = logging.getLogger(__name__)

KNOWN_SERVICES = {
    21: "ftp", 22: "ssh", 23: "telnet", 25: "smtp", 53: "dns",
    80: "http", 110: "pop3", 111: "rpc", 135: "msrpc", 139: "netbios",
    143: "imap", 443: "https", 445: "smb", 465: "smtps", 587: "submission",
    993: "imaps", 995: "pop3s", 1433: "mssql", 1521: "oracle", 2049: "nfs",
    2222: "ssh-alt", 2375: "docker", 2376: "docker-tls", 3000: "node-dev",
    3306: "mysql", 3389: "rdp", 4444: "metasploit", 5000: "upnp", 5432: "postgres",
    5601: "kibana", 5672: "amqp", 5900: "vnc", 5984: "couchdb", 6379: "redis",
    6443: "kubernetes", 7474: "neo4j", 8000: "http-alt", 8008: "http-alt",
    8080: "http-alt", 8081: "http-alt", 8086: "influxdb", 8088: "http-alt",
    8443: "https-alt", 8500: "consul", 8888: "http-alt", 9000: "http-mgmt",
    9090: "prometheus", 9092: "kafka", 9200: "elasticsearch", 9300: "elasticsearch",
    9929: "nmap-test", 11211: "memcached", 15672: "rabbitmq-mgmt",
    27017: "mongodb", 27018: "mongodb", 31337: "elite",
    50070: "hadoop", 50075: "hadoop",
}

WORKERS = 100         # max concurrent in-flight sockets — well under Windows' 16K limit
CHUNK_SIZE = 5000     # ports per chunk
CHUNK_PAUSE = 0.3     # seconds to let TIME_WAIT socks drain between chunks
CONNECT_TIMEOUT = 0.9 # closed-port timeout (most ports are closed → dominates runtime)
BANNER_TIMEOUT = 2.0


async def _service_probe(reader: asyncio.StreamReader, writer: asyncio.StreamWriter,
                         host: str, port: int, service: str) -> str:
    try:
        if service.startswith("http") and not service.startswith("https"):
            payload = (
                f"GET / HTTP/1.0\r\n"
                f"Host: {host}\r\n"
                f"User-Agent: ChronoTrace-OSINT/1.0\r\n"
                f"\r\n"
            ).encode()
            writer.write(payload)
            await writer.drain()
            data = await asyncio.wait_for(reader.read(800), timeout=BANNER_TIMEOUT)
            lines = data.decode("utf-8", errors="replace").splitlines()
            return " | ".join(l for l in lines[:6] if l.strip())

        if service == "redis":
            writer.write(b"PING\r\n")
            await writer.drain()
            data = await asyncio.wait_for(reader.read(100), timeout=BANNER_TIMEOUT)
            return data.decode("utf-8", errors="replace").strip()

        if service == "memcached":
            writer.write(b"version\r\n")
            await writer.drain()
            data = await asyncio.wait_for(reader.read(100), timeout=BANNER_TIMEOUT)
            return data.decode("utf-8", errors="replace").strip()

        # Passive read — server speaks first
        data = await asyncio.wait_for(reader.read(400), timeout=BANNER_TIMEOUT)
        return data.decode("utf-8", errors="replace").strip()[:300]
    except (asyncio.TimeoutError, ConnectionError, OSError):
        return ""


def _tls_probe_sync(host: str, port: int) -> dict:
    try:
        ctx = ssl.create_default_context()
        ctx.check_hostname = False
        ctx.verify_mode = ssl.CERT_NONE
        with socket.create_connection((host, port), timeout=3.0) as sock:
            with ctx.wrap_socket(sock, server_hostname=host) as ssock:
                cipher = ssock.cipher()
                der = ssock.getpeercert(binary_form=True)
                return {
                    "tls_version": ssock.version(),
                    "cipher": cipher[0] if cipher else "",
                    "cert_size_bytes": len(der) if der else 0,
                }
    except Exception:
        return {}


async def _probe_port(host: str, port: int) -> Optional[NormalizedEvent]:
    try:
        reader, writer = await asyncio.wait_for(
            asyncio.open_connection(host, port), timeout=CONNECT_TIMEOUT
        )
    except (asyncio.TimeoutError, ConnectionRefusedError, OSError):
        return None

    service = KNOWN_SERVICES.get(port, "unknown")
    banner = await _service_probe(reader, writer, host, port, service)

    tls_info: dict = {}
    if service.startswith("https") or port in (443, 465, 587, 636, 993, 995, 8443, 9443):
        loop = asyncio.get_running_loop()
        tls_info = await loop.run_in_executor(None, _tls_probe_sync, host, port)

    try:
        writer.close()
        await writer.wait_closed()
    except Exception:
        pass

    now = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    event_id = hashlib.md5(f"portfull-{host}-{port}-{now}".encode()).hexdigest()
    return NormalizedEvent(
        id=event_id,
        timestamp=now,
        source=EventSource.PORT_SCAN,
        event_type=EventType.OPEN_PORT,
        subject=f"{host}:{port}/{service}",
        details={
            "host": host,
            "port": port,
            "service": service,
            "banner": banner[:400],
            "tls": tls_info,
            "scan_type": "tcp_connect_full",
            "scan_range": "1-65535",
        },
        confidence=Confidence.EXACT,
    )


async def _worker(host: str, q: asyncio.Queue, out: list):
    while True:
        port = await q.get()
        try:
            if port is None:
                break
            ev = await _probe_port(host, port)
            if ev is not None:
                out.append(ev)
        finally:
            q.task_done()


async def fetch(domain: str, _client=None) -> List[NormalizedEvent]:
    try:
        loop = asyncio.get_running_loop()
        info = await loop.getaddrinfo(domain, None, family=socket.AF_INET)
        ip = info[0][4][0]
    except Exception as e:
        log.warning("port_scan_full: cannot resolve %s: %s", domain, e)
        return []

    log.info("port_scan_full: starting chunked full-range scan of %s (%s)", domain, ip)
    out: list = []

    total_ports = 65535
    for chunk_start in range(1, total_ports + 1, CHUNK_SIZE):
        chunk_end = min(chunk_start + CHUNK_SIZE - 1, total_ports)
        q: asyncio.Queue = asyncio.Queue()
        for p in range(chunk_start, chunk_end + 1):
            q.put_nowait(p)

        workers = [asyncio.create_task(_worker(ip, q, out)) for _ in range(WORKERS)]
        await q.join()

        for _ in range(WORKERS):
            q.put_nowait(None)
        await asyncio.gather(*workers, return_exceptions=True)

        log.info("port_scan_full: chunk %d-%d done, %d ports open so far",
                 chunk_start, chunk_end, len(out))
        await asyncio.sleep(CHUNK_PAUSE)

    log.info("port_scan_full: %s -> %d open ports", ip, len(out))
    return out
