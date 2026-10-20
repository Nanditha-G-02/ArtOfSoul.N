# Configuration guide

All backend settings live in `backend/app/config.py` (a `pydantic-settings` class). Each field can be set as an
environment variable with the same name in upper case, or in a `.env` file. The backend reads:

1. `backend/.env`
2. `.env` in the repository root — if both files set the same key, this one wins
3. real environment variables — these override both files

Start from the template:

```bash
cp .env.example backend/.env
```

The defaults are chosen so that **no setting is required** for local use. Never commit a real `.env` file — it is
listed in `.gitignore`.

## Application

| Variable | Default | Description |
|---|---|---|
| `APP_NAME` | `ArtOfSoul.N` | Name returned by `/api/health` |
| `ENVIRONMENT` | `development` | Any other value logs a warning if `JWT_SECRET` is still the default |
| `TUTOR_NAME` | `G` | Name the AI uses for itself in prompts. Also change `frontend/src/lib/tutor.ts` |
| `LOCAL_MODE` | `true` | Enables `POST /api/local/session` (single local learner, no sign-up) |

## Database and storage

| Variable | Default | Description |
|---|---|---|
| `DATABASE_URL` | `sqlite:///<repo>/backend/data/artofsoul.db` | Any SQLAlchemy URL, e.g. `postgresql+psycopg://user:pass@host:5432/db` |
| `STORAGE_DIR` | `<repo>/backend/data/storage` | Uploaded artwork, generated images, cached speech |
| `MAX_UPLOAD_MB` | `12` | Largest accepted image upload |

The saved AI quality choice is written to `backend/data/model_choice.json` (next to the storage folder).

## Security and HTTP

| Variable | Default | Description |
|---|---|---|
| `JWT_SECRET` | placeholder (32+ chars) | Signs session tokens and media links. **Set your own random value**; must be at least 32 characters |
| `JWT_ALGORITHM` | `HS256` | Token algorithm |
| `ACCESS_TOKEN_MINUTES` | `10080` (7 days) | Session lifetime |
| `CORS_ORIGINS` | `http://localhost:5174,http://127.0.0.1:5174` | Comma-separated allowed browser origins |
| `RATE_LIMIT_AI_PER_MINUTE` | `12` | AI requests per learner per minute |

Generate a secret: `python3 -c "import secrets; print(secrets.token_urlsafe(48))"`.

## Local AI — Ollama

| Variable | Default | Description |
|---|---|---|
| `OLLAMA_URL` | `http://localhost:11434` | Ollama server |
| `OLLAMA_NUM_CTX` | `16384` | Context window sent with each request |
| `OLLAMA_TIMEOUT_SECONDS` | `900` | Per-request timeout (CPU inference can be slow) |
| `OLLAMA_KEEP_ALIVE` | `60m` | How long Ollama keeps the model in memory |
| `OLLAMA_THINK` | `false` | Gemma 4 "thinking" mode — slower, rarely needed here |
| `PREFETCH_NEXT_LESSON` | `true` | Write the next lesson in the background while you study |

## Model roles

Format: `provider:model`. Providers: `ollama`, `anthropic`, `openai`; for images `sdwebui`, `openai` or `none`.

| Variable | Default | Role |
|---|---|---|
| `MODEL_TEACHER` | `ollama:gemma4:e4b` | Lesson scripts, answers to questions |
| `MODEL_CURRICULUM` | `ollama:gemma4:e4b` | Personalised syllabus |
| `MODEL_VISION` | `ollama:gemma4:e4b` | Observing uploaded artwork (must accept images) |
| `MODEL_ASSESSMENT` | `ollama:gemma4:e4b` | Rubric ratings |
| `MODEL_COORDINATOR` | `ollama:gemma4:e4b` | Routing free text, memory notes |
| `MODEL_EXERCISE` | `ollama:gemma4:e4b` | Exercises and palettes |
| `MODEL_IMAGE` | `none:` | Image generation (off) |

A choice made in **Progress → Setup → AI quality** overrides the text and vision roles. Delete
`backend/data/model_choice.json` to go back to the environment values.

## Voice

| Variable | Default | Description |
|---|---|---|
| `PIPER_VOICE` | `<repo>/models/piper/en_US-ljspeech-medium.onnx` | Piper voice model; its `.onnx.json` must sit next to it |

If Piper isn't installed or the voice file is missing, `/api/tts` returns 503 and the browser's own voice is used.

## Optional image generation

| Variable | Default | Description |
|---|---|---|
| `SD_WEBUI_URL` | `http://127.0.0.1:7860` | Stable Diffusion WebUI / Forge started with `--api` |
| `SD_STEPS` | `25` | Sampling steps |

## Optional cloud providers (not required)

| Variable | Default | Description |
|---|---|---|
| `ANTHROPIC_API_KEY` | — | Enables `anthropic:` roles |
| `ANTHROPIC_BASE_URL` | — | Custom Anthropic endpoint |
| `OPENAI_API_KEY` | — | Enables `openai:` roles |
| `OPENAI_BASE_URL` | — | Any OpenAI-compatible server, e.g. LM Studio `http://localhost:1234/v1` (no real key needed) |
| `AI_TIMEOUT_SECONDS` | `90` | Timeout for cloud providers |

Keys are only ever read by the backend; the frontend never sees them.

## Frontend

| Variable | Where | Description |
|---|---|---|
| `VITE_API_URL` | build time | Prefix for API calls. Empty by default (same origin, via the dev proxy or nginx) |
| `VITE_API_PROXY` | `vite.config.ts` | Where the dev server forwards `/api` (default `http://localhost:8040`) |

The frontend dev and preview servers use port **5174** (`frontend/vite.config.ts`).

## Docker Compose

`docker-compose.yml` additionally uses:

| Variable | Default | Description |
|---|---|---|
| `POSTGRES_PASSWORD` | `artofsoul-local` | Password for the bundled PostgreSQL |

and sets `DATABASE_URL`, `STORAGE_DIR`, `OLLAMA_URL` and `CORS_ORIGINS` for the containers.
