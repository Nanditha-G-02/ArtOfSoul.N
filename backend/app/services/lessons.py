"""Lesson teaching scripts (cached), understanding checks and per-step visuals."""
import json

from sqlalchemy import select
from sqlalchemy.orm import Session

from .. import models as m
from ..ai import prompts
from ..ai.router import get_router
from . import practice
from .learner import get_profile, log

# Deterministic fallback when the model's demo choice isn't one we can draw
DOMAIN_DEMO = {"Value": "value_scale", "Light": "sphere_shading", "Edges": "edge_control", "Space": "perspective",
               "Drawing accuracy": "proportion", "Composition": "composition", "Colour": "color_temperature",
               "Medium": "glazing", "Form": "sphere_shading", "Materials": "hatching", "Figure": "proportion",
               "Subjects": "composition", "Artistic voice": "brushwork"}


def _clean(script: dict, lesson: m.Lesson, db: Session) -> dict:
    domains = [d for (d,) in db.execute(select(m.Skill.domain).where(m.Skill.slug.in_(lesson.skill_slugs)))]
    fallback = DOMAIN_DEMO.get(domains[0] if domains else "", "value_scale")
    steps = []
    for st in (script.get("steps") or [])[:6]:
        if not isinstance(st, dict) or not st.get("say"):
            continue
        demo = st.get("demo") if st.get("demo") in prompts.DEMOS else fallback
        steps.append({"title": str(st.get("title", ""))[:120], "say": str(st["say"])[:600], "do": str(st.get("do", ""))[:400],
                      "demo": demo, "image_prompt": str(st.get("image_prompt", ""))[:500]})
    if not steps:
        raise ValueError("no usable steps")
    check = script.get("check") or {}
    opts = [str(o) for o in (check.get("options") or [])][:4]
    ai = check.get("answer_index")
    if len(opts) < 2 or not isinstance(ai, int) or not 0 <= ai < len(opts):
        check = None  # unusable check is dropped rather than shown with a wrong answer key
    else:
        check = {"question": str(check.get("question", "")), "options": opts, "answer_index": ai,
                 "explanation": str(check.get("explanation", ""))}
    pr = script.get("practice") or {}
    return {"intro": str(script.get("intro", ""))[:600],
            "concept": {"summary": str((script.get("concept") or {}).get("summary", "")),
                        "why_it_works": str((script.get("concept") or {}).get("why_it_works", ""))},
            "steps": steps, "tips": [str(t) for t in script.get("tips", [])][:5],
            "common_mistakes": [str(t) for t in script.get("common_mistakes", [])][:5], "check": check,
            "practice": {"task": str(pr.get("task", lesson.studio_assignment)), "minutes": int(pr.get("minutes") or 30),
                         "success_criteria": [str(c) for c in pr.get("success_criteria", lesson.assessment_criteria)][:5]},
            "next_hint": str(script.get("next_hint", ""))}


def get_script(db: Session, user: m.User, lesson: m.Lesson, regenerate: bool = False) -> m.LessonContent:
    cached = db.scalar(select(m.LessonContent).where(m.LessonContent.lesson_id == lesson.id))
    if cached and not regenerate:
        return cached
    profile = get_profile(db, user)
    payload = {
        "LEARNER": {"name": user.display_name, "level": profile.level, "track": profile.track, "medium": profile.medium,
                    "goal": profile.goals, "daily_minutes": profile.daily_minutes,
                    "techniques_to_improve": profile.difficulties},
        "LESSON": {"title": lesson.title, "stage": lesson.stage_title, "objectives": lesson.objectives,
                   "studio_assignment": lesson.studio_assignment, "exercises": lesson.exercises,
                   "assessment_criteria": lesson.assessment_criteria, "est_minutes": lesson.est_minutes,
                   "focused_practice": lesson.kind == "remedial"},
    }
    router = get_router()
    raw = router.json("teacher", prompts.LESSON, [{"role": "user", "content": json.dumps(payload, ensure_ascii=False)}],
                      "lesson_script", prompts.LESSON_SCHEMA, user_id=user.id, max_tokens=4000)
    try:
        script = _clean(raw, lesson, db)
    except (ValueError, TypeError) as e:
        raise practice_error() from e
    if cached:
        cached.script, cached.model, cached.quiz_correct = script, router.label("teacher"), None
    else:
        cached = m.LessonContent(lesson_id=lesson.id, script=script, model=router.label("teacher"))
        db.add(cached)
    if lesson.status == "upcoming":
        for l in lesson.syllabus.lessons:
            if l.status == "current":
                l.status = "upcoming"
        lesson.status = "current"
    log(db, user.id, "lesson", f"Teacher prepared lesson: {lesson.title}", "lesson", lesson.id)
    db.commit()
    return cached


def practice_error():
    from ..ai.providers import AIProviderError
    return AIProviderError("The local model's lesson script was incomplete. Press “Try again” — or use a larger model.")


def check_answer(db: Session, user: m.User, lesson: m.Lesson, choice: int) -> dict:
    content = db.scalar(select(m.LessonContent).where(m.LessonContent.lesson_id == lesson.id))
    if not content or not content.script.get("check"):
        raise ValueError("This lesson has no understanding check.")
    chk = content.script["check"]
    correct = choice == chk["answer_index"]
    if content.quiz_correct is None:
        content.quiz_correct = correct
    log(db, user.id, "check", f"Understanding check in “{lesson.title}”: {'correct' if correct else 'not yet'}", "lesson", lesson.id)
    db.commit()
    return {"correct": correct, "answer_index": chk["answer_index"], "explanation": chk["explanation"]}


def step_visual(db: Session, user: m.User, lesson: m.Lesson, index: int) -> m.GeneratedReference:
    cached = db.scalar(select(m.GeneratedReference).where(m.GeneratedReference.lesson_id == lesson.id,
                                                          m.GeneratedReference.step_index == index))
    if cached:
        return cached
    content = db.scalar(select(m.LessonContent).where(m.LessonContent.lesson_id == lesson.id))
    if not content or index >= len(content.script["steps"]):
        raise ValueError("Unknown step")
    step = content.script["steps"][index]
    ref = practice.generate_reference(db, user, "subject", step["image_prompt"] or step["title"])
    ref.lesson_id, ref.step_index = lesson.id, index
    db.commit()
    return ref
