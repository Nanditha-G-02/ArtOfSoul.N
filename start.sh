#!/usr/bin/env bash
# One command for Ubuntu/Linux: starts the backend and the frontend together. Press Ctrl+C to stop both.
cd "$(dirname "$0")"
./start-backend.sh &
BACK=$!
trap 'kill $BACK 2>/dev/null; exit' INT TERM EXIT
echo "Waiting for the backend..."
for i in $(seq 1 600); do
  curl -s http://127.0.0.1:8040/api/health >/dev/null 2>&1 && break
  kill -0 $BACK 2>/dev/null || { echo "The backend stopped - see the messages above."; exit 1; }
  sleep 1
done
./start-frontend.sh
