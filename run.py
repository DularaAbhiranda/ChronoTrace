#!/usr/bin/env python3
"""ChronoTrace one-shot launcher.

Run this single file and it sets everything up, then starts the app:

    1. Creates the backend virtual environment      (first run only)
    2. Installs backend Python dependencies          (first run only)
    3. Installs frontend deps + builds the web UI    (first run only)
    4. Starts ONE server and opens it in your browser

Usage:
    python run.py                  # set up if needed, then launch
    python run.py --rebuild        # force a fresh frontend build
    python run.py --port 9000      # serve on a specific port
    python run.py --no-browser     # don't auto-open the browser

Requirements on the machine: Python 3.10+ and Node.js (npm).
"""
from __future__ import annotations

import argparse
import os
import shutil
import socket
import subprocess
import sys
import threading
import webbrowser
from pathlib import Path

ROOT = Path(__file__).resolve().parent
BACKEND = ROOT / "backend"
FRONTEND = ROOT / "frontend"
VENV = BACKEND / "venv"


def info(msg: str) -> None:
    print(f"[*] {msg}", flush=True)


def ok(msg: str) -> None:
    print(f"[+] {msg}", flush=True)


def fail(msg: str) -> None:
    print(f"[!] {msg}", file=sys.stderr, flush=True)


def venv_python() -> Path:
    """Path to the python executable inside the backend venv."""
    return VENV / ("Scripts/python.exe" if os.name == "nt" else "bin/python")


def npm(args: str, cwd: Path) -> None:
    """Run an npm command. shell=True so Windows resolves npm.cmd correctly."""
    subprocess.run(f"npm {args}", cwd=str(cwd), shell=True, check=True)


def ensure_backend() -> None:
    py = venv_python()
    if not py.exists():
        info("Creating backend virtual environment (first run)...")
        subprocess.run([sys.executable, "-m", "venv", str(VENV)], check=True)

    # Skip the (slow) install if the key deps already import.
    probe = subprocess.run(
        [str(py), "-c", "import fastapi, uvicorn, httpx, chronotrace.main"],
        cwd=str(BACKEND),
        capture_output=True,
    )
    if probe.returncode != 0:
        info("Installing backend dependencies (first run, ~1 minute)...")
        subprocess.run([str(py), "-m", "pip", "install", "--upgrade", "pip", "--quiet"], check=True)
        subprocess.run(
            [str(py), "-m", "pip", "install", "-r", str(BACKEND / "requirements.txt"), "--quiet"],
            check=True,
        )
        ok("Backend dependencies installed.")
    else:
        ok("Backend ready.")


def ensure_frontend(rebuild: bool) -> None:
    if not shutil.which("npm"):
        fail("Node.js / npm not found on PATH. Install Node.js from https://nodejs.org and re-run.")
        sys.exit(1)

    if not (FRONTEND / "node_modules").is_dir():
        info("Installing frontend dependencies (first run, may take a few minutes)...")
        npm("install", FRONTEND)
        ok("Frontend dependencies installed.")

    if rebuild or not (FRONTEND / "dist" / "index.html").is_file():
        info("Building the web UI...")
        npm("run build", FRONTEND)
        ok("Web UI built.")
    else:
        ok("Web UI already built (use --rebuild to refresh).")


def free_port(preferred: int) -> int:
    """Return `preferred` if free, otherwise the next open port."""
    for port in range(preferred, preferred + 25):
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            if s.connect_ex(("127.0.0.1", port)) != 0:
                return port
    return preferred


def main() -> int:
    ap = argparse.ArgumentParser(description="Launch ChronoTrace — sets up everything, then runs it.")
    ap.add_argument("--port", type=int, default=8001, help="Port to serve on (default 8001)")
    ap.add_argument("--rebuild", action="store_true", help="Force a fresh frontend build")
    ap.add_argument("--no-browser", action="store_true", help="Don't auto-open the browser")
    args = ap.parse_args()

    print("\n=== ChronoTrace launcher ===\n")

    if not BACKEND.is_dir() or not FRONTEND.is_dir():
        fail("Run this from the ChronoTrace repo root (backend/ and frontend/ must sit next to run.py).")
        return 1

    try:
        ensure_backend()
        ensure_frontend(args.rebuild)
    except subprocess.CalledProcessError as e:
        fail(f"Setup step failed (exit {e.returncode}). Scroll up for the error above.")
        return e.returncode

    port = free_port(args.port)
    url = f"http://localhost:{port}"

    if not os.environ.get("OPENAI_API_KEY"):
        info("Tip: set OPENAI_API_KEY to enable the AI attack-path analysis (optional).")
    ok(f"Starting ChronoTrace at  {url}")
    print("    (press Ctrl+C to stop)\n")

    if not args.no_browser:
        threading.Timer(2.5, lambda: webbrowser.open(url)).start()

    try:
        subprocess.run(
            [str(venv_python()), "-m", "uvicorn", "chronotrace.main:app",
             "--host", "127.0.0.1", "--port", str(port)],
            cwd=str(BACKEND),
            env={**os.environ, "PYTHONPATH": str(BACKEND)},
            check=True,
        )
    except KeyboardInterrupt:
        print()
        info("ChronoTrace stopped.")
    except subprocess.CalledProcessError as e:
        fail(f"Server exited with an error (exit {e.returncode}).")
        return e.returncode
    return 0


if __name__ == "__main__":
    sys.exit(main())
