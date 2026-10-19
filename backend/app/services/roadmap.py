"""Controlled roadmap revision.

The roadmap changes only through these deterministic, evidence-backed rules:
  R1 remedial insert  – an upcoming lesson depends on a skill whose status is needs_practice
                        → insert a remedial lesson for that skill before it (once).
  R2 proficiency skip – every skill of an upcoming core, non-milestone lesson is proficient (artwork-confirmed)
                        → mark it skipped (the learner can restore it).
  R3 remedial retire  – a pending remedial lesson whose skill is now proficient → skip it.
Each change records its reason and the evidence ids behind it, and produces a new RoadmapVersion.
"""
from sqlalchemy import select
from sqlalchemy.orm import Session

from .. import models as m
from ..curriculum.graph import SkillGraph
from .learner import active_syllabus, skill_statuses


def snapshot(syl: m.Syllabus) -> list[dict]:
    return [{"id": l.id, "position": l.position, "stage": l.stage_title, "title": l.title, "status": l.status,
             "kind": l.kind, "skills": l.skill_slugs, "milestone": l.is_milestone}
            for l in sorted(syl.lessons, key=lambda x: x.position)]


def _evidence_ids(db: Session, user_id: int, slug: str, rating: str) -> list[int]:
    sk = db.scalar(select(m.Skill).where(m.Skill.slug == slug))
    return list(db.scalars(select(m.SkillEvidence.id).where(m.SkillEvidence.user_id == user_id,
                                                            m.SkillEvidence.skill_id == sk.id,
                                                            m.SkillEvidence.rating == rating)
                           .order_by(m.SkillEvidence.id.desc()).limit(3)))


def _remedial_lesson(db: Session, syl: m.Syllabus, slug: str, before: m.Lesson) -> m.Lesson:
    sk = db.scalar(select(m.Skill).where(m.Skill.slug == slug))
    tmpl = db.scalar(select(m.ExerciseTemplate).where(m.ExerciseTemplate.skill_id == sk.id))
    rub = db.scalar(select(m.AssessmentRubric).where(m.AssessmentRubric.skill_id == sk.id))
    obj = db.scalar(select(m.LearningObjective.text).where(m.LearningObjective.skill_id == sk.id))
    return m.Lesson(syllabus_id=syl.id, position=before.position, stage_index=before.stage_index,
                    stage_title=before.stage_title, module_title="Focused practice",
                    title=f"Focused practice: {sk.name}", objectives=[obj] if obj else [],
                    skill_slugs=[slug], prerequisite_slugs=[], kind="remedial", status="upcoming",
                    studio_assignment=tmpl.brief if tmpl else "",
                    exercises=[{"title": tmpl.title, "brief": tmpl.brief}] if tmpl else [],
                    assessment_criteria=[f"{rub.criterion}: aim for — {rub.solid}"] if rub else [],
                    est_minutes=tmpl.est_minutes if tmpl else 60)


def _renumber(syl: m.Syllabus) -> None:
    for i, l in enumerate(sorted(syl.lessons, key=lambda x: x.position)):
        l.position = i


def _set_current(syl: m.Syllabus) -> None:
    found = False
    for l in sorted(syl.lessons, key=lambda x: x.position):
        if l.status in ("completed", "skipped"):
            continue
        l.status = "upcoming" if found else "current"
        found = True


def revise(db: Session, user_id: int, trigger: str, *, extra_summary: str = "", force_version: bool = False) -> m.RoadmapVersion | None:
    syl = active_syllabus(db, user_id)
    if not syl:
        return None
    graph = SkillGraph.load(db)
    statuses = skill_statuses(db, user_id)
    changes: list[dict] = []
    lessons = sorted(syl.lessons, key=lambda x: x.position)

    pending_remedial = {l.skill_slugs[0] for l in lessons if l.kind == "remedial" and l.status in ("upcoming", "current")}

    for l in lessons:
        if l.status not in ("upcoming", "current"):
            continue
        # R3
        if l.kind == "remedial" and statuses.get(l.skill_slugs[0]) == "proficient":
            l.status = "skipped"
            changes.append({"type": "remedial_retired", "lesson": l.title,
                            "reason": "Recent artwork evidence shows this skill is now proficient.",
                            "evidence_ids": _evidence_ids(db, user_id, l.skill_slugs[0], "solid")})
            pending_remedial.discard(l.skill_slugs[0])
            continue
        if l.kind == "remedial":
            continue
        # R1
        deps: list[str] = []
        for s in l.skill_slugs + l.prerequisite_slugs:
            if s in graph.nodes:
                deps += [s] + graph.nodes[s].prereqs
        for dep in dict.fromkeys(deps):
            if statuses.get(dep) == "needs_practice" and dep not in pending_remedial:
                rem = _remedial_lesson(db, syl, dep, l)
                for other in syl.lessons:
                    if other.position >= rem.position:
                        other.position += 1
                syl.lessons.append(rem)
                pending_remedial.add(dep)
                changes.append({"type": "remedial_inserted", "lesson": rem.title, "before": l.title,
                                "reason": f"'{l.title}' depends on {graph.nodes[dep].name}, which recent assessments "
                                          f"flagged for more practice.",
                                "evidence_ids": _evidence_ids(db, user_id, dep, "needs_work")})
        # R2
        if (not l.is_milestone and l.skill_slugs and l.status == "upcoming"
                and all(statuses.get(s) == "proficient" for s in l.skill_slugs)):
            l.status = "skipped"
            changes.append({"type": "lesson_skipped", "lesson": l.title,
                            "reason": "Every skill in this lesson is already demonstrated in assessed artwork. "
                                      "You can restore it at any time.",
                            "evidence_ids": sum((_evidence_ids(db, user_id, s, "solid") for s in l.skill_slugs), [])})
    db.flush()
    _renumber(syl)
    _set_current(syl)
    db.flush()

    if not changes and not force_version:
        return None
    last = db.scalar(select(m.RoadmapVersion.version).where(m.RoadmapVersion.user_id == user_id)
                     .order_by(m.RoadmapVersion.version.desc()))
    summary = extra_summary or (f"{len(changes)} evidence-based change(s)." if changes else "Roadmap created.")
    rv = m.RoadmapVersion(user_id=user_id, syllabus_id=syl.id, version=(last or 0) + 1, trigger=trigger,
                          summary=summary, changes=changes, snapshot=snapshot(syl))
    db.add(rv)
    db.flush()
    return rv
