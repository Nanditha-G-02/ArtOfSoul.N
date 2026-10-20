# Future enhancements

> **Everything on this page is proposed. None of it is implemented yet.** For what exists today, see
> [project_overview.md](project_overview.md#implemented-features).

## Learning experience

| Proposal | Why | Notes |
|---|---|---|
| Streaming lesson text | Show the first words in seconds instead of waiting for the whole script | Ollama supports streaming; needs incremental JSON handling |
| Lip-synced or video tutor | More natural presence than the animated still photo | Would need a local talking-head model; heavy on hardware |
| Short generated demonstration videos | Show brush/pencil motion, not just diagrams | Depends on a capable local video model |
| Side-by-side "before / after" comparisons | Make progress visible over weeks | Artworks and analyses are already stored |
| Spaced review of key terms and quiz questions | Better retention | Quiz answers are already recorded per question |
| More lab types (perspective grid, edge-softening, proportion measuring) | More hands-on practice | Fits the existing `Interactive.tsx` pattern |
| Timed daily practice mode | Builds a routine around `daily_minutes` | |
| Additional tracks (ink, charcoal, gouache, digital painting) | Wider audience | Requires new skills, rubrics and demonstrations in the curriculum |

## AI

| Proposal | Why |
|---|---|
| Automated quality evaluation of lessons and feedback against reference answers | Measure accuracy instead of relying on manual review |
| Hybrid retrieval (BM25 + local embeddings, e.g. pgvector) | Better matching of goals to skills and courses |
| Per-role model choice in the UI | Finer control than the four quality levels |
| Optional local image generation set-up helper | Image generation currently needs a manual Stable Diffusion WebUI install |
| Multiple tutor voices and languages | Piper offers many voices; prompts are English-only today |

## Platform

| Proposal | Why |
|---|---|
| Several learners per installation (local profiles) | Families or classrooms sharing one computer |
| Teacher / classroom view | Track a group of students |
| Shared rate limiting and job queue (e.g. Redis) | Needed only for multi-user servers |
| Desktop packaging (one installer bundling backend, frontend and Ollama checks) | Simpler set-up for non-technical users |
| Mobile app / PWA with camera upload | Photograph work straight from a phone |
| Export of progress as a PDF report | Share with a teacher |
| Continuous integration (tests + build on every push) | Catch regressions automatically |

## Contributing a proposal

Open an issue describing the problem it solves, who benefits, and whether it can run locally and free — the project's
core constraints.
