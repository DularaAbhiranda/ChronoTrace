import httpx
import hashlib
from typing import List
from app.models.event import NormalizedEvent, EventSource, EventType, Confidence


async def fetch(domain: str, client: httpx.AsyncClient, api_key: str) -> List[NormalizedEvent]:
    events: List[NormalizedEvent] = []
    try:
        resp = await client.get(
            f"https://api.shodan.io/dns/resolve",
            params={"hostnames": domain, "key": api_key},
            timeout=15.0,
        )
        resp.raise_for_status()
        ip_map = resp.json()
        ip = ip_map.get(domain)
        if not ip:
            return events

        host_resp = await client.get(
            f"https://api.shodan.io/shodan/host/{ip}",
            params={"key": api_key},
            timeout=15.0,
        )
        host_resp.raise_for_status()
        data = host_resp.json()

        for item in data.get("data", []):
            timestamp = item.get("timestamp", "")
            port = item.get("port", "")
            transport = item.get("transport", "tcp")
            product = item.get("product", "")
            banner = item.get("data", "")[:200]

            event_id = hashlib.md5(f"shodan-{ip}-{port}-{timestamp}".encode()).hexdigest()
            events.append(NormalizedEvent(
                id=event_id,
                timestamp=timestamp if timestamp else "1970-01-01T00:00:00Z",
                source=EventSource.SHODAN,
                event_type=EventType.EXPOSURE,
                subject=f"{ip}:{port}/{transport}",
                details={
                    "ip": ip,
                    "port": port,
                    "transport": transport,
                    "product": product,
                    "banner": banner,
                    "org": data.get("org", ""),
                    "isp": data.get("isp", ""),
                    "country": data.get("country_name", ""),
                },
                confidence=Confidence.EXACT,
            ))
    except Exception:
        pass
    return events
