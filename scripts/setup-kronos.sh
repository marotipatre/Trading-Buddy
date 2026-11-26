#!/usr/bin/env bash
# One-time setup and launch for the optional Kronos forecast service. Run from the repo root:
#   bash scripts/setup-kronos.sh          # install (first time) and start on http://localhost:8765
#   bash scripts/setup-kronos.sh install # install only
# Needs python3 (3.10+) and git. Installs into ~/kronos-env and ~/Kronos; model weights download on first forecast.
set -euo pipefail
REPO_DIR="${KRONOS_REPO:-$HOME/Kronos}"
ENV_DIR="${KRONOS_ENV:-$HOME/kronos-env}"
PORT="${KRONOS_PORT:-8765}"

if [ ! -d "$REPO_DIR" ]; then git clone https://github.com/shiyu-coder/Kronos "$REPO_DIR"; fi
if [ ! -d "$ENV_DIR" ]; then python3 -m venv "$ENV_DIR"; fi
# shellcheck disable=SC1091
source "$ENV_DIR/bin/activate"
if ! python -c "import fastapi, torch" >/dev/null 2>&1; then
  pip install --upgrade pip >/dev/null
  pip install -r "$REPO_DIR/requirements.txt" fastapi uvicorn
fi
if [ "${1:-}" = "install" ]; then echo "Installed. Start it with: bash scripts/setup-kronos.sh"; exit 0; fi

if ! grep -q '^KRONOS_URL=' .env.local 2>/dev/null; then
  echo "KRONOS_URL=http://localhost:$PORT" >> .env.local
  echo "Added KRONOS_URL to .env.local (restart 'npm run dev' once to pick it up)."
fi
echo "Starting the Kronos service on 127.0.0.1:$PORT (Ctrl+C to stop)..."
KRONOS_REPO="$REPO_DIR" exec uvicorn kronos_service:app --host 127.0.0.1 --port "$PORT" --app-dir scripts
