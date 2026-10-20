# System architecture

ArtOfSoul.N is a two-tier local web application: a **React single-page app** talks to a **FastAPI backend** over
HTTP/JSON. The backend owns all state (SQLite by default) and all AI calls, which go to local servers (Ollama, and
optionally Stable Diffusion WebUI). The browser never talks to an AI service directly and never holds an API key.

## Components

```mermaid
flowchart TB
    subgraph FE["Frontend — React 19 + Vite (port 5174)"]
        direction TB
        Pages["pages/<br/>Home · Start · RoadmapPage · Studio · Practice · Progress"]
        Comp["components/<br/>Avatar · Landscape · Demos · Interactive · ModelPicker · Shell · ui"]
        Lib["lib/<br/>api (fetch client) · session · speech · tutor · hooks · types"]
        Pages --> Comp
        Pages --> Lib
    end

    subgraph BE["Backend — FastAPI (port 8040)"]
        direction TB
        Main["main.py<br/>migrations · seed · warm-up · error handlers"]
        APIs["api/<br/>journey · learning · studio · account"]
        Svc["services/<br/>lessons · syllabus · analysis · roadmap · skills<br/>practice · teacher · tts · media · hardware · learner"]
        Cur["curriculum/<br/>sources · skills · graph · retrieval · seed"]
        AI["ai/<br/>router · profiles · prompts<br/>local (Ollama, SD) · providers (cloud, optional)"]
        Sec["security.py · schemas.py · models.py · db.py · config.py"]
        Main --> APIs --> Svc
        Svc --> Cur
        Svc --> AI
        APIs --> Sec
        Svc --> Sec
    end

    Lib -- "HTTP JSON /api/*<br/>Bearer session token" --> APIs
    Sec --> DB[("SQLite / PostgreSQL")]
    Svc --> Store[("backend/data/storage<br/>artworks · references · tts cache")]
    AI --> Ollama["Ollama :11434"]
    AI -.optional.-> SD["Stable Diffusion WebUI :7860"]
    AI -.optional.-> Cloud["Anthropic / OpenAI-compatible"]
    Svc --> Piper["Piper voice<br/>models/piper/*.onnx"]
```

In development the Vite dev server proxies `/api` to `http://localhost:8040` (`frontend/vite.config.ts`), so the
browser only ever talks to one origin. In Docker, nginx does the same (`frontend/nginx.conf`).

## Request lifecycle

1. The frontend calls `api.get/post/...` (`frontend/src/lib/api.ts`), which adds `Authorization: Bearer <token>` from
   `localStorage`.
2. FastAPI validates the body with Pydantic (`schemas.py` or models declared in the router) — invalid input returns
   **422** with the field errors.
3. `security.current_user` decodes the JWT and loads the user; AI endpoints also pass a per-user sliding-window
   **rate limit** (`RATE_LIMIT_AI_PER_MINUTE`).
4. A service performs the work inside a SQLAlchemy session. AI calls go through `ModelRouter`, which maps a role to
   `provider:model`, calls the provider, and logs usage on a background thread.
5. Errors become JSON: `AIError` subclasses → **503** (not configured, e.g. Ollama not running) or **502** (provider
   failed); any unexpected exception → **500** with a friendly message, full traceback in the terminal.

## Key flows

### Onboarding to plan

```mermaid
sequenceDiagram
    participant U as Learner
    participant FE as Start page
    participant API as FastAPI
    participant SY as syllabus service
    participant G as Skill graph + BM25
    participant LLM as Ollama (curriculum role)
    participant LS as lessons service

    U->>FE: Open app
    FE->>API: POST /api/local/session
    API-->>FE: token, profile
    FE->>API: GET /api/journey/questions
    U->>FE: Answers (one question at a time)
    FE->>API: POST /api/journey/answers
    FE->>API: POST /api/syllabus {goal + answers summary}
    API->>SY: generate()
    SY->>G: retrieve skills & courses, take prerequisite closure, order topologically
    SY->>LLM: candidate skills + profile + sources (JSON schema)
    LLM-->>SY: stages & lessons
    SY->>SY: drop unknown skills, strip uncited sources, repair order, persist, roadmap v1
    API->>LS: prefetch lesson 1 (background thread)
    API-->>FE: syllabus
    FE-->>U: Animated roadmap
```

### A lesson

```mermaid
sequenceDiagram
    participant FE as Studio page
    participant API as FastAPI
    participant LS as lessons service
    participant LLM as Ollama (teacher role)
    participant TTS as Piper

    FE->>API: GET /api/lessons/{id}/script
    alt not written yet
        FE->>API: POST /api/lessons/{id}/script
        API->>LS: get_script() — per-lesson lock
        LS->>LLM: profile + medium facts + skill rubrics (JSON schema)
        LLM-->>LS: intro, terms, steps, quiz, practice
        LS->>LS: clean & validate, cache in lesson_contents
        API->>LS: prefetch next lesson (background)
    end
    API-->>FE: script
    loop each part
        FE->>API: POST /api/tts {text}
        API->>TTS: synthesize (cached by text hash)
        TTS-->>FE: WAV audio → avatar mouth level
    end
    FE->>API: POST /lessons/{id}/check, /activity
```

### Practice feedback and adaptation

```mermaid
flowchart LR
    Up["POST /api/artworks<br/>validate · re-encode · strip EXIF"] --> An["POST /artworks/{id}/analyze"]
    An --> V["Vision role<br/>observations + confidence<br/>or 'image unsuitable'"]
    V -- unsuitable --> Stop["Return limitations<br/>record nothing"]
    V -- suitable --> A["Assessment role<br/>rubric ratings citing observation ids"]
    A --> Val["Validation<br/>drop uncited/unknown ratings<br/>soften low-confidence extremes"]
    Val --> Ev["skill_evidence rows"]
    Ev --> St["Skill status rules<br/>needs_practice / in_progress / proficient"]
    St --> RM["Roadmap rules<br/>insert focused practice · skip · retire"]
    RM --> Ver["roadmap_versions<br/>with reasons + evidence ids"]
```

**Skill status rules** (`services/skills.py`, last three pieces of evidence):

- 2+ "needs work" → **needs practice** (unless the latest is "solid", which means improving → in progress)
- 2+ "solid" including artwork evidence, latest not "needs work" → **proficient**
- self-placement alone can only reach **in progress**

**Roadmap rules** (`services/roadmap.py`):

- R1 — an upcoming lesson depends on a skill that needs practice → insert a focused-practice lesson before it (once)
- R2 — every skill of an upcoming, non-milestone lesson is proficient → mark it skipped (restorable)
- R3 — a pending focused-practice lesson whose skill is now proficient → skip it

## AI layer

| Role | Used for | Default |
|---|---|---|
| `teacher` | Lesson scripts, answering questions | `ollama:gemma4:e4b` |
| `curriculum` | Personalised syllabus | `ollama:gemma4:e4b` |
| `vision` | Observing uploaded artwork | `ollama:gemma4:e4b` |
| `assessment` | Rubric ratings from observations | `ollama:gemma4:e4b` |
| `coordinator` | Routing free-text requests; memory notes | `ollama:gemma4:e4b` |
| `exercise` | Exercises and palettes (first-version endpoints) | `ollama:gemma4:e4b` |
| `image` | Step pictures / references | `none:` (off) |

`ModelRouter.spec(role)` resolves the model in this order: the learner's saved **AI quality** choice
(`backend/data/model_choice.json`) → the `MODEL_<ROLE>` environment variable.

Providers (`ai/local.py`, `ai/providers.py`):

- **OllamaProvider** — `/api/chat` with `format` (JSON schema), `think: false`, `num_ctx`, `keep_alive`; images passed
  as base64; one retry on invalid JSON; clear errors for "not running", "model not downloaded", out-of-memory and
  dropped connections; `pull()` streams download progress; `warm_up()` preloads the model.
- **SDWebUIProvider** — `/sdapi/v1/txt2img`.
- **NoImageProvider** — explains that image generation is off.
- **AnthropicProvider / OpenAIProvider** — optional; `OPENAI_BASE_URL` allows any OpenAI-compatible server.

## Data model

27 tables, created by Alembic migrations `0001`–`0003`. The ones the current journey relies on:

```mermaid
erDiagram
    users ||--|| learner_profiles : has
    users ||--o{ syllabi : owns
    syllabi ||--o{ lessons : contains
    lessons ||--o| lesson_contents : "cached script"
    lessons ||--o{ quiz_answers : "first attempts"
    lessons ||--o{ generated_references : "step pictures"
    users ||--o{ artworks : uploads
    artworks ||--o{ artwork_analyses : "feedback"
    users ||--o{ skill_evidence : records
    skills ||--o{ skill_evidence : about
    users ||--o{ skill_states : has
    users ||--o{ roadmap_versions : "plan changes"
    users ||--o{ activity_records : "history & streak"
    users ||--o{ conversations : "ask the tutor"
    conversations ||--o{ messages : contains
    skills ||--o{ skill_prerequisites : requires
    courses }o--|| institutions : "offered by"
    courses ||--o{ course_skill_links : "mapped to"
```

Other tables: `curriculum_versions`, `curriculum_modules`, `learning_objectives`, `exercise_templates`,
`assessment_rubrics`, `exercises`, `ai_usage`.

Files: uploads are re-encoded to JPEG and stored under `backend/data/storage/artworks/<user>/`; generated images under
`references/`; synthesized speech under `tts/`. Images are served only through HMAC-signed, expiring URLs
(`/api/media/...`).

## Startup sequence (`app/main.py`)

1. Run Alembic migrations to `head`.
2. Seed the curriculum knowledge base (idempotent, versioned `2026.10`).
3. Start a background thread that loads the teacher model into Ollama's memory.
4. Serve requests.
