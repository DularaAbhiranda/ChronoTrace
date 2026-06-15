"""AI-powered attack path analysis using the OpenAI API (GPT-4o).

Usage:
    from chronotrace.analysis import attack_path
    report = attack_path.analyze(domain, events, api_key="sk-...")
"""
from __future__ import annotations

import json
import os
from collections import defaultdict
from typing import Any

from openai import OpenAI

from chronotrace.models.event import NormalizedEvent

# ──────────────────────────────── prompts ────────────────────────────────

_SYSTEM_PROMPT = """\
You are a senior penetration tester performing an authorized security assessment. \
Given OSINT reconnaissance data about a target domain, identify every realistic \
attack path an adversary could follow to compromise it.

Rules:
- Base ALL findings strictly on evidence present in the provided scan data.
- Do NOT invent vulnerabilities not supported by the data.
- For each attack path, ordered steps must reflect a real kill chain.
- Severity = potential impact if exploited. Likelihood = how accessible the entry point is.
- CVSS estimates are approximate — use CVSS v3 base score ranges as a guide.

Output a SINGLE JSON object. No markdown fences. No explanation text outside the JSON."""

# ────────────────────────── JSON output schema ───────────────────────────

_SCHEMA: dict[str, Any] = {
    "type": "object",
    "additionalProperties": False,
    "required": [
        "executive_summary",
        "attack_surface_rating",
        "attack_paths",
        "quick_wins",
        "infrastructure_risks",
    ],
    "properties": {
        "executive_summary": {"type": "string"},
        "attack_surface_rating": {
            "type": "string",
            "enum": ["Critical", "High", "Medium", "Low"],
        },
        "attack_paths": {
            "type": "array",
            "items": {
                "type": "object",
                "additionalProperties": False,
                "required": [
                    "id", "name", "description", "severity", "likelihood",
                    "evidence", "steps", "objective", "defensive_recommendation",
                ],
                "properties": {
                    "id": {"type": "string"},
                    "name": {"type": "string"},
                    "description": {"type": "string"},
                    "severity": {
                        "type": "string",
                        "enum": ["Critical", "High", "Medium", "Low"],
                    },
                    "likelihood": {
                        "type": "string",
                        "enum": ["High", "Medium", "Low"],
                    },
                    "evidence": {
                        "type": "array",
                        "items": {"type": "string"},
                    },
                    "steps": {
                        "type": "array",
                        "items": {
                            "type": "object",
                            "additionalProperties": False,
                            "required": ["phase", "action", "tool_or_technique"],
                            "properties": {
                                "phase": {"type": "string"},
                                "action": {"type": "string"},
                                "tool_or_technique": {"type": "string"},
                            },
                        },
                    },
                    "objective": {"type": "string"},
                    "defensive_recommendation": {"type": "string"},
                },
            },
        },
        "quick_wins": {
            "type": "array",
            "items": {"type": "string"},
        },
        "infrastructure_risks": {
            "type": "array",
            "items": {
                "type": "object",
                "additionalProperties": False,
                "required": ["service", "risk", "cvss_estimate"],
                "properties": {
                    "service": {"type": "string"},
                    "risk": {"type": "string"},
                    "cvss_estimate": {"type": "string"},
                },
            },
        },
    },
}

# ─────────────────────────── event formatting ────────────────────────────

def _build_scan_summary(domain: str, events: list[NormalizedEvent]) -> str:
    """Convert NormalizedEvent list into a structured text block for the prompt."""
    by_source: dict[str, list[NormalizedEvent]] = defaultdict(list)
    for e in events:
        src = e.source.value if hasattr(e.source, "value") else str(e.source)
        by_source[src].append(e)

    lines: list[str] = [f"## OSINT Scan Results — Target: {domain}\n"]

    # Open ports (highest-value for attack paths)
    ports: list[NormalizedEvent] = by_source.get("port_scan", []) + by_source.get("port_scan_full", [])
    if ports:
        lines.append("### Open Ports")
        for e in ports:
            d = e.details or {}
            banner = (d.get("banner") or "").replace("\n", " ")[:120]
            protocol = d.get("protocol", "tcp")
            lines.append(f"- {e.subject} ({protocol})  banner={banner!r}")
        lines.append("")

    # HTTP fingerprint
    if "http_probe" in by_source:
        lines.append("### HTTP / Web Stack")
        for e in by_source["http_probe"]:
            d = e.details or {}
            tech = d.get("technologies", [])
            missing = d.get("missing_security_headers", [])
            headers = d.get("response_headers", {})
            server = headers.get("server", "")
            lines.append(f"- URL: {e.subject}")
            lines.append(f"  Status: {d.get('status_code', '?')}  Server: {server}")
            lines.append(f"  Technologies: {', '.join(tech)}")
            if missing:
                lines.append(f"  Missing security headers ({len(missing)}): {', '.join(missing[:10])}")
        lines.append("")

    # TLS
    if "tls_live" in by_source:
        lines.append("### TLS / Certificate")
        for e in by_source["tls_live"]:
            d = e.details or {}
            lines.append(
                f"- {e.subject}  version={d.get('tls_version','')}  "
                f"cipher={d.get('cipher_suite','')[:40]}"
            )
        lines.append("")

    # Discovered paths
    if "dir_probe" in by_source:
        lines.append("### Discovered Web Paths")
        for e in by_source["dir_probe"]:
            d = e.details or {}
            lines.append(
                f"- {e.subject}  HTTP {d.get('status_code', '?')} "
                f"({d.get('content_length', '?')} bytes)"
            )
        lines.append("")

    # Well-known files
    if "well_known" in by_source:
        lines.append("### Well-Known / Metadata Files")
        for e in by_source["well_known"]:
            d = e.details or {}
            lines.append(
                f"- {e.subject}  HTTP {d.get('status_code', '?')} "
                f"({d.get('size_bytes', '?')} bytes)"
            )
        lines.append("")

    # DNS records
    if "dns" in by_source:
        lines.append("### DNS Records")
        for e in by_source["dns"]:
            d = e.details or {}
            vals = d.get("values", [])
            lines.append(f"- {e.subject}: {', '.join(str(v) for v in vals[:6])}")
        lines.append("")

    # DNS AXFR
    if "dns_axfr" in by_source:
        lines.append("### DNS Zone Transfer Attempts")
        for e in by_source["dns_axfr"]:
            d = e.details or {}
            success = d.get("success", False)
            err = d.get("error", "")
            lines.append(
                f"- {e.subject}: {'SUCCESS — zone data leaked' if success else f'BLOCKED ({err})'}"
            )
        lines.append("")

    # RDAP registration
    if "rdap" in by_source:
        lines.append("### Domain Registration")
        for e in by_source["rdap"]:
            d = e.details or {}
            lines.append(
                f"- Registered: {d.get('registration_date', '?')}  "
                f"Expires: {d.get('expiry_date', '?')}  "
                f"Registrar: {d.get('registrar', '?')}"
            )
        lines.append("")

    # Certificate transparency subdomains
    subs = [e for e in by_source.get("crt_sh", []) if e.event_type.value == "subdomain"]
    if subs:
        lines.append("### Subdomains (Certificate Transparency)")
        for e in subs[:25]:
            lines.append(f"- {e.subject}")
        if len(subs) > 25:
            lines.append(f"  ... and {len(subs) - 25} more")
        lines.append("")

    # Wayback — interesting historical URLs
    wb_evs = by_source.get("wayback", [])
    interesting_keywords = [
        "admin", "login", "wp-", "phpmyadmin", "backup", ".sql", ".env",
        ".git", "upload", "config", "api/", "debug", "shell", ".bak",
    ]
    interesting_urls = [
        e.subject for e in wb_evs
        if any(k in e.subject.lower() for k in interesting_keywords)
    ]
    if interesting_urls:
        lines.append("### Interesting Historical URLs (Wayback Machine)")
        for u in interesting_urls[:20]:
            lines.append(f"- {u}")
        lines.append("")

    return "\n".join(lines)


# ─────────────────────────── public API ──────────────────────────────────

def analyze(
    domain: str,
    events: list[NormalizedEvent],
    api_key: str | None = None,
) -> dict[str, Any]:
    """Run GPT-4o attack path analysis on scan results.

    Args:
        domain: The target domain that was scanned.
        events: All NormalizedEvent objects from the scan.
        api_key: OpenAI API key. Falls back to OPENAI_API_KEY env var.

    Returns:
        Parsed report dict matching the attack path schema.

    Raises:
        ValueError: If no API key is available.
        openai.APIError: On API-level errors.
    """
    key = api_key or os.environ.get("OPENAI_API_KEY")
    if not key:
        raise ValueError(
            "OpenAI API key required. "
            "Set the OPENAI_API_KEY environment variable or pass --openai-key."
        )

    if not events:
        raise ValueError("No scan events to analyze.")

    client = OpenAI(api_key=key)
    scan_text = _build_scan_summary(domain, events)

    user_message = (
        "Analyze the following OSINT data and identify ALL realistic attack paths. "
        "Be thorough — this is a defensive security assessment with full authorization.\n\n"
        + scan_text
    )

    response = client.chat.completions.create(
        model="gpt-4o",
        max_tokens=8192,
        response_format={
            "type": "json_schema",
            "json_schema": {
                "name": "attack_path_report",
                "strict": True,
                "schema": _SCHEMA,
            },
        },
        messages=[
            {"role": "system", "content": _SYSTEM_PROMPT},
            {"role": "user", "content": user_message},
        ],
    )

    text = response.choices[0].message.content or ""
    return json.loads(text)
