"""Learner state: profile access, skill statuses, activity log, and the memory context handed to models."""
from sqlalchemy import select
from sqlalchemy.orm import Session

from .. import models as m


def get_profile(db: Session, user: m.User) -> m.LearnerProfile:
    p = db.scalar(select(m.LearnerProfile).where(m.LearnerProfile.user_id == user.id))
    if not p:
        p = m.LearnerProfile(user_id=user.id)
        db.add(p)
        db.commit()
    return p


def log(db: Session, user_id: int, kind: str, summary: str, ref_type: str | None = None, ref_id: int | None = None) -> None:
    db.add(m.ActivityRecord(user_id=user_id, kind=kind, summary=summary[:2000], ref_type=ref_type, ref_id=ref_id))


def skill_statuses(db: Session, user_id: int) -> dict[str, str]:
    rows = db.execute(select(m.Skill.slug, m.SkillState.status).join(m.SkillState, m.SkillState.skill_id == m.Skill.id)
                      .where(m.SkillState.user_id == user_id)).all()
    return {slug: status for slug, status in rows}


def active_syllabus(db: Session, user_id: int) -> m.Syllabus | None:
    return db.scalar(select(m.Syllabus).where(m.Syllabus.user_id == user_id, m.Syllabus.status == "active")
                     .order_by(m.Syllabus.version.desc()))


def current_lesson(db: Session, user_id: int) -> m.Lesson | None:
    syl = active_syllabus(db, user_id)
    if not syl:
        return None
    for l in syl.lessons:
        if l.status == "current":
            return l
    return next((l for l in syl.lessons if l.status == "upcoming"), None)


def learner_context(db: Session, user: m.User, *, include_analyses: int = 3) -> dict:
    """Compact, factual memory used in prompts. Only recorded data — no invented history."""
    p = get_profile(db, user)
    statuses = skill_statuses(db, user.id)
    names = dict(db.execute(select(m.Skill.slug, m.Skill.name)).all())
    syl = active_syllabus(db, user.id)
    lesson = current_lesson(db, user.id)
    analyses = list(db.scalars(select(m.ArtworkAnalysis).where(m.ArtworkAnalysis.user_id == user.id,
                                                               m.ArtworkAnalysis.image_suitable.is_(True))
                               .order_by(m.ArtworkAnalysis.created_at.desc()).limit(include_analyses)))
    done = []
    if syl:
        done = [l.title for l in syl.lessons if l.status == "completed"][-6:]
    return {
        "name": user.display_name,
        "track": p.track, "medium": p.medium, "goals": p.goals, "experience": p.experience,
        "preferred_subjects": p.preferred_subjects, "self_reported_strengths": p.strengths,
        "self_reported_difficulties": p.difficulties, "weekly_hours": p.weekly_hours,
        "teaching_style": p.teaching_style, "teacher_memory_notes": p.memory_notes,
        "skills_needing_practice": [names[s] for s, st in statuses.items() if st == "needs_practice"],
        "skills_proficient": [names[s] for s, st in statuses.items() if st == "proficient"],
        "skills_in_progress": [names[s] for s, st in statuses.items() if st == "in_progress"],
        "active_syllabus": syl.title if syl else None,
        "current_lesson": ({"title": lesson.title, "objectives": lesson.objectives, "skills": lesson.skill_slugs,
                            "studio_assignment": lesson.studio_assignment} if lesson else None),
        "recently_completed_lessons": done,
        "recent_artwork_feedback": [{"date": a.created_at.date().isoformat(),
                                     "strengths": a.strengths[:3], "improvements": [i.get("issue") for i in a.improvements[:3]],
                                     "next_milestone": a.next_milestone} for a in analyses],
    }
