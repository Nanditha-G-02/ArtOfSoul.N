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


def test_prefetch_writes_next_lesson_once_and_handles_odd_model_output(client, fake):
    import time

    from app import models as m
    from app.config import get_settings
    from app.services.lessons import _clean
    h = local(client)
    client.post("/api/journey/answers", headers=h, json={"track": "pencil", "level": "advanced", "goal": "Hair and portraits",
                                                         "daily_minutes": 60, "techniques": ["texture"]})
    syl = client.post("/api/syllabus", headers=h, json={"goal": "Hair and portrait realism"}).json()
    first, second = syl["lessons"][0]["id"], syl["lessons"][1]["id"]
    get_settings().prefetch_next_lesson = True
    try:
        client.post(f"/api/lessons/{first}/script", headers=h)
        for _ in range(100):  # background thread writes the following lesson
            if client.get(f"/api/lessons/{second}/script", headers=h).json()["script"]:
                break
            time.sleep(0.05)
        get_settings().prefetch_next_lesson = False  # don't start a third-lesson prefetch while counting calls
        before = len(fake.calls)
        got = client.post(f"/api/lessons/{second}/script", headers=h).json()
        assert got["script"] and len(fake.calls) == before  # served from the prefetched copy, no new model call
        assert got["lesson"]["status"] == "current"
    finally:
        get_settings().prefetch_next_lesson = False

    # small local models sometimes return odd types: never a crash
    with SessionLocal() as db:
        lesson = db.get(m.Lesson, first)
        out = _clean({"concept": "Values first", "check": [1, 2], "practice": {"minutes": "20 minutes"},
                      "tips": "one tip", "steps": [{"say": "Squint.", "demo": "nope"}, "junk"]}, lesson, db)
    assert out["check"] is None and out["practice"]["minutes"] == 20 and out["tips"] == ["one tip"]
    assert out["concept"]["summary"] == "Values first" and len(out["steps"]) == 1


def test_unexpected_errors_return_friendly_message(client, fake, monkeypatch):
    from app.services import lessons
    h = local(client)
    client.post("/api/journey/answers", headers=h, json={"track": "pencil", "level": "beginner", "goal": "Shading basics",
                                                         "daily_minutes": 30})
    syl = client.post("/api/syllabus", headers=h, json={"goal": "Shading basics in pencil"}).json()
    monkeypatch.setattr(lessons, "_write", lambda *a, **k: (_ for _ in ()).throw(KeyError("boom")))
    from fastapi.testclient import TestClient
    from app.main import app
    with TestClient(app, raise_server_exceptions=False) as c:
        r = c.post(f"/api/lessons/{syl['lessons'][-1]['id']}/script", headers=h)
    assert r.status_code == 500 and "try again" in r.json()["detail"]


def test_quiz_terms_activities_streak_and_grounding(client, fake):
    h = local(client)
    client.post("/api/journey/answers", headers=h, json={"track": "painting", "medium": "watercolor", "level": "intermediate",
                                                         "goal": "Glowing watercolour landscapes", "daily_minutes": 30})
    syl = client.post("/api/syllabus", headers=h, json={"goal": "Glowing watercolour landscapes"}).json()
    lid = syl["lessons"][0]["id"]
    sc = client.post(f"/api/lessons/{lid}/script", headers=h).json()["script"]
    assert len(sc["quiz"]) == 2 and sc["terms"] == [{"term": "Value", "meaning": "How light or dark a tone is."}]
    r1 = client.post(f"/api/lessons/{lid}/check", headers=h, json={"choice": 0, "question": 1}).json()
    r2 = client.post(f"/api/lessons/{lid}/check", headers=h, json={"choice": 1, "question": 1}).json()
    assert r1["correct"] and r1["first_attempt"] and not r2["first_attempt"]
    assert client.post(f"/api/lessons/{lid}/check", headers=h, json={"choice": 0, "question": 4}).status_code == 422
    assert client.post(f"/api/lessons/{lid}/activity", headers=h, json={"kind": "color_mix", "score": 4, "total": 5}).json()["ok"]
    assert client.post(f"/api/lessons/{lid}/activity", headers=h, json={"kind": "hack"}).status_code == 422
    prog = client.get("/api/progress", headers=h).json()
    assert prog["streak_days"] >= 1 and prog["activities"] >= 1 and prog["checks"]["answered"] >= 1


def test_lesson_prompt_is_grounded_in_medium_facts(client, fake):
    import json
    seen = []
    orig = fake.json

    def spy(model, system, messages, schema_name, schema, max_tokens):
        if schema_name == "lesson_script":
            seen.append(json.loads(messages[-1]["content"]))
        return orig(model, system, messages, schema_name, schema, max_tokens)
    fake.json = spy
    h = local(client)
    client.post("/api/journey/answers", headers=h, json={"track": "painting", "medium": "watercolor", "level": "beginner",
                                                         "goal": "Paint flowers in watercolour", "daily_minutes": 30})
    syl = client.post("/api/syllabus", headers=h, json={"goal": "Paint flowers in watercolour"}).json()
    client.post(f"/api/lessons/{syl['lessons'][-1]['id']}/script", headers=h)
    assert any("paper is the lightest value" in f for f in seen[0]["MEDIUM_FACTS"])
    assert seen[0]["SKILLS"] and "what_good_looks_like" in seen[0]["SKILLS"][0]


def test_model_profiles_switch_and_pull_is_restricted(client, monkeypatch):
    from app.ai import profiles
    from app.ai.router import get_router
    h = local(client)
    info = client.get("/api/system/models").json()
    assert {p["id"] for p in info["profiles"]} == {"fast", "balanced", "accurate", "best"}
    acc = next(p for p in info["profiles"] if p["id"] == "accurate")
    assert acc["vision"] == "qwen3-vl:8b"
    try:
        client.post("/api/system/models/profile", headers=h, json={"profile": "accurate"})
        assert get_router().spec("vision") == ("ollama", "qwen3-vl:8b")
        assert get_router().spec("teacher") == ("ollama", "gemma4:12b")
        assert client.post("/api/system/models/pull", headers=h, json={"model": "evil:latest"}).status_code == 422
        assert client.post("/api/system/models/profile", headers=h, json={"profile": "nope"}).status_code == 422
    finally:
        profiles._file().unlink(missing_ok=True)
    assert get_router().spec("teacher") == ("ollama", "gemma4:e4b")
    assert profiles.recommend(8, 0) == "fast" and profiles.recommend(16, 0) == "balanced" and profiles.recommend(16, 12) == "accurate"


def test_short_goal_is_accepted(client, fake):
    h = local(client)
    client.post("/api/journey/answers", headers=h, json={"track": "pencil", "level": "beginner", "goal": "faces", "daily_minutes": 15})
    assert client.post("/api/syllabus", headers=h, json={"goal": "faces"}).status_code == 200
