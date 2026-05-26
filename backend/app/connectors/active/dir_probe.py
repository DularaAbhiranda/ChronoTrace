"""Polite directory/file probing with a curated wordlist.

NOT a brute-force tool. Sends ~150 GETs at a rate-limited pace, reports only
meaningful responses (200, 301, 302, 401, 403, 500). Designed for authorized
recon to surface forgotten admin panels, exposed configs, .git/.env leakage.
"""
import asyncio
import hashlib
import logging
import re
from datetime import datetime, timezone
from typing import List, Optional
import httpx
from app.models.event import NormalizedEvent, EventSource, EventType, Confidence

log = logging.getLogger(__name__)

WORDLIST = [
    # Admin & auth
    "admin", "admin/", "administrator", "admin.php", "admin.html", "admin/login",
    "login", "login.php", "signin", "sign-in", "auth", "oauth", "sso", "logout",
    "user/login", "users/sign_in", "wp-admin/", "wp-login.php", "wp-admin/admin.php",
    # API surface
    "api", "api/", "api/v1", "api/v1/", "api/v2", "api/v2/", "api/v3",
    "graphql", "graphiql", "swagger", "swagger-ui", "api-docs", "openapi.json",
    "api/users", "api/v1/users", "api/health", "api/status", "rest", "rest/",
    # Secrets / config leakage
    ".env", ".env.local", ".env.production", ".env.backup", ".env.dev",
    "config.php", "config.json", "config.yml", "config.yaml", "config.xml",
    "configuration.php", "settings.php", "settings.json", "wp-config.php",
    # VCS exposure (huge wins when present)
    ".git/config", ".git/HEAD", ".git/index", ".gitignore",
    ".svn/entries", ".hg/store",
    # Backups & dumps
    "backup", "backup/", "backups", "backup.zip", "backup.sql", "backup.tar.gz",
    "db.sql", "dump.sql", "database.sql", "site-backup.zip", "old/",
    # Server status / debug
    "server-status", "server-info", "status", "health", "healthz", "ping",
    "metrics", "debug", "trace", "actuator", "actuator/health", "actuator/env",
    "phpinfo.php", "info.php", "test.php",
    # Admin tools
    "phpmyadmin/", "pma/", "myadmin/", "adminer.php", "adminer/",
    "jenkins", "jenkins/", "kibana", "grafana", "prometheus",
    # Source / docs
    "readme", "README.md", "CHANGELOG", "CHANGELOG.md", "LICENSE", "package.json",
    "composer.json", "Gemfile", "requirements.txt",
    # Mail
    "webmail", "mail", "roundcube", "rainloop",
    # Storage
    "uploads/", "uploads", "files/", "files", "assets/", "static/", "media/",
    "downloads/",
    # CI/CD & cloud
    "Dockerfile", "docker-compose.yml", ".dockerignore",
    "Jenkinsfile", ".gitlab-ci.yml", ".github/", ".github/workflows/",
    # Common app paths
    "console", "console/", "dashboard", "panel", "cpanel",
    "test", "staging", "dev", "beta",
    # .well-known (often legitimately exposed)
    ".well-known/security.txt", "security.txt", "humans.txt", "ads.txt",
    ".well-known/openid-configuration", ".well-known/change-password",
    # Less obvious but high-value
    "robots.txt.bak", "sitemap.xml.bak", "wp-content/uploads/",
    "config.bak", "config.old", "index.bak",
]

INTERESTING_STATUS = {200, 201, 301, 302, 307, 308, 401, 403, 500, 503}
SECRET_REGEX = re.compile(
    r"(api[_-]?key|access[_-]?token|secret|password|aws[_-]?access|private[_-]?key)",
    re.IGNORECASE,
)

CONCURRENCY = 8  # polite — ~8 req/sec sustained
REQUEST_TIMEOUT = 8.0


async def _probe(client: httpx.AsyncClient, base: str, path: str,
                 sem: asyncio.Semaphore) -> Optional[NormalizedEvent]:
    async with sem:
        url = f"{base}/{path}"
        try:
            resp = await client.get(url, timeout=REQUEST_TIMEOUT, follow_redirects=False)
        except Exception:
            return None

        if resp.status_code not in INTERESTING_STATUS:
            return None

        body = ""
        try:
            body = resp.text[:2000] if resp.text else ""
        except Exception:
            pass

        secret_hits = SECRET_REGEX.findall(body) if body else []

        now = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
        event_id = hashlib.md5(f"dir-{url}-{now}".encode()).hexdigest()
        return NormalizedEvent(
            id=event_id,
            timestamp=now,
            source=EventSource.DIR_PROBE,
            event_type=EventType.DISCOVERED_PATH,
            subject=f"/{path}",
            details={
                "url": url,
                "status_code": resp.status_code,
                "content_type": resp.headers.get("content-type", ""),
                "content_length": len(resp.content),
                "redirect_to": resp.headers.get("location", ""),
                "server": resp.headers.get("server", ""),
                "preview": body[:300],
                "suspicious_secrets_in_body": list(set(secret_hits))[:5],
            },
            confidence=Confidence.EXACT,
        )


async def fetch(domain: str, client: httpx.AsyncClient) -> List[NormalizedEvent]:
    base = f"https://{domain}"
    sem = asyncio.Semaphore(CONCURRENCY)
    tasks = [_probe(client, base, p, sem) for p in WORDLIST]
    results = await asyncio.gather(*tasks)
    findings = [r for r in results if r is not None]
    log.info("dir_probe: %d interesting paths on %s", len(findings), domain)
    return findings
