# Backend documentation

The backend is a **FastAPI** application in `backend/app/`. It serves the JSON API on port 8040, stores all state in a
SQL database through **SQLAlchemy 2**, manages schema changes with **Alembic**, and makes every AI call on the
learner's behalf.

## Folder structure

```
backend/
├── app/
│   ├── main.py            Entry point: FastAPI app, lifespan (migrations, seed, warm-up), CORS, error handlers, routers
│   ├── config.py          Settings (pydantic-settings) — see configuration_guide.md
│   ├── db.py              Engine, session factory, SQLite pragmas (foreign keys, WAL, busy timeout)
│   ├── models.py          27 SQLAlchemy tables
│   ├── schemas.py         Shared Pydantic request models
│   ├── security.py        bcrypt hashing, JWT, current_user, rate limiter, ownership check
│   ├── api/
│   │   ├── journey.py     Current app: local session, questions, answers, lesson scripts, quiz, activities,
│   │   │                  step visuals, TTS, hardware, AI quality, progress
│   │   ├── learning.py    Curriculum, syllabus, lessons status, roadmap, exercises
│   │   ├── studio.py      Conversations, artworks & analysis, references, palettes, signed media, AI status/usage
│   │   ├── account.py     Register/login, profile, diagnostic, skills, history, dashboard, export, delete
│   │   └── serialize.py   Model → JSON helpers
│   ├── ai/
│   │   ├── router.py      ModelRouter: role → provider:model, status, background usage logging
│   │   ├── profiles.py    Fast / Balanced / Accurate / Best levels, saved choice, hardware recommendation
│   │   ├── local.py       OllamaProvider, SDWebUIProvider, NoImageProvider
│   │   ├── providers.py   Optional AnthropicProvider / OpenAIProvider, error types
│   │   └── prompts.py     System prompts, JSON schemas, MEDIUM_FACTS, demo ids
│   ├── curriculum/
│   │   ├── sources.py     13 institutions, 14 course records with provenance
│   │   ├── skills.py      42 skills, prerequisites, rubrics, exercise templates, modules
│   │   ├── graph.py       SkillGraph: filtering by track/medium, closure, topological order
│   │   ├── retrieval.py   BM25 index with art-vocabulary normalisation
│   │   └── seed.py        Idempotent loader (curriculum version 2026.10)
│   └── services/
│       ├── lessons.py     Lesson scripts (cached, locked, prefetched), cleaning, quiz answers, activities, step visuals
│       ├── syllabus.py    Candidate skills, LLM plan, validation, order repair, persistence, versioning
│       ├── analysis.py    Vision → assessment → evidence → roadmap
│       ├── roadmap.py     Rule-based revisions R1–R3 with versioned history
│       ├── skills.py      Evidence recording and status rules
│       ├── teacher.py     Conversational tutor, quick actions, coordinator routing, memory notes
│       ├── practice.py    Exercises, projects, reference images, palettes
│       ├── tts.py         Piper synthesis with on-disk cache
│       ├── media.py       Upload validation, re-encoding, signed URLs, model-ready images
│       ├── hardware.py    OS/CPU/RAM/GPU report and recommendation
│       └── learner.py     Profile access, statuses, activity log, learner context
├── migrations/versions/   0001 initial schema · 0002 simple journey · 0003 quiz answers
├── tests/                 conftest.py (fake provider) + 3 test modules, 31 tests
├── alembic.ini
├── requirements.txt       Runtime dependencies
├── requirements-dev.txt   + pytest
├── requirements-voice.txt Optional Piper voice
└── Dockerfile
```

## Entry point

`app/main.py` creates `app = FastAPI(...)`. Start it with:

```bash
uvicorn app.main:app --host 127.0.0.1 --port 8040
```

The `lifespan` handler runs at start-up:

1. `run_migrations()` — `alembic upgrade head` against `DATABASE_URL`.
2. `seed_curriculum()` — loads skills, rubrics, modules, institutions and courses once per curriculum version.
3. `_warm_up_model()` — background thread that asks Ollama to load the teacher model.

Routers are mounted in this order: `journey`, `account`, `learning`, `studio`. `GET /` returns a short message pointing to
the frontend; `GET /api/health` checks the database.

## Authentication and sessions

- **Local mode** (default): `POST /api/local/session` creates or reuses a single learner
  (`learner@artofsoul.local`, random password) and returns a JWT. The frontend stores it in `localStorage` and sends
  `Authorization: Bearer <token>`.
- The first version's **email/password** endpoints (`/api/auth/register`, `/api/auth/login`) still work; passwords are
  hashed with bcrypt.
- `security.current_user` validates the token; `security.owned()` returns **404** for objects that belong to another
  user, so IDs can't be probed.
- `ai_rate_limit` adds an in-process sliding-window limit per learner for AI endpoints (429 when exceeded); auth
  endpoints are limited per IP.

## Validation

- Request bodies are Pydantic models (`schemas.py` and models declared in `api/journey.py`), with lengths, ranges,
  enums and patterns. Examples: `AnswersIn.level` must be `beginner|intermediate|advanced`; `ActivityIn.kind` must be
  one of `value_match|color_mix|order_steps|flashcards|sketch`; `SyllabusIn.goal` is 2–600 characters.
- Business rules return **422** with a readable `detail`, e.g. *"Choose a paint type"* when the painting track has no
  medium.
- **Uploads** (`services/media.py`): size limit, Pillow verification, JPEG/PNG/WEBP only, minimum 256 px on the short
  side, EXIF orientation applied, re-encoded to JPEG (which strips metadata such as GPS).
- **Model output** is never trusted as-is:
  - syllabus lessons must use skills from the graph-approved candidate set; unknown skills are dropped; source ids not
    actually retrieved are stripped; lesson order is repaired so prerequisites come first;
  - lesson scripts are normalised by `lessons._clean()` (wrong types, missing fields, invalid quiz answer keys, unknown
    demo ids) — unusable parts are dropped, never shown wrongly;
  - artwork ratings must cite observation ids; ratings resting only on low-confidence observations are softened to
    "developing"; strengths/improvements without citations are removed.

## Error handling

| Situation | Status | `detail` example |
|---|---|---|
| Validation error | 422 | FastAPI's field errors, or a business message |
| Not signed in / expired | 401 | `Not signed in` |
| Someone else's object, or missing | 404 | `Artwork not found` |
| Too many AI requests | 429 | `You're going a little fast…` |
| AI not available (`AINotConfigured`) | 503 | `Ollama isn't running at …` / `The model 'gemma4:e4b' isn't downloaded yet. Run: ollama pull gemma4:e4b` |
| AI call failed (`AIProviderError`) | 502 | `The local model didn't return valid structured output…` |
| Anything unexpected | 500 | `Something went wrong on the ArtOfSoul.N server. Please try again…` (traceback logged) |

All errors are JSON: `{"detail": "...", "kind": "..."}` (`kind` is set for AI and unexpected errors).

## Services in more detail

### Lesson scripts (`services/lessons.py`)

- `get_script()` takes a **per-lesson lock** so a lesson is never written twice (e.g. foreground request + background
  prefetch), returns the cached `lesson_contents` row when present, and marks the lesson *current*.
- The prompt payload contains the learner (level, track, medium, goal, daily minutes, techniques), `MEDIUM_FACTS` for
  the medium, `SKILLS` (curriculum description + "what good looks like" rubric level) and the lesson.
- The schema asks for intro, concept, 3–4 key terms, 3–4 steps (each with a demonstration id), tips, common mistakes,
  a 3-question quiz, a practice task and a next hint.
- `prefetch_next()` / `prefetch_lesson()` write a lesson on a daemon thread with its own database session.
- `check_answer()` records the **first** attempt per question in `quiz_answers`.
- `record_activity()` logs games, labs and sketches to `activity_records` (used for streaks).

### Syllabus (`services/syllabus.py`)

1. BM25 retrieval finds skills and course records matching the goal, medium, subjects and difficulties.
2. The skill graph adds every prerequisite, filters by track and medium, adds tier-0 foundations for beginners (or only
   where evidence shows a gap), and orders the result topologically.
3. The curriculum model plans stages and lessons from those candidates.
4. Output is validated and persisted; completed lessons from a previous version are carried over; a change summary is
   written; roadmap version 1 is recorded.

### Artwork analysis (`services/analysis.py`)

Two model calls: **vision** (observations with location and confidence, or "unsuitable" with limitations) and, only if
suitable, **assessment** against the rubrics of relevant skills. Valid ratings become `skill_evidence`; statuses are
recomputed; the roadmap is revised.

### Voice (`services/tts.py`)

`synthesize(text)` returns WAV bytes from Piper, caching by a hash of voice + text under `storage/tts/`. `status()`
reports whether Piper and the voice file are present.

### Hardware (`services/hardware.py`)

Reports OS, CPU cores, RAM and free disk (psutil), NVIDIA GPU name and VRAM (`nvidia-smi` if present), recommends an AI
quality level, and includes AI role and voice status.

## Database

- Default: SQLite at `backend/data/artofsoul.db`, with WAL mode and a busy timeout for concurrent background writes.
- PostgreSQL works through `DATABASE_URL=postgresql+psycopg://…` (the test suite passes on both).
- Migrations: `alembic upgrade head` runs automatically. To create a new migration after changing `models.py`:

```bash
cd backend
source .venv/bin/activate
alembic revision --autogenerate -m "describe change"
```

## Communication with the frontend

- JSON over HTTP on `/api/*`. In development, Vite proxies `/api` from port 5174 to 8040; in Docker, nginx does.
- CORS allows only `CORS_ORIGINS`.
- Binary responses: `POST /api/tts` returns `audio/wav`; `GET /api/media/...` serves images via signed, expiring links;
  `POST /api/system/models/pull` streams newline-delimited JSON progress.

## Tests

See [troubleshooting.md](troubleshooting.md#running-the-tests) and the README. `tests/conftest.py` points the app at a
temporary SQLite database (or `TEST_DATABASE_URL`) and swaps the AI provider for a scripted `FakeProvider` at the
provider boundary.
