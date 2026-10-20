"""Personalised syllabus generation: retrieval → graph-constrained candidates → curriculum LLM → validation → persist."""
import json

from sqlalchemy import select
from sqlalchemy.orm import Session

from .. import models as m
from ..ai import prompts
from ..ai.router import get_router
from ..curriculum.graph import SkillGraph
from ..curriculum.retrieval import get_index
from . import roadmap
from .learner import active_syllabus, get_profile, log, skill_statuses


class SyllabusError(Exception):
    pass


def candidate_skills(db: Session, profile: m.LearnerProfile, goal: str, statuses: dict[str, str]) -> tuple[list[str], list[dict]]:
    """Deterministically select and order the skills a syllabus may use, plus the institutional sources retrieved."""
    graph = SkillGraph.load(db)
    idx = get_index(db)
    query = " ".join([goal, profile.medium or "", " ".join(profile.preferred_subjects or []),
                      " ".join(profile.difficulties or [])])
    skill_hits = idx.search(query, track=profile.track, kinds=("skill",), k=10)
    course_hits = idx.search(query + f" {profile.track} {profile.medium or ''} advanced", track=profile.track,
                             kinds=("course",), k=6)

    targets = [h.doc.meta["slug"] for h in skill_hits if graph.applies(h.doc.meta["slug"], profile.track, profile.medium)]
    # always aim toward a capstone in the track so the plan has a professional endpoint
    targets += [s for s in graph.track_skills(profile.track, profile.medium) if graph.nodes[s].tier == 3][:1]
    # self-reported difficulties pull in matching skills
    for d in profile.difficulties or []:
        targets += [h.doc.meta["slug"] for h in idx.search(d, track=profile.track, kinds=("skill",), k=1)]
    closure = {s for s in graph.closure(targets) if graph.medium_ok(s, profile.medium)}
    # tier-0 foundations: always for beginners; otherwise only when evidence shows a gap
    level = getattr(profile, "level", "intermediate")
    if level == "beginner":
        closure |= {s for s in graph.track_skills(profile.track, profile.medium) if graph.nodes[s].tier == 0}
    else:
        closure = {s for s in closure if graph.nodes[s].tier > 0 or statuses.get(s) == "needs_practice"}
    if level == "beginner":  # keep a beginner plan focused: drop capstone-tier skills not directly targeted
        closure = {s for s in closure if graph.nodes[s].tier < 3 or s in targets[:3]}
    ordered = graph.order(closure)
    sources = [h.as_dict() for h in course_hits]
    return ordered, sources


def _repair_order(lessons: list[dict], graph: SkillGraph) -> list[dict]:
    """Move any lesson that appears before a lesson teaching one of its prerequisites (bounded passes)."""
    for _ in range(len(lessons) * 2):
        moved = False
        first_teach: dict[str, int] = {}
        for i, l in enumerate(lessons):
            for s in l["skill_slugs"]:
                first_teach.setdefault(s, i)
        for i, l in enumerate(lessons):
            needed = [first_teach[p] for s in l["skill_slugs"] for p in graph.nodes[s].prereqs
                      if p in first_teach and p not in l["skill_slugs"]]
            if needed and max(needed) > i:
                j = max(needed)
                lessons.insert(j, lessons.pop(i))
                moved = True
                break
        if not moved:
            break
    return lessons


def generate(db: Session, user: m.User, goal: str) -> m.Syllabus:
    profile = get_profile(db, user)
    if not profile.track:
        raise SyllabusError("Choose a track (pencil or painting) in onboarding first.")
    if profile.track == "painting" and not profile.medium:
        raise SyllabusError("Choose a painting medium (oil, acrylic or watercolour) first — techniques differ by medium.")
    statuses = skill_statuses(db, user.id)
    graph = SkillGraph.load(db)
    ordered, sources = candidate_skills(db, profile, goal, statuses)
    if not ordered:
        raise SyllabusError("No curriculum skills matched this goal for your track. Try rephrasing the goal.")
    skills = {s.slug: s for s in db.scalars(select(m.Skill))}
    previous = active_syllabus(db, user.id)

    payload = {
        "LEARNER_PROFILE": {"goal": goal, "track": profile.track, "medium": profile.medium, "experience": profile.experience,
                            "preferred_subjects": profile.preferred_subjects, "self_reported_strengths": profile.strengths,
                            "self_reported_difficulties": profile.difficulties, "weekly_hours": profile.weekly_hours,
                            "level": profile.level, "daily_minutes": profile.daily_minutes,
                            "teaching_style": profile.teaching_style},
        "SKILL_STATUS": {s: st for s, st in statuses.items() if s in ordered},
        "CANDIDATE_SKILLS": [{"slug": s, "name": skills[s].name, "tier": skills[s].tier,
                              "prerequisites": [p for p in graph.nodes[s].prereqs if p in ordered]} for s in ordered],
        "RETRIEVED_SOURCES": [{"id": src["id"], "institution": src["institution"], "course": src["title"],
                               "verification": src["verification"], "summary": src["text"][:280]} for src in sources[:4]],
        "PREVIOUS_SYLLABUS": ({"goal": previous.goal, "lessons": [{"title": l.title, "status": l.status} for l in previous.lessons]}
                              if previous else None),
    }
    data = get_router().json("curriculum", prompts.CURRICULUM,
                             [{"role": "user", "content": json.dumps(payload, ensure_ascii=False)}],
                             "personalised_syllabus", prompts.SYLLABUS_SCHEMA, user_id=user.id, max_tokens=6000)

    allowed_sources = {s["id"] for s in sources}
    allowed_skills = set(ordered)
    flat: list[dict] = []
    for si, stage in enumerate(data.get("stages", [])):
        for l in stage.get("lessons", []):
            slugs = [s for s in l.get("skill_slugs", []) if s in allowed_skills]
            if not slugs:
                continue  # reject lessons that reference skills outside the graph-approved set
            flat.append({**l, "skill_slugs": slugs, "stage_index": si, "stage_title": stage.get("title", f"Stage {si + 1}"),
                         "source_ids": [i for i in l.get("source_ids", []) if i in allowed_sources]})
    if len(flat) < 3:
        raise SyllabusError("The curriculum model returned too few valid lessons; please try again.")
    flat = _repair_order(flat, graph)

    # persist
    version = 1
    carried: list[m.Lesson] = []
    if previous:
        previous.status = "archived"
        version = previous.version + 1
        carried = [l for l in previous.lessons if l.status == "completed"]
    syl = m.Syllabus(user_id=user.id, version=version, goal=goal, track=profile.track, medium=profile.medium,
                     title=data["title"][:200], overview=data.get("overview", ""),
                     expected_outcomes=data.get("expected_outcomes", []),
                     practice_plan=[str(x) for x in data.get("practice_plan", [])][:6],
                     source_course_ids=sorted({i for l in flat for i in l["source_ids"]}),
                     model=get_router().label("curriculum"))
    db.add(syl)
    db.flush()
    pos = 0
    for old in carried:  # preserve completed work
        syl.lessons.append(m.Lesson(position=pos, stage_index=-1, stage_title="Completed earlier", module_title=old.module_title,
                                    title=old.title, objectives=old.objectives, skill_slugs=old.skill_slugs,
                                    studio_assignment=old.studio_assignment, exercises=old.exercises,
                                    assessment_criteria=old.assessment_criteria, source_course_ids=old.source_course_ids,
                                    est_minutes=old.est_minutes, kind="carried", status="completed", completed_at=old.completed_at))
        pos += 1
    done_titles = {o.title.lower() for o in carried}
    for l in flat:
        if l["title"].lower() in done_titles:
            continue
        prereqs = sorted({p for s in l["skill_slugs"] for p in graph.nodes[s].prereqs} - set(l["skill_slugs"]))
        syl.lessons.append(m.Lesson(position=pos, stage_index=l["stage_index"], stage_title=l["stage_title"][:160],
                                    module_title=l.get("module_title", "")[:160], title=l["title"][:200],
                                    objectives=l.get("objectives", []), skill_slugs=l["skill_slugs"], prerequisite_slugs=prereqs,
                                    studio_assignment=l.get("studio_assignment", ""), exercises=l.get("exercises", []),
                                    assessment_criteria=l.get("assessment_criteria", []), source_course_ids=l["source_ids"],
                                    est_minutes=max(15, min(int(l.get("est_minutes") or 90), 900)),
                                    is_milestone=bool(l.get("is_milestone"))))
        pos += 1
    syl.milestones = [{"lesson_position": x.position, "title": x.title} for x in syl.lessons if x.is_milestone]

    # deterministic change summary
    if previous:
        old_t = {l.title for l in previous.lessons}
        new_t = {l.title for l in syl.lessons}
        parts = [f"Goal: “{goal}”."]
        if previous.medium != syl.medium:
            parts.append(f"Medium changed from {previous.medium or '—'} to {syl.medium or '—'}.")
        parts.append(f"{len(carried)} completed lesson(s) preserved; {len(new_t - old_t)} new; {len(old_t - new_t)} removed.")
        if data.get("change_note"):
            parts.append(data["change_note"])
        syl.change_summary = " ".join(parts)
    db.flush()
    roadmap.revise(db, user.id, "syllabus_revised" if previous else "syllabus_created", force_version=True,
                   extra_summary=syl.change_summary or f"Roadmap created for “{syl.title}”.")
    log(db, user.id, "syllabus", f"Generated syllabus v{version}: {syl.title}", "syllabus", syl.id)
    db.commit()
    db.refresh(syl)
    return syl
