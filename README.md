# ChronoTrace

**Domain history & OSINT timeline tool.** Pip-installable command-line tool plus optional web UI.

Aggregates Wayback Machine, Certificate Transparency (crt.sh), RDAP, and live DNS into one correlated timeline. Optional Tier 2 active modules (port scan, AXFR, directory probe, TLS inspection, HTTP fingerprint, well-known harvesting) for authorized targets.

Designed for security research, authorized pentest reconnaissance, brand-abuse investigation, and incident-response timeline reconstruction.

---

## Install as a CLI tool (Kali-style)

```bash
git clone https://github.com/DularaAbhiranda/ChronoTrace.git
cd ChronoTrace/backend
pip install -e .
```

This puts a `chronotrace` command on your `$PATH`. On Kali / Debian, you may want to use `pipx` instead so it doesn't touch system packages:

```bash
pipx install ./backend
```

## Usage

```bash
chronotrace example.com                                    # passive only — Wayback, crt.sh, RDAP, DNS
chronotrace example.com --active                           # adds safe active modules (no full port scan)
chronotrace example.com --full                             # everything including 65535-port scan (~10-15 min)
chronotrace example.com --port-scan --axfr --dir-probe     # specific modules
chronotrace example.com --only wayback,crt_sh              # exclusive source list
chronotrace example.com --json -o results.json             # save JSON
chronotrace example.com --csv -o results.csv               # save CSV
chronotrace example.com --shodan-key XYZ                   # enrichment with API key
chronotrace --list-modules                                 # show all modules
chronotrace --help
```

Active modules require authorization. Without `-y`, you'll be prompted to retype the target domain to confirm.

### Output formats

| Flag | Output |
|---|---|
| (default) | Pretty colored terminal tables with summary panel |
| `--json` | JSON to stdout (or `-o file.json`) |
| `--csv` | CSV to stdout (or `-o file.csv`) |
| `--quiet` | Suppress banner & progress, just data |
| `--no-color` | Plain text (good for pipes / log files) |

### Sources & modules

```
PASSIVE                       ACTIVE (require authorization)
  wayback                       port_scan         — top 20 common ports
  crt_sh                        port_scan_full    — full 1-65535
  rdap                          http_probe        — live HTTP fingerprint
  dns                           tls_live          — real TLS handshake
ENRICHMENT (BYO API key)        well_known        — robots.txt, sitemap, .well-known
  shodan, virustotal, hibp      dns_axfr          — DNS zone-transfer attempt
                                dir_probe         — ~150 high-value paths
```

---

## Web UI (optional)

If you want the visual timeline, color-coded vis-timeline, side-by-side Wayback comparison, etc.:

### Backend

```bash
cd backend
python -m venv venv
venv\Scripts\activate                        # Windows  (Linux: source venv/bin/activate)
pip install -r requirements.txt
uvicorn chronotrace.main:app --port 8001
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Open <http://localhost:5173>.

---

## Architecture

```
ChronoTrace/
├── backend/
│   ├── pyproject.toml                  # Pip-installable, exposes `chronotrace` command
│   └── chronotrace/
│       ├── cli.py                      # ★ Command-line interface
│       ├── main.py                     # FastAPI app (optional web UI)
│       ├── models/event.py             # Pydantic schemas (NormalizedEvent, ScanJob)
│       ├── connectors/
│       │   ├── wayback.py              # Wayback CDX (paginated, retry-with-backoff)
│       │   ├── crt_sh.py               # crt.sh (retry-with-backoff on 502/503)
│       │   ├── rdap.py                 # Registration data
│       │   ├── dns_resolver.py         # Live DNS (dnspython)
│       │   ├── active/                 # ★ Tier 2 active modules
│       │   │   ├── port_scan.py        # Top-20 TCP connect
│       │   │   ├── port_scan_full.py   # Chunked 1-65535
│       │   │   ├── http_fingerprint.py # Headers, tech, security audit
│       │   │   ├── tls_inspect.py      # Real TLS handshake
│       │   │   ├── well_known.py       # robots.txt, sitemap, security.txt
│       │   │   ├── dns_axfr.py         # Zone transfer attempt
│       │   │   └── dir_probe.py        # 150-path directory probe
│       │   └── enrichment/             # Shodan, VirusTotal, HIBP (BYO key)
│       ├── workers/scan_worker.py      # Async orchestration + SSE queue
│       ├── cache/sqlite_store.py       # SQLite persistence
│       └── api/routes.py               # REST + SSE endpoints
└── frontend/                           # React + Vite + vis-timeline UI
    └── src/
        ├── App.tsx
        ├── components/
        │   ├── Timeline.tsx
        │   ├── FilterPanel.tsx
        │   ├── EventDetail.tsx
        │   ├── ScopeModal.tsx          # Authorization confirmation gate
        │   ├── ActiveProbePanel.tsx    # Tier 2 module toggles
        │   ├── HistoryPanel.tsx
        │   ├── CompareView.tsx
        │   └── ExportPanel.tsx
        └── types/index.ts
```

## API Endpoints (web UI mode)

| Method | Path | Description |
|---|---|---|
| POST | `/api/scans` | Start a new scan |
| GET | `/api/scans/{job_id}` | Get scan results |
| GET | `/api/scans/{job_id}/stream` | SSE live progress |
| GET | `/api/history` | Recent scans |
| POST | `/api/export` | Export (JSON/CSV/HTML) |

## Responsible Use

ChronoTrace is for **authorized** use only: domains you own, domains you're contracted to assess, or public threat-intelligence research.

- The CLI prompts you to retype the target domain before any active module runs.
- The web UI's scope modal is a hard gate — it cannot be bypassed.
- Active modules send live requests and will appear in target server logs / IDS.

Unauthorized reconnaissance may violate the CFAA, GDPR Article 32, and equivalent laws.
