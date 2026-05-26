import asyncio
import httpx
import hashlib
import logging
from typing import List
from chronotrace.models.event import NormalizedEvent, EventSource, EventType, Confidence

log = logging.getLogger(__name__)

MAX_RETRIES = 4
INITIAL_BACKOFF = 2.0


def _parse_date(date_str: str) -> str:
    if not date_str:
        return "1970-01-01T00:00:00Z"
    date_str = date_str.strip()
    if "T" not in date_str:
        date_str += "T00:00:00"
    if not date_str.endswith("Z"):
        date_str += "Z"
    return date_str


async def _fetch_with_retry(domain: str, client: httpx.AsyncClient) -> list:
    """crt.sh frequently returns 502/503 under load. Retry with exponential backoff."""
    last_err: Exception | None = None
    for attempt in range(MAX_RETRIES):
        try:
            resp = await client.get(
                "https://crt.sh/",
                params={"q": f"%.{domain}", "output": "json"},
                timeout=45.0,
            )
            if resp.status_code == 200:
                return resp.json()
            if resp.status_code in (502, 503, 504, 429):
                last_err = httpx.HTTPStatusError(
                    f"crt.sh {resp.status_code}", request=resp.request, response=resp
                )
                wait = INITIAL_BACKOFF * (2 ** attempt)
                log.warning("crt.sh returned %s for %s, retry %d/%d in %.1fs",
                            resp.status_code, domain, attempt + 1, MAX_RETRIES, wait)
                await asyncio.sleep(wait)
                continue
            resp.raise_for_status()
        except (httpx.ReadTimeout, httpx.ConnectTimeout, httpx.RemoteProtocolError) as e:
            last_err = e
            wait = INITIAL_BACKOFF * (2 ** attempt)
            log.warning("crt.sh timeout for %s, retry %d/%d in %.1fs",
                        domain, attempt + 1, MAX_RETRIES, wait)
            await asyncio.sleep(wait)
    if last_err:
        log.error("crt.sh exhausted retries for %s: %s", domain, last_err)
    return []


async def fetch(domain: str, client: httpx.AsyncClient) -> List[NormalizedEvent]:
    events: List[NormalizedEvent] = []
    seen_cns: set = set()
    try:
        data = await _fetch_with_retry(domain, client)
        for cert in data:
            cn = cert.get("common_name", "")
            not_before = cert.get("not_before", "")
            issuer = cert.get("issuer_name", "")
            serial = cert.get("serial_number", "")
            cert_id = cert.get("id", "")

            event_id = hashlib.md5(f"crt-{cert_id}".encode()).hexdigest()
            events.append(NormalizedEvent(
                id=event_id,
                timestamp=_parse_date(not_before),
                source=EventSource.CRT_SH,
                event_type=EventType.CERTIFICATE,
                subject=cn,
                details={
                    "issuer": issuer,
                    "serial_number": serial,
                    "not_before": not_before,
                    "not_after": cert.get("not_after", ""),
                    "cert_id": cert_id,
                    "crt_sh_url": f"https://crt.sh/?id={cert_id}",
                },
                confidence=Confidence.EXACT,
            ))

            if cn and cn not in seen_cns and cn != domain:
                seen_cns.add(cn)
                sub_id = hashlib.md5(f"subdomain-crt-{cn}-{not_before}".encode()).hexdigest()
                events.append(NormalizedEvent(
                    id=sub_id,
                    timestamp=_parse_date(not_before),
                    source=EventSource.CRT_SH,
                    event_type=EventType.SUBDOMAIN,
                    subject=cn,
                    details={"first_seen_via": "certificate_transparency"},
                    confidence=Confidence.EXACT,
                ))
    except Exception as e:
        log.error("crt_sh.fetch failed for %s: %s", domain, e)
    return events
