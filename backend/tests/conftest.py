"""Test fixtures.

AI providers are replaced ONLY in tests, at the provider boundary, with a scripted fake that returns
schema-shaped data. Application code paths (routing, validation, persistence, evidence rules, roadmap
revision) run for real. Live-model behaviour must be verified separately with real API keys.
"""
import io
import os
import tempfile

import pytest

_tmp = tempfile.mkdtemp()
os.environ["DATABASE_URL"] = os.environ.get("TEST_DATABASE_URL", f"sqlite:///{_tmp}/test.db")
os.environ["STORAGE_DIR"] = f"{_tmp}/storage"
os.environ["JWT_SECRET"] = "test-secret-test-secret-1234567890ab"
os.environ["RATE_LIMIT_AI_PER_MINUTE"] = "1000"
os.environ.pop("ANTHROPIC_API_KEY", None)
os.environ.pop("OPENAI_API_KEY", None)

from fastapi.testclient import TestClient  # noqa: E402
from PIL import Image  # noqa: E402

from app.ai.providers import AIProviderError, Usage  # noqa: E402
from app.ai.router import get_router  # noqa: E402
from app.main import app  # noqa: E402


class FakeProvider:
    name = "fake"

    def __init__(self):
        self.calls: list[tuple[str, str]] = []
        self.fail_roles: set[str] = set()
        self.vision_suitable = True
        self.rating = "needs_work"

    def text(self, model, system, messages, max_tokens):
        self.calls.append(("text", system[:40]))
        return "Here is a focused explanation of the technique, grounded in your current lesson.", Usage(10, 20)

    def json(self, model, system, messages, schema_name, schema, max_tokens):
        self.calls.append(("json", schema_name))
        if schema_name in self.fail_roles:
            raise AIProviderError("simulated provider outage")
        if schema_name == "route":
            return {"workflow": "teach", "skill_slug": None}, Usage()
        if schema_name == "personalised_syllabus":
            import json as j
            payload = j.loads(messages[-1]["content"])
            cands = [c["slug"] for c in payload["CANDIDATE_SKILLS"]]
            src = [s["id"] for s in payload["RETRIEVED_SOURCES"]]
            lessons = [{"module_title": "M", "title": f"Lesson on {s}", "objectives": ["o"], "skill_slugs": [s],
                        "studio_assignment": "a", "exercises": [{"title": "e", "brief": "b"}],
                        "assessment_criteria": ["c"], "est_minutes": 90, "source_ids": src[:1] + [99999],
                        "is_milestone": i % 4 == 3} for i, s in enumerate(reversed(cands))]  # reversed: tests order repair
            lessons.append({**lessons[0], "title": "Bogus", "skill_slugs": ["not-a-skill"]})
            return {"title": "Graphite portrait mastery", "overview": "o", "expected_outcomes": ["x"], "change_note": "",
                    "stages": [{"title": "Stage A", "rationale": "r", "lessons": lessons}]}, Usage()
        if schema_name == "visual_observations":
            if not self.vision_suitable:
                return {"image_suitable": False, "limitations": ["Strong glare across the lower half."], "observations": [],
                        "reference_comparison": ""}, Usage()
            return {"image_suitable": True, "limitations": [], "reference_comparison": "",
                    "observations": [{"dimension": "value grouping", "observation": "mid-values scattered", "location": "background", "confidence": "high"},
                                     {"dimension": "edge control", "observation": "uniform hard edges", "location": "contour", "confidence": "low"}]}, Usage()
        if schema_name == "assessment":
            return {"skill_ratings": [{"skill_slug": "value-structure", "rating": self.rating, "observation_ids": [0], "note": "n"},
                                      {"skill_slug": "edge-control", "rating": "needs_work", "observation_ids": [1], "note": "low conf"},
                                      {"skill_slug": "made-up", "rating": "solid", "observation_ids": [0], "note": "x"},
                                      {"skill_slug": "composition-hierarchy", "rating": "solid", "observation_ids": [], "note": "uncited"}],
                    "strengths": [{"point": "bold darks", "observation_ids": [0]}, {"point": "uncited", "observation_ids": []}],
                    "improvements": [{"issue": "scattered values", "reason": "flattens", "skill_slug": "value-structure", "observation_ids": [0]}],
                    "corrective_steps": ["step"], "exercises": [{"title": "t", "brief": "b", "skill_slug": "value-structure"}],
                    "progress_note": "", "next_milestone": "Three-value thumbnail"}, Usage()
        if schema_name.startswith("practice_"):
            return {"title": "Value massing drill", "objective": "obj", "instructions": ["i"], "materials": ["2B"],
                    "difficulty": "advanced", "est_minutes": 60, "evaluation_criteria": ["c"], "hints": ["h"],
                    "completion_requirements": ["r"], "reference_suggestion": "egg on cloth", "milestones": []}, Usage()
        if schema_name == "lesson_script":
            return {"intro": "Today we shape light.", "concept": {"summary": "Group values.", "why_it_works": "Eyes read masses first."},
                    "steps": [{"title": "Squint", "say": "Squint at the subject.", "do": "Squint", "demo": "value_scale", "image_prompt": "egg on cloth"},
                              {"title": "Block", "say": "Block the shadow shape.", "do": "Block", "demo": "not-a-demo", "image_prompt": "egg"},
                              {"title": "", "say": "", "do": "", "demo": "x", "image_prompt": ""}],
                    "tips": ["t"], "common_mistakes": ["m"],
                    "check": {"question": "What do eyes read first?", "options": ["Detail", "Big value masses", "Outlines"],
                              "answer_index": 1, "explanation": "Masses first."},
                    "practice": {"task": "Three-value egg study", "minutes": 30, "success_criteria": ["Three clear values"]},
                    "next_hint": "Next: edges."}, Usage()
        if schema_name == "palette":
            return {"name": "p", "pigments": [], "mixtures": [], "notes": []}, Usage()
        raise AssertionError(schema_name)

    def image(self, model, prompt, size):
        self.calls.append(("image", prompt[:30]))
        buf = io.BytesIO()
        Image.new("RGB", (64, 64), (200, 180, 160)).save(buf, "PNG")
        return buf.getvalue(), Usage()


@pytest.fixture(scope="session")
def client():
    with TestClient(app) as c:
        yield c


@pytest.fixture
def fake():
    f = FakeProvider()
    get_router()._override = lambda name: f
    yield f
    get_router()._override = None


def make_user(client, email="ana@example.com", track="pencil", medium=None):
    r = client.post("/api/auth/register", json={"email": email, "password": "correct-horse", "display_name": "Ana"})
    assert r.status_code == 200, r.text
    h = {"Authorization": f"Bearer {r.json()['token']}"}
    body = {"track": track, "goals": "realistic graphite portraits", "weekly_hours": 6, "onboarding_complete": True}
    if medium:
        body["medium"] = medium
    assert client.patch("/api/me/profile", json=body, headers=h).status_code == 200
    return h


def png_bytes(size=(600, 800)):
    buf = io.BytesIO()
    Image.new("RGB", size, (120, 120, 120)).save(buf, "PNG")
    return buf.getvalue()
