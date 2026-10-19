"""Idempotent loader for the curriculum knowledge base."""
from sqlalchemy import select
from sqlalchemy.orm import Session

from .. import models as m
from .skills import MODULES, SKILLS
from .sources import COURSES, INSTITUTIONS, REVIEWED

CURRICULUM_VERSION = "2026.10"


def seed_curriculum(db: Session) -> None:
    if db.scalar(select(m.CurriculumVersion).where(m.CurriculumVersion.version == CURRICULUM_VERSION)):
        return
    cv = m.CurriculumVersion(version=CURRICULUM_VERSION,
                             notes=f"{len(COURSES)} institutional course records reviewed {REVIEWED.isoformat()}; "
                                   f"{len(SKILLS)} synthesized skills.")
    db.add(cv)
    db.flush()

    # skills
    by_slug: dict[str, m.Skill] = {s.slug: s for s in db.scalars(select(m.Skill))}
    for spec in SKILLS:
        sk = by_slug.get(spec["slug"]) or m.Skill(slug=spec["slug"])
        sk.name, sk.track, sk.domain = spec["name"], spec["track"], spec["domain"]
        sk.description, sk.tier, sk.media = spec["description"], spec["tier"], spec["media"]
        db.add(sk)
        by_slug[sk.slug] = sk
    db.flush()

    db.query(m.SkillPrerequisite).delete()
    db.query(m.AssessmentRubric).delete()
    db.query(m.ExerciseTemplate).delete()
    db.query(m.LearningObjective).delete()
    db.query(m.CurriculumModule).delete()
    db.query(m.CourseSkillLink).delete()
    db.flush()
    for spec in SKILLS:
        sk = by_slug[spec["slug"]]
        for p in spec["prereqs"]:
            db.add(m.SkillPrerequisite(skill_id=sk.id, prerequisite_id=by_slug[p].id))
        crit, nw, dev, solid = spec["rubric"]
        db.add(m.AssessmentRubric(skill_id=sk.id, criterion=crit, needs_work=nw, developing=dev, solid=solid))
        title, brief, minutes = spec["exercise"]
        db.add(m.ExerciseTemplate(skill_id=sk.id, title=title, brief=brief, est_minutes=minutes, media=spec["media"]))

    for order, (slug, track, title, desc, skill_slugs) in enumerate(MODULES):
        mod = m.CurriculumModule(slug=slug, track=track, title=title, description=desc, order=order)
        db.add(mod)
        db.flush()
        for s in skill_slugs:
            spec = next(x for x in SKILLS if x["slug"] == s)
            db.add(m.LearningObjective(module_id=mod.id, skill_id=by_slug[s].id, text=spec["objective"]))

    # institutions & courses
    insts = {i.name: i for i in db.scalars(select(m.Institution))}
    for spec in INSTITUTIONS:
        inst = insts.get(spec["name"]) or m.Institution(name=spec["name"])
        inst.country, inst.kind, inst.website = spec["country"], spec["kind"], spec["website"]
        db.add(inst)
        insts[inst.name] = inst
    db.flush()
    courses = {c.key: c for c in db.scalars(select(m.Course))}
    for spec in COURSES:
        c = courses.get(spec["key"]) or m.Course(key=spec["key"])
        c.institution_id = insts[spec["institution"]].id
        for f in ("course_code", "title", "track", "media", "level", "summary", "objectives", "source_url",
                  "source_type", "verification"):
            setattr(c, f, spec[f])
        c.access_info = "Publicly accessible official web page; reviewed without login."
        c.licensing = ("Institutional catalog text is the institution's copyright. ArtOfSoul.N stores only a short "
                       "paraphrase and a link; no course materials are reproduced.")
        c.last_reviewed = REVIEWED
        c.curriculum_version_id = cv.id
        db.add(c)
        db.flush()
        for s in spec["skills"]:
            db.add(m.CourseSkillLink(course_id=c.id, skill_id=by_slug[s].id, provenance="inferred",
                                     rationale=f"ArtOfSoul.N mapping of the published description of {c.title}."))
    db.commit()
