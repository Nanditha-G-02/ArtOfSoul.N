"""Curriculum knowledge, syllabus, roadmap, lessons, exercises."""
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from .. import models as m
from ..curriculum.graph import SkillGraph
from ..curriculum.retrieval import get_index
from ..db import get_db
from ..schemas import ExerciseIn, LessonStatusIn, SyllabusIn
from ..security import ai_rate_limit, current_user, owned
from ..services import practice, roadmap
from ..services import syllabus as syllabus_svc
from ..services.learner import active_syllabus, log
from . import serialize as ser

router = APIRouter(prefix="/api")


# ------------------------------------------------------------ curriculum knowledge (public)
@router.get("/curriculum/sources")
def sources(track: str | None = None, db: Session = Depends(get_db)):
    q = select(m.Course)
    rows = [c for c in db.scalars(q) if not track or c.track in (track, "both")]
    links = {}
    names = dict(db.execute(select(m.Skill.id, m.Skill.slug)).all())
    for l in db.scalars(select(m.CourseSkillLink)):
        links.setdefault(l.course_id, []).append({"skill": names[l.skill_id], "provenance": l.provenance})
    return [{**ser.course(c), "skill_links": links.get(c.id, [])} for c in rows]


@router.get("/curriculum/graph")
def graph(track: str, medium: str | None = None, db: Session = Depends(get_db)):
    g = SkillGraph.load(db)
    slugs = g.track_skills(track, medium)
    closure = g.closure(slugs)
    return {"nodes": [{"slug": s, "name": g.nodes[s].name, "tier": g.nodes[s].tier, "domain": g.nodes[s].domain,
                       "track": g.nodes[s].track} for s in g.order(closure)],
            "edges": [{"from": p, "to": s} for s in closure for p in g.nodes[s].prereqs]}


@router.get("/curriculum/modules")
def modules(track: str, db: Session = Depends(get_db)):
    mods = db.scalars(select(m.CurriculumModule).where(m.CurriculumModule.track == track).order_by(m.CurriculumModule.order))
    sk = {s.id: s for s in db.scalars(select(m.Skill))}
    out = []
    for mod in mods:
        objs = db.scalars(select(m.LearningObjective).where(m.LearningObjective.module_id == mod.id))
        out.append({"slug": mod.slug, "title": mod.title, "description": mod.description, "provenance": mod.provenance,
                    "objectives": [{"skill": sk[o.skill_id].slug, "skill_name": sk[o.skill_id].name, "tier": sk[o.skill_id].tier,
                                    "media": sk[o.skill_id].media, "text": o.text} for o in objs]})
    return out


@router.get("/curriculum/search")
def search(q: str, track: str | None = None, db: Session = Depends(get_db)):
    return [h.as_dict() for h in get_index(db).search(q[:300], track=track, k=10)]


# ------------------------------------------------------------ syllabus
@router.post("/syllabus")
def create_syllabus(body: SyllabusIn, user: m.User = Depends(ai_rate_limit), db: Session = Depends(get_db)):
    try:
        syl = syllabus_svc.generate(db, user, body.goal.strip())
    except syllabus_svc.SyllabusError as e:
        raise HTTPException(422, str(e))
    first = next((l for l in sorted(syl.lessons, key=lambda x: x.position) if l.status == "current"), None)
    if first:
        from ..services.lessons import prefetch_lesson
        prefetch_lesson(user.id, first.id)  # lesson 1 is usually ready by the time the learner opens it
    return _syl_out(db, syl)


def _syl_out(db: Session, syl: m.Syllabus) -> dict:
    ids = {i for l in syl.lessons for i in l.source_course_ids} | set(syl.source_course_ids)
    courses = [ser.course(c) for c in db.scalars(select(m.Course).where(m.Course.id.in_(ids)))]
    return {**ser.syllabus(syl), "sources": courses}


@router.get("/syllabus")
def get_syllabus(user: m.User = Depends(current_user), db: Session = Depends(get_db)):
    syl = active_syllabus(db, user.id)
    return _syl_out(db, syl) if syl else None


@router.get("/syllabus/versions")
def syllabus_versions(user: m.User = Depends(current_user), db: Session = Depends(get_db)):
    rows = db.scalars(select(m.Syllabus).where(m.Syllabus.user_id == user.id).order_by(m.Syllabus.version.desc()))
    return [{"id": s.id, "version": s.version, "title": s.title, "goal": s.goal, "status": s.status,
             "change_summary": s.change_summary, "created_at": s.created_at} for s in rows]


@router.patch("/lessons/{lesson_id}")
def set_lesson_status(lesson_id: int, body: LessonStatusIn, user: m.User = Depends(current_user), db: Session = Depends(get_db)):
    lesson = db.get(m.Lesson, lesson_id)
    if not lesson or lesson.syllabus.user_id != user.id:
        raise HTTPException(404, "Lesson not found")
    syl = lesson.syllabus
    if body.status == "current":
        for l in syl.lessons:
            if l.status == "current":
                l.status = "upcoming"
        lesson.status = "current"
        log(db, user.id, "lesson", f"Started lesson: {lesson.title}", "lesson", lesson.id)
    elif body.status == "completed":
        lesson.status, lesson.completed_at = "completed", datetime.now(timezone.utc)
        log(db, user.id, "lesson", f"Completed lesson: {lesson.title}", "lesson", lesson.id)
        nxt = next((l for l in sorted(syl.lessons, key=lambda x: x.position) if l.status == "upcoming"), None)
        if nxt and not any(l.status == "current" for l in syl.lessons):
            nxt.status = "current"
        if nxt:
            from ..services.lessons import prefetch_lesson
            db.commit()
            prefetch_lesson(user.id, nxt.id)
    else:  # restore a skipped lesson
        lesson.status = "upcoming"
        log(db, user.id, "lesson", f"Restored lesson: {lesson.title}", "lesson", lesson.id)
    db.commit()
    return ser.lesson(lesson)


# ------------------------------------------------------------ roadmap
@router.get("/roadmap")
def get_roadmap(user: m.User = Depends(current_user), db: Session = Depends(get_db)):
    syl = active_syllabus(db, user.id)
    if not syl:
        return None
    g = SkillGraph.load(db)
    from ..services.learner import skill_statuses
    statuses = skill_statuses(db, user.id)
    versions = db.scalars(select(m.RoadmapVersion).where(m.RoadmapVersion.user_id == user.id)
                          .order_by(m.RoadmapVersion.version.desc()).limit(20))
    lessons = sorted(syl.lessons, key=lambda x: x.position)
    slugs = {s for l in lessons for s in l.skill_slugs}
    stages: dict[tuple, list] = {}
    for l in lessons:
        stages.setdefault((l.stage_index, l.stage_title), []).append(ser.lesson(l))
    assessments = db.execute(select(m.ArtworkAnalysis.id, m.ArtworkAnalysis.created_at, m.ArtworkAnalysis.skill_ratings,
                                    m.ArtworkAnalysis.image_suitable)
                             .where(m.ArtworkAnalysis.user_id == user.id).order_by(m.ArtworkAnalysis.created_at.desc()).limit(10)).all()
    return {
        "syllabus": {"id": syl.id, "title": syl.title, "version": syl.version},
        "stages": [{"index": k[0], "title": k[1], "lessons": v} for k, v in sorted(stages.items())],
        "skills": [{"slug": s, "name": g.nodes[s].name, "status": statuses.get(s, "not_assessed"),
                    "prerequisites": [p for p in g.nodes[s].prereqs]} for s in g.order(g.closure(list(slugs)))],
        "versions": [{"version": v.version, "trigger": v.trigger, "summary": v.summary, "changes": v.changes,
                      "created_at": v.created_at} for v in versions],
        "assessments": [{"id": a.id, "created_at": a.created_at, "ratings": len(a.skill_ratings or []), "suitable": a.image_suitable}
                        for a in assessments],
        "remaining_minutes": sum(l.est_minutes for l in lessons if l.status in ("current", "upcoming")),
    }


@router.post("/roadmap/revise")
def revise_roadmap(user: m.User = Depends(current_user), db: Session = Depends(get_db)):
    rv = roadmap.revise(db, user.id, "manual")
    db.commit()
    return {"changed": bool(rv), "version": rv.version if rv else None,
            "summary": rv.summary if rv else "No evidence-based changes are needed right now."}


# ------------------------------------------------------------ exercises & projects
@router.post("/exercises")
def new_exercise(body: ExerciseIn, user: m.User = Depends(ai_rate_limit), db: Session = Depends(get_db)):
    try:
        ex = practice.generate_exercise(db, user, kind=body.kind, focus=body.focus_skill, goal=body.goal, harder=body.harder)
    except ValueError as e:
        raise HTTPException(422, str(e))
    return ser.exercise(ex)


@router.get("/exercises")
def list_exercises(user: m.User = Depends(current_user), db: Session = Depends(get_db)):
    return [ser.exercise(e) for e in db.scalars(select(m.Exercise).where(m.Exercise.user_id == user.id)
                                                 .order_by(m.Exercise.created_at.desc()))]


@router.post("/exercises/{ex_id}/complete")
def complete_exercise(ex_id: int, user: m.User = Depends(current_user), db: Session = Depends(get_db)):
    ex = owned(db.get(m.Exercise, ex_id), user, "Exercise")
    ex.status, ex.completed_at = "completed", datetime.now(timezone.utc)
    log(db, user.id, "exercise", f"Marked complete: {ex.title} (upload the result to the Analysis Studio for feedback)",
        "exercise", ex.id)
    db.commit()
    return ser.exercise(ex)
