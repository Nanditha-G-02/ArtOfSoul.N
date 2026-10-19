#!/usr/bin/env bash
# ArtOfSoul.N backend for Ubuntu/Linux - free local AI. First run sets everything up; later runs just start.
set -e
cd "$(dirname "$0")/backend"

if ! command -v python3 >/dev/null; then
  echo "Python 3 not found. Install it with:  sudo apt install python3 python3-venv python3-pip"; exit 1
fi
if [ ! -d .venv ]; then
  echo "Creating Python environment - first run only, takes a few minutes..."
  python3 -m venv .venv || { echo; echo "Install venv support first:  sudo apt install python3-venv"; exit 1; }
fi
source .venv/bin/activate
python -c "import psutil" 2>/dev/null || pip install -r requirements.txt
[ -f .env ] || cp ../.env.example .env

# --- Local voice (optional): Piper + a public-domain voice ---
python -c "import piper" 2>/dev/null || { echo "Installing the local voice engine..."; pip install -r requirements-voice.txt || echo "Voice engine not installed - the app will use the browser's voice."; }
if [ ! -f ../models/piper/en_US-ljspeech-medium.onnx ] && python -c "import piper" 2>/dev/null; then
  echo "Downloading the teacher's voice - about 60 MB, one time..."
  python -m piper.download_voices en_US-ljspeech-medium --data-dir ../models/piper || echo "Voice download failed - the app will use the browser's voice."
fi

# --- Local AI model through Ollama ---
MODEL=$(grep -E '^MODEL_TEACHER=ollama:' .env | head -1 | sed 's/^MODEL_TEACHER=ollama://')
MODEL=${MODEL:-gemma4:e4b}
if ! command -v ollama >/dev/null; then
  echo
  echo "  Ollama is not installed. It runs the free AI models on this computer. Install it with:"
  echo "     curl -fsSL https://ollama.com/install.sh | sh"
  echo "  then run this script again. The app will still open, but the AI teacher stays off until then."
  echo
else
  if ! ollama list >/dev/null 2>&1; then
    echo "Starting the Ollama service..."
    (ollama serve >/dev/null 2>&1 &) ; sleep 3
  fi
  if ! ollama list | grep -qi "^${MODEL}[[:space:]]"; then
    echo "Downloading the free AI model ${MODEL} - one time, several GB..."
    ollama pull "${MODEL}"
  fi
fi

echo
echo "Starting ArtOfSoul.N on http://localhost:8040  (leave this terminal open, then run ./start-frontend.sh)"
exec uvicorn app.main:app --host 127.0.0.1 --port 8040
