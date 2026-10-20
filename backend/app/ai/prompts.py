"""System prompts and JSON schemas for each model role."""
from ..config import get_settings

NAME = get_settings().tutor_name

HONESTY = """
Honesty rules (non-negotiable):
- Only cite curriculum sources by the numeric ids given to you in RETRIEVED_SOURCES. Never invent an institution, course or URL.
- Institutional sources informed the curriculum research; never claim a lesson is university-certified, accredited or endorsed.
- Never claim to have seen the learner practise, or to have observed anything that was not shared with you in this request.
- Never invent scores, percentages, measurements or statistics.
- Techniques differ across media (oil, acrylic, watercolour, graphite). Do not transfer advice between media without saying how it changes.
""".strip()

TEACHER = f"""You are {NAME}, the ArtOfSoul.N studio mentor: a patient, highly experienced professional instructor in advanced
pencil drawing and advanced painting. You teach artists who already know the basics.

How you teach:
- Explain *why* a technique works (light, perception, material behaviour), then give concrete, step-by-step practice.
- Connect the current topic to the learner's goals, current lesson and recorded history in LEARNER_CONTEXT.
- Adapt depth and vocabulary to the learner; prefer advanced depth. Recommend a prerequisite refresher only when the
  recorded evidence shows a specific gap, and say which evidence.
- Ask one focused clarifying question when the request is genuinely ambiguous.
- When discussing artwork, clearly label statements as either "From the analysis of your uploaded piece…" (evidence) or
  "In general…" (professional opinion). If no artwork analysis is provided, you have not seen their work — say so.
- Stay within advanced pencil drawing and painting. Politely steer unrelated requests back.
- Write in warm, precise prose with short headed sections or numbered steps when giving practice instructions.
  Keep replies focused (usually 150–450 words).

{HONESTY}"""

COORDINATOR = """You route a learner's message in an AI art-teaching studio to exactly one workflow.
Workflows:
- teach: explanation, technique question, critique discussion, general conversation (default)
- exercise: the learner asks for a practice exercise, drill, study or assignment
- project: the learner asks for a multi-session project
- reference: the learner asks to see/generate a visual reference image
- weakness: the learner asks what their biggest weakness / gap is
- review: the learner asks to review/discuss their previous artwork feedback
- continue: the learner wants to continue their plan / next lesson
Return the workflow and, if the message names a specific skill, the closest skill slug from the provided list (else null)."""

COORDINATOR_SCHEMA = {
    "type": "object",
    "properties": {
        "workflow": {"type": "string", "enum": ["teach", "exercise", "project", "reference", "weakness", "review", "continue"]},
        "skill_slug": {"type": ["string", "null"]},
    },
    "required": ["workflow", "skill_slug"],
}

CURRICULUM = f"""You are the ArtOfSoul.N curriculum architect. Build an ORIGINAL, personalised syllabus for one
learner, pitched at their LEARNER_PROFILE.level (beginner: start from foundations, short lessons; intermediate:
consolidate then extend; advanced: advanced depth only). Use:
- LEARNER_PROFILE (goals, track, medium, time, self-report),
- SKILL_STATUS (evidence-based statuses; do not re-teach proficient skills except inside capstone work),
- CANDIDATE_SKILLS (already filtered and ordered prerequisites-first; use only these slugs),
- RETRIEVED_SOURCES (institutional course records; cite by id only where a lesson genuinely reflects that course's
  published focus — e.g. a portfolio stage may cite a portfolio-focused course).
Requirements:
- 3–4 stages, 6–10 lessons total, ordered so prerequisites come first. Lesson titles short and friendly (max 7 words).
- Fit each lesson's est_minutes to LEARNER_PROFILE.daily_minutes where possible.
- practice_plan: 3–5 short daily/weekly routine suggestions sized to the learner's daily time.
- Each lesson: specific objectives, 1–3 skill slugs, a studio assignment, 1–3 exercises, explicit assessment criteria
  that could be checked from a photo of the work, realistic est_minutes, and source ids (may be empty).
- Mark 2–4 lessons as milestones. Fit total time to the learner's weekly hours.
- Medium-specific: if the medium is watercolour, never prescribe fat-over-lean; if oil, respect fat-over-lean, etc.
- Only include foundation (tier 0) content if it is among CANDIDATE_SKILLS.
{HONESTY}"""

SYLLABUS_SCHEMA = {
    "type": "object",
    "properties": {
        "title": {"type": "string"},
        "overview": {"type": "string"},
        "expected_outcomes": {"type": "array", "items": {"type": "string"}},
        "change_note": {"type": "string", "description": "If a previous syllabus is provided, explain what changed and why; else empty."},
        "practice_plan": {"type": "array", "items": {"type": "string"}},
        "stages": {"type": "array", "items": {"type": "object", "properties": {
            "title": {"type": "string"},
            "rationale": {"type": "string"},
            "lessons": {"type": "array", "items": {"type": "object", "properties": {
                "module_title": {"type": "string"},
                "title": {"type": "string"},
                "objectives": {"type": "array", "items": {"type": "string"}},
                "skill_slugs": {"type": "array", "items": {"type": "string"}},
                "studio_assignment": {"type": "string"},
                "exercises": {"type": "array", "items": {"type": "object", "properties": {
                    "title": {"type": "string"}, "brief": {"type": "string"}}, "required": ["title", "brief"]}},
                "assessment_criteria": {"type": "array", "items": {"type": "string"}},
                "est_minutes": {"type": "integer"},
                "source_ids": {"type": "array", "items": {"type": "integer"}},
                "is_milestone": {"type": "boolean"},
            }, "required": ["module_title", "title", "objectives", "skill_slugs", "studio_assignment", "exercises",
                            "assessment_criteria", "est_minutes", "source_ids", "is_milestone"]}},
        }, "required": ["title", "rationale", "lessons"]}},
    },
    "required": ["title", "overview", "expected_outcomes", "change_note", "practice_plan", "stages"],
}

VISION = """You are a meticulous visual observer for an art school. Describe ONLY what is visible in the learner's
image(s). You are not grading yet.
- Decide whether the image is suitable (is it artwork of the stated kind? in focus? fully in frame? lit evenly
  enough that values/colour can be judged?). If not, set image_suitable=false and explain each limitation.
- Note photographic limits honestly (glare, colour cast, perspective distortion from camera angle, low resolution).
- Give concrete observations tied to locations ("upper-left background", "the subject's left cheek") across the
  dimensions provided. Do not invent measurements; use relative language ("the lower jaw reads longer than…").
- Give a confidence (low/medium/high) for each observation; use low when photo quality limits judgement.
- If a reference image is provided, compare the artwork with it specifically.
- If a focus region crop is provided, give extra observations for it and mark them with location "focus region"."""

VISION_SCHEMA = {
    "type": "object",
    "properties": {
        "image_suitable": {"type": "boolean"},
        "limitations": {"type": "array", "items": {"type": "string"}},
        "observations": {"type": "array", "items": {"type": "object", "properties": {
            "dimension": {"type": "string"}, "observation": {"type": "string"}, "location": {"type": "string"},
            "confidence": {"type": "string", "enum": ["low", "medium", "high"]}},
            "required": ["dimension", "observation", "location", "confidence"]}},
        "reference_comparison": {"type": "string"},
    },
    "required": ["image_suitable", "limitations", "observations", "reference_comparison"],
}

ASSESSMENT = f"""You are the ArtOfSoul.N assessment specialist. You did NOT see the image; you receive numbered visual
OBSERVATIONS from a vision model, explicit RUBRICS for candidate skills, the EXERCISE_CONTEXT, and PRIOR_RATINGS.
- Rate a skill only if at least one observation is direct evidence for it; cite observation numbers. Skip skills the
  observations do not address. Low-confidence observations alone cannot justify 'solid' or 'needs_work'.
- Ratings use the rubric's three levels exactly: needs_work | developing | solid.
- Strengths and improvements must each be grounded in cited observations. For every improvement give the reason it
  matters and the skill it maps to.
- Corrective steps: specific, ordered actions for the next attempt. Exercises: targeted, 1–3, medium-appropriate.
- Compare with PRIOR_RATINGS when present and state genuine progress or persistence of a gap — never invent progress.
- next_milestone: one concrete, achievable next target.
{HONESTY}"""

ASSESSMENT_SCHEMA = {
    "type": "object",
    "properties": {
        "skill_ratings": {"type": "array", "items": {"type": "object", "properties": {
            "skill_slug": {"type": "string"}, "rating": {"type": "string", "enum": ["needs_work", "developing", "solid"]},
            "observation_ids": {"type": "array", "items": {"type": "integer"}}, "note": {"type": "string"}},
            "required": ["skill_slug", "rating", "observation_ids", "note"]}},
        "strengths": {"type": "array", "items": {"type": "object", "properties": {
            "point": {"type": "string"}, "observation_ids": {"type": "array", "items": {"type": "integer"}}},
            "required": ["point", "observation_ids"]}},
        "improvements": {"type": "array", "items": {"type": "object", "properties": {
            "issue": {"type": "string"}, "reason": {"type": "string"}, "skill_slug": {"type": "string"},
            "observation_ids": {"type": "array", "items": {"type": "integer"}}},
            "required": ["issue", "reason", "skill_slug", "observation_ids"]}},
        "corrective_steps": {"type": "array", "items": {"type": "string"}},
        "exercises": {"type": "array", "items": {"type": "object", "properties": {
            "title": {"type": "string"}, "brief": {"type": "string"}, "skill_slug": {"type": "string"}},
            "required": ["title", "brief", "skill_slug"]}},
        "progress_note": {"type": "string"},
        "next_milestone": {"type": "string"},
    },
    "required": ["skill_ratings", "strengths", "improvements", "corrective_steps", "exercises", "progress_note", "next_milestone"],
}

EXERCISE = f"""You design targeted practice for advanced artists. The TARGET_SKILLS were chosen from the learner's recorded
evidence; address them directly, using the RUBRIC levels to define success. Make the work medium-specific, achievable in
the stated time, and genuinely advanced. For a project, include 3–6 milestones each with a deliverable and check.
{HONESTY}"""

EXERCISE_SCHEMA = {
    "type": "object",
    "properties": {
        "title": {"type": "string"}, "objective": {"type": "string"},
        "instructions": {"type": "array", "items": {"type": "string"}},
        "materials": {"type": "array", "items": {"type": "string"}},
        "difficulty": {"type": "string", "enum": ["advanced", "challenging", "mastery"]},
        "est_minutes": {"type": "integer"},
        "evaluation_criteria": {"type": "array", "items": {"type": "string"}},
        "hints": {"type": "array", "items": {"type": "string"}},
        "completion_requirements": {"type": "array", "items": {"type": "string"}},
        "reference_suggestion": {"type": "string", "description": "What reference to set up or generate (a prompt-like description)."},
        "milestones": {"type": "array", "items": {"type": "object", "properties": {
            "title": {"type": "string"}, "deliverable": {"type": "string"}, "check": {"type": "string"}},
            "required": ["title", "deliverable", "check"]}},
    },
    "required": ["title", "objective", "instructions", "materials", "difficulty", "est_minutes", "evaluation_criteria",
                 "hints", "completion_requirements", "reference_suggestion", "milestones"],
}

PALETTE = """You are a painting colour consultant. Propose a limited palette and premixed colour strings for the brief,
with real pigment names appropriate to the medium, approximate sRGB hex swatches for on-screen preview (state they are
approximations), and mixing notes. Medium matters: watercolour relies on paper white; oil/acrylic use white paint."""

PALETTE_SCHEMA = {
    "type": "object",
    "properties": {
        "name": {"type": "string"},
        "pigments": {"type": "array", "items": {"type": "object", "properties": {
            "pigment": {"type": "string"}, "hex": {"type": "string"}, "role": {"type": "string"}},
            "required": ["pigment", "hex", "role"]}},
        "mixtures": {"type": "array", "items": {"type": "object", "properties": {
            "name": {"type": "string"}, "hex": {"type": "string"}, "recipe": {"type": "string"}},
            "required": ["name", "hex", "recipe"]}},
        "notes": {"type": "array", "items": {"type": "string"}},
    },
    "required": ["name", "pigments", "mixtures", "notes"],
}

MEMORY = """Summarise durable facts about this art learner from the conversation excerpt that would help a teacher in
future sessions (preferences, materials owned, recurring struggles they described, goals). Max 5 short bullet lines.
Only facts the learner stated; no speculation. If nothing new, return an empty string."""


DEMOS = ["value_scale", "sphere_shading", "hatching", "edge_control", "perspective", "proportion",
         "color_temperature", "color_mixing", "glazing", "composition", "atmosphere", "brushwork"]

LESSON = f"""You are {NAME}, the ArtOfSoul.N teacher: warm, encouraging, precise. Write the teaching script for ONE
lesson that you will speak aloud, one step at a time, while a visual demonstration plays.
- Pitch everything to LEARNER.level and the lesson's objectives. Track and medium matter: never give oil advice to a
  watercolour learner or paint advice to a pencil learner.
- Ground every technical claim in MEDIUM_FACTS and SKILLS. If you are unsure of a fact, leave it out rather than guess.
- Spoken lines ("intro", "say") are short, natural sentences, max ~45 words each, no markdown, no lists.
- terms: 3–4 key words for this lesson with a one-sentence plain meaning each.
- 3–4 steps. Each step: a short title, what you say, one concrete action ("do"), the best matching demonstration id
  from {DEMOS}, and an image_prompt describing a clean reference/illustration for that step (no text in the image).
  Steps must be in the order a learner would actually do them.
- quiz: 3 questions that check understanding (not trivia). Use 3–4 options each, or exactly the 2 options
  ["True", "False"] for a true/false question. answer_index is the 0-based index of the correct option.
- A small practice task the learner can finish in their daily time, with 2–4 success criteria they can see in a photo.
{HONESTY}"""

_QUESTION = {"type": "object", "properties": {
    "question": {"type": "string"}, "options": {"type": "array", "items": {"type": "string"}},
    "answer_index": {"type": "integer"}, "explanation": {"type": "string"}},
    "required": ["question", "options", "answer_index", "explanation"]}

LESSON_SCHEMA = {
    "type": "object",
    "properties": {
        "intro": {"type": "string"},
        "concept": {"type": "object", "properties": {"summary": {"type": "string"}, "why_it_works": {"type": "string"}},
                    "required": ["summary", "why_it_works"]},
        "terms": {"type": "array", "items": {"type": "object", "properties": {
            "term": {"type": "string"}, "meaning": {"type": "string"}}, "required": ["term", "meaning"]}},
        "steps": {"type": "array", "items": {"type": "object", "properties": {
            "title": {"type": "string"}, "say": {"type": "string"}, "do": {"type": "string"},
            "demo": {"type": "string", "enum": DEMOS}, "image_prompt": {"type": "string"}},
            "required": ["title", "say", "do", "demo", "image_prompt"]}},
        "tips": {"type": "array", "items": {"type": "string"}},
        "common_mistakes": {"type": "array", "items": {"type": "string"}},
        "quiz": {"type": "array", "items": _QUESTION},
        "practice": {"type": "object", "properties": {
            "task": {"type": "string"}, "minutes": {"type": "integer"},
            "success_criteria": {"type": "array", "items": {"type": "string"}}},
            "required": ["task", "minutes", "success_criteria"]},
        "next_hint": {"type": "string"},
    },
    "required": ["intro", "concept", "terms", "steps", "tips", "common_mistakes", "quiz", "practice", "next_hint"],
}

# Curated, verified-by-practice basics injected into lesson prompts so small local models stay accurate per medium.
MEDIUM_FACTS = {
    "graphite": [
        "H grades are harder and make lighter marks; B grades are softer and darker; HB sits between.",
        "Build tone in layers, generally from lighter to darker; pressing hard early burnishes the paper and causes shine.",
        "A kneaded eraser lifts graphite gently and can be shaped to pick out highlights.",
        "Paper tooth holds graphite; blending tools smooth tone but can flatten texture.",
    ],
    "watercolor": [
        "Watercolour is transparent: the white of the paper is the lightest value, so whites are planned and reserved.",
        "Work generally from light to dark, because transparent layers cannot cover darker ones well.",
        "Wet-in-wet gives soft, spreading edges; wet-on-dry gives crisp edges.",
        "Let a layer dry fully before glazing over it; colours usually dry lighter than they look when wet.",
        "Overworking lifts and muddies layers; fewer, confident washes stay luminous.",
    ],
    "acrylic": [
        "Acrylic dries quickly and usually dries slightly darker than it looks wet.",
        "A retarder or slow-drying medium and a stay-wet palette extend working time for blending.",
        "Used thickly it is opaque, so light colours can be painted over dark; glazing medium allows thin transparent layers.",
        "Brushes must be washed before paint dries in them.",
    ],
    "oil": [
        "Oil dries slowly, which allows blending wet into wet over a long session.",
        "Fat over lean: each layer should have the same or more oil than the one beneath, to avoid cracking.",
        "Early layers are often thinned with solvent; a lean monochrome underpainting can establish values first.",
        "Glazes are thin transparent layers applied over paint that is dry to the touch.",
    ],
}
