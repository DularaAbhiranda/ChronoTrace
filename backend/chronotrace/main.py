import os
import logging
from pathlib import Path
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from dotenv import load_dotenv
from chronotrace.cache import sqlite_store
from chronotrace.api.routes import router

# Surface connector logging — INFO and above
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s: %(message)s",
)
# Quiet noisy libs
logging.getLogger("httpx").setLevel(logging.WARNING)
logging.getLogger("httpcore").setLevel(logging.WARNING)

load_dotenv()


@asynccontextmanager
async def lifespan(app: FastAPI):
    await sqlite_store.init_db()
    yield


app = FastAPI(
    title="ChronoTrace API",
    description="Zero-Cost OSINT Reconnaissance & Historical Analysis",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000", "*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(router, prefix="/api")


@app.get("/health")
async def health():
    return {"status": "ok", "service": "ChronoTrace"}


# ── Single-server mode: serve the built frontend (frontend/dist) ──
# After `npm run build`, the REST API and the web UI are served from this one
# process — no separate Vite dev server or proxy needed. Registered last, so
# /api/* and /health always take precedence over the SPA catch-all below.
_FRONTEND_DIST = (Path(__file__).resolve().parents[2] / "frontend" / "dist").resolve()
if _FRONTEND_DIST.is_dir():
    @app.get("/")
    async def _spa_index():
        return FileResponse(_FRONTEND_DIST / "index.html")

    @app.get("/{full_path:path}")
    async def _spa_catch_all(full_path: str):
        candidate = (_FRONTEND_DIST / full_path).resolve()
        if candidate.is_file() and candidate.is_relative_to(_FRONTEND_DIST):
            return FileResponse(candidate)
        # Unknown path → hand back index.html so the single-page app can route it.
        return FileResponse(_FRONTEND_DIST / "index.html")
