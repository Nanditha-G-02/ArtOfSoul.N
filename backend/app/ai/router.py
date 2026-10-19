"""Model router: maps each teaching role to a configurable provider:model and records usage.

Roles
  teacher     – advanced art-teaching conversation
  curriculum  – personalised syllabus generation / revision
  vision      – evidence-based visual observation of uploaded artwork
  assessment  – rubric interpretation → skill ratings, gaps, remedial work
  coordinator – classifies ambiguous free-text requests into workflows (cheap model)
  exercise    – targeted exercise / project generation
  image       – reference image generation
"""
from __future__ import annotations

import queue
import threading
import time
from collections.abc import Callable

from ..config import Settings, get_settings
from ..db import SessionLocal
from .. import models as m
from .providers import AIError, AINotConfigured, AnthropicProvider, OpenAIProvider, Provider, Usage

ROLES = ("teacher", "curriculum", "vision", "assessment", "coordinator", "exercise", "image")
TEXT_PROVIDERS = {"anthropic", "openai"}
IMAGE_PROVIDERS = {"openai"}


class ModelRouter:
    def __init__(self, settings: Settings | None = None):
        self.settings = settings or get_settings()
        self._providers: dict[str, Provider] = {}
        self._override: Callable[[str], Provider] | None = None  # used by tests only

    # -- configuration
    def spec(self, role: str) -> tuple[str, str]:
        raw = getattr(self.settings, f"model_{role}")
        provider, _, model = raw.partition(":")
        if not model:
            raise AINotConfigured(f"MODEL_{role.upper()} must look like 'provider:model'.")
        return provider.strip().lower(), model.strip()

    def label(self, role: str) -> str:
        p, mdl = self.spec(role)
        return f"{p}:{mdl}"

    def provider(self, name: str) -> Provider:
        if self._override:
            return self._override(name)
        if name not in self._providers:
            if name == "anthropic":
                self._providers[name] = AnthropicProvider(self.settings.anthropic_api_key, self.settings.anthropic_base_url,
                                                          self.settings.ai_timeout_seconds)
            elif name == "openai":
                self._providers[name] = OpenAIProvider(self.settings.openai_api_key, self.settings.ai_timeout_seconds)
            else:
                raise AINotConfigured(f"Unknown AI provider '{name}'.")
        return self._providers[name]

    def status(self) -> dict[str, dict]:
        """Which roles are usable right now (no network calls)."""
        keys = {"anthropic": bool(self.settings.anthropic_api_key), "openai": bool(self.settings.openai_api_key)}
        out = {}
        for role in ROLES:
            p, mdl = self.spec(role)
            supported = p in (IMAGE_PROVIDERS if role == "image" else TEXT_PROVIDERS)
            out[role] = {"provider": p, "model": mdl, "configured": bool(self._override) or (supported and keys.get(p, False))}
        return out

    # -- calls
    def _record(self, user_id: int | None, role: str, provider: str, model: str, usage: Usage, t0: float, err: str = ""):
        # Written by a background thread so it never contends with the request's open transaction.
        _usage_queue.put(dict(user_id=user_id, role=role, provider=provider, model=model,
                              input_tokens=usage.input_tokens, output_tokens=usage.output_tokens,
                              latency_ms=int((time.perf_counter() - t0) * 1000), ok=not err, error=err[:300]))

    def _run(self, role: str, user_id: int | None, fn):
        pname, model = self.spec(role)
        t0 = time.perf_counter()
        try:
            result, usage = fn(self.provider(pname), model)
        except AIError as e:
            self._record(user_id, role, pname, model, Usage(), t0, e.message)
            raise
        self._record(user_id, role, pname, model, usage, t0)
        return result

    def text(self, role: str, system: str, messages: list[dict], *, user_id: int | None = None, max_tokens: int = 1800) -> str:
        return self._run(role, user_id, lambda p, mdl: p.text(mdl, system, messages, max_tokens))

    def json(self, role: str, system: str, messages: list[dict], schema_name: str, schema: dict, *,
             user_id: int | None = None, max_tokens: int = 4000) -> dict:
        return self._run(role, user_id, lambda p, mdl: p.json(mdl, system, messages, schema_name, schema, max_tokens))

    def image(self, prompt: str, *, user_id: int | None = None, size: str = "1024x1024") -> bytes:
        return self._run("image", user_id, lambda p, mdl: p.image(mdl, prompt, size))


_usage_queue: "queue.Queue[dict]" = queue.Queue()


def _usage_writer() -> None:
    while True:
        rec = _usage_queue.get()
        for attempt in range(5):
            try:
                with SessionLocal() as s:
                    s.add(m.UsageRecord(**rec))
                    s.commit()
                break
            except Exception:  # usage logging must never break the app
                time.sleep(0.5 * (attempt + 1))
        _usage_queue.task_done()


threading.Thread(target=_usage_writer, name="usage-writer", daemon=True).start()


def flush_usage(timeout: float = 5.0) -> None:
    """Wait for pending usage records (used by tests and shutdown)."""
    end = time.time() + timeout
    while _usage_queue.unfinished_tasks and time.time() < end:
        time.sleep(0.02)


_router: ModelRouter | None = None


def get_router() -> ModelRouter:
    global _router
    if _router is None:
        _router = ModelRouter()
    return _router


def set_router(r: ModelRouter | None) -> None:
    global _router
    _router = r
