"""Lesson teaching scripts (cached), understanding checks and per-step visuals."""
import json
import logging
import threading

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


def _d(v) -> dict:
    return v if isinstance(v, dict) else {}


def _l(v) -> list:
    if isinstance(v, list):
        return v
    return [v] if isinstance(v, str) and v.strip() else []


def _int(v, default: int) -> int:
    try:
        return int(str(v).split()[0])
    except (ValueError, IndexError):
        return default


def _clean(script, lesson: m.Lesson, db: Session) -> dict:
    """Normalise a model-written script. Small local models sometimes return the right shape with odd types;
    anything unusable is dropped rather than shown wrongly."""
    script = _d(script)
    domains = [d for (d,) in db.execute(select(m.Skill.domain).where(m.Skill.slug.in_(lesson.skill_slugs)))]
    fallback = DOMAIN_DEMO.get(domains[0] if domains else "", "value_scale")
    steps = []
    for st in _l(script.get("steps"))[:6]:
        st = _d(st)
        say = str(st.get("say") or "").strip()
        if not say:
            continue
        demo = st.get("demo") if st.get("demo") in prompts.DEMOS else fallback
        steps.append({"title": str(st.get("title") or f"Step {len(steps) + 1}")[:120], "say": say[:600],
                      "do": str(st.get("do") or "")[:400], "demo": demo,
                      "image_prompt": str(st.get("image_prompt") or "")[:500]})
    if not steps:
        raise ValueError("no usable steps")
    quiz = []
    raw_quiz = _l(script.get("quiz")) or _l(script.get("check"))  # older cached lessons had a single "check"
    if isinstance(script.get("check"), dict) and not _l(script.get("quiz")):
        raw_quiz = [script["check"]]
    for q in raw_quiz[:4]:
        q = _d(q)
        opts = [str(o) for o in _l(q.get("options")) if str(o).strip()][:4]
        ai = q.get("answer_index")
        ai = _int(ai, -1) if not isinstance(ai, int) else ai
        if len(opts) < 2 or not 0 <= ai < len(opts) or not str(q.get("question") or "").strip():
            continue  # an unusable question is dropped rather than shown with a wrong answer key
        quiz.append({"question": str(q["question"]), "options": opts, "answer_index": ai,
                     "explanation": str(q.get("explanation") or "")})
    terms = []
    for t in _l(script.get("terms"))[:5]:
        t = _d(t)
        if str(t.get("term") or "").strip() and str(t.get("meaning") or "").strip():
            terms.append({"term": str(t["term"])[:60], "meaning": str(t["meaning"])[:300]})
    pr = _d(script.get("practice"))
    concept = script.get("concept")
    concept = _d(concept) if isinstance(concept, dict) else {"summary": str(concept or ""), "why_it_works": ""}
    criteria = [str(c) for c in _l(pr.get("success_criteria"))] or list(lesson.assessment_criteria)
    return {"intro": str(script.get("intro") or f"Let's begin: {lesson.title}.")[:600],
            "concept": {"summary": str(concept.get("summary") or ""), "why_it_works": str(concept.get("why_it_works") or "")},
            "steps": steps, "tips": [str(t) for t in _l(script.get("tips"))][:5],
            "common_mistakes": [str(t) for t in _l(script.get("common_mistakes"))][:5],
            "quiz": quiz, "check": quiz[0] if quiz else None, "terms": terms,
            "practice": {"task": str(pr.get("task") or lesson.studio_assignment or "Practise the steps above."),
                         "minutes": max(5, min(_int(pr.get("minutes"), 30), 240)), "success_criteria": criteria[:5]},
            "next_hint": str(script.get("next_hint") or "")}


_locks: dict[int, threading.Lock] = {}
_locks_guard = threading.Lock()
log_ = logging.getLogger("artofsoul.lessons")


def _skill_context(db: Session, lesson: m.Lesson) -> list[dict]:
    """The curriculum's own description and 'solid' rubric level for each skill — grounding for the lesson."""
    out = []
    for sk in db.scalars(select(m.Skill).where(m.Skill.slug.in_(lesson.skill_slugs))):
        rub = db.scalar(select(m.AssessmentRubric).where(m.AssessmentRubric.skill_id == sk.id))
        out.append({"name": sk.name, "what_it_is": sk.description, "what_good_looks_like": rub.solid if rub else ""})
    return out


def _lock(lesson_id: int) -> threading.Lock:
    with _locks_guard:
        return _locks.setdefault(lesson_id, threading.Lock())


def get_script(db: Session, user: m.User, lesson: m.Lesson, regenerate: bool = False,
               mark_current: bool = True) -> m.LessonContent:
    # One writer per lesson: if the background prefetch is already writing it, wait for that instead of starting again.
    with _lock(lesson.id):
        db.expire_all()
        lesson = db.get(m.Lesson, lesson.id)
        cached = db.scalar(select(m.LessonContent).where(m.LessonContent.lesson_id == lesson.id))
        if cached and not regenerate:
            if mark_current:
                _make_current(db, lesson)
                db.commit()
            return cached
        return _write(db, user, lesson, cached, mark_current)


def _make_current(db: Session, lesson: m.Lesson) -> None:
    if lesson.status == "upcoming":
        for l in lesson.syllabus.lessons:
            if l.status == "current":
                l.status = "upcoming"
        lesson.status = "current"


def _write(db: Session, user: m.User, lesson: m.Lesson, cached, mark_current: bool) -> m.LessonContent:
    profile = get_profile(db, user)
    payload = {
        "LEARNER": {"name": user.display_name, "level": profile.level, "track": profile.track, "medium": profile.medium,
                    "goal": profile.goals, "daily_minutes": profile.daily_minutes,
                    "techniques_to_improve": profile.difficulties},
        "MEDIUM_FACTS": prompts.MEDIUM_FACTS.get(profile.medium or "graphite", []),
        "SKILLS": _skill_context(db, lesson),
        "LESSON": {"title": lesson.title, "stage": lesson.stage_title, "objectives": lesson.objectives,
                   "studio_assignment": lesson.studio_assignment,
                   "assessment_criteria": lesson.assessment_criteria, "est_minutes": lesson.est_minutes,
                   "focused_practice": lesson.kind == "remedial"},
    }
    router = get_router()
    raw = router.json("teacher", prompts.LESSON, [{"role": "user", "content": json.dumps(payload, ensure_ascii=False)}],
                      "lesson_script", prompts.LESSON_SCHEMA, user_id=user.id, max_tokens=3000)
    try:
        script = _clean(raw, lesson, db)
    except (ValueError, TypeError, AttributeError) as e:
        raise practice_error() from e
    if cached:
        cached.script, cached.model, cached.quiz_correct = script, router.label("teacher"), None
    else:
        cached = m.LessonContent(lesson_id=lesson.id, script=script, model=router.label("teacher"))
        db.add(cached)
    if mark_current:
        _make_current(db, lesson)
    log(db, user.id, "lesson", f"Teacher prepared lesson: {lesson.title}", "lesson", lesson.id)
    db.commit()
    return cached


def next_unwritten(db: Session, lesson: m.Lesson) -> m.Lesson | None:
    later = sorted((l for l in lesson.syllabus.lessons if l.position > lesson.position and l.status in ("upcoming", "current")),
                   key=lambda l: l.position)
    for l in later:
        if not db.scalar(select(m.LessonContent.id).where(m.LessonContent.lesson_id == l.id)):
            return l
        return None  # the very next lesson is already written
    return None


def prefetch_next(user_id: int, lesson_id: int) -> None:
    """Background job: write the following lesson while the learner studies this one."""
    _prefetch(user_id, lesson_id, following=True)


def prefetch_lesson(user_id: int, lesson_id: int) -> None:
    """Background job: write this lesson now (e.g. the first lesson right after the plan is made)."""
    _prefetch(user_id, lesson_id, following=False)


def _prefetch(user_id: int, lesson_id: int, following: bool) -> None:
    from ..config import get_settings
    from ..db import SessionLocal
    if not get_settings().prefetch_next_lesson:
        return

    def run():
        try:
            with SessionLocal() as db:
                lesson = db.get(m.Lesson, lesson_id)
                user = db.get(m.User, user_id)
                if not lesson or not user:
                    return
                nxt = next_unwritten(db, lesson) if following else lesson
                if nxt:
                    get_script(db, user, nxt, mark_current=False)
        except Exception as e:  # prefetch is best-effort; the learner can always generate on demand
            log_.info("Prefetch of the next lesson skipped: %s", e)

    threading.Thread(target=run, name=f"prefetch-{lesson_id}", daemon=True).start()


def practice_error():
    from ..ai.providers import AIProviderError
    return AIProviderError("The local model's lesson script was incomplete. Press “Try again” — or use a larger model.")


def check_answer(db: Session, user: m.User, lesson: m.Lesson, choice: int, question: int = 0) -> dict:
    content = db.scalar(select(m.LessonContent).where(m.LessonContent.lesson_id == lesson.id))
    quiz = (content.script.get("quiz") or ([content.script["check"]] if content.script.get("check") else [])) if content else []
    if not 0 <= question < len(quiz):
        raise ValueError("This lesson has no such question.")
    q = quiz[question]
    correct = choice == q["answer_index"]
    first = not db.scalar(select(m.QuizAnswer.id).where(m.QuizAnswer.lesson_id == lesson.id, m.QuizAnswer.question_index == question))
    if first:
        db.add(m.QuizAnswer(lesson_id=lesson.id, question_index=question, correct=correct))
        if question == 0 and content.quiz_correct is None:
            content.quiz_correct = correct
        log(db, user.id, "check", f"Quiz in “{lesson.title}”, question {question + 1}: {'correct' if correct else 'not yet'}",
            "lesson", lesson.id)
    db.commit()
    return {"correct": correct, "answer_index": q["answer_index"], "explanation": q["explanation"], "first_attempt": first}


ACTIVITY_LABEL = {"value_match": "Value-matching game", "color_mix": "Colour-mixing challenge",
                  "order_steps": "Put-the-steps-in-order", "flashcards": "Key-word flashcards", "sketch": "Sketch pad"}


def record_activity(db: Session, user: m.User, lesson: m.Lesson, kind: str, score: int | None, total: int | None) -> None:
    label = ACTIVITY_LABEL.get(kind, kind)
    result = f" — {score}/{total}" if score is not None and total else ""
    log(db, user.id, "activity", f"{label} in “{lesson.title}”{result}", "lesson", lesson.id)
    db.commit()


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
