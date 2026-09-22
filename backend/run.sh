#!/usr/bin/env bash
# Start the backend. From backend/:  ./run.sh
set -euo pipefail
cd "$(dirname "$0")"

if [ ! -f .env ]; then
  echo "backend/.env is missing. Copy .env.example to .env and fill it in." >&2
  exit 1
fi

if [ -x .venv/Scripts/python.exe ]; then
  PY=.venv/Scripts/python.exe      # Windows
elif [ -x .venv/bin/python ]; then
  PY=.venv/bin/python              # macOS / Linux
else
  echo "No virtualenv found. Run: python -m venv .venv" >&2
  exit 1
fi

exec "$PY" -m uvicorn app.main:app --reload --port 8000
