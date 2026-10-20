# Installation guide

ArtOfSoul.N has three parts that all run on your computer:

| Part | Port | Started by |
|---|---|---|
| Ollama (AI models) | 11434 | the Ollama app / service |
| Backend (FastAPI) | 8040 | `start-backend.sh` / `.bat`, or `uvicorn` |
| Frontend (React) | 5174 | `start-frontend.sh` / `.bat`, or `npm run dev` |

Open the app at **http://localhost:5174**. Port 8040 is the API only.

## 1. Requirements

| | Version | Check with |
|---|---|---|
| Git | any | `git --version` |
| Python | 3.11 or newer | `python3 --version` (Windows: `python --version`) |
| Node.js | 20 or newer | `node --version` |
| Ollama | latest | `ollama --version` |

**Hardware:** 8 GB RAM minimum (Fast level), 16 GB recommended (Balanced, the default). An NVIDIA GPU makes
everything much faster. Free disk space: about 12 GB for the default model, more for larger levels.

## 2. Ubuntu / Linux

### 2.1 Install prerequisites (one time)

```bash
sudo apt update
sudo apt install -y python3 python3-venv python3-pip curl git

# Node.js 22 (Ubuntu's own nodejs package is usually too old)
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs

# Ollama (installs and starts a background service)
curl -fsSL https://ollama.com/install.sh | sh
```

### 2.2 Clone the repository

```bash
git clone <your-repository-url> ArtOfSoul.N
cd ArtOfSoul.N
```

### 2.3 Start

```bash
chmod +x start.sh start-backend.sh start-frontend.sh    # once
./start.sh
```

`start.sh` runs `start-backend.sh` in the background, waits for `http://127.0.0.1:8040/api/health`, then runs
`start-frontend.sh`. On the **first run** it:

1. creates `backend/.venv` and installs `backend/requirements.txt`;
2. copies `.env.example` to `backend/.env` if missing;
3. installs the optional Piper voice engine (`backend/requirements-voice.txt`) and downloads the
   `en_US-ljspeech-medium` voice into `models/piper/` (~60 MB) — if either fails, the app uses the system voice;
4. starts Ollama if it isn't running and pulls the model named in `MODEL_TEACHER` (default `gemma4:e4b`);
5. installs the frontend packages (`npm install`) and opens the browser.

Press **Ctrl+C** to stop both servers. To run them separately, use `./start-backend.sh` and `./start-frontend.sh` in two
terminals.

## 3. Windows

1. Install:
   - [Python 3.11+](https://www.python.org/downloads/) — on the first installer screen tick **Add python.exe to PATH**
   - [Node.js LTS](https://nodejs.org/)
   - [Ollama](https://ollama.com/download) — run the installer; a llama icon appears in the tray
2. Clone the repository (`git clone …`) or download it as a ZIP and extract it.
3. Double-click **`start-backend.bat`**. First run: creates the virtual environment, installs packages, the voice and
   the AI model. Wait for `Uvicorn running on http://127.0.0.1:8040` and leave the window open.
4. Double-click **`start-frontend.bat`**. It installs frontend packages the first time and opens
   http://localhost:5174.

> If you type commands yourself: `irm … | iex` style commands are for **PowerShell**, not Command Prompt.

## 4. Manual setup (any OS)

### 4.1 Backend

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate                 # Windows PowerShell: .venv\Scripts\Activate.ps1
pip install -r requirements-dev.txt       # app + pytest
pip install -r requirements-voice.txt     # optional: local Piper voice
cp ../.env.example .env                   # Windows: copy ..\.env.example .env
python -m piper.download_voices en_US-ljspeech-medium --data-dir ../models/piper   # optional voice file
ollama pull gemma4:e4b
uvicorn app.main:app --host 127.0.0.1 --port 8040
```

On start-up the backend runs database migrations and seeds the curriculum automatically. The SQLite database is created
at `backend/data/artofsoul.db`.

A root-level `requirements.txt` simply includes `backend/requirements.txt`, so `pip install -r requirements.txt` from the
repository root works too.

### 4.2 Frontend

```bash
cd frontend
npm install
npm run dev            # http://localhost:5174, proxies /api to http://localhost:8040
```

Production build: `npm run build` (output in `frontend/dist/`), preview with `npm run preview`.

## 5. Docker (optional)

`docker-compose.yml` runs PostgreSQL, Ollama, the backend and the frontend (nginx):

```bash
cp .env.example .env
docker compose up -d --build
docker compose exec ollama ollama pull gemma4:e4b
```

Open http://localhost:5174. Data persists in the `pgdata`, `storage` and `ollama` volumes. The Docker backend doesn't
install Piper, so the browser voice is used. Ollama in Docker is CPU-only unless you enable the commented GPU section.

## 6. Choosing the AI model

Use **Progress → Setup → AI quality** in the app. It recommends a level from your RAM and GPU and downloads anything
missing:

| Level | Teacher | Vision | Download (approx.) | Needs |
|---|---|---|---|---|
| Fast | `gemma4:e2b` | same | ~7 GB | 8 GB RAM |
| Balanced | `gemma4:e4b` | same | ~10 GB | 16 GB RAM |
| Accurate | `gemma4:12b` | `qwen3-vl:8b` | ~8 GB + ~6 GB | GPU 10 GB+ or 32 GB RAM |
| Best | `gemma4:26b` | same | ~18 GB | GPU 20 GB+ or 48 GB RAM |

Alternatively pull a model yourself (`ollama pull gemma4:e2b`) and set the six `MODEL_*` lines in `backend/.env`.

## 7. Optional: local image generation

Only practical with an NVIDIA GPU (≈6 GB+ VRAM). Install
[Stable Diffusion WebUI Forge](https://github.com/lllyasviel/stable-diffusion-webui-forge), start it with `--api`, then
set in `backend/.env`:

```
MODEL_IMAGE=sdwebui:default
SD_WEBUI_URL=http://127.0.0.1:7860
```

The studio then shows "Show me a picture" on lesson steps.

## 8. Updating

```bash
git pull
cd frontend && npm install && cd ..
./start.sh
```

Then hard-refresh the browser (**Ctrl+Shift+R**). Database migrations run automatically; your plan and progress are
kept.

## 9. Verify the installation

```bash
curl http://localhost:8040/api/health          # {"status":"ok","app":"ArtOfSoul.N"}
curl http://localhost:8040/api/system/models   # AI quality levels and what's installed
```

In the app, **Progress → Setup** should show *AI teacher: ready*.
