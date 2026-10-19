from app.curriculum.graph import SkillGraph
from app.db import SessionLocal

from .conftest import png_bytes


def local(client):
    r = client.post("/api/local/session", json={"name": "Nanditha"})
    assert r.status_code == 200
    return {"Authorization": f"Bearer {r.json()['token']}"}


def test_local_session_is_stable_and_needs_no_signup(client):
    a = client.post("/api/local/session").json()
    b = client.post("/api/local/session").json()
    assert a["user"]["id"] == b["user"]["id"]
    assert client.get("/api/me", headers={"Authorization": f"Bearer {b['token']}"}).status_code == 200
    assert client.get("/").json()["message"].startswith("This is the ArtOfSoul.N API")


def test_questions_and_answers(client):
    qs = client.get("/api/journey/questions").json()
    assert [q["id"] for q in qs][:3] == ["track", "medium", "level"]
    h = local(client)
    bad = client.post("/api/journey/answers", headers=h, json={"track": "painting", "level": "beginner", "goal": "paint flowers", "daily_minutes": 30})
    assert bad.status_code == 422
    p = client.post("/api/journey/answers", headers=h, json={
        "name": "Nanditha", "track": "pencil", "level": "beginner", "artwork_types": ["portraits"],
        "goal": "Draw realistic portraits of my family", "daily_minutes": 30, "techniques": ["shading"]}).json()
    assert p["onboarding_complete"] and p["medium"] == "graphite" and p["weekly_hours"] == 4 and p["level"] == "beginner"


def test_beginner_syllabus_includes_foundations_and_practice_plan(client, fake):
    h = local(client)
    client.post("/api/journey/answers", headers=h, json={"track": "pencil", "level": "beginner", "goal": "Draw realistic portraits",
                                                         "daily_minutes": 30, "techniques": ["shading"]})
    syl = client.post("/api/syllabus", headers=h, json={"goal": "Draw realistic portraits of my family"}).json()
    with SessionLocal() as db:
        g = SkillGraph.load(db)
    tiers = {g.nodes[s].tier for l in syl["lessons"] for s in l["skill_slugs"]}
    assert 0 in tiers and "practice_plan" in syl


def test_lesson_script_cached_check_visual_voice_progress(client, fake):
    h = local(client)
    client.post("/api/journey/answers", headers=h, json={"track": "pencil", "level": "intermediate", "goal": "Better shading",
                                                         "daily_minutes": 60, "techniques": ["shading"]})
    syl = client.post("/api/syllabus", headers=h, json={"goal": "Better shading in graphite"}).json()
    lid = syl["lessons"][1]["id"]
    empty = client.get(f"/api/lessons/{lid}/script", headers=h).json()
    assert empty["script"] is None
    n_before = len([c for c in fake.calls if c == ("json", "lesson_script")])
    s1 = client.post(f"/api/lessons/{lid}/script", headers=h).json()
    s2 = client.post(f"/api/lessons/{lid}/script", headers=h).json()
    assert len([c for c in fake.calls if c == ("json", "lesson_script")]) == n_before + 1  # cached
    steps = s1["script"]["steps"]
    assert len(steps) == 2  # empty step dropped
    assert steps[1]["demo"] in ("value_scale", "sphere_shading", "edge_control", "proportion", "perspective", "hatching", "composition", "glazing", "color_temperature", "brushwork")
    assert s2["lesson"]["status"] == "current"
    chk = client.post(f"/api/lessons/{lid}/check", headers=h, json={"choice": 1}).json()
    assert chk["correct"] is True
    vis = client.post(f"/api/lessons/{lid}/steps/0/visual", headers=h).json()
    assert vis["label"] == "AI-generated reference"
    assert client.get(f"/api/lessons/{lid}/script", headers=h).json()["visuals"]["0"]["id"] == vis["id"]
    # no Piper voice installed in CI → 503 so the browser voice is used
    assert client.post("/api/tts", headers=h, json={"text": "Hello"}).status_code == 503
    art = client.post("/api/artworks", headers=h, files={"file": ("a.png", png_bytes(), "image/png")}, data={"lesson_id": str(lid)}).json()
    client.post(f"/api/artworks/{art['id']}/analyze", headers=h, json={})
    prog = client.get("/api/progress", headers=h).json()
    assert prog["checks"] == {"answered": 1, "correct": 1} and prog["recent_feedback"]
    hw = client.get("/api/system/hardware").json()
    assert hw["recommended_model"].startswith("gemma4:") and "voice" in hw


def test_image_generation_off_explains_itself(client):
    from app.ai.router import get_router
    h = local(client)
    r = client.post("/api/references", headers=h, json={"purpose": "subject", "subject": "a pear"})
    assert r.status_code == 503 and "optional" in r.json()["detail"]
    assert get_router().status()["image"]["configured"] is False
