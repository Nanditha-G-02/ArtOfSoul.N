"""Auth, profile/onboarding, diagnostic, skill profile, history, privacy."""
import shutil

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from .. import models as m
from ..config import get_settings
from ..curriculum.graph import SkillGraph
from ..db import get_db
from ..schemas import DiagnosticIn, LoginIn, ProfileIn, RegisterIn, SkillOverrideIn
from ..security import auth_rate_limit, create_token, current_user, hash_password, verify_password
from ..services import roadmap, skills
from ..services.learner import get_profile, log
from . import serialize as ser

router = APIRouter(prefix="/api")


@router.post("/auth/register", dependencies=[Depends(auth_rate_limit)])
def register(body: RegisterIn, db: Session = Depends(get_db)):
    email = body.email.lower()
    if db.scalar(select(m.User).where(m.User.email == email)):
        raise HTTPException(409, "An account with this email already exists")
    u = m.User(email=email, password_hash=hash_password(body.password), display_name=body.display_name.strip())
    db.add(u)
    db.flush()
    db.add(m.LearnerProfile(user_id=u.id))
    log(db, u.id, "account", "Joined ArtOfSoul.N")
    db.commit()
    return {"token": create_token(u.id), "user": ser.user(u)}


@router.post("/auth/login", dependencies=[Depends(auth_rate_limit)])
def login(body: LoginIn, db: Session = Depends(get_db)):
    u = db.scalar(select(m.User).where(m.User.email == body.email.lower()))
    if not u or not verify_password(body.password, u.password_hash):
        raise HTTPException(401, "Email or password is incorrect")
    return {"token": create_token(u.id), "user": ser.user(u)}


@router.get("/me")
def me(user: m.User = Depends(current_user), db: Session = Depends(get_db)):
    return {"user": ser.user(user), "profile": ser.profile(get_profile(db, user))}


@router.patch("/me/profile")
def update_profile(body: ProfileIn, user: m.User = Depends(current_user), db: Session = Depends(get_db)):
    p = get_profile(db, user)
    data = body.model_dump(exclude_unset=True)
    if data.get("track") == "pencil":
        data["medium"] = "graphite"
    elif data.get("track") == "painting" and data.get("medium") == "graphite":
        raise HTTPException(422, "Choose oil, acrylic or watercolour for the painting track")
    changed = [k for k, v in data.items() if getattr(p, k) != v]
    for k, v in data.items():
        setattr(p, k, v)
    if changed:
        log(db, user.id, "profile", "Updated profile: " + ", ".join(changed))
    db.commit()
    return ser.profile(p)


# ------------------------------------------------------------ diagnostic
DIAGNOSTIC = {
    "pencil": ["value-structure", "proportion-measurement", "light-shadow-analysis", "edge-control", "layered-graphite",
               "form-construction", "composition-hierarchy", "texture-materials", "facial-anatomy"],
    "painting": ["value-structure", "value-grouping-paint", "color-relationships", "color-temperature", "color-mixing",
                 "edge-control", "brushwork", "composition-hierarchy", "form-rendering-paint"],
}


@router.get("/diagnostic")
def diagnostic(user: m.User = Depends(current_user), db: Session = Depends(get_db)):
    p = get_profile(db, user)
    if not p.track:
        raise HTTPException(400, "Choose a track first")
    slugs = DIAGNOSTIC[p.track]
    sk = {s.slug: s for s in db.scalars(select(m.Skill).where(m.Skill.slug.in_(slugs)))}
    rub = {r.skill_id: r for r in db.scalars(select(m.AssessmentRubric))}
    return [{"slug": s, "name": sk[s].name, "description": sk[s].description, "criterion": rub[sk[s].id].criterion,
             "levels": {"needs_work": rub[sk[s].id].needs_work, "developing": rub[sk[s].id].developing,
                        "solid": rub[sk[s].id].solid}} for s in slugs]


@router.post("/diagnostic")
def submit_diagnostic(body: DiagnosticIn, user: m.User = Depends(current_user), db: Session = Depends(get_db)):
    p = get_profile(db, user)
    if body.skip:
        p.diagnostic_status = "skipped"
        log(db, user.id, "diagnostic", "Skipped the diagnostic")
        db.commit()
        return {"status": "skipped"}
    allowed = set(DIAGNOSTIC.get(p.track or "", []))
    n = 0
    for slug, rating in body.answers.items():
        if slug in allowed and rating != "unsure":
            skills.record_evidence(db, user.id, slug, rating, "diagnostic", "Self-placement against the rubric")
            n += 1
    p.diagnostic_status = "complete"
    roadmap.revise(db, user.id, "assessment")
    log(db, user.id, "diagnostic", f"Completed diagnostic self-placement ({n} skills)")
    db.commit()
    return {"status": "complete", "recorded": n}


# ------------------------------------------------------------ skills & progress
@router.get("/skills/profile")
def skill_profile(user: m.User = Depends(current_user), db: Session = Depends(get_db)):
    p = get_profile(db, user)
    graph = SkillGraph.load(db)
    states = {s.skill_id: s for s in db.scalars(select(m.SkillState).where(m.SkillState.user_id == user.id))}
    out = []
    for s in db.scalars(select(m.Skill).order_by(m.Skill.tier, m.Skill.name)):
        if p.track and not graph.applies(s.slug, p.track, p.medium):
            continue
        st = states.get(s.id)
        out.append({"slug": s.slug, "name": s.name, "domain": s.domain, "tier": s.tier, "track": s.track,
                    "prerequisites": graph.nodes[s.slug].prereqs,
                    "status": st.status if st else "not_assessed", "explanation": st.explanation if st else "No evidence recorded yet.",
                    "evidence_count": st.evidence_count if st else 0, "user_override": st.user_override if st else False})
    return out


@router.get("/skills/{slug}/evidence")
def skill_evidence(slug: str, user: m.User = Depends(current_user), db: Session = Depends(get_db)):
    sk = db.scalar(select(m.Skill).where(m.Skill.slug == slug))
    if not sk:
        raise HTTPException(404, "Unknown skill")
    rows = db.scalars(select(m.SkillEvidence).where(m.SkillEvidence.user_id == user.id, m.SkillEvidence.skill_id == sk.id)
                      .order_by(m.SkillEvidence.created_at.desc()))
    return [{"id": e.id, "rating": e.rating, "source": e.source, "note": e.note, "analysis_id": e.analysis_id,
             "created_at": e.created_at} for e in rows]


@router.put("/skills/{slug}")
def correct_skill(slug: str, body: SkillOverrideIn, user: m.User = Depends(current_user), db: Session = Depends(get_db)):
    try:
        skills.override(db, user.id, slug, body.status, body.note)
    except ValueError as e:
        raise HTTPException(404, str(e))
    log(db, user.id, "profile", f"Manually set {slug} to {body.status}")
    roadmap.revise(db, user.id, "manual")
    db.commit()
    return {"ok": True}


@router.get("/history")
def history(limit: int = 100, user: m.User = Depends(current_user), db: Session = Depends(get_db)):
    rows = db.scalars(select(m.ActivityRecord).where(m.ActivityRecord.user_id == user.id)
                      .order_by(m.ActivityRecord.created_at.desc()).limit(min(limit, 500)))
    return [{"id": r.id, "kind": r.kind, "summary": r.summary, "ref_type": r.ref_type, "ref_id": r.ref_id,
             "created_at": r.created_at} for r in rows]


@router.get("/dashboard")
def dashboard(user: m.User = Depends(current_user), db: Session = Depends(get_db)):
    from ..services.learner import active_syllabus, current_lesson
    syl = active_syllabus(db, user.id)
    lesson = current_lesson(db, user.id)
    counts = {st: 0 for st in m.SKILL_STATUSES}
    for st in db.scalars(select(m.SkillState.status).where(m.SkillState.user_id == user.id)):
        counts[st] += 1
    total = len(syl.lessons) if syl else 0
    done = len([l for l in syl.lessons if l.status in ("completed", "skipped")]) if syl else 0
    last_analysis = db.scalar(select(m.ArtworkAnalysis).where(m.ArtworkAnalysis.user_id == user.id)
                              .order_by(m.ArtworkAnalysis.created_at.desc()))
    open_ex = list(db.scalars(select(m.Exercise).where(m.Exercise.user_id == user.id, m.Exercise.status == "assigned")
                              .order_by(m.Exercise.created_at.desc()).limit(3)))
    return {"profile": ser.profile(get_profile(db, user)),
            "syllabus": {"id": syl.id, "title": syl.title, "total": total, "done": done} if syl else None,
            "current_lesson": ser.lesson(lesson) if lesson else None,
            "skill_counts": counts,
            "last_analysis": ({"id": last_analysis.id, "artwork_id": last_analysis.artwork_id,
                               "next_milestone": last_analysis.next_milestone, "created_at": last_analysis.created_at}
                              if last_analysis else None),
            "open_exercises": [ser.exercise(e) for e in open_ex]}


# ------------------------------------------------------------ privacy
@router.get("/me/export")
def export(user: m.User = Depends(current_user), db: Session = Depends(get_db)):
    def rows(model):
        return [{c.name: getattr(r, c.name) for c in model.__table__.columns}
                for r in db.scalars(select(model).where(model.user_id == user.id))]
    return {"user": ser.user(user), "profile": ser.profile(get_profile(db, user)),
            "skill_evidence": rows(m.SkillEvidence), "skill_states": rows(m.SkillState), "artworks": rows(m.Artwork),
            "analyses": rows(m.ArtworkAnalysis), "exercises": rows(m.Exercise), "syllabi": rows(m.Syllabus),
            "roadmap_versions": rows(m.RoadmapVersion), "activity": rows(m.ActivityRecord)}


@router.delete("/me")
def delete_account(user: m.User = Depends(current_user), db: Session = Depends(get_db)):
    root = get_settings().storage_dir
    for kind in ("artworks", "references"):
        shutil.rmtree(root / kind / str(user.id), ignore_errors=True)
    db.delete(user)
    db.commit()
    return {"deleted": True}
