#!/usr/bin/env bash
#
# ChronoTrace CLI — one-shot launcher for Linux / macOS.
#
# First run sets up a virtualenv and installs the tool; after that it just runs.
# All arguments are passed straight through to the chronotrace CLI:
#
#   ./chronotrace.sh example.com
#   ./chronotrace.sh example.com --active
#   ./chronotrace.sh example.com --full -o results.json --json
#   ./chronotrace.sh example.com --json | jq '.events | length'
#   ./chronotrace.sh --help
#
# Requires: Python 3.10+  (override the interpreter with:  PYTHON=python3.12 ./chronotrace.sh ...)
#
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND="$ROOT/backend"
VENV="$BACKEND/venv"
PYBIN="$VENV/bin/python"

# Setup/progress messages go to stderr so stdout stays clean for `| jq`, `-o`, etc.
log() { printf '[*] %s\n' "$1" >&2; }

PYTHON="${PYTHON:-python3}"
if ! command -v "$PYTHON" >/dev/null 2>&1; then
  printf '[!] %s\n' "python3 not found. Install Python 3.10+ and re-run." >&2
  exit 1
fi

# 1. Virtual environment (first run only)
if [ ! -x "$PYBIN" ]; then
  log "Creating virtual environment (first run)..."
  "$PYTHON" -m venv "$VENV"
fi

# 2. Dependencies (install only if the CLI isn't importable yet)
if ! PYTHONPATH="$BACKEND" "$PYBIN" -c "import chronotrace.cli" >/dev/null 2>&1; then
  log "Installing ChronoTrace dependencies (first run, ~1 min)..."
  "$PYBIN" -m pip install --quiet --upgrade pip
  "$PYBIN" -m pip install --quiet -r "$BACKEND/requirements.txt"
  log "Done. Running scan..."
fi

# 3. Run the CLI, passing through every argument
exec env PYTHONPATH="$BACKEND" "$PYBIN" -m chronotrace "$@"
