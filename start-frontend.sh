#!/usr/bin/env bash
# ArtOfSoul.N frontend for Ubuntu/Linux. Run ./start-backend.sh first (in another terminal).
set -e
cd "$(dirname "$0")/frontend"
if ! command -v npm >/dev/null; then
  echo "Node.js not found. Install Node 22 LTS, for example:"
  echo "   curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -  &&  sudo apt install -y nodejs"
  exit 1
fi
NODE_MAJOR=$(node -p 'process.versions.node.split(".")[0]')
if [ "$NODE_MAJOR" -lt 20 ]; then
  echo "Your Node.js is version $(node -v); this app needs Node 20 or newer (Ubuntu's apt version is often too old)."
  echo "   curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -  &&  sudo apt install -y nodejs"
  exit 1
fi
[ -d node_modules ] || { echo "Installing frontend packages..."; npm install; }
echo "Open http://localhost:5174  (leave this terminal open)"
( sleep 4; command -v xdg-open >/dev/null && xdg-open http://localhost:5174 >/dev/null 2>&1 || true ) &
exec npm run dev
