"""Live TLS cert chain inspection — connect to host:443 and grab the actual served cert."""
import asyncio
import hashlib
import logging
import socket
import ssl
from datetime import datetime, timezone
from typing import List
from app.models.event import NormalizedEvent, EventSource, EventType, Confidence

log = logging.getLogger(__name__)


def _format_dn(dn_tuple) -> str:
    """Convert ((('CN','example.com'),), ...) tuple to readable string."""
    parts = []
    for rdn in dn_tuple or ():
        for k, v in rdn:
            parts.append(f"{k}={v}")
    return ", ".join(parts)


def _sync_inspect(host: str, port: int = 443) -> dict | None:
    ctx = ssl.create_default_context()
    ctx.check_hostname = False
    ctx.verify_mode = ssl.CERT_NONE  # we inspect even if invalid

    try:
        with socket.create_connection((host, port), timeout=8.0) as sock:
            with ctx.wrap_socket(sock, server_hostname=host) as ssock:
                cert = ssock.getpeercert()
                cipher = ssock.cipher()
                version = ssock.version()
                # cert is empty when CERT_NONE — get binary form
                der = ssock.getpeercert(binary_form=True)
    except Exception as e:
        log.info("tls_inspect: %s:%s failed: %s", host, port, e)
        return None

    # Re-parse with verification enabled to extract human-readable cert fields
    parsed_cert = {}
    try:
        ctx2 = ssl.create_default_context()
        with socket.create_connection((host, port), timeout=8.0) as sock:
            with ctx2.wrap_socket(sock, server_hostname=host) as ssock2:
                parsed_cert = ssock2.getpeercert() or {}
    except ssl.SSLCertVerificationError as e:
        parsed_cert = {"_verify_error": str(e)}
    except Exception:
        pass

    return {
        "cipher_suite": cipher[0] if cipher else "",
        "tls_version": version,
        "subject": _format_dn(parsed_cert.get("subject")),
        "issuer": _format_dn(parsed_cert.get("issuer")),
        "not_before": parsed_cert.get("notBefore", ""),
        "not_after": parsed_cert.get("notAfter", ""),
        "serial_number": parsed_cert.get("serialNumber", ""),
        "san": [v for k, v in parsed_cert.get("subjectAltName", []) if k == "DNS"],
        "verify_error": parsed_cert.get("_verify_error"),
        "cert_size_bytes": len(der) if der else 0,
    }


async def fetch(domain: str, _client=None) -> List[NormalizedEvent]:
    loop = asyncio.get_running_loop()
    data = await loop.run_in_executor(None, _sync_inspect, domain, 443)
    if not data:
        return []

    now = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    event_id = hashlib.md5(f"tls-{domain}-{now}".encode()).hexdigest()
    return [NormalizedEvent(
        id=event_id,
        timestamp=now,
        source=EventSource.TLS_LIVE,
        event_type=EventType.TLS_CHAIN,
        subject=f"{domain}:443",
        details=data,
        confidence=Confidence.EXACT,
    )]
