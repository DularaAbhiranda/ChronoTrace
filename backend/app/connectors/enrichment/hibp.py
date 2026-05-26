import httpx
import hashlib
from typing import List
from app.models.event import NormalizedEvent, EventSource, EventType, Confidence


async def fetch(domain: str, client: httpx.AsyncClient, api_key: str) -> List[NormalizedEvent]:
    events: List[NormalizedEvent] = []
    headers = {"hibp-api-key": api_key, "user-agent": "ChronoTrace-OSINT"}
    try:
        resp = await client.get(
            f"https://haveibeenpwned.com/api/v3/breacheddomain/{domain}",
            headers=headers,
            timeout=15.0,
        )
        if resp.status_code == 404:
            return events
        resp.raise_for_status()
        data = resp.json()

        for email, breaches in data.items():
            for breach in breaches:
                event_id = hashlib.md5(f"hibp-{email}-{breach}".encode()).hexdigest()
                events.append(NormalizedEvent(
                    id=event_id,
                    timestamp="1970-01-01T00:00:00Z",
                    source=EventSource.HIBP,
                    event_type=EventType.EXPOSURE,
                    subject=f"{email}@{domain}",
                    details={"breach_name": breach, "email": email},
                    confidence=Confidence.APPROXIMATE,
                ))

        resp2 = await client.get(
            f"https://haveibeenpwned.com/api/v3/breaches?domain={domain}",
            headers=headers,
            timeout=15.0,
        )
        if resp2.status_code == 200:
            for breach in resp2.json():
                breach_date = breach.get("BreachDate", "")
                if breach_date:
                    breach_date += "T00:00:00Z"
                event_id = hashlib.md5(f"hibp-breach-{breach.get('Name')}".encode()).hexdigest()
                events.append(NormalizedEvent(
                    id=event_id,
                    timestamp=breach_date or "1970-01-01T00:00:00Z",
                    source=EventSource.HIBP,
                    event_type=EventType.EXPOSURE,
                    subject=domain,
                    details={
                        "breach_name": breach.get("Name"),
                        "domain": breach.get("Domain"),
                        "pwn_count": breach.get("PwnCount"),
                        "data_classes": breach.get("DataClasses", []),
                        "description": breach.get("Description", ""),
                    },
                    confidence=Confidence.EXACT,
                ))
    except Exception:
        pass
    return events
