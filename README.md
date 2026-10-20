<div align="center">

# 🎨 ArtOfSoul.N

### Your personal AI art teacher — free, private and running on your own computer

Learn **pencil drawing** or **painting** with **G**, an animated AI tutor who plans your lessons,
teaches each step out loud, lets you practise interactively, and gives honest feedback on photos of your work.

![React](https://img.shields.io/badge/React-19-149eca?logo=react&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178c6?logo=typescript&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-8-646cff?logo=vite&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-4-38bdf8?logo=tailwindcss&logoColor=white)
![FastAPI](https://img.shields.io/badge/FastAPI-Python_3.11+-009688?logo=fastapi&logoColor=white)
![SQLite](https://img.shields.io/badge/SQLite-default-003b57?logo=sqlite&logoColor=white)
![Ollama](https://img.shields.io/badge/AI-Ollama_(local)-000000)
![License: MIT](https://img.shields.io/badge/License-MIT-green)

<img src="assets/images/01-home.jpg" alt="ArtOfSoul.N home page: a painted dawn landscape with the headline 'Your personal AI art teacher.'" width="900">

</div>

---

## Contents

- [What it is](#what-it-is)
- [Key features](#key-features)
- [Screenshots](#screenshots)
- [Technology stack](#technology-stack)
- [Architecture](#architecture)
- [Project structure](#project-structure)
- [Quick start](#quick-start)
- [Configuration](#configuration)
- [API](#api)
- [Testing](#testing)
- [Troubleshooting](#troubleshooting)
- [Documentation](#documentation)
- [Roadmap](#roadmap)
- [Contributing](#contributing)
- [License and acknowledgements](#license-and-acknowledgements)

---

## What it is

ArtOfSoul.N is a full-stack web app that acts as a **personal art teacher** for two subjects only — **pencil drawing**
(graphite) and **painting** (oil, acrylic or watercolour, taught as different media).

Learning art alone is hard: tutorials are generic, nobody plans what to learn next, and nobody looks at your work.
ArtOfSoul.N asks a few questions, builds a plan in the right order for your level and daily time, teaches each lesson
with narration and animated demonstrations, and reviews photos of your practice — then adapts your plan from that
evidence.

**Everything runs locally.** The AI models run through [Ollama](https://ollama.com) on your own machine: no sign-up,
no API keys, no subscriptions, and your artwork never leaves your computer. "Free" means no paid service is required;
your hardware, electricity and the one-time model downloads are the real costs.

**Who it's for:** self-taught artists and hobbyists from beginner to experienced, students who want structured
practice between classes, and anyone who wants feedback on their drawings without sharing them online.

---

## Key features

| Area | What's implemented |
|---|---|
| **Onboarding** | One question at a time, spoken by the tutor: name, pencil or painting, paint type, level, favourite subjects, goal, daily time and techniques to improve. Custom answers allowed; double-clicks and missing answers are handled. |
| **Personalised plan** | 6–10 lessons in 3–4 stages, ordered by a **prerequisite skill graph** (42 skills). Beginners get foundations first; experienced artists skip them. Includes a daily practice routine. |
| **Animated roadmap** | A winding path of lessons (done / *you are here* / upcoming), milestones, lesson details on tap, rebuild or change answers. |
| **AI tutor "G"** | Portrait tutor with breathing/float/tilt animation; while speaking a paint-colour halo, nod and live sound-wave follow the voice; thinking dots; paint-splash burst on correct answers. |
| **Voice** | Local **Piper** text-to-speech (offline), with automatic fallback to the operating system's voice. |
| **Learning studio** | Each lesson: welcome → the idea → **key-word flashcards** → steps with **12 animated demonstrations** → **put-the-steps-in-order** challenge → **value lab** (pencil) or **colour lab** (painting) → **3-question quiz** → practice task. "Play narrated lesson" auto-advances and pauses at interactive parts. Ask the tutor questions any time. |
| **Sketch pad** | Draw right in the lesson (pencil grades 2H–6B or a paint palette, pen pressure, eraser, undo) and send the sketch to the tutor for quick feedback. |
| **Practice feedback** | Upload a photo: a vision model describes only what's visible, then a separate rubric pass rates skills. You get strengths, improvements with reasons, next steps and a recommended exercise. Unclear photos are rejected honestly. |
| **Adaptive roadmap** | Repeated weak results insert a focused-practice lesson; repeated solid results let you skip ahead. Every change is recorded with its reason. |
| **Progress** | Lessons finished, quiz score, reviewed pieces, day streak, activities played, skills, recent practice, and a hardware check. |
| **AI quality picker** | Fast / Balanced / Accurate / Best — downloads missing models inside the app with a progress bar. "Accurate" adds a specialist vision model (`qwen3-vl:8b`). |
| **Speed** | Model warm-up at start-up, next lesson written in the background, lessons cached, short prompts, "thinking" mode off. |
| **Grounding** | Lesson prompts include the curriculum's own skill descriptions and checked basics for your medium (e.g. *fat over lean* for oil). Curriculum informed by 14 published university course descriptions, each linked to its source. |

> Optional: local image generation through Stable Diffusion WebUI / Forge (off by default; needs a GPU).

---

## Screenshots

> Screenshots were captured from the running app with **illustrative sample lesson text** (the AI model can't run in
> the environment where they were taken). Your own lessons and feedback are written by the local model.

| | |
|---|---|
| <img src="assets/images/02-questions.jpg" alt="Question flow with the tutor portrait" width="440"><br>**Questions** — one at a time | <img src="assets/images/03-roadmap.jpg" alt="Animated roadmap with practice routine" width="440"><br>**Roadmap** — your path and daily routine |
| <img src="assets/images/04-studio-step.jpg" alt="Lesson step with animated sphere-shading demonstration" width="440"><br>**Studio** — narrated step with animated demo | <img src="assets/images/06-sketch-pad.jpg" alt="Sketch pad with pencil grades" width="440"><br>**Sketch pad** — try it, then show G |
| <img src="assets/images/07-value-lab.jpg" alt="Value matching game" width="440"><br>**Value lab** — train your eye | <img src="assets/images/08-quiz.jpg" alt="Quiz question answered correctly" width="440"><br>**Quiz** — with explanations |
| <img src="assets/images/09-practice-feedback.jpg" alt="Photo feedback with strengths and improvements" width="440"><br>**Practice feedback** | <img src="assets/images/11-ai-quality.jpg" alt="AI quality picker with four levels" width="440"><br>**AI quality** — pick and download models |

More in [`assets/images/`](assets/images).

---

## Technology stack

| Layer | Technology |
|---|---|
| Frontend | React 19, TypeScript, Vite 8, React Router 7, Tailwind CSS 4, `motion` (Framer Motion), self-hosted Plus Jakarta Sans font |
| Backend | Python 3.11+, FastAPI, Pydantic 2 + pydantic-settings, SQLAlchemy 2, Alembic, Uvicorn |
| Database | SQLite (default, file in `backend/data/`); PostgreSQL supported (`psycopg`) |
| Local AI | Ollama — Gemma 4 (`gemma4:e2b` / `e4b` / `12b` / `26b`), optional `qwen3-vl:8b` for vision |
| Voice | Piper TTS (`piper-tts`, voice `en_US-ljspeech-medium`) or the browser's Web Speech API |
| Images (optional) | Stable Diffusion WebUI / Forge HTTP API |
| Other | Pillow (safe image handling), bcrypt + PyJWT (session tokens), httpx, psutil (hardware check) |
| Optional cloud | Anthropic / OpenAI / any OpenAI-compatible server, per role — **not required** |
| Tooling | pytest, Playwright (screenshots/QA), Docker Compose (optional) |

---

## Architecture

```mermaid
flowchart LR
    subgraph Browser["Browser — React app (localhost:5174)"]
        UI["Pages: Home · Questions · Roadmap<br/>Studio · Practice · Progress"]
        Voice["Voice hook<br/>Piper audio or system voice"]
    end

    subgraph API["FastAPI backend (localhost:8040)"]
        Routers["Routers<br/>journey · learning · studio · account"]
        Services["Services<br/>syllabus · lessons · analysis · roadmap · skills · tts · hardware"]
        Curriculum["Curriculum engine<br/>skill graph · BM25 retrieval · sources"]
        Router["Model router<br/>role → provider:model"]
    end

    DB[("SQLite<br/>backend/data")]
    Files[("Uploaded artwork<br/>& cached audio")]
    Ollama["Ollama<br/>localhost:11434<br/>Gemma 4 / Qwen3-VL"]
    Piper["Piper voice model<br/>models/piper"]
    SD["Stable Diffusion WebUI<br/>(optional)"]

    UI -- "fetch /api/* (Vite proxy)" --> Routers
    Voice -- "POST /api/tts" --> Routers
    Routers --> Services
    Services --> Curriculum
    Services --> Router
    Services --> DB
    Services --> Files
    Router --> Ollama
    Router -.-> SD
    Services --> Piper
```

The full write-up, including the lesson and feedback flows, is in [docs/system_architecture.md](docs/system_architecture.md).

---

## Project structure

```
ArtOfSoul.N/
├── README.md                  ← you are here
├── LICENSE                    MIT
├── requirements.txt           → backend/requirements.txt
├── .env.example               all settings, safe placeholders
├── start.sh                   Ubuntu/Linux: start everything
├── start-backend.sh/.bat      backend launcher (Linux / Windows)
├── start-frontend.sh/.bat     frontend launcher (Linux / Windows)
├── docker-compose.yml         optional: Postgres + Ollama + backend + frontend
├── backend/
│   ├── app/
│   │   ├── main.py            FastAPI app, migrations, warm-up, error handlers
│   │   ├── config.py          all settings (environment variables)
│   │   ├── models.py          SQLAlchemy tables
│   │   ├── api/               journey, learning, studio, account routers
│   │   ├── ai/                model router, Ollama/SD/cloud providers, prompts, quality profiles
│   │   ├── curriculum/        sources, skill graph, retrieval, seed
│   │   └── services/          lessons, syllabus, analysis, roadmap, skills, tts, media, hardware…
│   ├── migrations/            Alembic (0001–0003)
│   ├── tests/                 31 pytest tests
│   └── requirements*.txt
├── frontend/
│   ├── src/
│   │   ├── pages/             Home, Start, RoadmapPage, Studio, Practice, Progress
│   │   ├── components/        Avatar, Landscape, Demos, Interactive, ModelPicker, Shell, ui
│   │   ├── lib/               api, session, speech, tutor, hooks, types
│   │   └── assets/tutor.jpg   tutor portrait
│   └── package.json
├── models/                    local model notes (large files are not committed)
├── assets/images/             screenshots
└── docs/                      full documentation
```

---

## Quick start

### Requirements

| | Minimum | Notes |
|---|---|---|
| Python | 3.11+ | `python3-venv` on Ubuntu |
| Node.js | 20+ | Ubuntu's apt version is often too old — use NodeSource |
| Ollama | latest | [ollama.com/download](https://ollama.com/download) |
| RAM | 8 GB | 16 GB recommended; see [AI quality](#ai-quality) |
| Disk | ~12 GB free | default model ≈ 10 GB, voice ≈ 60 MB |

### Ubuntu / Linux

```bash
# 1. Prerequisites (one time)
sudo apt update && sudo apt install -y python3 python3-venv python3-pip curl git
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash - && sudo apt install -y nodejs
curl -fsSL https://ollama.com/install.sh | sh

# 2. Get the code
git clone <your-repository-url> ArtOfSoul.N
cd ArtOfSoul.N

# 3. Start everything (first run installs packages, the voice and the AI model)
chmod +x start.sh start-backend.sh start-frontend.sh
./start.sh
```

Open **http://localhost:5174**. Press **Ctrl+C** to stop.

### Windows

1. Install [Python 3.11+](https://www.python.org/downloads/) (tick **Add python.exe to PATH**),
   [Node.js LTS](https://nodejs.org/) and [Ollama](https://ollama.com/download).
2. Clone or download this repository.
3. Double-click **`start-backend.bat`** and wait for `Uvicorn running`.
4. Double-click **`start-frontend.bat`** — the browser opens http://localhost:5174.

### Manual start (any OS)

```bash
# Backend
cd backend
python -m venv .venv
source .venv/bin/activate            # Windows: .venv\Scripts\activate
pip install -r requirements-dev.txt
pip install -r requirements-voice.txt   # optional local voice
cp ../.env.example .env              # Windows: copy ..\.env.example .env
ollama pull gemma4:e4b
uvicorn app.main:app --port 8040

# Frontend (second terminal)
cd frontend
npm install
npm run dev                          # http://localhost:5174 (proxies /api to :8040)
```

> **http://localhost:8040 is the API only** — opening it in a browser shows a short JSON message.
> The app is at **http://localhost:5174**. Interactive API docs: **http://localhost:8040/docs**.

Full guide: [docs/installation_guide.md](docs/installation_guide.md).

---

## Configuration

All settings are environment variables read by `backend/app/config.py`. Copy `.env.example` to `backend/.env`; the
defaults already work for local use. The most useful ones:

| Variable | Default | Purpose |
|---|---|---|
| `MODEL_TEACHER` … `MODEL_EXERCISE` | `ollama:gemma4:e4b` | Model per AI role (`provider:model`) |
| `MODEL_VISION` | `ollama:gemma4:e4b` | Model that looks at artwork |
| `MODEL_IMAGE` | `none:` | `sdwebui:default` to enable local image generation |
| `OLLAMA_URL` | `http://localhost:11434` | Where Ollama runs |
| `OLLAMA_THINK` | `false` | Gemma "thinking" mode (slower) |
| `PREFETCH_NEXT_LESSON` | `true` | Write the next lesson in the background |
| `TUTOR_NAME` | `G` | The name the AI uses for itself |
| `DATABASE_URL` | SQLite in `backend/data/` | Any SQLAlchemy URL (PostgreSQL supported) |
| `JWT_SECRET` | placeholder | Signs local session tokens and media links — set your own |

Every variable is described in [docs/configuration_guide.md](docs/configuration_guide.md).

### AI quality

Choose in the app under **Progress → Setup → AI quality** (it recommends one for your hardware and downloads
what's missing):

| Level | Teacher | Vision | Needs |
|---|---|---|---|
| Fast | `gemma4:e2b` | `gemma4:e2b` | 8 GB RAM |
| Balanced *(default)* | `gemma4:e4b` | `gemma4:e4b` | 16 GB RAM |
| Accurate | `gemma4:12b` | `qwen3-vl:8b` | NVIDIA GPU 10 GB+ or 32 GB RAM |
| Best | `gemma4:26b` | `gemma4:26b` | GPU 20 GB+ or 48 GB RAM |

### Change the tutor

Replace `frontend/src/assets/tutor.jpg`, change the name in `frontend/src/lib/tutor.ts`, and set `TUTOR_NAME` in
`backend/.env`.

---

## API

FastAPI serves interactive documentation while the backend runs:

- **Swagger UI:** http://localhost:8040/docs
- **ReDoc:** http://localhost:8040/redoc
- **OpenAPI JSON:** http://localhost:8040/openapi.json

Endpoints used by the current app (all under `/api`, JSON unless noted):

| Method | Path | Purpose |
|---|---|---|
| `POST` | `/local/session` | Get a session for the single local learner (no sign-up) |
| `GET` | `/journey/questions` | The onboarding questions |
| `POST` | `/journey/answers` | Save answers to the learner profile |
| `POST` | `/syllabus` | Build (or rebuild) the personalised plan |
| `GET` | `/roadmap` | Stages, lessons, skills and change history |
| `GET`/`POST` | `/lessons/{id}/script` | Read / write the cached lesson script |
| `POST` | `/lessons/{id}/check` | Answer a quiz question |
| `POST` | `/lessons/{id}/activity` | Record a game, lab or sketch result |
| `PATCH` | `/lessons/{id}` | Start, complete or restore a lesson |
| `POST` | `/artworks` | Upload a photo (multipart) |
| `POST` | `/artworks/{id}/analyze` | Vision + rubric feedback |
| `POST` | `/conversations/{id}/messages` | Ask the tutor a question |
| `POST` | `/tts` | Speech audio (WAV) from the local voice |
| `GET` | `/progress` | Progress, streak, quiz and activity stats |
| `GET` | `/system/hardware`, `/system/models` | Hardware check and AI quality levels |

The backend also contains a fuller set of endpoints (accounts, curriculum search, skills, exercises, references,
palettes…) from the project's first, more advanced version. All 61 operations are documented in
[docs/api_documentation.md](docs/api_documentation.md).

---

## Testing

```bash
cd backend
source .venv/bin/activate
pip install -r requirements-dev.txt
pytest -q                       # 31 tests, ~5 s
# against PostgreSQL:
TEST_DATABASE_URL=postgresql+psycopg://user:pass@localhost:5432/db pytest -q

cd ../frontend
npm run build                   # TypeScript type-check + production build
```

The tests replace the AI **only at the provider boundary** with a scripted fake, so routing, validation,
persistence, adaptive-roadmap rules and error handling all run for real. The Ollama and Stable Diffusion adapters are
tested against mocked HTTP responses. Real model output quality is not covered by automated tests.

---

## Troubleshooting

| Problem | Fix |
|---|---|
| Browser shows `{"message": …}` or 404 at :8040 | That's the API. Open **http://localhost:5174** |
| "Ollama isn't running" | Windows: start the Ollama app. Linux: `sudo systemctl start ollama` |
| "The model … isn't downloaded" | `ollama pull gemma4:e4b`, or use the AI quality picker |
| `'irm' is not recognized` (Windows) | That command is for PowerShell, not Command Prompt — or use the installer |
| Very slow lessons | Choose **Fast**, close heavy apps, or use a GPU; the next lesson is prefetched while you study |
| "didn't return valid structured output" | Press *Try again*; if frequent, choose a larger model |
| No voice | Check *Voice on*; without Piper the system voice is used |
| `Permission denied: ./start.sh` | `chmod +x start.sh start-backend.sh start-frontend.sh` |
| Node too old | Install Node 22 from NodeSource |

Real issues met during development and how they were fixed: [docs/troubleshooting.md](docs/troubleshooting.md).

---

## Documentation

| Document | Contents |
|---|---|
| [Project overview](docs/project_overview.md) | Purpose, users, features, benefits, how the project evolved |
| [System architecture](docs/system_architecture.md) | Components, diagrams, data flows, database |
| [Installation guide](docs/installation_guide.md) | Step by step for Ubuntu, Windows, manual and Docker |
| [Backend](docs/backend_documentation.md) | Structure, services, AI layer, validation, errors |
| [Frontend](docs/frontend_documentation.md) | Pages, components, styling, API client |
| [API](docs/api_documentation.md) | Every endpoint with requests, responses and errors |
| [Configuration](docs/configuration_guide.md) | Every environment variable |
| [Troubleshooting](docs/troubleshooting.md) | Problems and fixes |
| [Future enhancements](docs/future_enhancements.md) | Proposed, not yet implemented |

---

## Roadmap

Ideas such as streaming replies, generated video lessons, mobile packaging and more languages are listed in
[docs/future_enhancements.md](docs/future_enhancements.md). None of them is implemented yet.

---

## Contributing

1. Fork the repository and create a branch: `git checkout -b feature/my-change`.
2. Keep the app working offline and free by default — new AI features should use local models or be optional.
3. Run `pytest -q` in `backend/` and `npm run build` in `frontend/` before opening a pull request.
4. Describe what changed and how you tested it.

---

## License and acknowledgements

Released under the [MIT License](LICENSE).

- AI models run through [Ollama](https://ollama.com): Google **Gemma 4** (Apache 2.0) and, optionally, **Qwen3-VL** —
  check each model's licence on its Ollama page.
- Voice: [Piper](https://github.com/OHF-Voice/piper1-gpl) (GPL-3.0, installed separately, not bundled) with the
  `en_US-ljspeech-medium` voice trained on the public-domain LJ Speech dataset.
- Curriculum research: the published course descriptions listed in `backend/app/curriculum/sources.py` informed the
  original ArtOfSoul.N curriculum. No institution endorses or certifies this project.
- Landscape illustration, demonstrations and logo are original SVG artwork made for this project.
