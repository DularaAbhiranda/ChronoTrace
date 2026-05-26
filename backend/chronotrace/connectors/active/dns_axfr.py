"""DNS AXFR (zone transfer) attempt against each NS server.

Almost always denied by modern infrastructure. When it works it's gold —
the attacker (or auditor) gets every record in the zone.
"""
import asyncio
import hashlib
import logging
from datetime import datetime, timezone
from typing import List
import dns.query
import dns.zone
import dns.resolver
import dns.exception
from chronotrace.models.event import NormalizedEvent, EventSource, EventType, Confidence

log = logging.getLogger(__name__)


def _sync_attempt_axfr(domain: str, nameserver: str) -> dict:
    """Returns dict with 'success': bool, 'records': [...], 'error': str."""
    try:
        # Resolve NS hostname to IP
        resolver = dns.resolver.Resolver()
        resolver.timeout = 5
        resolver.lifetime = 8
        ns_ip = str(resolver.resolve(nameserver, "A")[0])
    except Exception as e:
        return {"success": False, "nameserver": nameserver, "error": f"NS resolve failed: {e}"}

    try:
        xfr = dns.query.xfr(ns_ip, domain, timeout=10, lifetime=15)
        zone = dns.zone.from_xfr(xfr)
        records = []
        for name, node in zone.nodes.items():
            for rdataset in node.rdatasets:
                records.append({
                    "name": str(name),
                    "type": dns.rdatatype.to_text(rdataset.rdtype),
                    "ttl": rdataset.ttl,
                    "values": [str(rd) for rd in rdataset],
                })
        return {
            "success": True,
            "nameserver": nameserver,
            "ns_ip": ns_ip,
            "record_count": len(records),
            "records": records[:200],  # cap to avoid huge payloads
        }
    except dns.exception.FormError as e:
        return {"success": False, "nameserver": nameserver, "ns_ip": ns_ip, "error": "REFUSED (zone transfer denied)"}
    except Exception as e:
        return {"success": False, "nameserver": nameserver, "ns_ip": ns_ip, "error": str(e)[:200]}


async def fetch(domain: str, _client=None) -> List[NormalizedEvent]:
    events: List[NormalizedEvent] = []
    now = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")

    # Get NS records for the domain
    resolver = dns.resolver.Resolver()
    resolver.timeout = 5
    resolver.lifetime = 10
    try:
        ns_records = [str(r).rstrip(".") for r in resolver.resolve(domain, "NS")]
    except Exception as e:
        log.warning("dns_axfr: no NS records for %s: %s", domain, e)
        return []

    loop = asyncio.get_running_loop()
    for ns in ns_records:
        result = await loop.run_in_executor(None, _sync_attempt_axfr, domain, ns)
        event_id = hashlib.md5(f"axfr-{domain}-{ns}-{now}".encode()).hexdigest()
        events.append(NormalizedEvent(
            id=event_id,
            timestamp=now,
            source=EventSource.DNS_AXFR,
            event_type=EventType.AXFR_ATTEMPT,
            subject=f"AXFR {domain} @ {ns}",
            details=result,
            confidence=Confidence.EXACT,
        ))
    return events
