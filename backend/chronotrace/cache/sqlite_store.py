import aiosqlite
import json
import os
from typing import Optional, List
from chronotrace.models.event import ScanJob, NormalizedEvent

DB_PATH = os.getenv("DB_PATH", "chronotrace.db")


async def init_db():
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute("""
            CREATE TABLE IF NOT EXISTS scan_jobs (
                job_id TEXT PRIMARY KEY,
                domain TEXT NOT NULL,
                status TEXT NOT NULL,
                progress INTEGER DEFAULT 0,
                events TEXT DEFAULT '[]',
                created_at TEXT NOT NULL,
                completed_at TEXT,
                error TEXT,
                sources_completed TEXT DEFAULT '[]',
                sources_total INTEGER DEFAULT 0
            )
        """)
        await db.execute("""
            CREATE TABLE IF NOT EXISTS audit_log (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                job_id TEXT,
                domain TEXT NOT NULL,
                action TEXT NOT NULL,
                timestamp TEXT NOT NULL
            )
        """)
        await db.execute("""
            CREATE TABLE IF NOT EXISTS api_keys (
                source TEXT PRIMARY KEY,
                encrypted_key TEXT NOT NULL,
                updated_at TEXT NOT NULL
            )
        """)
        await db.commit()


async def save_job(job: ScanJob):
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute("""
            INSERT OR REPLACE INTO scan_jobs
            (job_id, domain, status, progress, events, created_at, completed_at, error, sources_completed, sources_total)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            job.job_id,
            job.domain,
            job.status,
            job.progress,
            json.dumps([e.model_dump() for e in job.events]),
            job.created_at,
            job.completed_at,
            job.error,
            json.dumps(job.sources_completed),
            job.sources_total,
        ))
        await db.commit()


async def get_job(job_id: str) -> Optional[ScanJob]:
    async with aiosqlite.connect(DB_PATH) as db:
        async with db.execute(
            "SELECT * FROM scan_jobs WHERE job_id = ?", (job_id,)
        ) as cursor:
            row = await cursor.fetchone()
            if not row:
                return None
            return _row_to_job(row)


async def get_jobs_for_domain(domain: str) -> List[ScanJob]:
    async with aiosqlite.connect(DB_PATH) as db:
        async with db.execute(
            "SELECT * FROM scan_jobs WHERE domain = ? ORDER BY created_at DESC", (domain,)
        ) as cursor:
            rows = await cursor.fetchall()
            return [_row_to_job(r) for r in rows]


async def list_recent_jobs(limit: int = 20) -> List[ScanJob]:
    async with aiosqlite.connect(DB_PATH) as db:
        async with db.execute(
            "SELECT * FROM scan_jobs ORDER BY created_at DESC LIMIT ?", (limit,)
        ) as cursor:
            rows = await cursor.fetchall()
            return [_row_to_job(r) for r in rows]


async def log_audit(job_id: str, domain: str, action: str, timestamp: str):
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute(
            "INSERT INTO audit_log (job_id, domain, action, timestamp) VALUES (?, ?, ?, ?)",
            (job_id, domain, action, timestamp)
        )
        await db.commit()


def _row_to_job(row) -> ScanJob:
    events_data = json.loads(row[4])
    events = [NormalizedEvent(**e) for e in events_data]
    return ScanJob(
        job_id=row[0],
        domain=row[1],
        status=row[2],
        progress=row[3],
        events=events,
        created_at=row[5],
        completed_at=row[6],
        error=row[7],
        sources_completed=json.loads(row[8]),
        sources_total=row[9],
    )
