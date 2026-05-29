<div align="center">

<pre>
 ██████╗██╗  ██╗██████╗  ██████╗ ███╗   ██╗ ██████╗ ████████╗██████╗  █████╗  ██████╗███████╗
██╔════╝██║  ██║██╔══██╗██╔═══██╗████╗  ██║██╔═══██╗╚══██╔══╝██╔══██╗██╔══██╗██╔════╝██╔════╝
██║     ███████║██████╔╝██║   ██║██╔██╗ ██║██║   ██║   ██║   ██████╔╝███████║██║     █████╗
██║     ██╔══██║██╔══██╗██║   ██║██║╚██╗██║██║   ██║   ██║   ██╔══██╗██╔══██║██║     ██╔══╝
╚██████╗██║  ██║██║  ██║╚██████╔╝██║ ╚████║╚██████╔╝   ██║   ██║  ██║██║  ██║╚██████╗███████╗
 ╚═════╝╚═╝  ╚═╝╚═╝  ╚═╝ ╚═════╝ ╚═╝  ╚═══╝ ╚═════╝    ╚═╝   ╚═╝  ╚═╝╚═╝  ╚═╝ ╚═════╝╚══════╝
</pre>

### &gt; Domain History · Certificate Transparency · Active Recon

<p>
<img src="https://img.shields.io/badge/python-3.10+-00ff66?style=flat-square&logo=python&logoColor=white" alt="Python 3.10+">
<img src="https://img.shields.io/badge/license-MIT-00ff66?style=flat-square" alt="MIT License">
<img src="https://img.shields.io/badge/platform-Kali%20%7C%20Ubuntu%20%7C%20macOS%20%7C%20Windows-1f6feb?style=flat-square" alt="Platforms">
<img src="https://img.shields.io/badge/interfaces-CLI%20%2B%20Web-1f6feb?style=flat-square" alt="CLI + Web">
<img src="https://img.shields.io/badge/PRs-welcome-00ff66?style=flat-square" alt="PRs Welcome">
</p>

<p><b>Reconstruct any domain's complete digital history.</b><br/>
A pip-installable, Kali-style OSINT CLI (plus a React web UI) that fuses the Wayback Machine,<br/>
Certificate Transparency, RDAP, live DNS, and seven opt-in active-recon modules into one correlated timeline.</p>

<p>
<a href="#-installation">Install</a> ·
<a href="#-cli-usage">Usage</a> ·
<a href="#-web-interface">Web&nbsp;UI</a> ·
<a href="#-recipes-by-role">Recipes</a> ·
<a href="#-contributing--development">Contribute</a> ·
<a href="landing.html">Showcase&nbsp;page</a>
</p>

<sub><code>11 data sources</code> · <code>7 active modules</code> · <code>65535 ports scannable</code> · <code>~90s passive scan</code> · <code>$0 to start</code></sub>

</div>

---

ChronoTrace aggregates the **Wayback Machine, Certificate Transparency (crt.sh), RDAP, and live DNS** into one chronological, correlated timeline — then optionally layers in **Tier 2 active modules** (port scan, AXFR, directory probe, TLS inspection, HTTP fingerprint, well-known harvesting) against targets you're authorized to test.

Built for **security research, authorized pentest reconnaissance, brand-abuse investigation, and incident-response timeline reconstruction** — two front doors over the same engine: a Kali-style CLI and a real-time web UI.

---

## ✨ Features

**CLI capabilities**

- **Passive aggregation** — Wayback CDX, crt.sh CT logs, RDAP registration, and live DNS, all queried in parallel in ~90 seconds. The target never sees a packet.
- **Active probing (opt-in)** — seven Tier 2 modules behind a hard authorization gate: top-20 or full `1–65535` port scan, service-aware banner grab, live HTTP fingerprint with security-header audit, real TLS handshake inspection, well-known harvesting, DNS zone-transfer attempt, and a polite ~150-path directory probe.
- **Pipe-friendly output** — Rich-rendered tables by default; `--json`/`--csv` for downstream tooling; `--quiet`/`--no-color` for scripts and cron. Built to chain into nuclei, nmap, ffuf, and Burp.
- **Authorization-gated** — active modules require you to retype the target domain (or pass `-y`) before any live traffic is sent. Every scan is audit-logged.

**Web interface**

- **Interactive timeline** — zoomable/pannable [vis-timeline](https://visjs.github.io/vis-timeline/) with color-coded lanes per source.
- **Live SSE progress** — connectors stream results as they finish; the timeline populates in real time, no polling.
- **Filter panel** — by source, event type, date range, and keyword simultaneously.
- **Export & compare** — full or filtered slice to JSON/CSV; overlay two domain timelines side-by-side.
- **API-key vault** — enable enrichment sources by pasting keys (stored in your browser only).
- **Scan history** — every completed job is persisted and instantly reloadable.

---

## 📡 Data Sources

| Source | Tier | Access | What it surfaces |
|---|---|---|---|
| 🕰️ **Wayback Machine** | Passive | Free | Historical snapshots with permanent citation URLs (up to 5,000/scan) |
| 🔒 **crt.sh** | Passive | Free | Every TLS cert ever issued — subdomains + first-seen dates |
| 📋 **RDAP** | Passive | Free | Registrar, creation/expiry dates, nameservers, status |
| 🌐 **DNS (live)** | Passive | Free | A / AAAA / MX / TXT / NS / CNAME — anchors present-day state |
| 🔍 **Shodan** | Enrichment | API key | Open ports, service banners, exposure history |
| 🛡️ **VirusTotal** | Enrichment | API key | Malware associations, URL verdicts, vendor analysis |
| 🚨 **HIBP** | Enrichment | API key | Breach records associated with the domain |
| 📡 **SecurityTrails** | Enrichment | API key | Historical DNS & IP history *(planned — [help wanted](#-good-first-contributions))* |

Active modules (`port_scan`, `port_scan_full`, `http_probe`, `tls_live`, `well_known`, `dns_axfr`, `dir_probe`) are off by default — see [CLI Usage](#-cli-usage).

---

## ⚡ Installation

<a id="-installation"></a>

ChronoTrace installs a `chronotrace` command on your `$PATH`, alongside `nmap`, `sqlmap`, and `hydra`.

**Kali · Ubuntu · macOS** (via `pipx`, recommended so it doesn't touch system packages):

```bash
sudo apt install -y pipx jq          # Debian/Kali; macOS: brew install pipx jq
pipx ensurepath
git clone https://github.com/DularaAbhiranda/ChronoTrace.git
cd ChronoTrace
pipx install ./backend
chronotrace --version
# chronotrace 1.0.0
```

**Windows · PowerShell:**

```powershell
python -m pip install --user pipx
python -m pipx ensurepath
git clone https://github.com/DularaAbhiranda/ChronoTrace.git
cd ChronoTrace
pipx install .\backend
chronotrace --version
```

> Prefer a plain editable install for hacking on it? `pip install -e ./backend` (ideally inside a virtualenv).

---

## 🚀 CLI Usage

<a id="-cli-usage"></a>

```bash
chronotrace example.com                                    # passive only — Wayback, crt.sh, RDAP, DNS
chronotrace example.com --active                           # adds safe active modules (no full port scan)
chronotrace example.com --full                             # everything incl. 65535-port scan (~10-15 min)
chronotrace example.com --port-scan --axfr --dir-probe     # specific modules
chronotrace example.com --only wayback,crt_sh              # exclusive source list
chronotrace example.com --json -o results.json             # save JSON
chronotrace example.com --csv  -o results.csv              # save CSV
chronotrace example.com --shodan-key XYZ                   # enrichment with API key
chronotrace --list-modules                                 # show all modules
chronotrace --help
```

Active modules require authorization. Without `-y`, you'll be prompted to **retype the target domain** to confirm.

**Output formats**

| Flag | Output |
|---|---|
| *(default)* | Pretty colored terminal tables with summary panel |
| `--json` | JSON to stdout (or `-o file.json`) |
| `--csv` | CSV to stdout (or `-o file.csv`) |
| `--quiet` | Suppress banner & progress, just data |
| `--no-color` | Plain text (good for pipes / log files) |

**Sources & modules**

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

## 🖥️ Web Interface

<a id="-web-interface"></a>

For the visual timeline, color-coded lanes, live progress, and side-by-side comparison:

**Backend**

```bash
cd backend
python -m venv venv
venv\Scripts\activate                  # Windows  (Linux/macOS: source venv/bin/activate)
pip install -r requirements.txt
uvicorn chronotrace.main:app --port 8001
```

**Frontend**

```bash
cd frontend
npm install
npm run dev
```

Open <http://localhost:5173>.

---

## 🎯 Recipes by Role

| # | You are a… | Command |
|---|---|---|
| 01 | Curious explorer | `chronotrace example.com` |
| 02 | Site owner / DevSec | `chronotrace mysite.com --active -y` |
| 03 | Authorized pentester | `chronotrace target.com --full -y -o recon.json --json` |
| 04 | Brand-abuse investigator | `chronotrace fake-brand.tld --only wayback,crt_sh,rdap` |
| 05 | Incident responder | `chronotrace affected.com --json -o ir-timeline.json` |
| 06 | Journalist / researcher | `chronotrace newssite.com --only wayback` |

Full walkthroughs are in the [User Guide](ChronoTrace_User_Guide.docx) (50 pages).

---

## 🏗️ Architecture

```
ChronoTrace/
├── backend/
│   ├── pyproject.toml                  # Pip-installable, exposes `chronotrace`
│   ├── requirements.txt
│   └── chronotrace/
│       ├── cli.py                      # ★ Command-line interface
│       ├── main.py                     # FastAPI app (web UI)
│       ├── models/event.py            # Pydantic schemas (NormalizedEvent, ScanJob, …)
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
│       ├── cache/sqlite_store.py       # SQLite persistence + audit log
│       └── api/routes.py               # REST + SSE endpoints
└── frontend/                           # React + Vite + vis-timeline UI
    └── src/
        ├── App.tsx
        ├── hooks/        useScan.ts, useSSE.ts
        ├── components/   Timeline · FilterPanel · EventDetail · ScopeModal
        │                 ActiveProbePanel · HistoryPanel · CompareView · ExportPanel
        └── types/index.ts
```

**API endpoints (web UI mode)**

| Method | Path | Description |
|---|---|---|
| POST | `/api/scans` | Start a new scan |
| GET | `/api/scans/{job_id}` | Get scan results |
| GET | `/api/scans/{job_id}/stream` | SSE live progress |
| GET | `/api/history` | Recent scans |
| POST | `/api/export` | Export (JSON/CSV/HTML) |

---

## 🤝 Contributing & Development

<a id="-contributing--development"></a>

**Contributions are very welcome** — whether that's a new data source, an active module, better output, docs, tests, or just a well-written bug report. ChronoTrace is intentionally modular so adding a source is a small, self-contained change.

### Dev setup

```bash
git clone https://github.com/DularaAbhiranda/ChronoTrace.git
cd ChronoTrace

# Backend (editable install so code changes take effect immediately)
cd backend
python -m venv venv
venv\Scripts\activate                  # Linux/macOS: source venv/bin/activate
pip install -e .
pip install -r requirements.txt

# Frontend (only if you're touching the web UI)
cd ../frontend
npm install
npm run dev
```

Run a scan against a domain **you own** to confirm everything works:

```bash
chronotrace your-own-domain.com --json | jq '.events | length'
```

### <a id="-good-first-contributions"></a>Good first contributions

- **🟢 Implement the SecurityTrails connector** — it's already declared in the `EventSource` enum but has no module yet. A great first PR (see the recipe below).
- **🟢 Add a new passive source** — VirusTotal-style passive DNS, Censys, URLScan, etc.
- **🟡 Add a new active module** — must be opt-in and authorization-gated (see [Ground rules](#ground-rules)).
- **🟡 Improve output** — an HTML report exporter, a `--diff` between two scans, richer table formatting.
- **🟢 Tests** — there's no automated test suite yet; connector unit tests (with recorded fixtures) are high-impact and very welcome.
- **🟢 Docs & recipes** — new role-based workflows, screenshots, the showcase page.

### Anatomy of a connector

Every source is a module exposing one async function that returns a list of `NormalizedEvent`. Passive connectors take `(domain, client)`; enrichment connectors also take an `api_key`. Here's the full pattern (mirrors [`rdap.py`](backend/chronotrace/connectors/rdap.py)):

```python
# backend/chronotrace/connectors/securitytrails.py
import hashlib
import httpx
from typing import List
from chronotrace.models.event import (
    NormalizedEvent, EventSource, EventType, Confidence,
)

async def fetch(domain: str, client: httpx.AsyncClient, api_key: str) -> List[NormalizedEvent]:
    events: List[NormalizedEvent] = []
    try:
        resp = await client.get(
            f"https://api.securitytrails.com/v1/history/{domain}/dns/a",
            headers={"APIKEY": api_key}, timeout=20.0,
        )
        resp.raise_for_status()
        for rec in resp.json().get("records", []):
            events.append(NormalizedEvent(
                id=hashlib.md5(f"st-{domain}-{rec['first_seen']}".encode()).hexdigest(),
                timestamp=rec["first_seen"],          # ISO-8601, e.g. 2024-01-30T00:00:00Z
                source=EventSource.SECURITYTRAILS,
                event_type=EventType.DNS_RECORD,
                subject=domain,
                details={"values": rec.get("values", [])},
                confidence=Confidence.EXACT,
            ))
    except Exception:
        pass                                          # a flaky source must never crash the scan
    return events
```

Then wire it in:

1. **Add the enum value** in [`models/event.py`](backend/chronotrace/models/event.py) (`EventSource` / `EventType` as needed). For an *active* module, also add it to the `ACTIVE_SOURCES` set.
2. **Register it** in [`workers/scan_worker.py`](backend/chronotrace/workers/scan_worker.py) — append to the passive `tasks` list, add to `ACTIVE_MODULE_MAP`, or gate it behind an enrichment key like `shodan`.
3. **Expose the CLI flag** in [`cli.py`](backend/chronotrace/cli.py) if it needs one.

That's it — the timeline, filters, export, and SSE progress all work automatically because everything normalizes to `NormalizedEvent`.

### <a id="ground-rules"></a>Ground rules

- **Passive by default.** Anything that sends traffic *to the target* is an active module, must be opt-in, and must be added to `ACTIVE_SOURCES` so the authorization gate covers it. Never make an active module run by default.
- **Be a good netizen.** Set timeouts, retry with backoff, respect rate limits, and keep the `ChronoTrace/1.0 OSINT-Research` user-agent honest.
- **Normalize everything** to `NormalizedEvent` with a stable, deduplicatable `id` and an ISO-8601 `timestamp`.
- **Fail soft.** A single source erroring should never abort the whole scan (wrap in `try/except`, as the existing connectors do).
- **Match the house style** — async `httpx`, type hints, small focused modules. No new heavyweight dependencies without discussion first.

### Pull request flow

1. Fork → create a branch (`git checkout -b feat/securitytrails-connector`).
2. Make your change; test it against a domain **you own or are authorized to test**.
3. Open a PR describing *what* and *why*. Mention any new dependency.
4. For active-module PRs, confirm in the description that the authorization gate covers it.

Found a bug or have an idea? [Open an issue](https://github.com/DularaAbhiranda/ChronoTrace/issues) — reproduction steps and the `chronotrace --version` output help a lot.

---

## 🛡️ Responsible Use

ChronoTrace is for **authorized** use only: domains you own, domains you're contracted to assess, or public threat-intelligence research.

- The CLI prompts you to retype the target domain before any active module runs.
- The web UI's scope modal is a hard gate — it cannot be bypassed.
- Active modules send live requests and **will appear in target server logs / IDS**.

Unauthorized reconnaissance may violate the **CFAA**, **GDPR Article 32**, the **Sri Lanka Computer Crime Act No. 24 of 2007**, and equivalent laws in your jurisdiction. You are responsible for your own actions.

---

## 📄 License

MIT © [Dulara Abhiranda](https://github.com/DularaAbhiranda) · Made with caffeine in Sri Lanka 🇱🇰

<div align="center"><sub>For authorized use only.</sub></div>
