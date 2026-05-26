import httpx
import hashlib
from typing import List
from chronotrace.models.event import NormalizedEvent, EventSource, EventType, Confidence


def _get_event_date(events_list: list, event_action: str) -> str:
    for ev in events_list:
        if ev.get("eventAction") == event_action:
            return ev.get("eventDate", "1970-01-01T00:00:00Z")
    return ""


async def fetch(domain: str, client: httpx.AsyncClient) -> List[NormalizedEvent]:
    url = f"https://rdap.org/domain/{domain}"
    events: List[NormalizedEvent] = []
    try:
        resp = await client.get(url, timeout=20.0, follow_redirects=True)
        resp.raise_for_status()
        data = resp.json()

        rdap_events = data.get("events", [])
        registrar = ""
        for entity in data.get("entities", []):
            roles = entity.get("roles", [])
            if "registrar" in roles:
                vcard = entity.get("vcardArray", [])
                if len(vcard) > 1:
                    for prop in vcard[1]:
                        if prop[0] == "fn":
                            registrar = prop[3]

        status = data.get("status", [])

        registration_date = _get_event_date(rdap_events, "registration")
        expiry_date = _get_event_date(rdap_events, "expiration")
        last_changed = _get_event_date(rdap_events, "last changed")

        if registration_date:
            event_id = hashlib.md5(f"rdap-registration-{domain}".encode()).hexdigest()
            events.append(NormalizedEvent(
                id=event_id,
                timestamp=registration_date,
                source=EventSource.RDAP,
                event_type=EventType.REGISTRATION,
                subject=domain,
                details={
                    "action": "registration",
                    "registrar": registrar,
                    "status": status,
                    "expiry_date": expiry_date,
                    "last_changed": last_changed,
                },
                confidence=Confidence.EXACT,
            ))

        if last_changed:
            event_id = hashlib.md5(f"rdap-changed-{domain}-{last_changed}".encode()).hexdigest()
            events.append(NormalizedEvent(
                id=event_id,
                timestamp=last_changed,
                source=EventSource.RDAP,
                event_type=EventType.REGISTRATION,
                subject=domain,
                details={
                    "action": "last_changed",
                    "registrar": registrar,
                    "status": status,
                },
                confidence=Confidence.EXACT,
            ))
    except Exception:
        pass
    return events
