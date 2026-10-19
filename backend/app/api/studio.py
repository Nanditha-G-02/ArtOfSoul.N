"""Teacher conversations, artwork upload & analysis, references, palettes, media."""
from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile
from fastapi.responses import FileResponse
from sqlalchemy import select
from sqlalchemy.orm import Session

from .. import models as m
from ..ai.router import get_router
from ..db import get_db
from ..schemas import AnalyzeIn, MessageIn, PaletteIn, ReferenceIn
from ..security import ai_rate_limit, current_user, owned
from ..services import analysis as analysis_svc
from ..services import media, practice, teacher
from ..services.learner import get_profile, log
from . import serialize as ser

router = APIRouter(prefix="/api")


def _msg(db: Session, x: m.Message) -> dict:
    out = ser.message(x)
    rid = (x.meta or {}).get("reference_id")
    if rid:
        ref = db.get(m.GeneratedReference, rid)
        if ref:
            out["reference"] = ser.reference(ref)
    eid = (x.meta or {}).get("exercise_id")
    if eid:
        ex = db.get(m.Exercise, eid)
        if ex:
            out["exercise"] = ser.exercise(ex)
    return out


# ------------------------------------------------------------ teacher
@router.get("/conversations")
def conversations(user: m.User = Depends(current_user), db: Session = Depends(get_db)):
    rows = db.scalars(select(m.Conversation).where(m.Conversation.user_id == user.id).order_by(m.Conversation.created_at.desc()))
    return [{"id": c.id, "title": c.title, "lesson_id": c.lesson_id, "created_at": c.created_at} for c in rows]


@router.post("/conversations")
def new_conversation(lesson_id: int | None = None, user: m.User = Depends(current_user), db: Session = Depends(get_db)):
    if lesson_id:
        lesson = db.get(m.Lesson, lesson_id)
        if not lesson or lesson.syllabus.user_id != user.id:
            raise HTTPException(404, "Lesson not found")
    c = m.Conversation(user_id=user.id, lesson_id=lesson_id)
    db.add(c)
    db.commit()
    return {"id": c.id, "title": c.title, "lesson_id": c.lesson_id, "created_at": c.created_at}


@router.get("/conversations/{cid}")
def conversation(cid: int, user: m.User = Depends(current_user), db: Session = Depends(get_db)):
    c = owned(db.get(m.Conversation, cid), user, "Conversation")
    return {"id": c.id, "title": c.title, "lesson_id": c.lesson_id, "messages": [_msg(db, x) for x in c.messages]}


@router.delete("/conversations/{cid}")
def delete_conversation(cid: int, user: m.User = Depends(current_user), db: Session = Depends(get_db)):
    c = owned(db.get(m.Conversation, cid), user, "Conversation")
    db.delete(c)
    db.commit()
    return {"deleted": True}


@router.post("/conversations/{cid}/messages")
def send(cid: int, body: MessageIn, user: m.User = Depends(ai_rate_limit), db: Session = Depends(get_db)):
    c = owned(db.get(m.Conversation, cid), user, "Conversation")
    if not get_profile(db, user).track:
        raise HTTPException(400, "Complete onboarding (choose a track) before starting a studio session")
    try:
        msgs = teacher.respond(db, user, c, body.text, body.action)
    except ValueError as e:
        db.rollback()
        raise HTTPException(422, str(e))
    return [_msg(db, x) for x in msgs]


@router.get("/teacher/actions")
def actions():
    return [{"id": k, "label": v[1]} for k, v in teacher.ACTIONS.items()]


# ------------------------------------------------------------ artworks
@router.post("/artworks")
async def upload(file: UploadFile = File(...), title: str = Form("Untitled study", max_length=200),
                 exercise_context: str = Form("", max_length=3000), lesson_id: int | None = Form(None),
                 kind: str = Form("learner"), reference_artwork_id: int | None = Form(None),
                 user: m.User = Depends(current_user), db: Session = Depends(get_db)):
    if kind not in ("learner", "reference"):
        raise HTTPException(422, "Invalid kind")
    p = get_profile(db, user)
    if not p.track:
        raise HTTPException(400, "Complete onboarding (choose a track) first")
    max_bytes = media.get_settings().max_upload_mb * 1024 * 1024
    raw = await file.read(max_bytes + 1)
    try:
        info = media.validate_and_store(raw, "artworks", user.id)
    except media.UploadError as e:
        raise HTTPException(422, str(e))
    if lesson_id:
        lesson = db.get(m.Lesson, lesson_id)
        if not lesson or lesson.syllabus.user_id != user.id:
            raise HTTPException(404, "Lesson not found")
    if reference_artwork_id:
        owned(db.get(m.Artwork, reference_artwork_id), user, "Reference")
    a = m.Artwork(user_id=user.id, kind=kind, title=title.strip() or "Untitled study", track=p.track, medium=p.medium,
                  exercise_context=exercise_context.strip(), lesson_id=lesson_id, reference_artwork_id=reference_artwork_id, **info)
    db.add(a)
    db.flush()
    log(db, user.id, "artwork", f"Uploaded {'reference' if kind == 'reference' else 'artwork'}: {a.title}", "artwork", a.id)
    db.commit()
    return ser.artwork(a)


@router.get("/artworks")
def artworks(kind: str = "learner", user: m.User = Depends(current_user), db: Session = Depends(get_db)):
    rows = db.scalars(select(m.Artwork).where(m.Artwork.user_id == user.id, m.Artwork.kind == kind)
                      .order_by(m.Artwork.created_at.desc()))
    out = []
    for a in rows:
        n = db.query(m.ArtworkAnalysis).filter(m.ArtworkAnalysis.artwork_id == a.id).count()
        out.append({**ser.artwork(a), "analysis_count": n})
    return out


@router.get("/artworks/{aid}")
def artwork(aid: int, user: m.User = Depends(current_user), db: Session = Depends(get_db)):
    a = owned(db.get(m.Artwork, aid), user, "Artwork")
    analyses = db.scalars(select(m.ArtworkAnalysis).where(m.ArtworkAnalysis.artwork_id == a.id)
                          .order_by(m.ArtworkAnalysis.created_at.desc()))
    ref = db.get(m.Artwork, a.reference_artwork_id) if a.reference_artwork_id else None
    return {**ser.artwork(a), "reference": ser.artwork(ref) if ref else None, "analyses": [ser.analysis(x) for x in analyses]}


@router.delete("/artworks/{aid}")
def delete_artwork(aid: int, user: m.User = Depends(current_user), db: Session = Depends(get_db)):
    a = owned(db.get(m.Artwork, aid), user, "Artwork")
    try:
        media.path_for("artworks", user.id, a.stored_name).unlink(missing_ok=True)
    except media.UploadError:
        pass
    db.delete(a)
    db.commit()
    return {"deleted": True}


@router.post("/artworks/{aid}/analyze")
def analyze(aid: int, body: AnalyzeIn | None = None, user: m.User = Depends(ai_rate_limit), db: Session = Depends(get_db)):
    a = owned(db.get(m.Artwork, aid), user, "Artwork")
    if a.kind != "learner":
        raise HTTPException(422, "Only your own artwork can be analysed (references are for comparison)")
    region = body.region.model_dump() if body and body.region else None
    x = analysis_svc.analyze(db, user, a, region)
    return ser.analysis(x)


@router.get("/analyses/{xid}")
def get_analysis(xid: int, user: m.User = Depends(current_user), db: Session = Depends(get_db)):
    x = owned(db.get(m.ArtworkAnalysis, xid), user, "Analysis")
    return {**ser.analysis(x), "artwork": ser.artwork(db.get(m.Artwork, x.artwork_id))}


@router.get("/analyses")
def list_analyses(user: m.User = Depends(current_user), db: Session = Depends(get_db)):
    rows = db.scalars(select(m.ArtworkAnalysis).where(m.ArtworkAnalysis.user_id == user.id)
                      .order_by(m.ArtworkAnalysis.created_at.desc()))
    return [{**ser.analysis(x), "artwork": ser.artwork(db.get(m.Artwork, x.artwork_id))} for x in rows]


# ------------------------------------------------------------ references & palettes
@router.post("/references")
def new_reference(body: ReferenceIn, user: m.User = Depends(ai_rate_limit), db: Session = Depends(get_db)):
    ref = practice.generate_reference(db, user, body.purpose, body.subject, body.lighting)
    return ser.reference(ref)


@router.get("/references")
def references(user: m.User = Depends(current_user), db: Session = Depends(get_db)):
    return [ser.reference(r) for r in db.scalars(select(m.GeneratedReference).where(m.GeneratedReference.user_id == user.id)
                                                  .order_by(m.GeneratedReference.created_at.desc()))]


@router.post("/palettes")
def new_palette(body: PaletteIn, user: m.User = Depends(ai_rate_limit), db: Session = Depends(get_db)):
    data = practice.palette(db, user, body.brief)
    log(db, user.id, "palette", f"Palette suggestion: {body.brief[:100]}")
    db.commit()
    return {**data, "label": "AI suggestion — hex swatches are on-screen approximations of the pigments."}


# ------------------------------------------------------------ media (signed URLs)
@router.get("/media/{kind}/{uid}/{name}")
def get_media(kind: str, uid: int, name: str, exp: int = Query(...), sig: str = Query(...)):
    if kind not in ("artworks", "references") or not media.verify(kind, uid, name, exp, sig):
        raise HTTPException(403, "Link expired or invalid")
    try:
        p = media.path_for(kind, uid, name)
    except media.UploadError:
        raise HTTPException(404, "Not found")
    if not p.exists():
        raise HTTPException(404, "Not found")
    return FileResponse(p, headers={"Cache-Control": "private, max-age=3600"})


# ------------------------------------------------------------ system
@router.get("/system/ai-status")
def ai_status():
    return get_router().status()


@router.get("/system/usage")
def usage(user: m.User = Depends(current_user), db: Session = Depends(get_db)):
    rows = db.scalars(select(m.UsageRecord).where(m.UsageRecord.user_id == user.id).order_by(m.UsageRecord.created_at.desc()).limit(200))
    agg: dict[str, dict] = {}
    for r in rows:
        a = agg.setdefault(r.role, {"calls": 0, "errors": 0, "input_tokens": 0, "output_tokens": 0})
        a["calls"] += 1
        a["errors"] += 0 if r.ok else 1
        a["input_tokens"] += r.input_tokens
        a["output_tokens"] += r.output_tokens
    return agg
