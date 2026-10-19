"""Evidence-based skill tracking. Status changes come only from recorded evidence (deterministic rules)."""
from sqlalchemy import select
from sqlalchemy.orm import Session

from .. import models as m

WINDOW = 3


def _skill(db: Session, slug: str) -> m.Skill:
    sk = db.scalar(select(m.Skill).where(m.Skill.slug == slug))
    if not sk:
        raise ValueError(f"Unknown skill {slug}")
    return sk


def record_evidence(db: Session, user_id: int, slug: str, rating: str, source: str, note: str = "",
                    analysis_id: int | None = None) -> m.SkillEvidence:
    if rating not in m.EVIDENCE_RATINGS:
        raise ValueError("bad rating")
    sk = _skill(db, slug)
    ev = m.SkillEvidence(user_id=user_id, skill_id=sk.id, rating=rating, source=source, note=note[:1000], analysis_id=analysis_id)
    db.add(ev)
    db.flush()
    recompute(db, user_id, sk)
    return ev


def decide(evidence: list[m.SkillEvidence]) -> tuple[str, str]:
    """evidence newest-first. Returns (status, explanation)."""
    if not evidence:
        return "not_assessed", "No evidence recorded yet."
    recent = evidence[:WINDOW]
    ratings = [e.rating for e in recent]
    observed = [e for e in recent if e.source == "artwork_analysis"]
    solid_observed = [e for e in observed if e.rating == "solid"]
    n_solid, n_weak = ratings.count("solid"), ratings.count("needs_work")
    if n_weak >= 2 and ratings[0] == "solid":
        return "in_progress", "Latest assessment shows clear improvement after earlier gaps; confirming with more work."
    if n_weak >= 2:
        return "needs_practice", f"{n_weak} of the last {len(recent)} assessments rated this 'needs work'."
    if n_solid >= 2 and ratings[0] != "needs_work" and solid_observed:
        return "proficient", (f"{n_solid} of the last {len(recent)} assessments rated this 'solid', "
                              f"including {len(solid_observed)} from artwork analysis.")
    if ratings[0] == "needs_work":
        return "in_progress", "Latest assessment flagged a gap; one more weak result would mark this for focused practice."
    if not observed:
        return "in_progress", "Only self-reported or diagnostic evidence so far; artwork evidence is needed to confirm."
    return "in_progress", f"Mixed evidence across the last {len(recent)} assessments."


def recompute(db: Session, user_id: int, skill: m.Skill) -> m.SkillState:
    evidence = list(db.scalars(select(m.SkillEvidence).where(m.SkillEvidence.user_id == user_id,
                                                             m.SkillEvidence.skill_id == skill.id)
                               .order_by(m.SkillEvidence.created_at.desc(), m.SkillEvidence.id.desc())))
    state = db.scalar(select(m.SkillState).where(m.SkillState.user_id == user_id, m.SkillState.skill_id == skill.id))
    if not state:
        state = m.SkillState(user_id=user_id, skill_id=skill.id)
        db.add(state)
    status, why = decide(evidence)
    state.status, state.explanation, state.evidence_count = status, why, len(evidence)
    state.user_override = False  # new evidence supersedes a manual correction
    db.flush()
    return state


def override(db: Session, user_id: int, slug: str, status: str, note: str) -> m.SkillState:
    """Learner correction of their stored profile. Kept distinct from evidence and clearly labelled."""
    if status not in m.SKILL_STATUSES:
        raise ValueError("bad status")
    sk = _skill(db, slug)
    state = db.scalar(select(m.SkillState).where(m.SkillState.user_id == user_id, m.SkillState.skill_id == sk.id))
    if not state:
        state = m.SkillState(user_id=user_id, skill_id=sk.id)
        db.add(state)
    state.status, state.user_override = status, True
    state.explanation = f"Set manually by the learner. {note}".strip()
    db.flush()
    return state
