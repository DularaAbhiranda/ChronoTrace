"""Live HTTP/HTTPS fingerprinting — headers, server tech, security headers, redirects."""
import hashlib
import logging
import re
from datetime import datetime, timezone
from typing import List, Dict
import httpx
from app.models.event import NormalizedEvent, EventSource, EventType, Confidence

log = logging.getLogger(__name__)

SECURITY_HEADERS = [
    "Strict-Transport-Security",
    "Content-Security-Policy",
    "X-Frame-Options",
    "X-Content-Type-Options",
    "Referrer-Policy",
    "Permissions-Policy",
]

TECH_PATTERNS = [
    (r"cloudflare", "Cloudflare"),
    (r"nginx", "nginx"),
    (r"apache", "Apache"),
    (r"litespeed", "LiteSpeed"),
    (r"iis", "Microsoft IIS"),
    (r"caddy", "Caddy"),
    (r"openresty", "OpenResty"),
    (r"php", "PHP"),
    (r"express", "Express.js"),
    (r"next\.js", "Next.js"),
    (r"wordpress", "WordPress"),
    (r"drupal", "Drupal"),
    (r"shopify", "Shopify"),
    (r"vercel", "Vercel"),
    (r"netlify", "Netlify"),
    (r"github", "GitHub Pages"),
    (r"akamai", "Akamai"),
    (r"fastly", "Fastly"),
]


def _detect_tech(headers: Dict[str, str], body_snippet: str) -> List[str]:
    found = set()
    haystack = " ".join([
        headers.get("server", ""),
        headers.get("x-powered-by", ""),
        headers.get("x-generator", ""),
        headers.get("via", ""),
        body_snippet[:2000],
    ]).lower()
    for pat, name in TECH_PATTERNS:
        if re.search(pat, haystack, re.IGNORECASE):
            found.add(name)
    return sorted(found)


async def _probe_url(client: httpx.AsyncClient, url: str) -> NormalizedEvent | None:
    try:
        resp = await client.get(url, timeout=10.0, follow_redirects=True)
    except Exception as e:
        log.info("http_probe: %s failed: %s", url, e)
        return None

    headers = {k.lower(): v for k, v in resp.headers.items()}
    body_snippet = resp.text[:5000] if resp.text else ""
    tech = _detect_tech(headers, body_snippet)

    missing_security = [h for h in SECURITY_HEADERS if h.lower() not in headers]
    redirect_chain = [str(r.url) for r in resp.history] + [str(resp.url)]

    now = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    event_id = hashlib.md5(f"http-{url}-{now}".encode()).hexdigest()
    return NormalizedEvent(
        id=event_id,
        timestamp=now,
        source=EventSource.HTTP_PROBE,
        event_type=EventType.HTTP_FINGERPRINT,
        subject=url,
        details={
            "status_code": resp.status_code,
            "final_url": str(resp.url),
            "server": headers.get("server", ""),
            "x_powered_by": headers.get("x-powered-by", ""),
            "content_type": headers.get("content-type", ""),
            "technologies": tech,
            "missing_security_headers": missing_security,
            "redirect_chain": redirect_chain,
            "title": _extract_title(body_snippet),
        },
        confidence=Confidence.EXACT,
    )


def _extract_title(html: str) -> str:
    m = re.search(r"<title[^>]*>(.*?)</title>", html, re.IGNORECASE | re.DOTALL)
    return m.group(1).strip()[:200] if m else ""


async def fetch(domain: str, client: httpx.AsyncClient) -> List[NormalizedEvent]:
    events: List[NormalizedEvent] = []
    for scheme in ("https", "http"):
        ev = await _probe_url(client, f"{scheme}://{domain}/")
        if ev:
            events.append(ev)
    return events
