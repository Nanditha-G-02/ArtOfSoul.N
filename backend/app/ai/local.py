"""Free, local providers.

OllamaProvider   – text, structured JSON and vision through a local Ollama server (no key, no cost).
SDWebUIProvider  – image generation through a local Stable Diffusion WebUI / Forge started with --api.
NoImageProvider  – explicit "image generation not configured" state.
"""
from __future__ import annotations

import base64
import json
import re

import httpx

from .providers import AINotConfigured, AIProviderError, Usage

_FENCE = re.compile(r"^```(?:json)?\s*|\s*```$", re.S)


def _parse_json(text: str) -> dict:
    t = _FENCE.sub("", text.strip()).strip()
    try:
        v = json.loads(t)
    except json.JSONDecodeError:
        start, end = t.find("{"), t.rfind("}")
        if start < 0 or end <= start:
            raise
        v = json.loads(t[start:end + 1])
    if not isinstance(v, dict):
        raise json.JSONDecodeError("not an object", t, 0)
    return v


class OllamaProvider:
    name = "ollama"

    def __init__(self, url: str, num_ctx: int, timeout: float, keep_alive: str = "30m",
                 transport: httpx.BaseTransport | None = None):
        self.url = url.rstrip("/")
        self.num_ctx = num_ctx
        self.keep_alive = keep_alive
        self.client = httpx.Client(base_url=self.url, timeout=httpx.Timeout(timeout, connect=5.0), transport=transport)

    @staticmethod
    def _convert(system: str, messages: list[dict]) -> list[dict]:
        out: list[dict] = [{"role": "system", "content": system}]
        for msg in messages:
            c = msg["content"]
            if isinstance(c, str):
                out.append({"role": msg["role"], "content": c})
                continue
            text = "\n\n".join(p["text"] for p in c if p["type"] == "text")
            images = [p["data"] for p in c if p["type"] == "image"]
            m = {"role": msg["role"], "content": text}
            if images:
                m["images"] = images
            out.append(m)
        return out

    def _chat(self, model: str, messages: list[dict], max_tokens: int, fmt: dict | None) -> tuple[str, Usage]:
        body: dict = {"model": model, "messages": messages, "stream": False, "keep_alive": self.keep_alive,
                      "options": {"num_ctx": self.num_ctx, "num_predict": max_tokens,
                                  "temperature": 0.2 if fmt else 0.7}}
        if fmt:
            body["format"] = fmt
        try:
            r = self.client.post("/api/chat", json=body)
        except httpx.ConnectError as e:
            raise AINotConfigured(f"Ollama isn't running at {self.url}. Start Ollama (the app on Windows/macOS, or `ollama serve` on Linux), then run: ollama pull {model}") from e
        except httpx.TimeoutException as e:
            raise AIProviderError("The local model took too long. Try a smaller model (e.g. gemma4:e2b) or a shorter request.") from e
        if r.status_code == 404:
            raise AINotConfigured(f"The model '{model}' isn't downloaded yet. Run: ollama pull {model}")
        if r.status_code >= 400:
            try:
                detail = r.json().get("error", "")
            except ValueError:
                detail = r.text[:200]
            if "not found" in detail and "model" in detail:
                raise AINotConfigured(f"The model '{model}' isn't downloaded yet. Run: ollama pull {model}")
            raise AIProviderError(f"Ollama error {r.status_code}: {detail[:200]}")
        data = r.json()
        text = (data.get("message") or {}).get("content", "").strip()
        return text, Usage(data.get("prompt_eval_count", 0) or 0, data.get("eval_count", 0) or 0)

    def text(self, model, system, messages, max_tokens):
        txt, usage = self._chat(model, self._convert(system, messages), max_tokens, None)
        if not txt:
            raise AIProviderError("The local model returned an empty response.")
        return txt, usage

    def json(self, model, system, messages, schema_name, schema, max_tokens):
        sys = (f"{system}\n\nRespond ONLY with a JSON object for `{schema_name}` that matches this JSON schema:\n"
               f"{json.dumps(schema)}")
        msgs = self._convert(sys, messages)
        total = Usage()
        for attempt in range(2):
            txt, u = self._chat(model, msgs, max_tokens, schema)
            total.input_tokens += u.input_tokens
            total.output_tokens += u.output_tokens
            try:
                return _parse_json(txt), total
            except json.JSONDecodeError:
                msgs = msgs + [{"role": "assistant", "content": txt[:4000]},
                               {"role": "user", "content": "That was not valid JSON for the schema. Reply again with only the complete JSON object."}]
        raise AIProviderError("The local model didn't return valid structured output. Try again, or use a larger model.")

    def image(self, model, prompt, size):
        raise AINotConfigured("Ollama doesn't generate images here. Set MODEL_IMAGE=sdwebui:default to use a local Stable Diffusion WebUI.")

    def available_models(self) -> list[str] | None:
        try:
            r = self.client.get("/api/tags", timeout=1.5)
            return [m["name"] for m in r.json().get("models", [])]
        except (httpx.HTTPError, ValueError, KeyError):
            return None


class SDWebUIProvider:
    """AUTOMATIC1111 / Forge WebUI launched with --api. Free and local; needs a GPU for reasonable speed."""
    name = "sdwebui"

    def __init__(self, url: str, steps: int, timeout: float = 600.0, transport: httpx.BaseTransport | None = None):
        self.url = url.rstrip("/")
        self.steps = steps
        self.client = httpx.Client(base_url=self.url, timeout=httpx.Timeout(timeout, connect=5.0), transport=transport)

    def text(self, *a, **k):
        raise AINotConfigured("Stable Diffusion WebUI is only used for images.")

    json = text

    def image(self, model, prompt, size):
        w, _, h = size.partition("x")
        body = {"prompt": prompt, "negative_prompt": "text, watermark, signature, logo, blurry, deformed",
                "steps": self.steps, "width": min(int(w), 1024), "height": min(int(h), 1024)}
        if model and model != "default":
            body["override_settings"] = {"sd_model_checkpoint": model}
        try:
            r = self.client.post("/sdapi/v1/txt2img", json=body)
        except httpx.ConnectError as e:
            raise AINotConfigured(f"Stable Diffusion WebUI isn't running at {self.url}. Start it with the --api flag.") from e
        except httpx.TimeoutException as e:
            raise AIProviderError("Image generation timed out on the local GPU.") from e
        if r.status_code == 404:
            raise AINotConfigured("Stable Diffusion WebUI is running without its API. Restart it with the --api flag.")
        if r.status_code >= 400:
            raise AIProviderError(f"Stable Diffusion WebUI error {r.status_code}.")
        imgs = r.json().get("images") or []
        if not imgs:
            raise AIProviderError("Stable Diffusion WebUI returned no image.")
        return base64.b64decode(imgs[0].split(",", 1)[-1]), Usage()


class NoImageProvider:
    name = "none"

    def _no(self, *a, **k):
        raise AINotConfigured("Image generation is turned off (MODEL_IMAGE=none). It's optional: install a local "
                              "Stable Diffusion WebUI and set MODEL_IMAGE=sdwebui:default to enable it for free.")

    text = json = image = _no
