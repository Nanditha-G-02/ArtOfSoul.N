"""AI teacher workflow with a personalised teaching coordinator.

Quick actions are routed deterministically (no extra model call). Free text goes to the coordinator
model, which picks one workflow; if that call fails we fall back to the plain teaching workflow and
record why in the message metadata.
"""
import json

from sqlalchemy import select
from sqlalchemy.orm import Session

from .. import models as m
from ..ai import prompts
from ..ai.providers import AIError
from ..ai.router import get_router
from ..curriculum.retrieval import get_index
from . import practice
from .learner import current_lesson, get_profile, learner_context, log, skill_statuses

ACTIONS = {
    "explain_differently": ("teach", "Explain the last technique we discussed in a different way — new analogy, different angle."),
    "visual_reference": ("reference", "Show me a visual reference for what I'm working on."),
    "harder_exercise": ("exercise_harder", "Give me a more challenging exercise."),
    "biggest_weakness": ("weakness", "What is my biggest weakness right now?"),
    "review_previous": ("review", "Review my previous artwork feedback with me."),
    "continue_plan": ("continue", "Let's continue my current learning plan."),
    "why_not_working": ("teach", "Explain why my technique might not be working and how to diagnose it."),
    "focused_session": ("exercise", "Create a focused practice session for me."),
}

HISTORY_TURNS = 14
MEMORY_EVERY = 8


def _retrieved(db: Session, text: str, track: str | None) -> list[dict]:
    hits = get_index(db).search(text, track=track, k=4)
    out = []
    for h in hits:
        d = h.as_dict()
        out.append({"id": d["id"], "kind": d["kind"], "title": d["title"], "provenance": d.get("provenance"),
                    "url": d.get("url"), "text": d["text"][:500]})
    return out


def _weakness_facts(db: Session, user: m.User) -> dict:
    statuses = skill_statuses(db, user.id)
    names = dict(db.execute(select(m.Skill.slug, m.Skill.name)).all())
    rows = db.execute(select(m.Skill.slug, m.SkillEvidence.rating, m.SkillEvidence.note, m.SkillEvidence.created_at)
                      .join(m.Skill, m.Skill.id == m.SkillEvidence.skill_id)
                      .where(m.SkillEvidence.user_id == user.id, m.SkillEvidence.rating == "needs_work")
                      .order_by(m.SkillEvidence.created_at.desc()).limit(12)).all()
    counts: dict[str, int] = {}
    for slug, *_ in rows:
        counts[slug] = counts.get(slug, 0) + 1
    ranked = sorted(counts, key=lambda s: (statuses.get(s) != "needs_practice", -counts[s]))
    return {"has_evidence": bool(rows),
            "ranked_gaps": [{"skill": names[s], "status": statuses.get(s), "times_flagged_recently": counts[s],
                             "notes": [n for sl, _, n, _ in rows if sl == s][:2]} for s in ranked[:3]]}


def _coordinate(db: Session, user: m.User, text: str) -> tuple[str, str | None, str]:
    slugs = [s for (s,) in db.execute(select(m.Skill.slug))]
    try:
        r = get_router().json("coordinator", prompts.COORDINATOR,
                              [{"role": "user", "content": json.dumps({"message": text, "skills": slugs})}],
                              "route", prompts.COORDINATOR_SCHEMA, user_id=user.id, max_tokens=200)
        wf = r.get("workflow", "teach")
        slug = r.get("skill_slug") if r.get("skill_slug") in slugs else None
        return wf, slug, "coordinator"
    except AIError as e:
        return "teach", None, f"coordinator unavailable ({e.message}); defaulted to teaching"


def respond(db: Session, user: m.User, convo: m.Conversation, text: str | None, action: str | None) -> list[m.Message]:
    if action and action not in ACTIONS:
        raise ValueError("Unknown action")
    if action:
        workflow, default_text = ACTIONS[action]
        text = (text or "").strip() or default_text
        focus, route_note = None, "quick action"
    else:
        text = (text or "").strip()
        if not text:
            raise ValueError("Message is empty")
        workflow, focus, route_note = _coordinate(db, user, text)

    user_msg = m.Message(conversation_id=convo.id, role="user", content=text[:8000], meta={"action": action})
    db.add(user_msg)
    db.flush()

    profile = get_profile(db, user)
    extra: dict = {}
    meta: dict = {"workflow": workflow, "route": route_note}

    if workflow in ("exercise", "exercise_harder", "project"):
        try:
            ex = practice.generate_exercise(db, user, kind="project" if workflow == "project" else "exercise",
                                            focus=focus, harder=workflow == "exercise_harder")
            extra["NEW_EXERCISE"] = {"title": ex.title, "objective": ex.objective, "why_chosen": ex.rationale,
                                     "est_minutes": ex.est_minutes}
            meta["exercise_id"] = ex.id
        except (AIError, ValueError) as e:
            extra["EXERCISE_UNAVAILABLE"] = getattr(e, "message", str(e))
    elif workflow == "reference":
        lesson = current_lesson(db, user.id)
        subject = (lesson.title if lesson else profile.goals) or "a still life of three objects of different materials"
        try:
            ref = practice.generate_reference(db, user, "tonal" if profile.track == "pencil" else "subject", subject)
            meta["reference_id"] = ref.id
            extra["GENERATED_REFERENCE"] = {"prompt": ref.prompt, "note": "An AI-generated reference image is attached below this reply. It is generated, not a verified demonstration."}
        except AIError as e:
            extra["REFERENCE_UNAVAILABLE"] = (f"{e.message} Describe instead how to set up or photograph an equivalent "
                                              "reference from life.")
    elif workflow == "weakness":
        extra["RECORDED_WEAKNESS_EVIDENCE"] = _weakness_facts(db, user)
    elif workflow == "review":
        last = db.scalar(select(m.ArtworkAnalysis).where(m.ArtworkAnalysis.user_id == user.id)
                         .order_by(m.ArtworkAnalysis.created_at.desc()))
        if last:
            art = db.get(m.Artwork, last.artwork_id)
            extra["PREVIOUS_ANALYSIS"] = {"artwork": art.title, "date": last.created_at.date().isoformat(),
                                          "suitable": last.image_suitable, "limitations": last.limitations,
                                          "observations": last.observations[:10], "strengths": last.strengths,
                                          "improvements": last.improvements, "next_milestone": last.next_milestone}
            meta["analysis_id"] = last.id
        else:
            extra["PREVIOUS_ANALYSIS"] = None
    elif workflow == "continue":
        lesson = current_lesson(db, user.id)
        extra["CURRENT_LESSON_FULL"] = ({"title": lesson.title, "objectives": lesson.objectives,
                                         "studio_assignment": lesson.studio_assignment, "exercises": lesson.exercises,
                                         "assessment_criteria": lesson.assessment_criteria} if lesson else None)

    history = list(db.scalars(select(m.Message).where(m.Message.conversation_id == convo.id, m.Message.id != user_msg.id)
                              .order_by(m.Message.id.desc()).limit(HISTORY_TURNS)))[::-1]
    sources = _retrieved(db, text, profile.track)
    context = {"LEARNER_CONTEXT": learner_context(db, user), "RETRIEVED_SOURCES": sources, "WORKFLOW": workflow, **extra}
    messages = [{"role": h.role, "content": h.content} for h in history]
    messages.append({"role": "user", "content": f"<context>\n{json.dumps(context, ensure_ascii=False, default=str)}\n</context>\n\n{text}"})
    # providers require alternating roles starting with user
    while messages and messages[0]["role"] != "user":
        messages.pop(0)

    reply = get_router().text("teacher", prompts.TEACHER, messages, user_id=user.id, max_tokens=1800)
    meta["sources"] = [{"id": s["id"], "kind": s["kind"], "title": s["title"], "url": s["url"], "provenance": s["provenance"]}
                       for s in sources if s["kind"] == "course"]
    meta["model"] = get_router().label("teacher")
    bot = m.Message(conversation_id=convo.id, role="assistant", content=reply, meta=meta)
    db.add(bot)
    if convo.title == "Studio session":
        convo.title = text[:80]
    log(db, user.id, "teacher", f"Studio conversation: {text[:120]}", "conversation", convo.id)
    db.commit()
    _maybe_update_memory(db, user, convo)
    return [user_msg, bot]


def _maybe_update_memory(db: Session, user: m.User, convo: m.Conversation) -> None:
    n = db.query(m.Message).filter(m.Message.conversation_id == convo.id, m.Message.role == "user").count()
    if n % MEMORY_EVERY:
        return
    recent = list(db.scalars(select(m.Message).where(m.Message.conversation_id == convo.id, m.Message.role == "user")
                             .order_by(m.Message.id.desc()).limit(MEMORY_EVERY)))
    excerpt = "\n".join(f"- {x.content[:400]}" for x in reversed(recent))
    try:
        notes = get_router().text("coordinator", prompts.MEMORY, [{"role": "user", "content": excerpt}],
                                  user_id=user.id, max_tokens=300).strip()
    except AIError:
        return
    if notes:
        p = get_profile(db, user)
        p.memory_notes = (p.memory_notes + "\n" + notes).strip()[-4000:]
        db.commit()
