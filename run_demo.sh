#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT_DIR"

if [[ ! -d venv ]]; then
  echo "[ERROR] venv not found at $ROOT_DIR/venv"
  exit 1
fi

source venv/bin/activate

cleanup() {
  echo "\n[INFO] Stopping services..."
  [[ -n "${API_PID:-}" ]] && kill "$API_PID" >/dev/null 2>&1 || true
  [[ -n "${WEB_PID:-}" ]] && kill "$WEB_PID" >/dev/null 2>&1 || true
}
trap cleanup EXIT INT TERM

echo "[1/2] Starting backend API on http://localhost:5000 ..."
python3 api.py > /tmp/smartcontainer_api.log 2>&1 &
API_PID=$!

# Wait briefly for backend warmup logs to start
sleep 3

echo "[2/2] Starting frontend on http://localhost:3000 ..."
cd "$ROOT_DIR/dashboard"
REACT_APP_API_BASE_URL="http://localhost:5000" npm start > /tmp/smartcontainer_frontend.log 2>&1 &
WEB_PID=$!

echo "\n[READY] Demo stack is starting."
echo "Frontend: http://localhost:3000"
echo "Backend:  http://localhost:5000"
echo "Logs: /tmp/smartcontainer_api.log and /tmp/smartcontainer_frontend.log"
echo "Press Ctrl+C to stop both services."

wait "$WEB_PID"
