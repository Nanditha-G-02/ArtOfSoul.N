# Project overview

## What ArtOfSoul.N is

ArtOfSoul.N is a web application that acts as a **personal AI art teacher** for two subjects:

1. **Pencil drawing** (graphite)
2. **Painting** — oil, acrylic or watercolour, treated as different media

A learner answers a few questions, receives a personalised lesson plan, learns each lesson from an animated, speaking
tutor called **G**, practises with interactive exercises, and uploads photos of their work for feedback. The plan adapts
to what the feedback shows.

The application runs **entirely on the learner's own computer**. AI models run locally through
[Ollama](https://ollama.com); there are no accounts, API keys or subscriptions, and artwork never leaves the machine.

## The problem it addresses

| Problem for self-taught artists | How ArtOfSoul.N responds |
|---|---|
| Tutorials are generic and unordered | A plan built from the learner's level, goal and daily time, ordered by a prerequisite skill graph |
| Watching is passive | Each lesson mixes narration with flashcards, a sketch pad, ordering challenges, a value or colour lab and a quiz |
| Nobody looks at your work | A vision model describes what's visible in a photo; a second pass rates it against explicit rubrics |
| Practice doesn't change the plan | Repeated gaps add focused practice; demonstrated skills let the learner skip ahead |
| AI tools cost money and upload your data | Everything runs locally and free by default |

## Objectives

- Teach real drawing and painting skills in a sensible order, at the learner's level.
- Keep lessons short, visual and interactive rather than text-heavy.
- Give feedback that is grounded in what is actually visible, and say so when a photo can't be judged.
- Run without paid services, and work offline once the models are downloaded.
- Be honest: no invented scores, no claims of having seen something the model didn't see.

## Target users

- Beginners who want a structured start in pencil drawing or painting.
- Intermediate and experienced hobbyists who want to work on specific skills (values, edges, colour, portraits…).
- Students who want guided practice between classes.
- Anyone who prefers to keep their artwork private.

## Implemented features

### Learning journey

| Feature | Details |
|---|---|
| Local session | No sign-up: the browser receives a session for the single local learner (`POST /api/local/session`) |
| Spoken onboarding | Name, track, paint type (painting only), level, favourite subjects, goal, daily practice time, techniques to improve; custom answers; guards against double-clicks and missing answers |
| Personalised syllabus | 6–10 lessons in 3–4 stages; beginners get tier-0 foundations; each lesson has objectives, a studio assignment, exercises, assessment criteria and an estimated time; plus a daily practice routine |
| Animated roadmap | Winding path of lessons with done / current / upcoming / skipped states, milestones, lesson detail sheet, rebuild plan |
| Learning studio | Welcome → idea → key-word flashcards → 3–4 steps with animated demonstrations → put-the-steps-in-order → value lab or colour lab → 3-question quiz → practice task |
| Narrated playback | "Play narrated lesson" speaks each part and advances automatically, pausing at interactive parts |
| Ask the tutor | Free-text questions answered in the context of the current lesson and the learner's history |
| Sketch pad | Pencil grades 2H/HB/2B/6B or a paint palette with brush size, pen pressure, eraser, undo/clear; send the sketch for feedback |
| Practice feedback | Photo upload → observations → strengths, improvements (with reasons), corrective steps, recommended exercise; unsuitable photos are rejected and nothing is recorded |
| Adaptive roadmap | Rule-based: insert focused practice, skip proficient lessons, retire focused practice once proficient — each with a recorded reason |
| Progress | Lessons finished, quiz answers correct, practice pieces reviewed, day streak, activities played, skills with evidence, recent practice |
| Setup panel | Detects OS, CPU, RAM, NVIDIA GPU; recommends an AI quality level; shows voice and image-generation status |
| AI quality picker | Fast / Balanced / Accurate / Best; downloads missing models through Ollama with live progress |

### Tutor presentation

- Portrait tutor (photo in `frontend/src/assets/tutor.jpg`) with entrance, breathing zoom, floating and pointer-tilt
  animations; while speaking: rotating paint-colour halo, slight nod and rising paint dots driven by the audio level,
  plus a sound-wave in the name tag; thinking dots while the AI works; a paint-splash burst for correct answers.
- The still photo is deliberately **not** lip-synced.
- Voice: local **Piper** speech (`en_US-ljspeech-medium`) with on-disk caching; falls back to the browser/system voice.

### Visual design

- Original painted SVG landscape (dawn sky, rocky peak, valley, trees, cottage, swaying wildflower meadow) on the home
  page, with a faded version behind the other pages.
- Floating white pill navigation, frosted-glass panels, Plus Jakarta Sans (bundled, works offline), palette logo.
- Responsive from phone width upward; respects "reduce motion".

### AI and accuracy

- Role-based model router: `teacher`, `curriculum`, `vision`, `assessment`, `coordinator`, `exercise`, `image`.
- Default: one local Gemma 4 model for all text and vision roles.
- Structured output through Ollama's JSON-schema `format`, with one automatic retry on malformed JSON.
- Grounding: each lesson prompt includes the curriculum's description and "what good looks like" for its skills and a
  list of checked basics for the learner's medium.
- Speed: thinking mode off, model warm-up at start-up, background prefetch of the next lesson, cached lessons, short
  prompts.

### Curriculum knowledge base

- 42 original skills with prerequisites, tiers, media restrictions, objectives, three-level rubrics and exercise
  templates.
- 14 course records from 13 institutions (official catalogue pages, reviewed 19 Oct 2026), stored with URL, summary,
  verification status and licensing note; one record marked *partial* where no description is published.
- BM25 retrieval over courses, skills and exercise templates.

## Benefits and use cases

- **Daily practice:** a 15–60 minute lesson sized to the learner's day, with a routine on the roadmap.
- **Skill repair:** feedback that keeps flagging, say, edge control adds a focused-practice lesson before lessons that
  depend on it.
- **Private critique:** get feedback on work you wouldn't post online.
- **Classroom companion:** students can practise specific skills between sessions.

## How the project evolved

The repository history shows two stages:

1. **First version** — a broader "advanced" platform with sign-up, a dashboard, a syllabus page, an analysis studio,
   a reference studio, portfolio and settings, using cloud models (Anthropic/OpenAI) by default.
2. **Current version** — a simpler, local-first learning journey (Home → Questions → Roadmap → Studio → Practice →
   Progress) running free on Ollama, with the landscape theme, tutor G and interactive lessons.

The current frontend uses a subset of the backend API. The first version's endpoints (accounts, curriculum search,
skills, exercises, references, palettes, usage) are still present and tested in the backend; see
[api_documentation.md](api_documentation.md). Optional cloud providers can still be configured per role but are never
required.

## Known limitations

- Real model output quality (plans, lessons, artwork feedback) depends on the chosen model and hasn't been measured with
  automated tests.
- On computers without a GPU, plans and photo reviews take minutes.
- Local image generation needs a separately installed Stable Diffusion WebUI and a capable GPU.
- Single learner per installation in local mode.
- English only.
