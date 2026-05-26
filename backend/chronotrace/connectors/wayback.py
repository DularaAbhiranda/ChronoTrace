"""Wayback Machine CDX API connector with pagination for huge archives.

Sites like example.com have millions of captures, which times out single requests.
This connector paginates via resumeKey and caps total events at MAX_EVENTS.
"""
import asyncio
import hashlib
import logging
from typing import List, Optional
import httpx
from chronotrace.models.event import NormalizedEvent, EventSource, EventType, Confidence

log = logging.getLogger(__name__)

MAX_EVENTS = 5000        # Cap to avoid memory blowups on giant archives
PAGE_SIZE = 500          # Per-request limit (smaller = less likely to time out)
REQUEST_TIMEOUT = 120.0  # Very generous — CDX is slow on giant archives
MAX_PAGES = 10           # Hard ceiling on pagination depth
MAX_RETRIES = 4          # Retry on 504/502/503
INITIAL_BACKOFF = 3.0


def _ts_to_iso(ts: str) -> str:
    if len(ts) < 14:
        ts = ts.ljust(14, "0")
    return f"{ts[:4]}-{ts[4:6]}-{ts[6:8]}T{ts[8:10]}:{ts[10:12]}:{ts[12:14]}Z"


def _row_to_event(row: list) -> Optional[NormalizedEvent]:
    if len(row) < 4:
        return None
    ts, orig_url, status, mime = row[0], row[1], row[2], row[3]
    event_id = hashlib.md5(f"wayback-{orig_url}-{ts}".encode()).hexdigest()
    return NormalizedEvent(
        id=event_id,
        timestamp=_ts_to_iso(ts),
        source=EventSource.WAYBACK,
        event_type=EventType.SNAPSHOT,
        subject=orig_url,
        details={
            "status_code": status,
            "mime_type": mime,
            "wayback_url": f"https://web.archive.org/web/{ts}/{orig_url}",
        },
        confidence=Confidence.EXACT,
    )


async def _fetch_page(client: httpx.AsyncClient, domain: str,
                     resume_key: Optional[str], limit: int) -> tuple[list, Optional[str]]:
    """Fetch one CDX page. Returns (rows, next_resume_key)."""
    params = {
        "url": f"{domain}/*",
        "output": "json",
        "fl": "timestamp,original,statuscode,mimetype",
        "collapse": "urlkey",
        "limit": str(limit),
        "showResumeKey": "true",
    }
    if resume_key:
        params["resumeKey"] = resume_key

    data = None
    last_err: Optional[Exception] = None
    for attempt in range(MAX_RETRIES):
        try:
            resp = await client.get(
                "http://web.archive.org/cdx/search/cdx",
                params=params,
                timeout=REQUEST_TIMEOUT,
            )
            if resp.status_code == 200:
                data = resp.json()
                break
            if resp.status_code in (502, 503, 504, 429):
                wait = INITIAL_BACKOFF * (2 ** attempt)
                log.warning("wayback: %d for %s, retry %d/%d in %.1fs",
                            resp.status_code, domain, attempt + 1, MAX_RETRIES, wait)
                await asyncio.sleep(wait)
                continue
            resp.raise_for_status()
        except (httpx.ReadTimeout, httpx.ConnectTimeout) as e:
            last_err = e
            wait = INITIAL_BACKOFF * (2 ** attempt)
            log.warning("wayback: timeout for %s, retry %d/%d in %.1fs",
                        domain, attempt + 1, MAX_RETRIES, wait)
            await asyncio.sleep(wait)
        except Exception as e:
            log.warning("wayback: unexpected error for %s: %s", domain, e)
            return [], None

    if data is None:
        log.error("wayback: exhausted retries for %s: %s", domain, last_err)
        return [], None

    if not data:
        return [], None

    # CDX format: header row, then data rows, then optional blank line + resumeKey
    # When showResumeKey=true, the last non-empty element after a blank row is the key
    rows = data[1:] if len(data) > 1 else []
    next_key = None

    # Detect resumeKey: it appears as final row(s) after blank rows
    if rows:
        for i in range(len(rows) - 1, -1, -1):
            row = rows[i]
            if isinstance(row, list) and len(row) == 1 and isinstance(row[0], str) and row[0]:
                next_key = row[0]
                rows = rows[:i]
                break
            if isinstance(row, list) and len(row) == 0:
                rows = rows[:i]
                continue
            break

    return rows, next_key


async def fetch(domain: str, client: httpx.AsyncClient) -> List[NormalizedEvent]:
    all_rows: list = []
    resume_key: Optional[str] = None

    for page in range(MAX_PAGES):
        remaining = MAX_EVENTS - len(all_rows)
        if remaining <= 0:
            break

        limit = min(PAGE_SIZE, remaining)
        rows, next_key = await _fetch_page(client, domain, resume_key, limit)
        if not rows:
            break

        all_rows.extend(rows)
        log.info("wayback: page %d for %s: +%d rows (total %d)",
                 page + 1, domain, len(rows), len(all_rows))

        if not next_key:
            break
        resume_key = next_key

    events = [e for r in all_rows if (e := _row_to_event(r)) is not None]
    log.info("wayback: %s -> %d events", domain, len(events))
    return events
