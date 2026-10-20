# Troubleshooting

Most problems are one of three things: the wrong address is open, Ollama or the model isn't ready, or the computer is
slow for the chosen AI level. The backend terminal always shows the full error.

## Quick checks

```bash
curl http://localhost:8040/api/health        # backend up?
curl http://localhost:11434/api/tags         # Ollama up? lists downloaded models
ollama list                                  # same, from the command line
```

In the app: **Progress → Setup** shows the AI teacher, vision and voice status.

---

## Installation

### `'irm' is not recognized as an internal or external command` (Windows)
`irm … | iex` is a **PowerShell** command; you ran it in Command Prompt. Open **PowerShell** and run it there, or simply
install Ollama with the installer from https://ollama.com/download.

### `python3: command not found` / `'python' is not recognized` (Windows)
Install Python 3.11+ from python.org and tick **Add python.exe to PATH**, then open a new terminal.

### `Ollama is not installed` from the start script
Ubuntu: `curl -fsSL https://ollama.com/install.sh | sh`. Windows: run the installer from https://ollama.com/download.
Then run the start script again.

### `The virtual environment was not created` / `ensurepip is not available` (Ubuntu)
```bash
sudo apt install -y python3-venv python3-pip
rm -rf backend/.venv
./start-backend.sh
```

### `Permission denied` when running `./start.sh`
```bash
chmod +x start.sh start-backend.sh start-frontend.sh
```

### Frontend fails to build or `npm install` errors about the engine
Node.js is too old. Check `node --version`; install Node 20 or newer (on Ubuntu use the NodeSource commands in the
[installation guide](installation_guide.md)), then `rm -rf frontend/node_modules && cd frontend && npm install`.

### Piper voice didn't install / G sounds robotic
The app falls back to the browser's voice when Piper is missing. To install it:
```bash
cd backend && source .venv/bin/activate
pip install -r requirements-voice.txt
python -m piper.download_voices en_US-ljspeech-medium --data-dir ../models/piper
```
Restart the backend. **Progress → Setup** should show the voice as ready.

---

## Running

### `{"detail":"Not Found"}` or 404 at http://localhost:8040
Port 8040 is the API. Open the app at **http://localhost:5174**. (404s for `/favicon.ico` in the backend log are
harmless.)

### `Address already in use` / port 8040 or 5174 is busy
Another copy is still running. Close the other terminal, or:
```bash
# Ubuntu
fuser -k 8040/tcp 5174/tcp
# Windows (PowerShell)
Get-NetTCPConnection -LocalPort 8040 | % { Stop-Process -Id $_.OwningProcess }
```

### `Can't reach the ArtOfSoul.N server`
The backend isn't running or crashed. Start `start-backend.sh` / `.bat` and read the last lines in its window.

### `Ollama isn't running at http://localhost:11434`
Start Ollama: on Windows open the Ollama app (tray icon); on Ubuntu `sudo systemctl start ollama` or `ollama serve`.

### `The model 'gemma4:e4b' isn't downloaded yet`
Run `ollama pull gemma4:e4b`, or download from **Progress → Setup → AI quality**.

### `Something went wrong on the ArtOfSoul.N server` (500) when opening a lesson
Fixed in the current version: model output is now cleaned and validated before use, and connection problems become
clear messages. Update (`git pull`), restart the backend and hard-refresh the browser (**Ctrl+Shift+R**). If it
persists, the traceback is in the backend terminal; try **Rewrite lesson** or a different AI level.

### `The local model didn't return valid structured output` (502)
Small models occasionally produce invalid JSON; the backend already retries once. Try again, or switch to a larger level
(Balanced or Accurate).

### Out-of-memory / the model stops part-way
Choose a smaller level (**Fast**), close other heavy programs, or lower `OLLAMA_NUM_CTX` to `8192` in `backend/.env`.

---

## Onboarding

### `String should have at least 8 characters` when creating the plan
Fixed: the goal's minimum length is now 2 characters and the app sends a full sentence built from your answers. Update
and hard-refresh the browser.

### `Choose a paint type`
Painting needs a paint (watercolour, acrylic or oil). This used to appear when a double-click skipped that question.
The current version ignores double-clicks and takes you back to any unanswered required question. Update and
hard-refresh; if it still appears, go back and pick the paint type.

---

## Performance

### Creating the plan or a lesson takes several minutes
Expected on a CPU-only computer. To speed things up:

1. Use **Fast** in **Progress → Setup → AI quality** (or keep **Balanced** if you have 16 GB RAM and a GPU).
2. Keep `OLLAMA_THINK=false` (default).
3. Leave `PREFETCH_NEXT_LESSON=true` so the next lesson is written while you study.
4. Keep the backend running — the model stays loaded for `OLLAMA_KEEP_ALIVE` (60 minutes).
5. An NVIDIA GPU makes the biggest difference.

### Rate limit: `You're going a little fast…` (429)
Wait a minute, or raise `RATE_LIMIT_AI_PER_MINUTE` in `backend/.env`.

---

## Display

### The lesson panel is cut off or the page scrolls sideways
Fixed: the lesson column can no longer widen the page. Update and hard-refresh.

### Changes don't appear after updating
Hard-refresh (**Ctrl+Shift+R**). If you use `npm run preview`, run `npm run build` again first.

---

## Data

### Start over with a fresh learner
Stop the backend and delete `backend/data/` (database, uploaded images, cached speech, saved AI choice). It is
recreated on the next start. This permanently removes your progress.

### Reset the AI level to the `.env` values
Delete `backend/data/model_choice.json`.

---

## Running the tests

```bash
cd backend
source .venv/bin/activate         # Windows: .venv\Scripts\activate
pip install -r requirements-dev.txt
python -m pytest -q               # 31 tests, no Ollama needed (AI is faked)
```

Against PostgreSQL: `TEST_DATABASE_URL=postgresql+psycopg://user:pass@localhost:5432/artofsoul_test python -m pytest -q`.

Frontend type-check and build: `cd frontend && npm run build`.
