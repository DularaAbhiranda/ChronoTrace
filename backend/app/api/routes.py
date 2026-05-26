import json
import asyncio
import csv
import io
from typing import Optional
from fastapi import APIRouter, HTTPException, BackgroundTasks
from fastapi.responses import StreamingResponse, JSONResponse
from app.models.event import ScanRequest, ExportRequest
from app.workers import scan_worker
from app.cache import sqlite_store

router = APIRouter()


@router.post("/scans")
async def create_scan(request: ScanRequest):
    if not request.confirmed_authorization:
        raise HTTPException(status_code=400, detail="Authorization confirmation required before scanning.")

    try:
        job = await scan_worker.start_scan(request)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return {"job_id": job.job_id, "domain": job.domain, "status": job.status}


@router.get("/scans/{job_id}")
async def get_scan(job_id: str):
    job = await sqlite_store.get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    return job


@router.get("/scans/{job_id}/stream")
async def stream_scan(job_id: str):
    """Server-Sent Events stream for live scan progress."""
    job = await sqlite_store.get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    async def event_generator():
        if job.status == "completed":
            data = json.dumps({"type": "done", "job_id": job_id, "total_events": len(job.events)})
            yield f"data: {data}\n\n"
            return

        queue = scan_worker.get_queue(job_id)
        if not queue:
            data = json.dumps({"type": "error", "message": "Queue not available"})
            yield f"data: {data}\n\n"
            return

        while True:
            try:
                msg = await asyncio.wait_for(queue.get(), timeout=30.0)
                yield f"data: {json.dumps(msg)}\n\n"
                if msg.get("type") == "done":
                    break
            except asyncio.TimeoutError:
                yield f"data: {json.dumps({'type': 'ping'})}\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )


@router.get("/history")
async def get_history(limit: int = 20):
    jobs = await sqlite_store.list_recent_jobs(limit)
    return [
        {
            "job_id": j.job_id,
            "domain": j.domain,
            "status": j.status,
            "created_at": j.created_at,
            "completed_at": j.completed_at,
            "total_events": len(j.events),
        }
        for j in jobs
    ]


@router.get("/history/{domain}")
async def get_domain_history(domain: str):
    jobs = await sqlite_store.get_jobs_for_domain(domain)
    return jobs


@router.post("/export")
async def export_results(request: ExportRequest):
    job = await sqlite_store.get_job(request.job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    events = job.events
    if request.filters:
        sources = request.filters.get("sources")
        types = request.filters.get("event_types")
        if sources:
            events = [e for e in events if e.source.value in sources]
        if types:
            events = [e for e in events if e.event_type.value in types]

    if request.format == "json":
        return JSONResponse(content={
            "domain": job.domain,
            "scan_id": job.job_id,
            "completed_at": job.completed_at,
            "total_events": len(events),
            "events": [e.model_dump() for e in events],
        })

    if request.format == "csv":
        output = io.StringIO()
        writer = csv.DictWriter(output, fieldnames=["timestamp", "source", "event_type", "subject", "confidence"])
        writer.writeheader()
        for e in events:
            writer.writerow({
                "timestamp": e.timestamp,
                "source": e.source.value,
                "event_type": e.event_type.value,
                "subject": e.subject,
                "confidence": e.confidence.value,
            })
        return StreamingResponse(
            iter([output.getvalue()]),
            media_type="text/csv",
            headers={"Content-Disposition": f"attachment; filename=chronotrace-{job.domain}.csv"},
        )

    if request.format == "html":
        rows = "".join(
            f"<tr><td>{e.timestamp}</td><td>{e.source.value}</td>"
            f"<td>{e.event_type.value}</td><td>{e.subject}</td></tr>"
            for e in events
        )
        html = f"""<!DOCTYPE html>
<html><head><title>ChronoTrace - {job.domain}</title>
<style>body{{font-family:monospace;background:#0d1117;color:#e6edf3;padding:2rem}}
table{{border-collapse:collapse;width:100%}}th,td{{border:1px solid #30363d;padding:8px;text-align:left}}
th{{background:#161b22}}tr:nth-child(even){{background:#161b22}}</style></head>
<body><h1>ChronoTrace Report: {job.domain}</h1>
<p>Scan ID: {job.job_id} | Completed: {job.completed_at} | Total Events: {len(events)}</p>
<table><thead><tr><th>Timestamp</th><th>Source</th><th>Type</th><th>Subject</th></tr></thead>
<tbody>{rows}</tbody></table></body></html>"""
        return StreamingResponse(
            iter([html]),
            media_type="text/html",
            headers={"Content-Disposition": f"attachment; filename=chronotrace-{job.domain}.html"},
        )

    raise HTTPException(status_code=400, detail="Invalid format. Use json, csv, or html.")
