# ArtOfSoul.N — your personal AI art teacher

A colourful, animated art-teaching app that runs **entirely on your own computer, for free**. You answer a few
questions, the AI builds a personalised pencil-drawing or painting plan, and Muse — an animated, talking teacher —
walks you through each lesson, checks your understanding, and gives feedback on photos of your practice.

**Home → Questions → Roadmap → Learning studio → Practice → Progress**

No sign-up, no API keys, no subscriptions. "Free" means no paid service is required — your hardware, electricity,
disk space and the one-time model downloads are the real costs.

---

## Quick start (Windows)

1. Install, all free:
   - [Python 3.11+](https://www.python.org/downloads/) — tick **Add python.exe to PATH**
   - [Node.js LTS](https://nodejs.org/)
   - [Ollama](https://ollama.com/download) — runs the AI model locally
2. Double-click **`start-backend.bat`**. The first run installs packages, the voice (~60 MB) and the AI model
   (several GB). Wait for `Uvicorn running…` and leave the window open.
3. Double-click **`start-frontend.bat`**. Your browser opens **http://localhost:5174**.

Next time, just double-click the two files again. After the downloads, everything works offline.

> http://localhost:8040 is the backend only; the app is at http://localhost:5174.

## Quick start (Ubuntu / Linux)

1. Install the prerequisites (one time):

   ```bash
   sudo apt update && sudo apt install -y python3 python3-venv python3-pip curl unzip
   # Node.js 20+ (Ubuntu's own apt version is often too old):
   curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash - && sudo apt install -y nodejs
   # Ollama (runs the AI model locally, installs as a background service):
   curl -fsSL https://ollama.com/install.sh | sh
   ```

2. In the project folder, start everything with one command:

   ```bash
   chmod +x start.sh start-backend.sh start-frontend.sh   # only needed once, if the zip lost permissions
   ./start.sh
   ```

   The first run installs packages, the voice and the AI model (several GB). Your browser opens
   **http://localhost:5174**. Press **Ctrl+C** in the terminal to stop.

   Prefer two terminals? Run `./start-backend.sh` in one and `./start-frontend.sh` in the other.

NVIDIA GPU on Linux: install the NVIDIA driver; Ollama uses the GPU automatically (`nvidia-smi` should list it).

---

## What runs locally

| Part | What it uses | Cost | Notes |
|---|---|---|---|
| Teacher, plans, lessons, answers | **Gemma 4** via Ollama | free | Apache 2.0 licence. One model serves every role. |
| Artwork feedback | **Gemma 4** (it reads images) | free | Two passes: describe what's visible → rate against explicit rubrics |
| Voice | **Piper** with the `en_US-ljspeech-medium` voice | free | Piper is GPL-3.0; the LJSpeech dataset is public domain. Falls back to the Windows system voice. |
| Avatar & demonstrations | Animated SVG in the browser (Framer Motion) | free | Mouth follows the real audio level with Piper; word timing with the system voice |
| Pictures for lesson steps | Optional local **Stable Diffusion WebUI / Forge** | free | Off by default; needs a GPU. Without it, each step shows an animated demonstration |
| Data | **SQLite** in `backend\data\` | free | Profile, plan, progress, artwork and cached lessons |

### Pick the model for your computer

The **Progress → Setup** panel reads your RAM/GPU and recommends one. To switch, run `ollama pull <model>` and change
the six `MODEL_*` lines in `backend\.env`.

| Your machine | Model | Download |
|---|---|---|
| 8 GB RAM | `gemma4:e2b` | ~7 GB |
| 16 GB RAM | `gemma4:e4b` (default) | ~10 GB |
| NVIDIA GPU 10 GB+ or 32 GB RAM | `gemma4:12b` | ~8 GB |

On a laptop without a GPU, expect a lesson to take a minute or more to prepare and a full plan several minutes.
Lesson scripts are **cached**: each lesson is written once and replays instantly afterwards.

### Optional: generated pictures

Local image generation is only practical with an NVIDIA GPU (≈6 GB+ VRAM). Install
[Stable Diffusion WebUI Forge](https://github.com/lllyasviel/stable-diffusion-webui-forge), start it with `--api`, then
set `MODEL_IMAGE=sdwebui:default` in `backend\.env`. Check the licence of whichever checkpoint you install. Generated
pictures are always labelled "AI-generated reference" and cached per lesson step.

### About "videos"

Each lesson can be played as a **narrated lesson**: the teacher speaks each part while animated demonstrations (or
generated pictures) play, advancing automatically. It's a narrated, animated slide sequence — not a generated video
file, and the app labels it that way. The lesson format (ordered steps, each with narration and a visual prompt) is
what a future frame-sequence video generator would consume.

---

## Pages

| Page | What happens |
|---|---|
| **Home** | Meet Muse; one button: *Start My Art Journey* |
| **Questions** | One friendly question at a time: name, pencil or painting, paint type, level, what you love to draw, goal, daily time, techniques. Custom answers allowed |
| **Roadmap** | Animated path of stages and lessons (done / you are here / upcoming). Tap a lesson for details. Shows your daily practice routine and any changes made from your practice |
| **Learning studio** | Muse introduces the lesson, explains the idea, walks through each step with an animated demonstration, asks a quick check question, then sets a practice task. Ask Muse questions any time |
| **Practice** | Upload a photo → feedback: what went well, what to improve and why, next steps, next exercise. Results update the roadmap |
| **Progress** | Continue where you left off; lessons, checks and reviewed pieces; skills; and a setup check for this computer |

---

## How it adapts

- **Plan:** built from your answers and an original skill graph (42 skills with prerequisites, informed by published
  university course descriptions listed in `backend/app/curriculum/sources.py`). Beginners get foundations first;
  experienced artists skip them. Lessons are always ordered so prerequisites come first.
- **Feedback → roadmap:** each artwork rating must cite something the vision model actually observed. Two weak
  results on a skill add a focused-practice lesson before anything that depends on it; repeated solid results let
  you skip ahead. Every change is recorded with its reason.
- **Honesty rules:** if a photo can't be judged (glare, blur, wrong subject) nothing is recorded and you're asked to
  retake it. No feature substitutes canned text for a model call; if the AI isn't running you get a clear message.

---

## Troubleshooting

| Problem | Fix |
|---|---|
| `'irm' is not recognized` | That command is for PowerShell, not Command Prompt — or use the installer from ollama.com/download |
| "Ollama isn't running" | Windows: start the Ollama app (llama icon in the tray). Ubuntu: `sudo systemctl start ollama` (or `ollama serve`) |
| Ubuntu: `python3 -m venv` fails | `sudo apt install python3-venv` |
| Ubuntu: frontend says Node is too old | Install Node 22 from NodeSource (see Quick start) |
| Ubuntu: `Permission denied` running `./start.sh` | `chmod +x start.sh start-backend.sh start-frontend.sh` |
| "The model 'gemma4:e4b' isn't downloaded" | Run `ollama pull gemma4:e4b` |
| Plan or lesson fails with "didn't return valid structured output" | Press *Try again*; if it repeats, use a larger model (`gemma4:12b`) |
| Very slow replies | Use `gemma4:e2b`, close other heavy apps, or use a GPU |
| No voice | Check *Voice on* in the studio; with Piper missing the Windows voice is used. Reinstall with `pip install -r backend\requirements-voice.txt` |
| "I can't reach the ArtOfSoul.N server" | Run `start-backend.bat` and wait for `Uvicorn running` |
| Port already in use | Close the other program using 8040 / 5174 |

---

## For developers

```
backend/   FastAPI · SQLAlchemy · Alembic · SQLite (PostgreSQL also supported)
  app/api/journey.py        local session, questions, lesson scripts, checks, step visuals, TTS, hardware, progress
  app/ai/local.py           Ollama (JSON-schema constrained output, retries) · Stable Diffusion WebUI
  app/services/lessons.py   cached lesson scripts, demo fallback, understanding checks
  app/services/tts.py       Piper voice with on-disk cache
  app/curriculum/           skill graph, BM25 retrieval, institutional source records
frontend/  React 19 · Vite · TypeScript · Tailwind v4 · motion (Framer Motion) · self-hosted fonts (no CDN)
  src/components/Avatar.tsx  animated teacher   src/components/Demos.tsx  12 animated demonstrations
  src/lib/speech.ts          Piper/system voice with lip-sync level
models/    local model notes (large files are never committed)
```

Manual start: `cd backend && pip install -r requirements-dev.txt && uvicorn app.main:app --port 8040`, then
`cd frontend && npm install && npm run dev`. Tests: `cd backend && pytest -q`.

Docker (`docker compose up -d --build`, then `docker compose exec ollama ollama pull gemma4:e4b`) runs the same
stack with PostgreSQL; it uses the browser voice and is CPU-only unless you enable GPU support.

Optional paid/cloud providers (Anthropic, OpenAI, any OpenAI-compatible server) can still be set per role in `.env`;
none is required.

### Verified / not verified

- **Verified here:** 23 backend tests (SQLite and PostgreSQL), including the full journey with the AI replaced at
  the provider boundary by a scripted fake, the Ollama/Stable Diffusion adapters against mocked HTTP responses,
  migrations upgrading an existing database, and a headless-browser walkthrough of every page on desktop and mobile.
- **Not verified here:** real Gemma 4 output quality, real Piper audio, and real image generation — Ollama, Piper
  voices and model downloads are blocked in the build environment. Try one full lesson on your machine.
