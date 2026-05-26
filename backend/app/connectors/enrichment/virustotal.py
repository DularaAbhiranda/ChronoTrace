import httpx
import hashlib
from typing import List
from app.models.event import NormalizedEvent, EventSource, EventType, Confidence


async def fetch(domain: str, client: httpx.AsyncClient, api_key: str) -> List[NormalizedEvent]:
    events: List[NormalizedEvent] = []
    headers = {"x-apikey": api_key}
    try:
        resp = await client.get(
            f"https://www.virustotal.com/api/v3/domains/{domain}",
            headers=headers,
            timeout=15.0,
        )
        resp.raise_for_status()
        data = resp.json().get("data", {})
        attrs = data.get("attributes", {})

        creation_date = attrs.get("creation_date")
        if creation_date:
            from datetime import datetime, timezone
            ts = datetime.fromtimestamp(creation_date, tz=timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
            event_id = hashlib.md5(f"vt-creation-{domain}".encode()).hexdigest()
            events.append(NormalizedEvent(
                id=event_id,
                timestamp=ts,
                source=EventSource.VIRUSTOTAL,
                event_type=EventType.REGISTRATION,
                subject=domain,
                details={
                    "action": "creation",
                    "reputation": attrs.get("reputation", 0),
                    "categories": attrs.get("categories", {}),
                    "last_analysis_stats": attrs.get("last_analysis_stats", {}),
                    "registrar": attrs.get("registrar", ""),
                },
                confidence=Confidence.EXACT,
            ))

        for record in attrs.get("last_dns_records", []):
            event_id = hashlib.md5(f"vt-dns-{domain}-{record.get('type')}-{record.get('value')}".encode()).hexdigest()
            events.append(NormalizedEvent(
                id=event_id,
                timestamp=attrs.get("last_dns_records_date", ""),
                source=EventSource.VIRUSTOTAL,
                event_type=EventType.DNS_RECORD,
                subject=f"{domain} {record.get('type')}",
                details=record,
                confidence=Confidence.APPROXIMATE,
            ))
    except Exception:
        pass
    return events
