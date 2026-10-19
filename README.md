# ArtOfSoul.N

A personalised AI art teacher for **advanced pencil drawing** and **advanced painting** (oil, acrylic, watercolour).
It runs the full learning loop: understand the learner → self-placement → retrieve curriculum → personalised
syllabus → roadmap → teach → analyse artwork → record evidence → assign targeted practice → adapt the roadmap.

- **Frontend:** React 19 + Vite + TypeScript + Tailwind v4 + React Router (16 pages)
- **Backend:** FastAPI + Pydantic + SQLAlchemy 2 + Alembic; PostgreSQL in production, SQLite for local dev
- **AI:** role-based multi-model router. **Default: 100% free** — Gemma 4 running locally through
  [Ollama](https://ollama.com) for every role, including artwork vision. No API keys, no accounts, no usage fees;
  your artwork never leaves your computer. Paid/cloud providers remain optional.

---

## Quick start (free, Windows)

1. Install, all free:
   - [Python 3.11+](https://www.python.org/downloads/) — tick **Add python.exe to PATH**
   - [Node.js LTS](https://nodejs.org/)
   - [Ollama](https://ollama.com/download) — runs the AI model on your PC
2. Double-click **start-backend.bat**. The first run installs packages and downloads the free model
   (`gemma4:e4b`, several GB, one time). Leave the window open.
3. Double-click **start-frontend.bat**. It opens http://localhost:5174.

Keep both windows open while you use the app. Data is saved in `backend\data\`.

### Which model for your PC

All roles use one model so only one is loaded. Change the six `MODEL_*` lines in `backend\.env`:

| Your machine | Model | Notes |
|---|---|---|
| 8 GB RAM, no GPU | `ollama:gemma4:e2b` | Works; slowest feedback quality, fastest replies |
| 16 GB RAM | `ollama:gemma4:e4b` (default) | Good balance |
| NVIDIA GPU ~10 GB+ VRAM, or 32 GB RAM | `ollama:gemma4:12b` | Best quality |

On CPU-only laptops expect a teacher reply in roughly 20–90 s and a full syllabus or artwork analysis in a few
minutes. A GPU makes this much faster.

### Optional: free reference images

Off by default (needs a GPU to be practical). Install a local
[Stable Diffusion WebUI / Forge](https://github.com/lllyasviel/stable-diffusion-webui-forge), start it with `--api`,
then set `MODEL_IMAGE=sdwebui:default` in `backend\.env`. Palette suggestions work without it.

### Docker (any OS)

```bash
cp .env.example .env
docker compose up -d --build
docker compose exec ollama ollama pull gemma4:e4b     # one time
```

Open **http://localhost:5174** (API on **http://localhost:8040**). Docker runs Ollama inside a container; on
Windows/macOS that is CPU-only unless you enable GPU support. Data persists in the `pgdata`, `storage` and `ollama` volumes.

### Local development (manual)

```bash
cd backend
python -m venv .venv
# Linux/macOS: source .venv/bin/activate      Windows (PowerShell): .venv\Scripts\Activate.ps1
pip install -r requirements-dev.txt
cp ../.env.example .env                        # Windows: copy ..\.env.example .env
ollama pull gemma4:e4b
uvicorn app.main:app --reload --port 8040
```

```bash
cd frontend
npm install
npm run dev          # http://localhost:5174, proxies /api to http://localhost:8040
```

On start-up the server runs Alembic migrations and seeds the curriculum (idempotent). SQLite is the default;
set `DATABASE_URL=postgresql+psycopg://…` for Postgres.

**Tests:** `cd backend && pytest -q` (add `TEST_DATABASE_URL=postgresql+psycopg://…` to run against Postgres).

---

## Cost

| Feature | Default (free) | If the local AI isn't running |
|---|---|---|
| Teacher, syllabus, artwork analysis, exercises, palettes | Ollama + Gemma 4 on your PC | Clear message telling you to start Ollama or `ollama pull` the model; Settings shows status per role |
| Reference images | Off; optional free local Stable Diffusion | Reference studio explains how to set up a reference from life |
| Sign-up, onboarding, self-placement, curriculum, roadmap, portfolio, history | No AI needed | Fully works |

No feature silently substitutes canned output for a model call. Optional paid providers (Anthropic, OpenAI) and any
OpenAI-compatible server (e.g. LM Studio, via `OPENAI_BASE_URL`) can be set per role in `.env`.

## Architecture

```
frontend (React)  ──/api──▶  FastAPI
                               ├── api/            account · learning · studio routers
                               ├── services/       syllabus · teacher · analysis · practice · roadmap · skills · learner · media
                               ├── ai/router.py    role → "provider:model", usage logging, error mapping
                               ├── ai/prompts.py   system prompts + JSON schemas per role
                               └── curriculum/     sources · skill graph · BM25 retrieval · seed
```

### Model roles (each set by an env var)

All text/vision roles default to `ollama:gemma4:e4b`; image defaults to off (`none:`).

| Role | Used for |
|---|---|
| `teacher` | Advanced teaching conversation |
| `curriculum` | Personalised syllabus (structured output, JSON-schema constrained) |
| `vision` | Describing only what's visible in uploaded artwork |
| `assessment` | Mapping observations to explicit rubrics → skill ratings |
| `coordinator` | Routing free-text requests to a workflow; memory notes |
| `exercise` | Targeted exercises, projects, palettes |
| `image` | Reference images (`sdwebui:` local, or `openai:`) |

The Ollama adapter sends a JSON schema as Ollama's `format` (constrained decoding), retries once on malformed
JSON, raises the context window (`OLLAMA_NUM_CTX`, default 16384) and keeps the model loaded between requests.

Only the roles a request needs are called: quick actions skip the coordinator, an unsuitable photo skips assessment,
and skill-status changes and roadmap revisions are deterministic code, not model calls.

### Guardrails implemented in code (not just in prompts)

- **Syllabus:** the model may only use skills from a graph-filtered candidate set (medium-specific skills excluded for
  other media); unknown skills are dropped; cited source ids not actually retrieved are stripped; lessons are
  re-ordered so prerequisites come first; completed lessons are carried into new versions.
- **Artwork analysis:** two passes (vision observes, assessment rates). Ratings without a cited observation are
  discarded; ratings backed only by low-confidence observations are softened to "developing"; strengths/improvements
  must cite observations; unsuitable photos record no evidence.
- **Skill status rules** (`services/skills.py`): 2 of the last 3 "needs work" → *needs practice*; 2 of the last 3
  "solid", including artwork evidence, → *proficient*; self-placement alone can only reach *in progress*.
- **Roadmap rules** (`services/roadmap.py`): insert focused practice before a lesson whose prerequisite needs practice;
  skip lessons whose skills are all proficient (restorable); retire focused practice once proficient. Every change is
  versioned with its reason and the evidence ids.

### Curriculum knowledge base

`backend/app/curriculum/sources.py` holds **14 course records from 13 institutions**, each reviewed on 19 Oct 2026
at its official catalogue page, with institution, course code, URL, source type, level, paraphrased summary and
objectives, licensing note, verification status and review date. One record (CCNY ARTE 6200E) is marked *partial*
because the official page publishes no description; nothing is attributed to it beyond its existence.

`backend/app/curriculum/skills.py` is the **original** ArtOfSoul.N curriculum: 42 skills with prerequisite edges,
tiers, media restrictions, objectives, three-level rubrics and exercise templates, grouped into modules. Course → skill
links are labelled `inferred` (our mapping), curriculum content `synthesized`, catalogue paraphrases `verified`.
Nothing claims certification, accreditation or endorsement.

Retrieval is BM25 over course records, skills and exercise templates, with art-vocabulary normalisation
(colour/color, tone/value, watercolour/watercolor). For a corpus this size it works well without an embedding
provider; a pgvector backend can be added behind `CurriculumIndex.search()`.

### Security

bcrypt password hashing · JWT bearer auth · ownership checks on every user resource (404 on others' data) ·
Pydantic validation · uploads verified with Pillow, size/dimension limits, re-encoded to strip EXIF/GPS ·
images served via HMAC-signed expiring URLs · explicit CORS origins · per-user AI rate limit and per-IP auth limit ·
provider timeouts and retries · data export and account deletion · keys only on the server.

---

## Status

### Verified in this build

- 18 backend tests pass on **both SQLite and PostgreSQL 16**, covering: curriculum provenance, graph acyclicity and
  medium filtering, retrieval, skill-status rules, registration/login, access control across users, signed media
  URLs, invalid and undersized uploads, missing API keys, provider outage (rolls back, no partial analysis), the full
  loop (diagnostic → syllabus → teacher → exercise → reference → analysis ×4 → needs-practice → remedial insert →
  proficient → remedial retired → profile correction → syllabus v2 with completed work preserved), unsuitable images,
  coordinator fallback, export/delete, and per-role usage logging.
- In these tests the AI provider is replaced **at the provider boundary only** with a scripted fake; all routing,
  validation, persistence and adaptation logic runs for real.
- Frontend type-checks and builds; the main journeys were driven in headless Chromium (desktop and 390 px mobile).

### Not verified here

- **Live model calls.** Ollama and model downloads were blocked in the build environment, so the local adapters were
  tested against mocked Ollama/Stable Diffusion responses only. How well Gemma 4 handles the large syllabus schema
  and real artwork photos has not been measured — walk through the loop once on your machine. If structured output
  fails often on `e2b`/`e4b`, use `gemma4:12b` for the `curriculum` and `assessment` roles.
- **Docker images** were written and `docker compose config` validates, but no Docker daemon was available to build them.

### Remaining work / next steps

1. Live evaluation with real keys: a small set of real student drawings/paintings with instructor-written expected
   feedback, to tune prompts and compare models per role.
2. Streaming teacher replies (currently request/response; long answers take a few seconds).
3. Optional pgvector embeddings retrieval; expand the institutional record set (more non-US institutions and OER).
4. Redis-backed rate limiting for multi-instance deployment (current limiter is in-process).
5. Email verification and password reset.
6. Frontend unit tests and an automated Playwright suite in CI.
7. Licensed or generated artwork gallery for the landing page (currently original SVG illustrations).
