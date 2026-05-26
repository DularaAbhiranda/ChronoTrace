"""Top-20 common-port scan with service-aware banner grabbing.

Faster sibling of port_scan_full. Scans only the highest-value ports for quick recon.
"""
import asyncio
import hashlib
import logging
import socket
from datetime import datetime, timezone
from typing import List, Optional, Tuple
from app.connectors.active.port_scan_full import _service_probe, _tls_probe_sync
from app.models.event import NormalizedEvent, EventSource, EventType, Confidence

log = logging.getLogger(__name__)

COMMON_PORTS: List[Tuple[int, str]] = [
    (21, "ftp"), (22, "ssh"), (23, "telnet"), (25, "smtp"),
    (53, "dns"), (80, "http"), (110, "pop3"), (143, "imap"),
    (443, "https"), (465, "smtps"), (587, "submission"), (993, "imaps"),
    (995, "pop3s"), (3306, "mysql"), (3389, "rdp"), (5432, "postgres"),
    (5900, "vnc"), (6379, "redis"), (8080, "http-alt"), (8443, "https-alt"),
]

CONNECT_TIMEOUT = 2.5
MAX_CONCURRENT = 10


async def _probe(host: str, port: int, service: str, sem: asyncio.Semaphore) -> Optional[NormalizedEvent]:
    async with sem:
        try:
            reader, writer = await asyncio.wait_for(
                asyncio.open_connection(host, port), timeout=CONNECT_TIMEOUT
            )
        except (asyncio.TimeoutError, ConnectionRefusedError, OSError):
            return None

        banner = await _service_probe(reader, writer, host, port, service)

        tls_info: dict = {}
        if service.startswith("https") or port in (443, 465, 587, 993, 995, 8443):
            loop = asyncio.get_running_loop()
            tls_info = await loop.run_in_executor(None, _tls_probe_sync, host, port)

        try:
            writer.close()
            await writer.wait_closed()
        except Exception:
            pass

        now = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
        event_id = hashlib.md5(f"port-{host}-{port}-{now}".encode()).hexdigest()
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
                "scan_type": "tcp_connect",
                "scan_range": "top_20",
            },
            confidence=Confidence.EXACT,
        )


async def fetch(domain: str, _client=None) -> List[NormalizedEvent]:
    try:
        loop = asyncio.get_running_loop()
        info = await loop.getaddrinfo(domain, None, family=socket.AF_INET)
        ip = info[0][4][0]
    except Exception as e:
        log.warning("port_scan: cannot resolve %s: %s", domain, e)
        return []

    sem = asyncio.Semaphore(MAX_CONCURRENT)
    tasks = [_probe(ip, port, svc, sem) for port, svc in COMMON_PORTS]
    results = await asyncio.gather(*tasks)
    return [r for r in results if r is not None]
