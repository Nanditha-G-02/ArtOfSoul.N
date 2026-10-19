"""Unit tests for the free local providers, using httpx's mock transport (no Ollama/SD server needed)."""
import base64
import json

import httpx
import pytest

from app.ai.local import NoImageProvider, OllamaProvider, SDWebUIProvider
from app.ai.providers import AINotConfigured, AIProviderError


def ollama(handler):
    return OllamaProvider("http://ollama.test", 16384, 30, transport=httpx.MockTransport(handler))


def test_ollama_text_and_vision_payload():
    seen = {}

    def h(req):
        seen.update(json.loads(req.content))
        return httpx.Response(200, json={"message": {"content": "Soften the edge where the form turns."}, "prompt_eval_count": 5, "eval_count": 7})

    p = ollama(h)
    txt, u = p.text("gemma4:e4b", "sys", [{"role": "user", "content": [
        {"type": "text", "text": "Look"}, {"type": "image", "media_type": "image/jpeg", "data": "QUJD"}]}], 500)
    assert txt.startswith("Soften") and u.output_tokens == 7
    assert seen["messages"][0] == {"role": "system", "content": "sys"}
    assert seen["messages"][1]["images"] == ["QUJD"] and seen["messages"][1]["content"] == "Look"
    assert seen["options"]["num_ctx"] == 16384 and seen["options"]["num_predict"] == 500 and "format" not in seen


def test_ollama_json_uses_schema_strips_fences_and_retries():
    calls = []

    def h(req):
        body = json.loads(req.content)
        calls.append(body)
        content = "not json at all" if len(calls) == 1 else '```json\n{"workflow": "teach", "skill_slug": null}\n```'
        return httpx.Response(200, json={"message": {"content": content}})

    data, _ = ollama(h).json("m", "route it", [{"role": "user", "content": "hi"}], "route", {"type": "object"}, 100)
    assert data == {"workflow": "teach", "skill_slug": None}
    assert calls[0]["format"] == {"type": "object"} and len(calls) == 2


def test_ollama_gives_actionable_errors():
    def down(req):
        raise httpx.ConnectError("refused")
    with pytest.raises(AINotConfigured, match="Start Ollama"):
        ollama(down).text("gemma4:e4b", "s", [{"role": "user", "content": "x"}], 10)

    def missing(req):
        return httpx.Response(404, json={"error": "model 'gemma4:e4b' not found"})
    with pytest.raises(AINotConfigured, match="ollama pull gemma4:e4b"):
        ollama(missing).text("gemma4:e4b", "s", [{"role": "user", "content": "x"}], 10)

    def garbage(req):
        return httpx.Response(200, json={"message": {"content": "still not json"}})
    with pytest.raises(AIProviderError, match="valid structured output"):
        ollama(garbage).json("m", "s", [{"role": "user", "content": "x"}], "r", {}, 10)


def test_sdwebui_decodes_image_and_reports_missing_api():
    png = base64.b64encode(b"\x89PNG fake").decode()
    p = SDWebUIProvider("http://sd.test", 20, transport=httpx.MockTransport(lambda r: httpx.Response(200, json={"images": [png]})))
    data, _ = p.image("default", "a pear", "1024x1024")
    assert data.startswith(b"\x89PNG")
    p404 = SDWebUIProvider("http://sd.test", 20, transport=httpx.MockTransport(lambda r: httpx.Response(404)))
    with pytest.raises(AINotConfigured, match="--api"):
        p404.image("default", "a pear", "1024x1024")


def test_image_off_by_default_is_explained():
    with pytest.raises(AINotConfigured, match="optional"):
        NoImageProvider().image("", "x", "1024x1024")
