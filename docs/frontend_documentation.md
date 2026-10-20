# Frontend documentation

The frontend is a **React 19 + TypeScript** single-page app built with **Vite 8** and styled with **Tailwind CSS v4**.
Animations use **motion** (Framer Motion). It runs on port **5174** and calls the backend only through `/api/*`.

## Technologies

| Package | Purpose |
|---|---|
| `react`, `react-dom` 19 | UI |
| `react-router-dom` 7 | Client-side routing |
| `motion` | Page transitions, avatar animation, demonstrations, roadmap path |
| `@fontsource-variable/plus-jakarta-sans` | Bundled font (works offline) |
| `tailwindcss` 4 + `@tailwindcss/vite` | Styling; reusable classes declared with `@utility` in `index.css` |
| `typescript`, `vite`, `@vitejs/plugin-react` | Build tooling |

Scripts (`frontend/package.json`):

```bash
npm run dev       # dev server on http://localhost:5174 (proxies /api → http://localhost:8040)
npm run build     # type-check (tsc -b) and build to dist/
npm run preview   # serve the built app on port 5174
```

## Folder structure

```
frontend/
├── index.html
├── vite.config.ts          Port 5174, /api proxy (VITE_API_PROXY), Tailwind plugin
├── nginx.conf              Used by the Docker image: serves dist/ and proxies /api
├── Dockerfile
├── public/favicon.svg      Palette icon
└── src/
    ├── main.tsx            Router and providers
    ├── index.css           Theme tokens, @utility classes (btn, panel, chip…), keyframes, reduced-motion rules
    ├── assets/tutor.jpg    Portrait used for tutor G
    ├── pages/              One component per screen
    ├── components/         Reusable UI and interactive pieces
    └── lib/                API client, session, speech, hooks, shared types
```

## Routing (`src/main.tsx`)

| Path | Page | Notes |
|---|---|---|
| `/` | `Home` | Full landscape hero, "Start learning" / "Continue" |
| `/start` | `Start` | One-question-at-a-time onboarding, then plan creation |
| `/roadmap` | `RoadmapPage` | Inside `Shell` (pill navigation + faded backdrop) |
| `/studio`, `/studio/:lessonId` | `Studio` | Without an id, opens the current lesson |
| `/practice`, `/practice/:lessonId` | `Practice` | Photo upload and feedback |
| `/progress` | `Progress` | Stats, setup panel, AI quality picker |
| `*` | — | Redirects to `/` |

`SessionProvider` wraps everything and makes sure a local session exists before pages load data.

## Pages

### `Home.tsx`
Landscape hero (`Landscape variant="full"`), the tutor's portrait, pill navigation and the call to action. If the learner
already has a plan, the button continues to the roadmap.

### `Start.tsx`
Loads `GET /api/journey/questions` and shows one question at a time while G speaks it.

- Supports `single`, `multi` (with custom answers when `allow_custom`) and `text` questions; questions with `when` (paint
  type) are only shown for the painting track; technique options come from `options_by_track`.
- A `useRef` guard ignores double-clicks while advancing; the paint type is removed if the learner switches to pencil.
- Before submitting, `firstMissing()` returns the learner to any unanswered required question
  (track, medium for painting, level, goal, daily minutes).
- Submits `POST /api/journey/answers`, then `POST /api/syllabus` with a goal sentence composed from the answers, and
  navigates to the roadmap.

### `RoadmapPage.tsx`
Draws the plan (`GET /api/roadmap`) as a winding, animated path of lesson nodes with done / current / upcoming /
skipped states and milestone markers. Clicking a node opens a detail sheet (objectives, assignment, time) with "Start
lesson". Also offers rebuilding the plan.

### `Studio.tsx`
The lesson player. Loads `GET /api/lessons/{id}/script`; if no script exists yet it requests
`POST /api/lessons/{id}/script` and shows the tutor "thinking". The lesson is split into **segments**:

| Segment | Component |
|---|---|
| `intro`, `concept` | Narration with the avatar |
| `terms` | `Flashcards` |
| `step` (×3–4) | Step text + `Demo` animation; optional "Show me a picture" when image generation is configured |
| `order` | `OrderSteps` |
| `lab` | `ValueMatch` (pencil) or `ColorMixer` (painting) |
| `quiz` | `Quiz` |
| `practice` | Practice task + `SketchPad` + link to Practice |

"Play narrated lesson" speaks each part through `useSpeaker` and advances automatically, pausing at interactive
segments. A side column holds the segment list and "Ask G" (conversation endpoints). Finishing calls
`PATCH /api/lessons/{id}` with `completed`.

### `Practice.tsx`
Uploads a photo (`POST /api/artworks`), runs feedback (`POST /api/artworks/{id}/analyze`) and shows strengths,
improvements with reasons, next steps and the recommended exercise — or the reasons a photo couldn't be judged. Lists
earlier feedback (`GET /api/analyses`).

### `Progress.tsx`
Shows lessons finished, quiz answers correct, practice pieces reviewed, day streak, activities, skills with evidence
and recent practice (`GET /api/progress`). The **Setup** panel shows hardware (`GET /api/system/hardware`), AI role
status and voice status, and contains `ModelPicker`.

## Components

| File | Exports | Description |
|---|---|---|
| `Avatar.tsx` | `Avatar` | Tutor portrait with moods `idle`, `talking`, `thinking`, `happy`. Entrance, breathing zoom, floating and pointer tilt; while talking a rotating colour halo, nod and paint dots react to the audio `level`; a splash burst for `happy` |
| `Landscape.tsx` | `Landscape` | Original SVG landscape; `full` for Home, `soft` as a faded backdrop |
| `Demos.tsx` | `Demo`, `DEMO_IDS` | 12 animated SVG demonstrations: `value_scale`, `sphere_shading`, `hatching`, `edge_control`, `perspective`, `proportion`, `color_temperature`, `color_mixing`, `glazing`, `composition`, `atmosphere`, `brushwork`. Must match `DEMOS` in `backend/app/ai/prompts.py` |
| `Interactive.tsx` | `Flashcards`, `OrderSteps`, `ValueMatch`, `ColorMixer`, `Quiz`, `SketchPad`, `mixPigments` | Lesson activities (below) |
| `ModelPicker.tsx` | `ModelPicker` | AI quality levels from `GET /api/system/models`; saves via `/system/models/profile`; downloads with streamed progress from `/system/models/pull` |
| `Shell.tsx` | `Shell`, `PillNav`, `Brand`, `PaletteMark`, `Backdrop` | Layout for inner pages: floating pill navigation, palette logo, faded landscape |
| `ui.tsx` | `PageHeader`, `Section`, `Loading`, `Thinking`, `ErrorNote`, `Empty`, `Prose`, `List`, `StatusChip` | Small shared pieces |
| `Art.tsx` | `EmptyArt` and others | Decorative SVGs used by empty states |

### Interactive activities

| Activity | What the learner does | Recorded as |
|---|---|---|
| `Flashcards` | Flip the lesson's key terms | `flashcards` |
| `OrderSteps` | Put the shuffled lesson steps in the right order | `order_steps` with score |
| `ValueMatch` | Five rounds: judge the value of a grey patch shown on a different surrounding grey and pick it on a value scale (trains seeing past simultaneous contrast) | `value_match` with score |
| `ColorMixer` | Mix paints to hit a target colour. `mixPigments` mixes in linear reflectance (weighted geometric mean, closer to real paint than RGB averaging); closeness is measured with ΔE (CIE76) | `color_mix` with score |
| `Quiz` | Three multiple-choice questions; each answer is checked by `POST /lessons/{id}/check`, which returns the explanation | quiz answers (first attempt) |
| `SketchPad` | Canvas with pencil grades 2H/HB/2B/6B or a paint palette, brush size, pen pressure, eraser, undo, clear; can send the sketch for feedback | `sketch` |

Activity results are sent to `POST /api/lessons/{id}/activity`.

## `lib/`

| File | Purpose |
|---|---|
| `api.ts` | `api.get/post/patch/put/del/upload`, `fetchBlob`, `mediaUrl`, `tokenStore`, `ApiError`. Adds the bearer token, turns error `detail` into readable messages, clears the token on 401 |
| `session.tsx` | `SessionProvider` / `useSession`: calls `POST /api/local/session` if there is no token, exposes the user and profile |
| `speech.ts` | `useSpeaker()`: plays Piper audio from `POST /api/tts` and measures loudness with the Web Audio API to drive the avatar; falls back to the browser's `speechSynthesis` |
| `tutor.ts` | `{ name: "G", photo }` — change the tutor's name or photo here (and `TUTOR_NAME` in the backend) |
| `hooks.ts` | `useFetch(path)` and `useAction(fn)` with loading/error state |
| `types.ts` | Shared TypeScript types for API responses |

## Styling

- Theme colours, radii and shadows are CSS variables in `index.css`; reusable classes (`btn`, `btn-primary`, `panel`,
  `chip`, …) are declared with Tailwind v4 `@utility`.
- Layout grids use `minmax(0, 1fr)` and `min-w-0` so long lesson text can't widen the page.
- `prefers-reduced-motion` turns off non-essential animation.

## State management

There is no global store. Server data is fetched per page with `useFetch`; the session lives in `SessionProvider`; the
token is kept in `localStorage` (`aos.token`). Lesson progress is stored on the server, so reloading resumes where the
learner left off.

## Talking to the backend

All calls go through `lib/api.ts` with paths starting `/api`. `VITE_API_URL` can prefix them (empty by default). During
development Vite forwards `/api` to `VITE_API_PROXY` (default `http://localhost:8040`). The endpoints the current
frontend uses are marked in [api_documentation.md](api_documentation.md).
