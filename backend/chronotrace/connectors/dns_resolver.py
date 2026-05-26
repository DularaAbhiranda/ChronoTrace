import dns.resolver
import dns.exception
import hashlib
from datetime import datetime, timezone
from typing import List
from chronotrace.models.event import NormalizedEvent, EventSource, EventType, Confidence

RECORD_TYPES = ["A", "AAAA", "MX", "NS", "TXT", "CNAME"]


async def fetch(domain: str, _client=None) -> List[NormalizedEvent]:
    now = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    events: List[NormalizedEvent] = []
    resolver = dns.resolver.Resolver()
    resolver.timeout = 5
    resolver.lifetime = 10

    for rtype in RECORD_TYPES:
        try:
            answers = resolver.resolve(domain, rtype)
            values = []
            for rdata in answers:
                values.append(str(rdata))

            event_id = hashlib.md5(f"dns-{rtype}-{domain}-{now}".encode()).hexdigest()
            events.append(NormalizedEvent(
                id=event_id,
                timestamp=now,
                source=EventSource.DNS,
                event_type=EventType.DNS_RECORD,
                subject=f"{domain} {rtype}",
                details={
                    "record_type": rtype,
                    "values": values,
                    "ttl": answers.rrset.ttl if answers.rrset else None,
                },
                confidence=Confidence.EXACT,
            ))
        except (dns.resolver.NXDOMAIN, dns.resolver.NoAnswer, dns.exception.Timeout):
            pass
        except Exception:
            pass
    return events
