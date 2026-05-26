"""Fetch well-known endpoints respectfully: robots.txt, sitemap.xml, security.txt, .well-known/*"""
import hashlib
import logging
import re
from datetime import datetime, timezone
from typing import List
import httpx
from chronotrace.models.event import NormalizedEvent, EventSource, EventType, Confidence

log = logging.getLogger(__name__)

PATHS = [
    "/robots.txt",
    "/sitemap.xml",
    "/.well-known/security.txt",
    "/security.txt",
    "/.well-known/openid-configuration",
    "/.well-known/change-password",
    "/humans.txt",
    "/ads.txt",
]


def _parse_robots_disallows(text: str) -> List[str]:
    paths = []
    for line in text.splitlines():
        line = line.strip()
        if line.lower().startswith("disallow:"):
            p = line.split(":", 1)[1].strip()
            if p:
                paths.append(p)
    return paths[:50]


def _parse_sitemap_urls(text: str) -> List[str]:
    return re.findall(r"<loc>(.*?)</loc>", text)[:50]


async def _probe_path(client: httpx.AsyncClient, base: str, path: str) -> NormalizedEvent | None:
    url = base + path
    try:
        resp = await client.get(url, timeout=8.0, follow_redirects=True)
    except Exception:
        return None

    if resp.status_code != 200:
        return None

    text = resp.text[:20000] if resp.text else ""
    details = {
        "url": url,
        "final_url": str(resp.url),
        "status_code": resp.status_code,
        "content_type": resp.headers.get("content-type", ""),
        "size_bytes": len(resp.content),
        "preview": text[:500],
    }

    if path == "/robots.txt":
        details["disallow_paths"] = _parse_robots_disallows(text)
    elif "sitemap" in path:
        details["sitemap_urls"] = _parse_sitemap_urls(text)

    now = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    event_id = hashlib.md5(f"wellknown-{url}-{now}".encode()).hexdigest()
    return NormalizedEvent(
        id=event_id,
        timestamp=now,
        source=EventSource.WELL_KNOWN,
        event_type=EventType.WELL_KNOWN_FILE,
        subject=path,
        details=details,
        confidence=Confidence.EXACT,
    )


async def fetch(domain: str, client: httpx.AsyncClient) -> List[NormalizedEvent]:
    base = f"https://{domain}"
    events: List[NormalizedEvent] = []
    for path in PATHS:
        ev = await _probe_path(client, base, path)
        if ev:
            events.append(ev)
    return events
