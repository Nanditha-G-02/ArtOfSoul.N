"""The simple local learning journey: local session, questions, lesson teaching, voice, hardware, progress."""
import secrets

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import Response
from pydantic import BaseModel, Field
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from .. import models as m
from ..config import get_settings
from ..db import get_db
from ..schemas import Medium, Track
from ..security import ai_rate_limit, create_token, current_user, hash_password
from ..services import hardware, lessons, tts
from ..services.learner import active_syllabus, current_lesson, get_profile, log, skill_statuses
from . import serialize as ser

router = APIRouter(prefix="/api")
LOCAL_EMAIL = "learner@artofsoul.local"


# ------------------------------------------------------------ local single-user session
class LocalIn(BaseModel):
    name: str = Field(default="Artist", max_length=60)


@router.post("/local/session")
def local_session(body: LocalIn | None = None, db: Session = Depends(get_db)):
    if not get_settings().local_mode:
        raise HTTPException(404, "Local mode is off")
    u = db.scalar(select(m.User).where(m.User.email == LOCAL_EMAIL))
    if not u:
        u = m.User(email=LOCAL_EMAIL, password_hash=hash_password(secrets.token_urlsafe(24)),
                   display_name=(body.name.strip() if body and body.name.strip() else "Artist"))
        db.add(u)
        db.flush()
        db.add(m.LearnerProfile(user_id=u.id))
        log(db, u.id, "account", "Started ArtOfSoul.N")
        db.commit()
    return {"token": create_token(u.id), "user": ser.user(u), "profile": ser.profile(get_profile(db, u))}


# ------------------------------------------------------------ questions
QUESTIONS = [
    {"id": "track", "ask": "What would you like to learn?", "kind": "single",
     "options": [{"value": "pencil", "label": "Pencil drawing", "hint": "Graphite, value, form, realism"},
                 {"value": "painting", "label": "Painting", "hint": "Colour, light, brushwork"}]},
    {"id": "medium", "ask": "Which paint will you use?", "kind": "single", "when": {"track": "painting"},
     "options": [{"value": "watercolor", "label": "Watercolour", "hint": "Transparent layers"},
                 {"value": "acrylic", "label": "Acrylic", "hint": "Fast drying, versatile"},
                 {"value": "oil", "label": "Oil", "hint": "Slow drying, rich blending"}]},
    {"id": "level", "ask": "How would you describe your skill right now?", "kind": "single",
     "options": [{"value": "beginner", "label": "Just starting", "hint": "I'm learning the basics"},
                 {"value": "intermediate", "label": "Getting comfortable", "hint": "I can finish simple pieces"},
                 {"value": "advanced", "label": "Experienced", "hint": "I want to refine and push further"}]},
    {"id": "artwork_types", "ask": "What do you love to create?", "kind": "multi", "allow_custom": True,
     "options": [{"value": "portraits", "label": "Portraits"}, {"value": "still life", "label": "Still life"},
                 {"value": "landscapes", "label": "Landscapes"}, {"value": "flowers and nature", "label": "Flowers & nature"},
                 {"value": "animals", "label": "Animals"}, {"value": "architecture", "label": "Buildings"}]},
    {"id": "goal", "ask": "What's your main goal?", "kind": "text",
     "placeholder": "e.g. Draw realistic portraits of my family"},
    {"id": "daily_minutes", "ask": "How much time can you practise each day?", "kind": "single",
     "options": [{"value": 15, "label": "15 min"}, {"value": 30, "label": "30 min"},
                 {"value": 60, "label": "1 hour"}, {"value": 120, "label": "2 hours+"}]},
    {"id": "techniques", "ask": "Which techniques do you want to improve?", "kind": "multi", "allow_custom": True,
     "options_by_track": {
         "pencil": [{"value": "shading", "label": "Shading"}, {"value": "proportions", "label": "Proportions"},
                    {"value": "soft edges", "label": "Soft edges"}, {"value": "texture", "label": "Texture"},
                    {"value": "perspective", "label": "Perspective"}, {"value": "composition", "label": "Composition"}],
         "painting": [{"value": "colour mixing", "label": "Colour mixing"}, {"value": "light and shadow", "label": "Light & shadow"},
                      {"value": "blending", "label": "Blending"}, {"value": "brushwork", "label": "Brushwork"},
                      {"value": "colour harmony", "label": "Colour harmony"}, {"value": "composition", "label": "Composition"}]}},
]


@router.get("/journey/questions")
def questions():
    return QUESTIONS


class AnswersIn(BaseModel):
    name: str = Field(default="", max_length=60)
    track: Track
    medium: Medium | None = None
    level: str = Field(pattern="^(beginner|intermediate|advanced)$")
    artwork_types: list[str] = Field(default_factory=list, max_length=12)
    goal: str = Field(min_length=3, max_length=500)
    daily_minutes: int = Field(ge=5, le=480)
    techniques: list[str] = Field(default_factory=list, max_length=12)


@router.post("/journey/answers")
def save_answers(body: AnswersIn, user: m.User = Depends(current_user), db: Session = Depends(get_db)):
    if body.track == "painting" and body.medium not in ("oil", "acrylic", "watercolor"):
        raise HTTPException(422, "Choose a paint type")
    p = get_profile(db, user)
    p.track, p.medium = body.track, ("graphite" if body.track == "pencil" else body.medium)
    p.level, p.daily_minutes = body.level, body.daily_minutes
    p.weekly_hours = max(1, min(60, round(body.daily_minutes * 7 / 60)))
    p.preferred_subjects = [s.strip()[:80] for s in body.artwork_types if s.strip()]
    p.difficulties = [s.strip()[:80] for s in body.techniques if s.strip()]
    p.goals = body.goal.strip()
    p.experience = {"beginner": "Just starting", "intermediate": "Getting comfortable", "advanced": "Experienced"}[body.level]
    p.onboarding_complete = True
    p.diagnostic_status = "skipped"
    if body.name.strip():
        user.display_name = body.name.strip()
    log(db, user.id, "profile", f"Answered the teacher's questions: {body.track}, {body.level}")
    db.commit()
    return ser.profile(p)


# ------------------------------------------------------------ lessons
def _lesson(db: Session, user: m.User, lesson_id: int) -> m.Lesson:
    lesson = db.get(m.Lesson, lesson_id)
    if not lesson or lesson.syllabus.user_id != user.id:
        raise HTTPException(404, "Lesson not found")
    return lesson


@router.get("/lessons/{lesson_id}/script")
def get_script(lesson_id: int, user: m.User = Depends(current_user), db: Session = Depends(get_db)):
    lesson = _lesson(db, user, lesson_id)
    c = db.scalar(select(m.LessonContent).where(m.LessonContent.lesson_id == lesson.id))
    return {"lesson": ser.lesson(lesson), "script": c.script if c else None, "model": c.model if c else None,
            "visuals": _visuals(db, user, lesson)}


@router.post("/lessons/{lesson_id}/script")
def make_script(lesson_id: int, regenerate: bool = False, user: m.User = Depends(ai_rate_limit), db: Session = Depends(get_db)):
    lesson = _lesson(db, user, lesson_id)
    c = lessons.get_script(db, user, lesson, regenerate)
    lessons.prefetch_next(user.id, lesson.id)
    return {"lesson": ser.lesson(lesson), "script": c.script, "model": c.model, "visuals": _visuals(db, user, lesson)}


def _visuals(db: Session, user: m.User, lesson: m.Lesson) -> dict:
    refs = db.scalars(select(m.GeneratedReference).where(m.GeneratedReference.lesson_id == lesson.id))
    return {str(r.step_index): ser.reference(r) for r in refs}


class CheckIn(BaseModel):
    choice: int = Field(ge=0, le=5)
    question: int = Field(default=0, ge=0, le=5)


class ActivityIn(BaseModel):
    kind: str = Field(pattern="^(value_match|color_mix|order_steps|flashcards|sketch)$")
    score: int | None = Field(default=None, ge=0, le=100)
    total: int | None = Field(default=None, ge=1, le=100)


@router.post("/lessons/{lesson_id}/activity")
def activity(lesson_id: int, body: ActivityIn, user: m.User = Depends(current_user), db: Session = Depends(get_db)):
    lessons.record_activity(db, user, _lesson(db, user, lesson_id), body.kind, body.score, body.total)
    return {"ok": True}


@router.post("/lessons/{lesson_id}/check")
def check(lesson_id: int, body: CheckIn, user: m.User = Depends(current_user), db: Session = Depends(get_db)):
    try:
        return lessons.check_answer(db, user, _lesson(db, user, lesson_id), body.choice, body.question)
    except ValueError as e:
        raise HTTPException(422, str(e))


@router.post("/lessons/{lesson_id}/steps/{index}/visual")
def visual(lesson_id: int, index: int, user: m.User = Depends(ai_rate_limit), db: Session = Depends(get_db)):
    try:
        return ser.reference(lessons.step_visual(db, user, _lesson(db, user, lesson_id), index))
    except ValueError as e:
        raise HTTPException(422, str(e))


# ------------------------------------------------------------ voice
class SpeakIn(BaseModel):
    text: str = Field(min_length=1, max_length=1500)


@router.get("/tts/status")
def speak_status():
    return tts.status()


@router.post("/tts")
def speak(body: SpeakIn, user: m.User = Depends(current_user)):
    audio = tts.synthesize(body.text)
    if audio is None:
        raise HTTPException(503, "Local Piper voice isn't installed; using the browser's built-in voice instead.")
    return Response(content=audio, media_type="audio/wav", headers={"Cache-Control": "private, max-age=86400"})


# ------------------------------------------------------------ system & progress
@router.get("/system/hardware")
def hw():
    return hardware.report()


@router.get("/system/models")
def models_info():
    from ..ai import profiles
    from ..ai.router import get_router
    router = get_router()
    installed: list[str] = []
    try:
        installed = router.provider("ollama").available_models() or []  # type: ignore[attr-defined]
    except Exception:
        pass
    names = set(installed) | {n.removesuffix(":latest") for n in installed}
    hw_ = hardware.report()
    return {"profiles": [{"id": k, **v, "installed": {v["text"]: v["text"] in names, v["vision"]: v["vision"] in names}}
                         for k, v in profiles.PROFILES.items()],
            "current": profiles.load().get("profile"), "recommended": hw_["recommended_profile"],
            "roles": {r: router.label(r) for r in ("teacher", "vision", "assessment")}, "ollama_running": bool(installed)}


class ProfileIn(BaseModel):
    profile: str


@router.post("/system/models/profile")
def set_profile(body: ProfileIn, user: m.User = Depends(current_user), db: Session = Depends(get_db)):
    from ..ai import profiles
    try:
        data = profiles.save(body.profile)
    except ValueError as e:
        raise HTTPException(422, str(e))
    log(db, user.id, "settings", f"Switched AI quality to {profiles.PROFILES[body.profile]['label']}")
    db.commit()
    return data


class PullIn(BaseModel):
    model: str


@router.post("/system/models/pull")
def pull_model(body: PullIn, user: m.User = Depends(current_user)):
    import json as _json

    from fastapi.responses import StreamingResponse

    from ..ai import profiles
    from ..ai.router import get_router
    if body.model not in profiles.ALLOWED_MODELS:
        raise HTTPException(422, "Only the models listed in the app can be downloaded from here.")
    provider = get_router().provider("ollama")
    return StreamingResponse((_json.dumps(ev) + "\n" for ev in provider.pull(body.model)),  # type: ignore[attr-defined]
                             media_type="application/x-ndjson")


@router.get("/progress")
def progress(user: m.User = Depends(current_user), db: Session = Depends(get_db)):
    syl = active_syllabus(db, user.id)
    lesson = current_lesson(db, user.id)
    statuses = skill_statuses(db, user.id)
    names = dict(db.execute(select(m.Skill.slug, m.Skill.name)).all())
    lessons_ = sorted(syl.lessons, key=lambda x: x.position) if syl else []
    done = [l for l in lessons_ if l.status == "completed"]
    checks = db.execute(select(m.QuizAnswer.correct).join(m.Lesson).where(
        m.Lesson.syllabus_id == (syl.id if syl else -1))).scalars().all()
    days = {d.date() for d in db.scalars(select(m.ActivityRecord.created_at).where(
        m.ActivityRecord.user_id == user.id, m.ActivityRecord.kind.in_(["lesson", "check", "activity", "analysis", "teacher"])))}
    from datetime import date, timedelta
    streak, day = 0, date.today()
    if day not in days:
        day -= timedelta(days=1)  # today not practised yet: the streak can still continue
    while day in days:
        streak, day = streak + 1, day - timedelta(days=1)
    activities = db.scalar(select(func.count(m.ActivityRecord.id)).where(m.ActivityRecord.user_id == user.id,
                                                                         m.ActivityRecord.kind == "activity")) or 0
    analyses = db.scalars(select(m.ArtworkAnalysis).where(m.ArtworkAnalysis.user_id == user.id)
                          .order_by(m.ArtworkAnalysis.created_at.desc()).limit(6))
    return {
        "profile": ser.profile(get_profile(db, user)),
        "syllabus": {"title": syl.title, "total": len(lessons_), "completed": len(done)} if syl else None,
        "current_lesson": ser.lesson(lesson) if lesson else None,
        "completed_lessons": [{"id": l.id, "title": l.title, "completed_at": l.completed_at} for l in done],
        "checks": {"answered": len(checks), "correct": sum(1 for c in checks if c)},
        "streak_days": streak, "activities": activities,
        "skills": [{"slug": s, "name": names.get(s, s), "status": st} for s, st in statuses.items()],
        "recent_feedback": [{"id": a.id, "artwork": ser.artwork(db.get(m.Artwork, a.artwork_id)),
                             "suitable": a.image_suitable, "next": a.next_milestone, "created_at": a.created_at} for a in analyses],
    }
