# ArtOfSoul.N

A personalised AI art teacher for **advanced pencil drawing** and **advanced painting** (oil, acrylic, watercolour).
It runs the full learning loop: understand the learner → self-placement → retrieve curriculum → personalised
syllabus → roadmap → teach → analyse artwork → record evidence → assign targeted practice → adapt the roadmap.

- **Frontend:** React 19 + Vite + TypeScript + Tailwind v4 + React Router (16 pages)
- **Backend:** FastAPI + Pydantic + SQLAlchemy 2 + Alembic; PostgreSQL in production, SQLite for local dev
- **AI:** role-based multi-model router (Anthropic Claude by default; OpenAI image model for references), all configurable

---

## Quick start

### Docker (Linux, macOS, Windows with Docker Desktop)

```bash
cp .env.example .env          # add ANTHROPIC_API_KEY (and OPENAI_API_KEY for reference images)
docker compose up --build
```

Open **http://localhost:5174**. The API runs on **http://localhost:8040** (`/docs` for OpenAPI).
Ports 5174/8040 were chosen to avoid the usual 3000/5173/8000/5432 clashes; Postgres is not exposed to the host.
Learner data, curriculum records and uploaded artwork persist in the `pgdata` and `storage` volumes.

### Local development

**Backend** (Python 3.11+):

```bash
cd backend
python -m venv .venv
# Linux/macOS: source .venv/bin/activate      Windows (PowerShell): .venv\Scripts\Activate.ps1
pip install -r requirements-dev.txt
cp ../.env.example .env                        # Windows: copy ..\.env.example .env
uvicorn app.main:app --reload --port 8040
```

On start-up the server runs Alembic migrations and seeds the curriculum knowledge base (idempotent). SQLite is
used by default (`backend/data/artofsoul.db`); set `DATABASE_URL=postgresql+psycopg://…` for Postgres.

**Frontend** (Node 20+):

```bash
cd frontend
npm install
npm run dev          # http://localhost:5174, proxies /api to http://localhost:8040
```

**Tests:**

```bash
cd backend && pytest -q
# against Postgres:  TEST_DATABASE_URL=postgresql+psycopg://user:pass@localhost:5432/db pytest -q
```

---

## What needs API keys

| Feature | Needs | Without the key |
|---|---|---|
| Teacher conversations, syllabus generation, artwork analysis, exercises/projects, palettes | `ANTHROPIC_API_KEY` (or switch roles to `openai:` models) | Clear 503 message in the UI; Settings shows which roles are not ready |
| Reference image generation | `OPENAI_API_KEY` | Reference studio explains how to set up a reference from life; teacher describes one instead |
| Sign-up, onboarding, self-placement, curriculum browsing, roadmap, portfolio, history, skill corrections | nothing | Fully works |

No feature silently substitutes canned output for a model call.

---

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

| Role | Default | Used for |
|---|---|---|
| `teacher` | claude-sonnet-5-5 | Advanced teaching conversation |
| `curriculum` | claude-sonnet-5-5 | Personalised syllabus (structured output) |
| `vision` | claude-sonnet-5-5 | Describing only what's visible in uploaded artwork |
| `assessment` | claude-sonnet-5-5 | Mapping observations to explicit rubrics → skill ratings |
| `coordinator` | claude-haiku-5-5 | Routing free-text requests to a workflow; memory notes |
| `exercise` | claude-haiku-5-5 | Targeted exercises, projects, palettes |
| `image` | gpt-image-2 | Reference images |

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

- 13 backend tests pass on **both SQLite and PostgreSQL 16**, covering: curriculum provenance, graph acyclicity and
  medium filtering, retrieval, skill-status rules, registration/login, access control across users, signed media
  URLs, invalid and undersized uploads, missing API keys, provider outage (rolls back, no partial analysis), the full
  loop (diagnostic → syllabus → teacher → exercise → reference → analysis ×4 → needs-practice → remedial insert →
  proficient → remedial retired → profile correction → syllabus v2 with completed work preserved), unsuitable images,
  coordinator fallback, export/delete, and per-role usage logging.
- In these tests the AI provider is replaced **at the provider boundary only** with a scripted fake; all routing,
  validation, persistence and adaptation logic runs for real.
- Frontend type-checks and builds; the main journeys were driven in headless Chromium (desktop and 390 px mobile).

### Not verified here

- **Live model calls.** No API keys were available in the build environment, so real Claude/OpenAI responses —
  syllabus quality, vision accuracy on real drawings, image generation — have not been exercised end to end. Run the
  app with keys and walk through the loop once before relying on it.
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
