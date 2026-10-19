"""Artwork analysis workflow: vision observation → rubric assessment → evidence → skill states → roadmap."""
import json

from sqlalchemy import select
from sqlalchemy.orm import Session

from .. import models as m
from ..ai import prompts
from ..ai.router import get_router
from ..curriculum.graph import SkillGraph
from . import media, roadmap, skills
from .learner import active_syllabus, log

DIMENSIONS = {
    "pencil": ["proportion", "construction", "tonal range", "value grouping", "light-source consistency", "edge control",
               "texture/material", "spatial depth", "perspective", "composition", "mark-making"],
    "painting": ["colour relationships", "colour temperature", "value structure", "composition", "contrast",
                 "edge relationships", "visible brushwork / handling", "texture", "form rendering", "atmosphere",
                 "medium-specific handling"],
}


def _candidate_skills(db: Session, user_id: int, art: m.Artwork) -> list[m.Skill]:
    graph = SkillGraph.load(db)
    slugs = [s for s in graph.track_skills(art.track, art.medium) if graph.nodes[s].tier <= 2]
    if art.lesson_id:
        lesson = db.get(m.Lesson, art.lesson_id)
        if lesson:
            slugs = list(dict.fromkeys(lesson.skill_slugs + slugs))
    syl = active_syllabus(db, user_id)
    if syl:
        upcoming = [s for l in syl.lessons if l.status in ("current", "upcoming") for s in l.skill_slugs]
        slugs = list(dict.fromkeys(slugs + upcoming))
    rows = {s.slug: s for s in db.scalars(select(m.Skill).where(m.Skill.slug.in_(slugs)))}
    return [rows[s] for s in slugs if s in rows][:28]


def analyze(db: Session, user: m.User, art: m.Artwork, region: dict | None = None) -> m.ArtworkAnalysis:
    router = get_router()
    lesson = db.get(m.Lesson, art.lesson_id) if art.lesson_id else None
    ctx_lines = [f"Track: {art.track}. Medium: {art.medium or 'graphite'}. Title: {art.title}."]
    if art.exercise_context:
        ctx_lines.append(f"Exercise/intent given by the learner: {art.exercise_context}")
    if lesson:
        ctx_lines.append(f"Lesson: {lesson.title}. Criteria: {'; '.join(lesson.assessment_criteria)}")
    ctx_lines.append("Dimensions to observe: " + ", ".join(DIMENSIONS[art.track]))

    parts: list[dict] = [{"type": "text", "text": "\n".join(ctx_lines) + "\n\nIMAGE 1 — the learner's artwork:"},
                         media.for_model("artworks", user.id, art.stored_name)]
    if region:
        parts += [{"type": "text", "text": "IMAGE 2 — focus region crop chosen by the learner:"},
                  media.for_model("artworks", user.id, art.stored_name, region)]
    if art.reference_artwork_id:
        ref = db.get(m.Artwork, art.reference_artwork_id)
        if ref and ref.user_id == user.id:
            parts += [{"type": "text", "text": "REFERENCE IMAGE — what the learner worked from:"},
                      media.for_model("artworks", user.id, ref.stored_name)]

    vision = router.json("vision", prompts.VISION, [{"role": "user", "content": parts}], "visual_observations",
                         prompts.VISION_SCHEMA, user_id=user.id, max_tokens=3000)
    observations = vision.get("observations", [])
    a = m.ArtworkAnalysis(artwork_id=art.id, user_id=user.id, region=region,
                          image_suitable=bool(vision.get("image_suitable")) and bool(observations),
                          limitations=vision.get("limitations", []), observations=observations,
                          reference_comparison=vision.get("reference_comparison", ""),
                          model_vision=router.label("vision"))
    db.add(a)
    db.flush()
    if not a.image_suitable:
        if not a.limitations:
            a.limitations = ["The model could not make reliable observations from this image."]
        log(db, user.id, "analysis", f"Analysis of “{art.title}”: image unsuitable for assessment", "analysis", a.id)
        db.commit()
        return a

    cands = _candidate_skills(db, user.id, art)
    rubrics = {r.skill_id: r for r in db.scalars(select(m.AssessmentRubric).where(
        m.AssessmentRubric.skill_id.in_([s.id for s in cands])))}
    prior = db.execute(select(m.Skill.slug, m.SkillEvidence.rating, m.SkillEvidence.created_at)
                       .join(m.Skill, m.Skill.id == m.SkillEvidence.skill_id)
                       .where(m.SkillEvidence.user_id == user.id)
                       .order_by(m.SkillEvidence.created_at.desc()).limit(30)).all()
    payload = {
        "EXERCISE_CONTEXT": "\n".join(ctx_lines),
        "OBSERVATIONS": [{"id": i, **o} for i, o in enumerate(observations)],
        "REFERENCE_COMPARISON": a.reference_comparison,
        "RUBRICS": [{"skill_slug": s.slug, "skill": s.name, "criterion": rubrics[s.id].criterion,
                     "needs_work": rubrics[s.id].needs_work, "developing": rubrics[s.id].developing, "solid": rubrics[s.id].solid}
                    for s in cands if s.id in rubrics],
        "PRIOR_RATINGS": [{"skill": slug, "rating": r, "date": t.date().isoformat()} for slug, r, t in prior],
    }
    result = router.json("assessment", prompts.ASSESSMENT, [{"role": "user", "content": json.dumps(payload, ensure_ascii=False)}],
                         "assessment", prompts.ASSESSMENT_SCHEMA, user_id=user.id, max_tokens=4000)

    valid = {s.slug for s in cands}
    n_obs = len(observations)
    low_conf = {i for i, o in enumerate(observations) if o.get("confidence") == "low"}

    def cited(ids):
        return [i for i in ids if isinstance(i, int) and 0 <= i < n_obs]

    ratings = []
    for r in result.get("skill_ratings", []):
        ids = cited(r.get("observation_ids", []))
        if r.get("skill_slug") not in valid or not ids:
            continue  # unsupported rating — discard
        rating = r["rating"]
        if rating != "developing" and set(ids) <= low_conf:
            rating = "developing"  # low-confidence evidence cannot support an extreme rating
        ratings.append({**r, "rating": rating, "observation_ids": ids})
    a.skill_ratings = ratings
    a.strengths = [s for s in result.get("strengths", []) if cited(s.get("observation_ids", []))]
    a.improvements = [i for i in result.get("improvements", []) if cited(i.get("observation_ids", []))]
    a.corrective_steps = result.get("corrective_steps", [])
    a.exercises = result.get("exercises", [])
    a.next_milestone = result.get("next_milestone", "")
    a.model_assessment = router.label("assessment")
    syl = active_syllabus(db, user.id)
    if syl:
        weak = {i["skill_slug"] for i in a.improvements}
        a.suggested_lessons = [{"lesson_id": l.id, "title": l.title} for l in syl.lessons
                               if l.status in ("current", "upcoming") and weak & set(l.skill_slugs)][:3]
    if result.get("progress_note"):
        a.reference_comparison = (a.reference_comparison + "\n\nProgress: " + result["progress_note"]).strip()

    for r in ratings:
        skills.record_evidence(db, user.id, r["skill_slug"], r["rating"], "artwork_analysis", r.get("note", ""), a.id)
    rv = roadmap.revise(db, user.id, "assessment")
    log(db, user.id, "analysis", f"Analysed “{art.title}”: {len(ratings)} skill rating(s)"
        + (f"; roadmap updated (v{rv.version})" if rv else ""), "analysis", a.id)
    db.commit()
    return a
