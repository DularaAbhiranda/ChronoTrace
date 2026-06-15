"""ChronoTrace CLI — Kali-style command-line interface.

Examples:
    chronotrace example.com
    chronotrace example.com --active
    chronotrace example.com --port-scan --axfr --dir-probe
    chronotrace example.com --full -o results.json --json
    chronotrace example.com --only wayback,crt_sh --no-color
"""
from __future__ import annotations

import argparse
import asyncio
import csv
import json
import logging
import sys
import time
from collections import defaultdict
from datetime import datetime
from pathlib import Path
from typing import Any

import httpx
from rich.console import Console
from rich.panel import Panel
from rich.table import Table
from rich.text import Text

from chronotrace.connectors import wayback, crt_sh, rdap, dns_resolver
from chronotrace.connectors.enrichment import shodan, virustotal, hibp
from chronotrace.connectors.active import (
    port_scan, port_scan_full, http_fingerprint, tls_inspect,
    well_known, dns_axfr, dir_probe,
)
from chronotrace.models.event import NormalizedEvent, EventSource

__version__ = "1.0.1"

# Big ANSI Shadow banner — same style nmap/sqlmap/metasploit use.
# Requires terminal width ≥ 96 columns; falls back to the small slant banner otherwise.
BANNER_LARGE = r"""
 ██████╗██╗  ██╗██████╗  ██████╗ ███╗   ██╗ ██████╗ ████████╗██████╗  █████╗  ██████╗███████╗
██╔════╝██║  ██║██╔══██╗██╔═══██╗████╗  ██║██╔═══██╗╚══██╔══╝██╔══██╗██╔══██╗██╔════╝██╔════╝
██║     ███████║██████╔╝██║   ██║██╔██╗ ██║██║   ██║   ██║   ██████╔╝███████║██║     █████╗
██║     ██╔══██║██╔══██╗██║   ██║██║╚██╗██║██║   ██║   ██║   ██╔══██╗██╔══██║██║     ██╔══╝
╚██████╗██║  ██║██║  ██║╚██████╔╝██║ ╚████║╚██████╔╝   ██║   ██║  ██║██║  ██║╚██████╗███████╗
 ╚═════╝╚═╝  ╚═╝╚═╝  ╚═╝ ╚═════╝ ╚═╝  ╚═══╝ ╚═════╝    ╚═╝   ╚═╝  ╚═╝╚═╝  ╚═╝ ╚═════╝╚══════╝
"""

BANNER_SMALL = r"""
   ____ _                       _____
  / ___| |__  _ __ ___  _ __   |_   _| __ __ _  ___ ___
 | |   | '_ \| '__/ _ \| '_ \    | || '__/ _` |/ __/ _ \
 | |___| | | | | | (_) | | | |   | || | | (_| | (_|  __/
  \____|_| |_|_|  \___/|_| |_|   |_||_|  \__,_|\___\___|
"""


def render_banner(console: Console) -> None:
    """Pick big or small banner based on terminal width, render with color."""
    art = BANNER_LARGE if console.width >= 96 else BANNER_SMALL
    # Cyan banner, red tagline — same palette family as Hydra / sqlmap
    console.print(f"[bold cyan]{art}[/]")
    tagline = "         Domain History  ·  Certificate Transparency  ·  Active Recon"
    console.print(f"[bold red]{tagline}[/]")
    console.print(f"        [dim]v{__version__}  by Dulara Abhiranda  ·  github.com/DularaAbhiranda/ChronoTrace[/]")
    console.print()

PASSIVE_SOURCES = ["wayback", "crt_sh", "rdap", "dns"]
ACTIVE_MODULES = {
    "port_scan":      ("Top-20 port scan",                 port_scan),
    "port_scan_full": ("Full 1-65535 port scan",           port_scan_full),
    "http_probe":     ("Live HTTP fingerprint + headers",  http_fingerprint),
    "tls_live":       ("Live TLS handshake inspection",    tls_inspect),
    "well_known":     ("robots.txt / sitemap / .well-known", well_known),
    "dns_axfr":       ("DNS zone transfer attempt",        dns_axfr),
    "dir_probe":      ("Directory / file probe (~150 paths)", dir_probe),
}
SOCKET_HEAVY = {"port_scan_full"}  # serialized after other modules


# ───────────────────────────── argparse ─────────────────────────────

def build_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(
        prog="chronotrace",
        description=(
            "ChronoTrace — domain history & OSINT timeline. "
            "Aggregates Wayback / crt.sh / RDAP / DNS plus optional active probing."
        ),
        epilog=(
            "Examples:\n"
            "  chronotrace example.com\n"
            "  chronotrace example.com --active\n"
            "  chronotrace example.com --port-scan --axfr --dir-probe\n"
            "  chronotrace example.com --full -o results.json --json\n"
            "\n"
            "Active modules require -y/--yes (or explicit per-flag confirmation).\n"
            "Only scan domains you own or have written authorization to assess."
        ),
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    p.add_argument("domain", nargs="?", help="Target domain (e.g. example.com)")
    p.add_argument("-V", "--version", action="version", version=f"chronotrace {__version__}")
    p.add_argument("--list-modules", action="store_true",
                   help="List all available passive sources and active modules, then exit")

    src = p.add_argument_group("source selection")
    src.add_argument("--passive", action="store_true",
                     help="Run all passive sources (default behaviour)")
    src.add_argument("--active", action="store_true",
                     help="Enable safe active modules (http_probe, tls_live, well_known, port_scan, dns_axfr, dir_probe)")
    src.add_argument("--full", action="store_true",
                     help="Enable EVERYTHING including the full 1-65535 port scan (slow, ~10-15 min)")
    src.add_argument("--only", metavar="LIST",
                     help="Comma-separated list of sources to run exclusively (e.g. wayback,crt_sh)")

    am = p.add_argument_group("active modules (each requires authorization)")
    am.add_argument("--port-scan", action="store_true", help="Top-20 port TCP connect-scan")
    am.add_argument("--port-scan-full", action="store_true",
                    help="Full 1-65535 port scan with banner grab (slow)")
    am.add_argument("--http-fingerprint", action="store_true", help="Live HTTP headers + tech detection")
    am.add_argument("--tls-inspect", action="store_true", help="Live TLS handshake inspection")
    am.add_argument("--well-known", action="store_true", help="Fetch robots.txt / sitemap / .well-known/*")
    am.add_argument("--axfr", action="store_true", help="Attempt DNS zone transfer (AXFR)")
    am.add_argument("--dir-probe", action="store_true", help="Probe ~150 common paths for admin/config/secret leakage")

    auth = p.add_argument_group("authorization")
    auth.add_argument("-y", "--yes", action="store_true",
                      help="Skip interactive confirmation prompts for active modules")

    en = p.add_argument_group("enrichment (require API keys)")
    en.add_argument("--shodan-key", metavar="KEY", help="Shodan API key for host intel enrichment")
    en.add_argument("--vt-key", metavar="KEY", help="VirusTotal API key")
    en.add_argument("--hibp-key", metavar="KEY", help="Have I Been Pwned API key")

    ai = p.add_argument_group("AI analysis (OpenAI / GPT-4o)")
    ai.add_argument("--analyze", action="store_true",
                    help="Run AI-powered attack path analysis after the scan (requires OpenAI API key)")
    ai.add_argument("--openai-key", metavar="KEY",
                    help="OpenAI API key for attack path analysis (default: $OPENAI_API_KEY)")

    out = p.add_argument_group("output")
    out.add_argument("-o", "--output", metavar="FILE", help="Write results to file (default: stdout pretty print)")
    out.add_argument("--json", action="store_true", help="Output as JSON")
    out.add_argument("--csv", action="store_true", help="Output as CSV")
    out.add_argument("--quiet", "-q", action="store_true", help="Suppress banner & progress; only show results")
    out.add_argument("--verbose", "-v", action="store_true", help="Verbose logging")
    out.add_argument("--no-color", action="store_true", help="Disable ANSI colors (for pipes / log files)")
    out.add_argument("--max-events-shown", type=int, default=30,
                     help="Max events shown per source in pretty output (default 30)")

    return p


# ───────────────────────── confirmation / scope ─────────────────────────

def confirm_active(console: Console, domain: str, modules: list[str], assume_yes: bool) -> bool:
    if not modules:
        return True
    if assume_yes:
        console.print(
            f"[bold yellow]![/] Active modules pre-confirmed via -y: "
            f"[red]{', '.join(modules)}[/]"
        )
        return True
    console.print()
    console.print(Panel.fit(
        Text.from_markup(
            f"[bold red]Active modules will send LIVE requests to {domain}[/]\n\n"
            f"Enabled: [yellow]{', '.join(modules)}[/]\n\n"
            "Only proceed if you own this domain or have written authorization to probe it. "
            "Unauthorized recon may violate the CFAA and equivalent laws."
        ),
        title="[red]AUTHORIZATION REQUIRED[/]",
        border_style="red",
    ))
    try:
        ans = input(f"\nType the target domain to confirm [{domain}]: ").strip().lower()
    except (EOFError, KeyboardInterrupt):
        console.print("[red]Aborted.[/]")
        return False
    if ans != domain.lower():
        console.print("[red]Domain mismatch — aborting.[/]")
        return False
    return True


def resolve_modules(args: argparse.Namespace) -> tuple[list[str], list[str]]:
    """Return (passive_sources, active_modules) based on parsed flags.

    Rules:
      --only X,Y  → exclusive set (only those listed, passive + active)
      --active    → all safe active modules added
      --full      → all active modules added (incl. port_scan_full)
      --port-scan/--axfr/etc → individual modules, additive
    """
    if args.only:
        wanted = [s.strip() for s in args.only.split(",") if s.strip()]
        passive = [s for s in wanted if s in PASSIVE_SOURCES]
        active = [s for s in wanted if s in ACTIVE_MODULES]
    else:
        passive = list(PASSIVE_SOURCES)
        active = []
        if args.full:
            active = list(ACTIVE_MODULES.keys())
        elif args.active:
            active = [m for m in ACTIVE_MODULES.keys() if m != "port_scan_full"]

    # Per-flag overrides — additive (works with or without --only)
    explicit = {
        "port_scan": args.port_scan,
        "port_scan_full": args.port_scan_full,
        "http_probe": args.http_fingerprint,
        "tls_live": args.tls_inspect,
        "well_known": args.well_known,
        "dns_axfr": args.axfr,
        "dir_probe": args.dir_probe,
    }
    for mod, on in explicit.items():
        if on and mod not in active:
            active.append(mod)

    # Mutex: port_scan_full supersedes port_scan
    if "port_scan_full" in active and "port_scan" in active:
        active = [m for m in active if m != "port_scan"]

    return passive, active


# ─────────────────────────── scan runner ────────────────────────────

async def _run_one(name: str, coro, console: Console, quiet: bool) -> tuple[str, list, str | None]:
    start = time.time()
    try:
        events = await coro
        dt = time.time() - start
        if not quiet:
            console.print(
                f"[green][+][/] {name:18} [dim]{dt:5.1f}s[/]  "
                f"[bold]{len(events):>5}[/] events"
            )
        return name, events, None
    except Exception as e:
        dt = time.time() - start
        msg = f"{type(e).__name__}: {e}"
        if not quiet:
            console.print(f"[red][!][/] {name:18} [dim]{dt:5.1f}s[/]  [red]FAILED: {msg[:80]}[/]")
        return name, [], msg


async def run_scan(domain: str, passive: list[str], active: list[str],
                   enrichment: dict[str, str], console: Console, quiet: bool) -> dict:
    results: dict[str, list] = defaultdict(list)
    errors: dict[str, str] = {}

    async with httpx.AsyncClient(
        headers={"User-Agent": f"chronotrace-cli/{__version__} OSINT-Research"},
        follow_redirects=True,
    ) as client:
        # Phase 1: passive + light active in parallel
        light_active = [m for m in active if m not in SOCKET_HEAVY]
        tasks = []
        registry = {
            "wayback": lambda: wayback.fetch(domain, client),
            "crt_sh": lambda: crt_sh.fetch(domain, client),
            "rdap": lambda: rdap.fetch(domain, client),
            "dns": lambda: dns_resolver.fetch(domain, client),
        }
        for src in passive:
            if src in registry:
                tasks.append(_run_one(src, registry[src](), console, quiet))
        if enrichment.get("shodan"):
            tasks.append(_run_one("shodan", shodan.fetch(domain, client, enrichment["shodan"]), console, quiet))
        if enrichment.get("virustotal"):
            tasks.append(_run_one("virustotal", virustotal.fetch(domain, client, enrichment["virustotal"]), console, quiet))
        if enrichment.get("hibp"):
            tasks.append(_run_one("hibp", hibp.fetch(domain, client, enrichment["hibp"]), console, quiet))
        for mod in light_active:
            label, fn = ACTIVE_MODULES[mod]
            tasks.append(_run_one(mod, fn.fetch(domain, client), console, quiet))

        for name, evs, err in await asyncio.gather(*tasks):
            results[name] = evs
            if err:
                errors[name] = err

        # Phase 2: socket-heavy modules sequentially
        for mod in active:
            if mod not in SOCKET_HEAVY:
                continue
            label, fn = ACTIVE_MODULES[mod]
            if not quiet:
                console.print(f"[yellow][*][/] Running [bold]{mod}[/] sequentially (this is slow)...")
            name, evs, err = await _run_one(mod, fn.fetch(domain, client), console, quiet)
            results[name] = evs
            if err:
                errors[name] = err

    return {"results": dict(results), "errors": errors}


# ─────────────────────────── output formatters ────────────────────────────

def _render_open_ports(results: dict, console: Console) -> None:
    """nmap-style open-ports table with service mapping (dedupes top-20 + full)."""
    port_evs = list(results.get("port_scan", [])) + list(results.get("port_scan_full", []))
    by_port: dict[int, dict] = {}
    for e in port_evs:
        d = e.details or {}
        p = d.get("port")
        if p is not None:
            by_port[p] = d
    if not by_port:
        return
    tbl = Table(title=f"Open Ports ({len(by_port)})", border_style="dim", title_style="bold")
    tbl.add_column("PORT", style="bold cyan", no_wrap=True)
    tbl.add_column("STATE", style="green")
    tbl.add_column("SERVICE", style="yellow")
    tbl.add_column("VERSION / BANNER", style="dim", overflow="ellipsis")
    for port in sorted(by_port):
        d = by_port[port]
        tls = d.get("tls") or {}
        banner = (d.get("banner") or "").replace("\n", " ").strip()
        if tls.get("tls_version"):
            extra = f"{tls['tls_version']} {tls.get('cipher', '')}".strip()
            extra = f"{extra} | {banner}" if banner else extra
        else:
            extra = banner
        tbl.add_row(f"{port}/tcp", "open", d.get("service", "unknown"), extra[:70])
    console.print()
    console.print(tbl)


def pretty_report(domain: str, scan: dict, console: Console, max_shown: int) -> None:
    results = scan["results"]
    all_events: list[NormalizedEvent] = [e for evs in results.values() for e in evs]

    # Summary table
    summary = Table(title="Source Summary", border_style="dim", title_style="bold")
    summary.add_column("Source", style="cyan", no_wrap=True)
    summary.add_column("Events", justify="right", style="bold")
    summary.add_column("Status")
    for src in PASSIVE_SOURCES + list(ACTIVE_MODULES) + ["shodan", "virustotal", "hibp"]:
        if src in results:
            n = len(results[src])
            err = scan["errors"].get(src)
            status = "[red]FAILED[/]" if err else ("[green]OK[/]" if n else "[yellow]0 events[/]")
            tag = "active" if src in ACTIVE_MODULES else "passive"
            summary.add_row(f"{src} [{tag}]", str(n), status)
    console.print()
    console.print(summary)

    # Open ports — dedicated nmap-style view (port → service mapping)
    _render_open_ports(results, console)

    # Per-source detail dump (ports are shown above, so skip them here)
    for src, evs in results.items():
        if not evs or src in ("port_scan", "port_scan_full"):
            continue
        console.print()
        console.print(f"[bold cyan]--- {src.upper()} ---[/]  [dim]{len(evs)} events[/]")

        t = Table(border_style="dim", show_header=True)
        t.add_column("Date", style="dim", no_wrap=True)
        t.add_column("Type", style="yellow")
        t.add_column("Subject")
        t.add_column("Extra", style="dim", overflow="ellipsis")

        for e in evs[:max_shown]:
            extra = _extra_for(e)
            t.add_row(e.timestamp[:10], e.event_type, e.subject[:60], extra[:60])

        if len(evs) > max_shown:
            t.add_row("...", "...", f"[dim]+{len(evs) - max_shown} more[/]", "")
        console.print(t)

    # Final stats
    if all_events:
        times = sorted(e.timestamp for e in all_events if e.timestamp > "1990")
        console.print()
        console.print(Panel.fit(
            f"[bold]{len(all_events)}[/] total events across [bold]{len([s for s,e in results.items() if e])}[/] sources"
            + (f"\n[dim]Date range:[/] {times[0][:10]} → {times[-1][:10]}" if times else ""),
            border_style="green",
            title="[green]Scan Complete[/]",
        ))


def _extra_for(e: NormalizedEvent) -> str:
    d = e.details or {}
    if e.source == EventSource.WAYBACK:
        return f"HTTP {d.get('status_code','')} {d.get('mime_type','')}"
    if e.source == EventSource.CRT_SH:
        return d.get("issuer", "")[:80]
    if e.source == EventSource.DNS:
        return ", ".join(d.get("values", []))[:80]
    if e.source == EventSource.PORT_SCAN:
        banner = (d.get("banner") or "").replace("\n", " ")[:60]
        return banner
    if e.source == EventSource.HTTP_PROBE:
        tech = d.get("technologies", [])
        miss = d.get("missing_security_headers", [])
        return f"{d.get('status_code','')} tech={tech} missing_sec={len(miss)}"
    if e.source == EventSource.TLS_LIVE:
        return f"{d.get('tls_version','')} {d.get('cipher_suite','')[:30]}"
    if e.source == EventSource.WELL_KNOWN:
        return f"{d.get('status_code','')} {d.get('size_bytes','')}b"
    if e.source == EventSource.DNS_AXFR:
        return "SUCCESS" if d.get("success") else (d.get("error") or "")[:60]
    if e.source == EventSource.DIR_PROBE:
        return f"HTTP {d.get('status_code','')} {d.get('content_length','')}b"
    if e.source == EventSource.RDAP:
        return d.get("event_action", "")
    return ""


def to_json(scan: dict, domain: str) -> str:
    out = {
        "domain": domain,
        "scanned_at": datetime.utcnow().isoformat() + "Z",
        "tool": f"chronotrace {__version__}",
        "errors": scan["errors"],
        "events": [
            e.model_dump() if hasattr(e, "model_dump") else e.__dict__
            for evs in scan["results"].values() for e in evs
        ],
    }
    return json.dumps(out, indent=2, default=str)


def render_attack_report(report: dict, console: Console) -> None:
    """Render an OpenAI GPT-4o attack-path report to the terminal using Rich."""
    from rich.rule import Rule
    from rich.columns import Columns

    severity_color = {
        "Critical": "bold red",
        "High": "red",
        "Medium": "yellow",
        "Low": "green",
    }
    likelihood_color = {
        "High": "red",
        "Medium": "yellow",
        "Low": "green",
    }

    rating = report.get("attack_surface_rating", "Unknown")
    rc = severity_color.get(rating, "white")

    console.print()
    console.print(Rule("[bold magenta] AI Attack Path Analysis [/]", style="magenta"))
    console.print()
    console.print(
        f"[bold]Attack Surface Rating:[/]  [{rc}]{rating}[/]"
    )
    console.print()
    console.print(Panel.fit(
        Text.from_markup(f"[italic]{report.get('executive_summary', '')}[/]"),
        title="[bold]Executive Summary[/]",
        border_style="dim",
    ))

    # Quick wins
    qw = report.get("quick_wins", [])
    if qw:
        console.print()
        console.print("[bold yellow]Quick Wins — Immediate Defensive Actions[/]")
        for win in qw:
            console.print(f"  [yellow]▶[/] {win}")

    # Infrastructure risks
    risks = report.get("infrastructure_risks", [])
    if risks:
        console.print()
        console.print("[bold red]Infrastructure Risks[/]")
        t = Table(border_style="dim", show_header=True, header_style="bold")
        t.add_column("Service", style="cyan")
        t.add_column("Risk")
        t.add_column("CVSS", justify="center", style="yellow")
        for r in risks:
            t.add_row(r.get("service", ""), r.get("risk", ""), r.get("cvss_estimate", "?"))
        console.print(t)

    # Attack paths
    paths = report.get("attack_paths", [])
    if paths:
        console.print()
        console.print(Rule("[bold red] Attack Paths [/]", style="red"))

        for ap in paths:
            sev = ap.get("severity", "")
            lik = ap.get("likelihood", "")
            sc = severity_color.get(sev, "white")
            lc = likelihood_color.get(lik, "white")
            ap_id = ap.get("id", "")
            name = ap.get("name", "")

            console.print()
            console.print(
                f"[bold]{ap_id}[/]  [bold {sc}]{name}[/]  "
                f"[[{sc}]{sev}[/] | likelihood [{lc}]{lik}[/]]"
            )
            console.print(f"  [dim]{ap.get('description', '')}[/]")

            evidence = ap.get("evidence", [])
            if evidence:
                console.print("  [bold]Evidence:[/]")
                for ev in evidence:
                    console.print(f"    [cyan]•[/] {ev}")

            steps = ap.get("steps", [])
            if steps:
                console.print("  [bold]Kill Chain:[/]")
                for i, step in enumerate(steps, 1):
                    phase = step.get("phase", "")
                    action = step.get("action", "")
                    tool = step.get("tool_or_technique", "")
                    console.print(
                        f"    [bold]{i}.[/] [[dim]{phase}[/]] {action}"
                        + (f"  [dim]← {tool}[/]" if tool else "")
                    )

            objective = ap.get("objective", "")
            if objective:
                console.print(f"  [bold]Objective:[/] [red]{objective}[/]")

            defense = ap.get("defensive_recommendation", "")
            if defense:
                console.print(f"  [bold]Defense:[/] [green]{defense}[/]")

    console.print()
    console.print(Rule(style="magenta"))


def to_csv(scan: dict) -> str:
    import io
    buf = io.StringIO()
    w = csv.writer(buf)
    w.writerow(["timestamp", "source", "event_type", "subject", "details"])
    for evs in scan["results"].values():
        for e in evs:
            w.writerow([
                e.timestamp,
                e.source.value if hasattr(e.source, "value") else e.source,
                e.event_type.value if hasattr(e.event_type, "value") else e.event_type,
                e.subject,
                json.dumps(e.details or {}, default=str),
            ])
    return buf.getvalue()


# ─────────────────────── windows console / ansi ─────────────────────────

def _enable_windows_ansi() -> None:
    """Enable ANSI / virtual-terminal processing on the Windows console.

    Classic conhost and PowerShell 5.1 start with VT processing *disabled*,
    so ANSI color codes get printed literally (the dreaded ``←[1;36m``).
    Flipping on ENABLE_VIRTUAL_TERMINAL_PROCESSING makes them render.
    Safe no-op off-Windows, on redirected output, or on consoles too old
    to support it.
    """
    if sys.platform != "win32":
        return
    try:
        import ctypes
        from ctypes import wintypes

        kernel32 = ctypes.windll.kernel32
        kernel32.GetStdHandle.restype = wintypes.HANDLE
        kernel32.GetStdHandle.argtypes = [wintypes.DWORD]
        kernel32.GetConsoleMode.argtypes = [wintypes.HANDLE, ctypes.POINTER(wintypes.DWORD)]
        kernel32.SetConsoleMode.argtypes = [wintypes.HANDLE, wintypes.DWORD]

        ENABLE_VIRTUAL_TERMINAL_PROCESSING = 0x0004
        for std_id in (-11, -12):  # STD_OUTPUT_HANDLE, STD_ERROR_HANDLE
            handle = kernel32.GetStdHandle(std_id)
            if not handle:
                continue
            mode = wintypes.DWORD()
            if not kernel32.GetConsoleMode(handle, ctypes.byref(mode)):
                continue  # redirected to a file/pipe — not a real console
            kernel32.SetConsoleMode(handle, mode.value | ENABLE_VIRTUAL_TERMINAL_PROCESSING)
    except Exception:
        pass


# ─────────────────────────── main entrypoint ────────────────────────────

def main(argv: list[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    # Load API keys from backend/.env (next to the package) and any .env in cwd.
    # Never overrides a real environment variable if one is already set.
    try:
        from dotenv import load_dotenv
        load_dotenv(Path(__file__).resolve().parents[1] / ".env")
        load_dotenv()
    except Exception:
        pass
    # On Windows, force UTF-8 to avoid legacy console crashes on box-drawing chars
    if sys.platform == "win32":
        try:
            sys.stdout.reconfigure(encoding="utf-8", errors="replace")
            sys.stderr.reconfigure(encoding="utf-8", errors="replace")
        except Exception:
            pass
        _enable_windows_ansi()  # turn on VT processing so ANSI colors render
    console = Console(
        no_color=args.no_color,
        stderr=False,
        soft_wrap=False,
        safe_box=True,         # ASCII-safe box characters on legacy consoles
    )

    if args.verbose:
        logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s: %(message)s")
        logging.getLogger("httpx").setLevel(logging.WARNING)
        logging.getLogger("httpcore").setLevel(logging.WARNING)
    elif args.quiet:
        logging.basicConfig(level=logging.CRITICAL)
    else:
        # Default: surface errors only — retry chatter from crt.sh / wayback is hidden
        logging.basicConfig(level=logging.ERROR, format="%(message)s")

    if args.list_modules:
        console.print("[bold]Passive sources:[/]")
        for s in PASSIVE_SOURCES:
            console.print(f"  [cyan]{s}[/]")
        console.print("\n[bold]Active modules:[/]  (require authorization)")
        for k, (desc, _) in ACTIVE_MODULES.items():
            console.print(f"  [red]{k:18}[/] {desc}")
        return 0

    if not args.domain:
        console.print("[red]error:[/] target domain is required. Try: [bold]chronotrace example.com[/]")
        console.print("Use --help for usage.")
        return 2

    if not args.quiet:
        render_banner(console)

    passive, active = resolve_modules(args)
    if not passive and not active:
        console.print("[red]error:[/] no sources selected. Use --active, --full, or --only.")
        return 2

    if not args.quiet:
        console.print(f"[bold]Target:[/]   {args.domain}")
        console.print(f"[bold]Passive:[/]  {', '.join(passive) if passive else '[dim]none[/]'}")
        if active:
            console.print(f"[bold red]Active:[/]   {', '.join(active)}")
        else:
            console.print(f"[bold]Active:[/]   [dim]none[/]")
        console.print(f"[bold]Started:[/]  {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        console.print()

    if active and not confirm_active(console, args.domain, active, args.yes):
        return 3

    enrichment = {}
    if args.shodan_key: enrichment["shodan"] = args.shodan_key
    if args.vt_key: enrichment["virustotal"] = args.vt_key
    if args.hibp_key: enrichment["hibp"] = args.hibp_key

    if not args.quiet:
        console.print("[bold]Running connectors...[/]")
    t0 = time.time()
    scan = asyncio.run(run_scan(args.domain, passive, active, enrichment, console, args.quiet))
    elapsed = time.time() - t0

    total = sum(len(v) for v in scan["results"].values())

    # Output
    if args.json:
        out = to_json(scan, args.domain)
    elif args.csv:
        out = to_csv(scan)
    else:
        out = None  # pretty path

    if args.output:
        Path(args.output).write_text(out or to_json(scan, args.domain), encoding="utf-8")
        if not args.quiet:
            console.print(f"\n[green]Saved {total} events to[/] [bold]{args.output}[/]  [dim]({elapsed:.1f}s)[/]")
    else:
        if out is not None:
            print(out)
        else:
            pretty_report(args.domain, scan, console, args.max_events_shown)
            if not args.quiet:
                console.print(f"\n[dim]Elapsed: {elapsed:.1f}s[/]")

    # AI attack path analysis
    if getattr(args, "analyze", False) and total > 0 and not args.json and not args.csv:
        all_events: list[NormalizedEvent] = [
            e for evs in scan["results"].values() for e in evs
        ]
        if not args.quiet:
            console.print()
        with console.status(
            "[bold magenta]Analyzing attack surface with OpenAI GPT-4o…[/]  "
            "[dim](this takes 15–30 seconds)[/]",
            spinner="dots",
        ):
            try:
                from chronotrace.analysis import attack_path
                report = attack_path.analyze(
                    args.domain,
                    all_events,
                    api_key=getattr(args, "openai_key", None),
                )
            except ImportError:
                console.print(
                    "\n[red][!] AI analysis needs the 'openai' package:[/] "
                    "pip install openai"
                )
                return 0 if total > 0 else 1
            except ValueError as exc:
                console.print(f"\n[red][!] Analysis failed:[/] {exc}")
                return 0 if total > 0 else 1
            except Exception as exc:
                console.print(f"\n[red][!] Analysis error:[/] {exc}")
                return 0 if total > 0 else 1

        render_attack_report(report, console)

    return 0 if total > 0 else 1


if __name__ == "__main__":
    sys.exit(main())
