"""Targeted exercises & projects, reference images and palette suggestions."""
import json

from sqlalchemy import select
from sqlalchemy.orm import Session

from .. import models as m
from ..ai import prompts
from ..ai.router import get_router
from ..curriculum.graph import SkillGraph
from . import media
from .learner import current_lesson, get_profile, learner_context, log, skill_statuses


def choose_targets(db: Session, user: m.User, focus: str | None) -> tuple[list[str], str]:
    """Deterministic target selection from recorded evidence. Returns (slugs, rationale)."""
    profile = get_profile(db, user)
    graph = SkillGraph.load(db)
    if focus and focus in graph.nodes:
        return [focus], "You asked to focus on this skill."
    statuses = skill_statuses(db, user.id)
    weak = [s for s, st in statuses.items() if st == "needs_practice" and graph.medium_ok(s, profile.medium)]
    if weak:
        weak.sort(key=lambda s: graph.nodes[s].tier)
        return weak[:2], "Recent artwork assessments flagged these skills for focused practice."
    lesson = current_lesson(db, user.id)
    if lesson and lesson.skill_slugs:
        return lesson.skill_slugs[:2], f"These are the skills of your current lesson, “{lesson.title}”."
    inprog = [s for s, st in statuses.items() if st == "in_progress"]
    if inprog:
        return inprog[:2], "These skills are in progress in your recorded assessments."
    if profile.track:
        core = [s for s in graph.track_skills(profile.track, profile.medium) if graph.nodes[s].tier == 1]
        return core[:1], "No assessment evidence yet — starting with a core advanced skill for your track."
    return [], ""


def generate_exercise(db: Session, user: m.User, *, kind: str = "exercise", focus: str | None = None,
                      goal: str = "", harder: bool = False) -> m.Exercise:
    profile = get_profile(db, user)
    if not profile.track:
        raise ValueError("Complete onboarding (choose a track) first.")
    targets, rationale = choose_targets(db, user, focus)
    if not targets:
        raise ValueError("No target skill could be determined.")
    sks = list(db.scalars(select(m.Skill).where(m.Skill.slug.in_(targets))))
    rub = {r.skill_id: r for r in db.scalars(select(m.AssessmentRubric).where(m.AssessmentRubric.skill_id.in_([s.id for s in sks])))}
    tmpl = {t.skill_id: t for t in db.scalars(select(m.ExerciseTemplate).where(m.ExerciseTemplate.skill_id.in_([s.id for s in sks])))}
    payload = {
        "KIND": kind, "GOAL": goal or profile.goals, "HARDER_THAN_LAST": harder,
        "LEARNER": learner_context(db, user, include_analyses=2),
        "TARGET_SKILLS": [{"slug": s.slug, "name": s.name, "description": s.description,
                           "rubric": ({"criterion": rub[s.id].criterion, "needs_work": rub[s.id].needs_work,
                                       "developing": rub[s.id].developing, "solid": rub[s.id].solid} if s.id in rub else None),
                           "template_idea": tmpl[s.id].brief if s.id in tmpl else None} for s in sks],
        "WHY_THESE_SKILLS": rationale,
    }
    data = get_router().json("exercise", prompts.EXERCISE, [{"role": "user", "content": json.dumps(payload, ensure_ascii=False)}],
                             "practice_" + kind, prompts.EXERCISE_SCHEMA, user_id=user.id, max_tokens=3000)
    ex = m.Exercise(user_id=user.id, kind=kind, track=profile.track, medium=profile.medium, skill_slugs=targets,
                    title=data["title"][:200], objective=data["objective"], instructions=data.get("instructions", []),
                    materials=data.get("materials", []), difficulty=data.get("difficulty", "advanced"),
                    est_minutes=max(10, min(int(data.get("est_minutes") or 60), 3000)),
                    evaluation_criteria=data.get("evaluation_criteria", []), hints=data.get("hints", []),
                    completion_requirements=data.get("completion_requirements", []),
                    milestones=data.get("milestones", []) if kind == "project" else [],
                    reference_suggestion=data.get("reference_suggestion", ""), rationale=rationale,
                    model=get_router().label("exercise"))
    db.add(ex)
    db.flush()
    log(db, user.id, kind, f"New {kind}: {ex.title}", "exercise", ex.id)
    db.commit()
    return ex


PURPOSES = {
    "subject": "a clean photographic reference of {subject}, single clear light source, neutral background, sharp focus",
    "composition": "a composition study of {subject} with a strong, clear focal point and deliberate negative space",
    "tonal": "a high-contrast black-and-white tonal study photograph of {subject}, one key light, distinct light and shadow shapes",
    "lighting": "{subject} lit by {lighting}, photographic reference showing the light family clearly",
    "inspiration": "a finished fine-art painting of {subject}, painterly, advanced level",
}


def build_image_prompt(purpose: str, subject: str, track: str, medium: str | None, lighting: str = "") -> str:
    base = PURPOSES.get(purpose, PURPOSES["subject"]).format(subject=subject.strip(), lighting=lighting or "a single warm key light")
    if track == "pencil" and purpose != "inspiration":
        base += ". Monochrome or easy to read in grayscale, suitable as a graphite drawing reference"
    if track == "painting" and medium and purpose == "inspiration":
        base += f", in the visual character of {medium} paint"
    return base + ". No text, no watermark, no signature. Original subject; not imitating any specific artist's work."


def generate_reference(db: Session, user: m.User, purpose: str, subject: str, lighting: str = "") -> m.GeneratedReference:
    profile = get_profile(db, user)
    track = profile.track or "pencil"
    prompt = build_image_prompt(purpose, subject, track, profile.medium, lighting)
    data = get_router().image(prompt, user_id=user.id)
    name = media.save_png(data, "references", user.id)
    ref = m.GeneratedReference(user_id=user.id, purpose=purpose, prompt=prompt, track=track, stored_name=name,
                               model=get_router().label("image"))
    db.add(ref)
    db.flush()
    log(db, user.id, "reference", f"Generated {purpose} reference: {subject}", "reference", ref.id)
    db.commit()
    return ref


def palette(db: Session, user: m.User, brief: str) -> dict:
    profile = get_profile(db, user)
    content = json.dumps({"brief": brief, "medium": profile.medium or "oil", "track": profile.track})
    return get_router().json("exercise", prompts.PALETTE, [{"role": "user", "content": content}], "palette",
                             prompts.PALETTE_SCHEMA, user_id=user.id, max_tokens=1500)
