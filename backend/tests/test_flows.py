from app.curriculum.graph import SkillGraph
from app.curriculum.retrieval import tokenize
from app.db import SessionLocal
from app.services.skills import decide

from .conftest import make_user, png_bytes


# ------------------------------------------------------------ curriculum engine
def test_curriculum_seeded_with_provenance(client):
    rows = client.get("/api/curriculum/sources").json()
    assert len(rows) >= 10
    assert len({r["institution"] for r in rows}) >= 8
    for r in rows:
        assert r["source_url"].startswith("https://")
        assert r["verification"] in ("verified", "partial")
        assert all(l["provenance"] == "inferred" for l in r["skill_links"])
    partial = [r for r in rows if r["verification"] == "partial"]
    assert partial and partial[0]["objectives"] == []  # nothing invented for unverifiable courses


def test_skill_graph_is_acyclic_and_ordered():
    with SessionLocal() as db:
        g = SkillGraph.load(db)
        order = g.order(set(g.nodes))
        pos = {s: i for i, s in enumerate(order)}
        for s, n in g.nodes.items():
            for p in n.prereqs:
                assert pos[p] < pos[s], (p, s)
        assert "layering-oil" not in g.track_skills("painting", "watercolor")
        assert "layering-watercolor" in g.track_skills("painting", "watercolor")


def test_retrieval_normalises_art_vocabulary(client):
    assert tokenize("Watercolour tones") == ["watercolor", "value"]
    hits = client.get("/api/curriculum/search", params={"q": "transparent watercolour glazing", "track": "painting"}).json()
    assert hits and any("watercolor" in h["title"].lower() or "watercolour" in h["text"].lower() for h in hits[:3])


# ------------------------------------------------------------ evidence rules
class E:
    def __init__(self, rating, source="artwork_analysis"):
        self.rating, self.source = rating, source


def test_skill_status_rules():
    assert decide([])[0] == "not_assessed"
    assert decide([E("needs_work"), E("needs_work")])[0] == "needs_practice"
    assert decide([E("solid"), E("needs_work"), E("needs_work")])[0] == "in_progress"  # improving
    assert decide([E("solid"), E("solid")])[0] == "proficient"
    assert decide([E("solid", "diagnostic"), E("solid", "self_report")])[0] == "in_progress"  # needs artwork proof


# ------------------------------------------------------------ auth & access
def test_auth_and_access_control(client, fake):
    h1 = make_user(client, "owner@example.com")
    h2 = make_user(client, "other@example.com")
    assert client.get("/api/me").status_code == 401
    assert client.post("/api/auth/login", json={"email": "owner@example.com", "password": "wrong-pass"}).status_code == 401
    art = client.post("/api/artworks", headers=h1, files={"file": ("a.png", png_bytes(), "image/png")}, data={"title": "Mine"}).json()
    assert client.get(f"/api/artworks/{art['id']}", headers=h2).status_code == 404
    assert client.post(f"/api/artworks/{art['id']}/analyze", headers=h2).status_code == 404
    c = client.post("/api/conversations", headers=h1).json()
    assert client.get(f"/api/conversations/{c['id']}", headers=h2).status_code == 404
    # signed media URLs
    assert client.get(art["url"]).status_code == 200
    assert client.get(art["url"].replace("sig=", "sig=x")).status_code == 403


def test_invalid_uploads(client, fake):
    h = make_user(client, "uploads@example.com")
    bad = client.post("/api/artworks", headers=h, files={"file": ("x.png", b"not an image", "image/png")})
    assert bad.status_code == 422
    tiny = client.post("/api/artworks", headers=h, files={"file": ("t.png", png_bytes((50, 50)), "image/png")})
    assert tiny.status_code == 422 and "too small" in tiny.json()["detail"]


def test_missing_api_keys_give_clear_error(client):
    h = make_user(client, "nokeys@example.com")
    r = client.post("/api/syllabus", headers=h, json={"goal": "Master realistic graphite portrait drawing"})
    assert r.status_code == 503 and "Ollama" in r.json()["detail"]  # default free local provider, not running in CI
    status = client.get("/api/system/ai-status").json()
    assert status["vision"]["configured"] is False


# ------------------------------------------------------------ full learning loop
def test_full_learning_loop(client, fake):
    h = make_user(client, "loop@example.com")
    # diagnostic
    items = client.get("/api/diagnostic", headers=h).json()
    assert items and "levels" in items[0]
    client.post("/api/diagnostic", headers=h, json={"answers": {"value-structure": "developing", "edge-control": "unsure"}})

    # syllabus
    syl = client.post("/api/syllabus", headers=h, json={"goal": "Master realistic graphite portrait drawing"}).json()
    titles = [l["title"] for l in syl["lessons"]]
    assert "Bogus" not in titles  # lessons with unknown skills are rejected
    for l in syl["lessons"]:
        assert 99999 not in l["source_course_ids"]  # fabricated citation ids are stripped
    assert syl["sources"] and all(s["source_url"] for s in syl["sources"])
    # prerequisite order repaired despite reversed model output
    first = {}
    for i, l in enumerate(syl["lessons"]):
        for s in l["skill_slugs"]:
            first.setdefault(s, i)
    with SessionLocal() as db:
        g = SkillGraph.load(db)
    for i, l in enumerate(syl["lessons"]):
        for s in l["skill_slugs"]:
            for p in g.nodes[s].prereqs:
                if p in first:
                    assert first[p] <= i, (p, s)

    rm = client.get("/api/roadmap", headers=h).json()
    assert rm["versions"] and rm["versions"][0]["trigger"] == "syllabus_created"
    current = [l for st in rm["stages"] for l in st["lessons"] if l["status"] == "current"]
    assert len(current) == 1

    # teacher
    c = client.post("/api/conversations", headers=h).json()
    msgs = client.post(f"/api/conversations/{c['id']}/messages", headers=h, json={"text": "How do I soften edges in graphite?"}).json()
    assert msgs[1]["role"] == "assistant" and msgs[1]["meta"]["workflow"] == "teach"
    ex_msgs = client.post(f"/api/conversations/{c['id']}/messages", headers=h, json={"action": "focused_session"}).json()
    assert ex_msgs[1]["exercise"]["title"] == "Value massing drill"
    ref_msgs = client.post(f"/api/conversations/{c['id']}/messages", headers=h, json={"action": "visual_reference"}).json()
    assert ref_msgs[1]["reference"]["label"] == "AI-generated reference"

    # artwork analysis x2 → needs_practice → roadmap remedial insert
    art = client.post("/api/artworks", headers=h, files={"file": ("a.png", png_bytes(), "image/png")},
                      data={"title": "Portrait study 1"}).json()
    a1 = client.post(f"/api/artworks/{art['id']}/analyze", headers=h, json={}).json()
    slugs = {r["skill_slug"]: r for r in a1["skill_ratings"]}
    assert "made-up" not in slugs and "composition-hierarchy" not in slugs  # invalid / uncited rejected
    assert slugs["edge-control"]["rating"] == "developing"  # low-confidence-only evidence softened
    assert len(a1["strengths"]) == 1
    a2 = client.post(f"/api/artworks/{art['id']}/analyze", headers=h,
                     json={"region": {"x": 0.1, "y": 0.1, "w": 0.5, "h": 0.5}}).json()
    assert a2["region"]["w"] == 0.5
    prof = {s["slug"]: s for s in client.get("/api/skills/profile", headers=h).json()}
    assert prof["value-structure"]["status"] == "needs_practice"
    rm2 = client.get("/api/roadmap", headers=h).json()
    remedial = [l for st in rm2["stages"] for l in st["lessons"] if l["kind"] == "remedial"]
    assert remedial and "Value structure" in remedial[0]["title"]
    change = rm2["versions"][0]["changes"][0]
    assert change["type"] == "remedial_inserted" and change["evidence_ids"]

    # improvement → proficient → remedial retired
    fake.rating = "solid"
    client.post(f"/api/artworks/{art['id']}/analyze", headers=h, json={})
    client.post(f"/api/artworks/{art['id']}/analyze", headers=h, json={})
    prof = {s["slug"]: s for s in client.get("/api/skills/profile", headers=h).json()}
    assert prof["value-structure"]["status"] == "proficient"
    rm3 = client.get("/api/roadmap", headers=h).json()
    assert any(c["type"] == "remedial_retired" for v in rm3["versions"] for c in v["changes"])

    # saved analyses retrievable; history recorded
    assert len(client.get(f"/api/artworks/{art['id']}", headers=h).json()["analyses"]) == 4
    kinds = {r["kind"] for r in client.get("/api/history", headers=h).json()}
    assert {"syllabus", "analysis", "teacher", "artwork"} <= kinds

    # learner correction of profile
    assert client.put("/api/skills/edge-control", headers=h, json={"status": "proficient", "note": "trained elsewhere"}).status_code == 200
    prof = {s["slug"]: s for s in client.get("/api/skills/profile", headers=h).json()}
    assert prof["edge-control"]["user_override"] is True

    # revise syllabus: completed work preserved
    lesson = next(l for st in rm3["stages"] for l in st["lessons"] if l["status"] == "current")
    client.patch(f"/api/lessons/{lesson['id']}", headers=h, json={"status": "completed"})
    syl2 = client.post("/api/syllabus", headers=h, json={"goal": "Master graphite portraits and hair rendering"}).json()
    assert syl2["version"] == 2 and syl2["change_summary"]
    carried = [l for l in syl2["lessons"] if l["kind"] == "carried"]
    assert carried and carried[0]["status"] == "completed"


def test_unsuitable_image_records_no_evidence(client, fake):
    h = make_user(client, "glare@example.com")
    fake.vision_suitable = False
    art = client.post("/api/artworks", headers=h, files={"file": ("a.png", png_bytes(), "image/png")}).json()
    a = client.post(f"/api/artworks/{art['id']}/analyze", headers=h, json={}).json()
    assert a["image_suitable"] is False and a["limitations"]
    assert all(s["evidence_count"] == 0 for s in client.get("/api/skills/profile", headers=h).json())
    assert not any(c == ("json", "assessment") for c in fake.calls)  # no wasted assessment call


def test_provider_error_surfaces_and_rolls_back(client, fake):
    h = make_user(client, "outage@example.com")
    fake.fail_roles.add("assessment")
    art = client.post("/api/artworks", headers=h, files={"file": ("a.png", png_bytes(), "image/png")}).json()
    r = client.post(f"/api/artworks/{art['id']}/analyze", headers=h, json={})
    assert r.status_code == 502 and "outage" in r.json()["detail"]
    assert client.get(f"/api/artworks/{art['id']}", headers=h).json()["analyses"] == []


def test_painting_requires_medium_and_coordinator_fallback(client, fake):
    h = make_user(client, "paint@example.com", track="painting")
    r = client.post("/api/syllabus", headers=h, json={"goal": "Improve advanced oil painting and colour harmony"})
    assert r.status_code == 422 and "medium" in r.json()["detail"]
    client.patch("/api/me/profile", headers=h, json={"medium": "watercolor"})
    syl = client.post("/api/syllabus", headers=h, json={"goal": "Luminous watercolour landscapes with strong colour harmony"}).json()
    all_slugs = {s for l in syl["lessons"] for s in l["skill_slugs"]}
    assert "layering-oil" not in all_slugs and "layering-acrylic" not in all_slugs
    fake.fail_roles.add("route")
    c = client.post("/api/conversations", headers=h).json()
    msgs = client.post(f"/api/conversations/{c['id']}/messages", headers=h, json={"text": "Why do my washes bloom?"}).json()
    assert msgs[1]["meta"]["workflow"] == "teach" and "defaulted" in msgs[1]["meta"]["route"]


def test_export_and_delete_account(client, fake):
    h = make_user(client, "bye@example.com")
    assert "profile" in client.get("/api/me/export", headers=h).json()
    assert client.delete("/api/me", headers=h).json()["deleted"]
    assert client.get("/api/me", headers=h).status_code == 401


def test_usage_is_recorded_per_role(client, fake):
    from app.ai.router import flush_usage
    h = make_user(client, "usage@example.com")
    c = client.post("/api/conversations", headers=h).json()
    client.post(f"/api/conversations/{c['id']}/messages", headers=h, json={"text": "Explain lost edges"})
    flush_usage()
    usage = client.get("/api/system/usage", headers=h).json()
    assert usage["teacher"]["calls"] == 1 and usage["coordinator"]["calls"] == 1
