# ChronoTrace

**Zero-cost OSINT domain reconnaissance & historical timeline platform.**

Aggregates Wayback Machine, Certificate Transparency, RDAP, and live DNS into one correlated, interactive timeline. Designed for authorized security research and threat-intelligence work.

---

## Quick Start

### Backend

```bash
cd backend
python -m venv venv
venv\Scripts\activate        # Windows
pip install -r requirements.txt

# Generate an encryption key and copy .env.example → .env
python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
copy .env.example .env       # then paste the key as ENCRYPTION_KEY=...

uvicorn app.main:app --reload --port 8000
```

The API will be available at `http://localhost:8000`. Interactive docs at `http://localhost:8000/docs`.

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Open `http://localhost:5173`.

---

## Architecture

```
ChronoTrace/
├── backend/
│   └── app/
│       ├── main.py              # FastAPI app + CORS + lifespan
│       ├── models/event.py      # Pydantic: NormalizedEvent, ScanJob, etc.
│       ├── connectors/
│       │   ├── wayback.py       # Wayback Machine CDX API
│       │   ├── crt_sh.py        # Certificate Transparency (crt.sh)
│       │   ├── rdap.py          # RDAP registration data
│       │   ├── dns_resolver.py  # Live DNS resolution (dnspython)
│       │   └── enrichment/
│       │       ├── shodan.py
│       │       ├── virustotal.py
│       │       └── hibp.py
│       ├── workers/scan_worker.py  # Async fan-out orchestrator + SSE queue
│       ├── cache/sqlite_store.py   # SQLite persistence (aiosqlite)
│       └── api/routes.py           # REST + SSE endpoints
└── frontend/
    └── src/
        ├── App.tsx                 # Root layout + state wiring
        ├── hooks/
        │   ├── useScan.ts          # Scan lifecycle state machine
        │   └── useSSE.ts           # Server-Sent Events client
        ├── components/
        │   ├── Timeline.tsx        # vis-timeline integration
        │   ├── FilterPanel.tsx     # Source / type / date / search filters
        │   ├── EventDetail.tsx     # Selected event detail panel
        │   ├── ScanProgress.tsx    # Live progress during scan
        │   ├── ScopeModal.tsx      # Authorization confirmation gate
        │   ├── ApiKeyVault.tsx     # Optional enrichment key storage
        │   ├── HistoryPanel.tsx    # Past scan history
        │   ├── CompareView.tsx     # Side-by-side snapshot comparison
        │   └── ExportPanel.tsx     # JSON / CSV / HTML export
        └── types/index.ts          # Shared TypeScript types + color maps
```

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/scans` | Start a new scan |
| GET | `/api/scans/{job_id}` | Get completed scan results |
| GET | `/api/scans/{job_id}/stream` | SSE live progress stream |
| GET | `/api/history` | Recent scan history |
| POST | `/api/export` | Export results (JSON/CSV/HTML) |

## Free Core Sources

| Source | What it provides |
|--------|-----------------|
| Wayback Machine CDX | Content snapshots + historical URLs |
| crt.sh | Certificate Transparency logs + subdomains |
| RDAP | Domain registration dates + registrar |
| Live DNS | Current A, AAAA, MX, NS, TXT, CNAME records |

## Optional Enrichment (user-supplied keys)

| Source | Provides |
|--------|----------|
| Shodan | Host/port exposure, banners |
| VirusTotal | Reputation, passive DNS |
| Have I Been Pwned | Breach associations |

## Responsible Use

ChronoTrace is designed for **authorized** use only: domains you own, domains you are contracted to assess, or public threat-intelligence research. The scope confirmation prompt is a hard gate — it cannot be bypassed. Unauthorized reconnaissance may violate the CFAA and equivalent laws.
