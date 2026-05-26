import asyncio
import hashlib
import json
import httpx
from datetime import datetime, timezone
from typing import Dict, List, Optional
from app.models.event import ScanJob, NormalizedEvent, ScanRequest
from app.cache import sqlite_store
from app.connectors import wayback, crt_sh, rdap, dns_resolver
from app.connectors.enrichment import shodan, virustotal, hibp
from app.connectors.active import (
    port_scan, port_scan_full, http_fingerprint, tls_inspect, well_known,
    dns_axfr, dir_probe,
)

ACTIVE_MODULE_MAP = {
    "port_scan": port_scan,
    "port_scan_full": port_scan_full,
    "http_probe": http_fingerprint,
    "tls_live": tls_inspect,
    "well_known": well_known,
    "dns_axfr": dns_axfr,
    "dir_probe": dir_probe,
}

# In-memory progress queues: job_id -> asyncio.Queue
_queues: Dict[str, asyncio.Queue] = {}


def get_queue(job_id: str) -> Optional[asyncio.Queue]:
    return _queues.get(job_id)


def _now() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def _make_job_id(domain: str) -> str:
    ts = _now()
    return hashlib.md5(f"{domain}-{ts}".encode()).hexdigest()[:16]


async def start_scan(request: ScanRequest) -> ScanJob:
    domain = request.domain.lower().strip().rstrip("/")
    if domain.startswith("http://") or domain.startswith("https://"):
        from urllib.parse import urlparse
        domain = urlparse(domain).netloc

    job_id = _make_job_id(domain)
    queue: asyncio.Queue = asyncio.Queue()
    _queues[job_id] = queue

    core_connectors = ["wayback", "crt_sh", "rdap", "dns"]
    enrichment_connectors = list(request.enabled_enrichment.keys())

    # Validate active modules — require explicit authorization + re-typed domain
    active_modules: List[str] = []
    if request.active_modules:
        if not request.active_authorization_confirmed:
            raise ValueError("active_authorization_confirmed must be true to enable active probing")
        if (request.active_domain_typed or "").strip().lower() != domain.lower():
            raise ValueError("active_domain_typed must match the target domain exactly")
        active_modules = [m for m in request.active_modules if m in ACTIVE_MODULE_MAP]

    all_sources = core_connectors + enrichment_connectors + active_modules

    job = ScanJob(
        job_id=job_id,
        domain=domain,
        status="running",
        progress=0,
        created_at=_now(),
        sources_total=len(all_sources),
    )
    await sqlite_store.save_job(job)
    await sqlite_store.log_audit(job_id, domain, "scan_started", _now())

    asyncio.create_task(_run_scan(job, request, queue, all_sources, active_modules))
    return job


async def _run_scan(
    job: ScanJob,
    request: ScanRequest,
    queue: asyncio.Queue,
    all_sources: List[str],
    active_modules: List[str] = None,
):
    active_modules = active_modules or []
    domain = job.domain
    all_events: List[NormalizedEvent] = []
    completed = 0
    total = len(all_sources)

    async with httpx.AsyncClient(
        headers={"User-Agent": "ChronoTrace/1.0 OSINT-Research"},
        follow_redirects=True,
    ) as client:

        async def run_connector(name: str, coro):
            nonlocal completed
            try:
                events = await coro
                all_events.extend(events)
                completed += 1
                progress = int((completed / total) * 100)
                await queue.put({
                    "type": "progress",
                    "source": name,
                    "events_count": len(events),
                    "progress": progress,
                })
            except Exception as e:
                completed += 1
                await queue.put({
                    "type": "error",
                    "source": name,
                    "message": str(e),
                    "progress": int((completed / total) * 100),
                })

        tasks = [
            run_connector("wayback", wayback.fetch(domain, client)),
            run_connector("crt_sh", crt_sh.fetch(domain, client)),
            run_connector("rdap", rdap.fetch(domain, client)),
            run_connector("dns", dns_resolver.fetch(domain, client)),
        ]

        enrichment = request.enabled_enrichment
        if "shodan" in enrichment:
            tasks.append(run_connector("shodan", shodan.fetch(domain, client, enrichment["shodan"])))
        if "virustotal" in enrichment:
            tasks.append(run_connector("virustotal", virustotal.fetch(domain, client, enrichment["virustotal"])))
        if "hibp" in enrichment:
            tasks.append(run_connector("hibp", hibp.fetch(domain, client, enrichment["hibp"])))

        # Active modules (Tier 2) — port_scan_full is held back so it doesn't
        # exhaust the OS ephemeral-port pool while other HTTP connectors are running.
        socket_heavy = {"port_scan_full"}
        light_active = [m for m in active_modules if m not in socket_heavy]
        heavy_active = [m for m in active_modules if m in socket_heavy]

        for mod_name in light_active:
            mod = ACTIVE_MODULE_MAP[mod_name]
            tasks.append(run_connector(mod_name, mod.fetch(domain, client)))

        # Phase 1: passive + light active concurrent
        await asyncio.gather(*tasks)

        # Phase 2: socket-heavy modules sequentially, alone
        for mod_name in heavy_active:
            mod = ACTIVE_MODULE_MAP[mod_name]
            await run_connector(mod_name, mod.fetch(domain, client))

    # Sort events chronologically
    all_events.sort(key=lambda e: e.timestamp)

    # Deduplicate by id
    seen = set()
    unique_events = []
    for e in all_events:
        if e.id not in seen:
            seen.add(e.id)
            unique_events.append(e)

    job.events = unique_events
    job.status = "completed"
    job.progress = 100
    job.completed_at = _now()
    job.sources_completed = all_sources

    await sqlite_store.save_job(job)
    await sqlite_store.log_audit(job.job_id, domain, "scan_completed", _now())

    await queue.put({"type": "done", "job_id": job.job_id, "total_events": len(unique_events)})

    # Clean up queue after a delay
    await asyncio.sleep(60)
    _queues.pop(job.job_id, None)
