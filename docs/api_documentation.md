# API documentation

Base URL: `http://localhost:8040` (the frontend reaches it as `/api/...` through the dev proxy).

FastAPI also publishes interactive documentation while the backend is running:

- Swagger UI — http://localhost:8040/docs
- ReDoc — http://localhost:8040/redoc
- OpenAPI JSON — http://localhost:8040/openapi.json

The backend exposes **61 operations**. Those marked **●** are used by the current frontend; the rest belong to the first
version of the app and remain available and covered by tests.

## Conventions

- **Authentication:** `Authorization: Bearer <token>`. Get a token from `POST /api/local/session` (or the
  login/register endpoints). "Auth: no" means the endpoint works without a token.
- **Content type:** JSON unless stated otherwise.
- **Errors:** always JSON, `{"detail": "...", "kind"?: "..."}`. For 422 from Pydantic, `detail` is a list of
  `{loc, msg, type}`.

| Status | Meaning |
|---|---|
| 400 | Action not possible yet (e.g. onboarding not completed) |
| 401 | Missing, invalid or expired token |
| 403 | Signed media link expired or invalid |
| 404 | Not found, or belongs to another learner |
| 422 | Invalid input or business rule (`"Choose a paint type"`) |
| 429 | AI rate limit reached (`RATE_LIMIT_AI_PER_MINUTE`) |
| 502 | The AI provider failed or returned invalid output |
| 503 | AI not available (Ollama not running, model not downloaded) or Piper voice not installed |
| 500 | Unexpected server error (friendly message; details in the backend terminal) |

Endpoints that call a model are marked **AI** and are rate-limited per learner.

---

## Health

### `GET /api/health` ● — Auth: no
```json
{"status": "ok", "app": "ArtOfSoul.N"}
```

### `GET /` — Auth: no
Returns a message pointing to the frontend at http://localhost:5174.

---

## Session and onboarding (`api/journey.py`)

### `POST /api/local/session` ● — Auth: no
Creates or reuses the single local learner (only when `LOCAL_MODE=true`).

Request (optional): `{"name": "Artist"}` (≤ 60 chars)

Response:
```json
{"token": "eyJ…", "user": {"id": 1, "email": "learner@artofsoul.local", "display_name": "Artist", "created_at": "…"},
 "profile": {"track": null, "medium": null, "level": null, "onboarding_complete": false, "…": "…"}}
```

### `GET /api/journey/questions` ● — Auth: no
The onboarding questions. Each item has `id`, `ask`, `kind` (`single` | `multi` | `text`) and either `options`,
`options_by_track` (techniques) or `placeholder`; `when` restricts a question (paint type only for painting);
`allow_custom` permits free answers.

Ids in order: `track`, `medium`, `level`, `artwork_types`, `goal`, `daily_minutes`, `techniques`.

### `POST /api/journey/answers` ●
Saves the answers to the learner profile.

| Field | Type | Rules |
|---|---|---|
| `name` | string | ≤ 60, optional |
| `track` | string | `pencil` \| `painting` — required |
| `medium` | string \| null | `graphite` \| `oil` \| `acrylic` \| `watercolor`; **required for painting** |
| `level` | string | `beginner` \| `intermediate` \| `advanced` — required |
| `artwork_types` | string[] | ≤ 12 |
| `goal` | string | 3–500 chars — required |
| `daily_minutes` | int | 5–480 — required |
| `techniques` | string[] | ≤ 12 |

```json
{"track": "painting", "medium": "watercolor", "level": "beginner", "artwork_types": ["landscapes"],
 "goal": "Paint loose landscapes", "daily_minutes": 30, "techniques": ["colour mixing"]}
```

Response: the updated profile. Errors: **422** `Choose a paint type`.

---

## Syllabus and roadmap (`api/learning.py`)

### `POST /api/syllabus` ● — AI
Builds a new personalised syllabus (the previous one is archived and its completed lessons carried over), then starts
writing lesson 1 in the background.

Request: `{"goal": "Paint loose landscapes — watercolour, beginner level. …"}` (2–600 chars)

Response: the syllabus — `id`, `version`, `status`, `goal`, `track`, `medium`, `title`, `overview`,
`expected_outcomes`, `milestones`, `practice_plan`, `source_course_ids`, `change_summary`, `model`, `created_at`, and
`lessons[]` (see Lesson object). Errors: **400/422** if onboarding isn't complete, **502/503** from the AI.

### `GET /api/syllabus`
The active syllabus, or `null`.

### `GET /api/syllabus/versions`
All syllabus versions (newest first) with their change summaries.

### `GET /api/roadmap` ●
```json
{"syllabus": {"id": 3, "title": "…", "version": 1},
 "stages": [{"index": 0, "title": "Foundations", "lessons": [ /* Lesson */ ]}],
 "skills": [{"slug": "value-scale", "name": "Value scale", "status": "in_progress", "prerequisites": []}],
 "versions": [{"version": 2, "trigger": "analysis", "summary": "…", "changes": [], "created_at": "…"}],
 "assessments": [{"id": 5, "created_at": "…", "ratings": 3, "suitable": true}],
 "remaining_minutes": 240}
```
Returns `null` when there is no plan yet.

### `POST /api/roadmap/revise`
Runs the roadmap rules now. Response: `{"changed": bool, "version": int|null, …}`.

### `PATCH /api/lessons/{lesson_id}` ●
Request: `{"status": "current" | "completed" | "upcoming"}`. Completing a lesson makes the next one current and starts
writing it in the background. Errors: **404**.

#### Lesson object
`id`, `position`, `stage_index`, `stage_title`, `module_title`, `title`, `objectives[]`, `skill_slugs[]`,
`prerequisite_slugs[]`, `studio_assignment`, `exercises[]`, `assessment_criteria[]`, `source_course_ids[]`,
`est_minutes`, `is_milestone`, `kind` (`core`; `remedial` for inserted focused practice; `carried` for lessons completed in an earlier plan version), `status` (`upcoming` | `current` | `completed` |
`skipped`), `completed_at`.

---

## Lessons (`api/journey.py`)

### `GET /api/lessons/{lesson_id}/script` ●
Returns the cached script without generating one.
```json
{"lesson": { /* Lesson */ }, "script": null, "model": null, "visuals": {}}
```

### `POST /api/lessons/{lesson_id}/script?regenerate=false` ● — AI
Writes (or returns the cached) lesson script. With `regenerate=true` the script is rewritten. The next lesson is
prefetched in the background.

`script` contains: `intro`, `concept`, `terms[] {term, meaning}`, `steps[] {title, say, do, demo, image_prompt}`,
`tips[]`, `mistakes[]`, `quiz[] {question, options[], answer_index, explanation}`, `practice`, `next_hint`.
`demo` is one of the 12 demonstration ids. `visuals` maps a step index to a generated picture (if any).

Errors: **404**, **429**, **502**, **503**.

### `POST /api/lessons/{lesson_id}/check` ●
Checks a quiz answer. Only the **first** attempt per question is recorded.

Request: `{"question": 0, "choice": 2}` (both 0–5)

Response:
```json
{"correct": true, "answer_index": 2, "explanation": "…", "first_attempt": true}
```
Errors: **422** if the lesson has no such question.

### `POST /api/lessons/{lesson_id}/activity` ●
Records an interactive activity.

Request: `{"kind": "value_match" | "color_mix" | "order_steps" | "flashcards" | "sketch", "score": 0–100?, "total": 1–100?}`

Response: `{"ok": true}`

### `POST /api/lessons/{lesson_id}/steps/{index}/visual` ● — AI
Generates a picture for a lesson step using the `image` role. Response: a reference object with a signed `url`.
Errors: **503** when image generation is off (`MODEL_IMAGE=none:`), **422** for an invalid step.

---

## Voice

### `GET /api/tts/status` ● — Auth: no
`{"engine": "piper", "ready": bool, "voice": "en_US-ljspeech-medium", "hint": "how to install, if not ready"}`

### `POST /api/tts` ●
Request: `{"text": "Hello"}` (1–1500 chars). Response: `audio/wav` bytes. **503** if Piper or the voice file isn't
installed (the frontend then uses the browser voice).

---

## System and AI quality

### `GET /api/system/hardware` ● — Auth: no
OS, CPU cores, RAM, free disk, NVIDIA GPU and VRAM (if detected), `recommended_profile`, AI role status and voice
status.

### `GET /api/system/models` ● — Auth: no
```json
{"profiles": [{"id": "balanced", "label": "Balanced", "text": "gemma4:e4b", "vision": "gemma4:e4b",
               "installed": {"gemma4:e4b": true}, "…": "…"}],
 "current": "balanced", "recommended": "balanced",
 "roles": {"teacher": "ollama:gemma4:e4b", "vision": "…", "assessment": "…"}, "ollama_running": true}
```

### `POST /api/system/models/profile` ●
Request: `{"profile": "fast" | "balanced" | "accurate" | "best"}`. Saves the choice to
`backend/data/model_choice.json`. **422** for an unknown level.

### `POST /api/system/models/pull` ●
Request: `{"model": "gemma4:e4b"}` — only models used by the four levels are allowed (**422** otherwise).
Response: `application/x-ndjson` stream of Ollama progress events, e.g.
`{"status": "pulling …", "completed": 123, "total": 456}`.

### `GET /api/system/ai-status` ● — Auth: no
Per-role provider, model and whether it's configured/reachable.

### `GET /api/system/usage`
AI calls logged for the learner (role, model, duration, success).

---

## Progress

### `GET /api/progress` ●
```json
{"profile": { }, "syllabus": {"title": "…", "total": 8, "completed": 2},
 "current_lesson": { /* Lesson */ },
 "completed_lessons": [{"id": 1, "title": "…", "completed_at": "…"}],
 "checks": {"answered": 6, "correct": 5}, "streak_days": 3, "activities": 9,
 "skills": [{"slug": "…", "name": "…", "status": "proficient"}],
 "recent_feedback": [{"id": 4, "artwork": { }, "suitable": true, "next": "…", "created_at": "…"}]}
```

---

## Practice feedback (`api/studio.py`)

### `POST /api/artworks` ●
`multipart/form-data`:

| Field | Type | Notes |
|---|---|---|
| `file` | file | JPEG/PNG/WEBP, ≤ `MAX_UPLOAD_MB`, short side ≥ 256 px — required |
| `title` | string | ≤ 200, default `Untitled study` |
| `exercise_context` | string | ≤ 3000 |
| `lesson_id` | int | optional |
| `kind` | string | `learner` (default) or `reference` |
| `reference_artwork_id` | int | optional, for comparison |

Response: artwork object — `id`, `kind`, `title`, `track`, `medium`, `width`, `height`, `exercise_context`,
`lesson_id`, `reference_artwork_id`, `created_at`, `url` (signed). Errors: **400** onboarding incomplete, **422**
invalid image, **404** lesson.

### `GET /api/artworks?kind=` · `GET /api/artworks/{aid}` · `DELETE /api/artworks/{aid}`
List, fetch (with its analyses) and delete (also removes the file).

### `POST /api/artworks/{aid}/analyze` ● — AI
Optional body: `{"region": {"x": 0–1, "y": 0–1, "w": ≤1, "h": ≤1}}` to focus on part of the image.

Response: analysis object — `id`, `artwork_id`, `region`, `image_suitable`, `limitations[]`, `observations[]`
(`id`, `dimension`, `observation`, `location`, `confidence` low/medium/high), `strengths[]`, `improvements[]`, `corrective_steps[]`, `exercises[]`,
`suggested_lessons[]`, `next_milestone`, `skill_ratings[]`, `reference_comparison`, `model_vision`,
`model_assessment`, `created_at`. If `image_suitable` is false, nothing is recorded as evidence.

Errors: **422** for reference images, **404**, **429**, **502**, **503**.

### `GET /api/analyses` ● · `GET /api/analyses/{xid}`
Recent analyses / one analysis.

### `GET /api/media/{kind}/{uid}/{name}?exp=…&sig=…` — Auth: no (signed)
Serves stored images. **403** when the signature is invalid or expired, **404** when missing.

---

## Ask the tutor (`api/studio.py`)

### `POST /api/conversations?lesson_id=` ●
Creates a conversation, optionally tied to a lesson. Response includes `id`.

### `POST /api/conversations/{cid}/messages` ● — AI
Request: `{"text": "How do I keep edges soft?"}` (≤ 6000) or `{"action": "<quick action id>"}`.
Response: the new messages (`id`, `role`, `content`, `meta`, `created_at`). **400** before onboarding.

### `GET /api/conversations` · `GET /api/conversations/{cid}` · `DELETE /api/conversations/{cid}`
List, read and delete conversations.

### `GET /api/teacher/actions` — Auth: no
Quick-action ids and labels (first-version studio).

---

## Account (`api/account.py`) — first version

| Method & path | Description |
|---|---|
| `POST /api/auth/register` | `{email, password (8–128), display_name}` → token. Rate-limited per IP |
| `POST /api/auth/login` | `{email, password}` → token. **401** for wrong credentials |
| `GET /api/me` ● | Current user and profile |
| `PATCH /api/me/profile` | Update track, medium, goals, experience, subjects, strengths, difficulties, weekly hours (1–60), teaching style, memory notes |
| `DELETE /api/me` | Delete the account and its files |
| `GET /api/me/export` | All learner data as JSON |
| `GET /api/diagnostic` · `POST /api/diagnostic` | Self-placement questions / answers (`{answers, skip}`) |
| `GET /api/skills/profile` | Every skill with status and evidence count |
| `GET /api/skills/{slug}/evidence` | Evidence for one skill |
| `PUT /api/skills/{slug}` | Learner correction: `{status, note}` |
| `GET /api/history?limit=` | Activity log |
| `GET /api/dashboard` | Summary used by the first-version dashboard |

## Curriculum (`api/learning.py`) — Auth: no

| Method & path | Description |
|---|---|
| `GET /api/curriculum/sources?track=` | Institutions and course records with URLs and verification status |
| `GET /api/curriculum/graph?track=&medium=` | Skills and prerequisite edges |
| `GET /api/curriculum/modules?track=` | Curriculum modules |
| `GET /api/curriculum/search?q=&track=` | BM25 search over skills, courses and exercise templates |

## Exercises, references, palettes — first version

| Method & path | Description |
|---|---|
| `GET /api/exercises` | Exercises created for the learner |
| `POST /api/exercises` (AI) | `{kind: exercise|project, focus_skill?, goal?, harder?}` |
| `POST /api/exercises/{ex_id}/complete` | Mark done |
| `GET /api/references` | Generated reference images |
| `POST /api/references` (AI) | `{purpose: subject|composition|tonal|lighting|inspiration, subject, lighting?}`; **503** when images are off |
| `POST /api/palettes` (AI) | `{brief}` → palette with mixing notes |
