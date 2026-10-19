"""Provider adapters. API keys stay on the server; nothing here is ever sent to the browser.

Neutral message format used by the services:
    {"role": "user"|"assistant", "content": str | [ {"type":"text","text":...} |
                                                    {"type":"image","media_type":"image/png","data":<base64>} ]}
"""
from __future__ import annotations

import base64
import json
from dataclasses import dataclass
from typing import Any, Protocol


class AIError(Exception):
    status_code = 502

    def __init__(self, message: str):
        super().__init__(message)
        self.message = message


class AINotConfigured(AIError):
    status_code = 503


class AIProviderError(AIError):
    status_code = 502


@dataclass
class Usage:
    input_tokens: int = 0
    output_tokens: int = 0


class Provider(Protocol):
    name: str

    def text(self, model: str, system: str, messages: list[dict], max_tokens: int) -> tuple[str, Usage]: ...

    def json(self, model: str, system: str, messages: list[dict], schema_name: str, schema: dict,
             max_tokens: int) -> tuple[dict, Usage]: ...

    def image(self, model: str, prompt: str, size: str) -> tuple[bytes, Usage]: ...


# ------------------------------------------------------------------ Anthropic
class AnthropicProvider:
    name = "anthropic"

    def __init__(self, api_key: str | None, base_url: str | None, timeout: float):
        if not api_key:
            raise AINotConfigured("ANTHROPIC_API_KEY is not set on the server.")
        import anthropic

        self._anthropic = anthropic
        kwargs: dict[str, Any] = {"api_key": api_key, "timeout": timeout, "max_retries": 2}
        if base_url:
            kwargs["base_url"] = base_url
        self.client = anthropic.Anthropic(**kwargs)

    @staticmethod
    def _convert(messages: list[dict]) -> list[dict]:
        out = []
        for msg in messages:
            content = msg["content"]
            if isinstance(content, str):
                out.append({"role": msg["role"], "content": content})
                continue
            parts = []
            for p in content:
                if p["type"] == "text":
                    parts.append({"type": "text", "text": p["text"]})
                else:
                    parts.append({"type": "image", "source": {"type": "base64", "media_type": p["media_type"], "data": p["data"]}})
            out.append({"role": msg["role"], "content": parts})
        return out

    def _call(self, **kw):
        try:
            return self.client.messages.create(**kw)
        except self._anthropic.AuthenticationError as e:
            raise AINotConfigured("Anthropic rejected the API key.") from e
        except self._anthropic.APITimeoutError as e:
            raise AIProviderError("The Anthropic request timed out.") from e
        except self._anthropic.APIStatusError as e:
            raise AIProviderError(f"Anthropic error {e.status_code}.") from e
        except self._anthropic.APIConnectionError as e:
            raise AIProviderError("Could not reach the Anthropic API.") from e

    def text(self, model, system, messages, max_tokens):
        r = self._call(model=model, system=system, messages=self._convert(messages), max_tokens=max_tokens)
        txt = "".join(b.text for b in r.content if getattr(b, "type", "") == "text").strip()
        if not txt:
            raise AIProviderError("The model returned an empty response.")
        return txt, Usage(r.usage.input_tokens, r.usage.output_tokens)

    def json(self, model, system, messages, schema_name, schema, max_tokens):
        r = self._call(model=model, system=system, messages=self._convert(messages), max_tokens=max_tokens,
                       tools=[{"name": schema_name, "description": f"Return the {schema_name} result.", "input_schema": schema}],
                       tool_choice={"type": "tool", "name": schema_name})
        for b in r.content:
            if getattr(b, "type", "") == "tool_use":
                return dict(b.input), Usage(r.usage.input_tokens, r.usage.output_tokens)
        raise AIProviderError("The model did not return structured output.")

    def image(self, model, prompt, size):
        raise AINotConfigured("Anthropic models do not generate images; set MODEL_IMAGE to an image provider.")


# ------------------------------------------------------------------ OpenAI
class OpenAIProvider:
    name = "openai"

    def __init__(self, api_key: str | None, timeout: float):
        if not api_key:
            raise AINotConfigured("OPENAI_API_KEY is not set on the server.")
        import openai

        self._openai = openai
        self.client = openai.OpenAI(api_key=api_key, timeout=timeout, max_retries=2)

    def _wrap(self, fn):
        try:
            return fn()
        except self._openai.AuthenticationError as e:
            raise AINotConfigured("OpenAI rejected the API key.") from e
        except self._openai.APITimeoutError as e:
            raise AIProviderError("The OpenAI request timed out.") from e
        except self._openai.BadRequestError as e:
            raise AIProviderError("The image request was rejected by the provider (it may have been filtered).") from e
        except self._openai.APIStatusError as e:
            raise AIProviderError(f"OpenAI error {e.status_code}.") from e
        except self._openai.APIConnectionError as e:
            raise AIProviderError("Could not reach the OpenAI API.") from e

    @staticmethod
    def _convert(system: str, messages: list[dict]) -> list[dict]:
        out: list[dict] = [{"role": "system", "content": system}]
        for msg in messages:
            c = msg["content"]
            if isinstance(c, str):
                out.append({"role": msg["role"], "content": c})
            else:
                out.append({"role": msg["role"], "content": [
                    {"type": "text", "text": p["text"]} if p["type"] == "text" else
                    {"type": "image_url", "image_url": {"url": f"data:{p['media_type']};base64,{p['data']}"}} for p in c]})
        return out

    def text(self, model, system, messages, max_tokens):
        r = self._wrap(lambda: self.client.chat.completions.create(model=model, messages=self._convert(system, messages),
                                                                   max_completion_tokens=max_tokens))
        txt = (r.choices[0].message.content or "").strip()
        if not txt:
            raise AIProviderError("The model returned an empty response.")
        return txt, Usage(r.usage.prompt_tokens, r.usage.completion_tokens)

    def json(self, model, system, messages, schema_name, schema, max_tokens):
        r = self._wrap(lambda: self.client.chat.completions.create(
            model=model, messages=self._convert(system, messages), max_completion_tokens=max_tokens,
            tools=[{"type": "function", "function": {"name": schema_name, "parameters": schema}}],
            tool_choice={"type": "function", "function": {"name": schema_name}}))
        calls = r.choices[0].message.tool_calls or []
        if not calls:
            raise AIProviderError("The model did not return structured output.")
        return json.loads(calls[0].function.arguments), Usage(r.usage.prompt_tokens, r.usage.completion_tokens)

    def image(self, model, prompt, size):
        r = self._wrap(lambda: self.client.images.generate(model=model, prompt=prompt, size=size, n=1))
        item = r.data[0]
        if getattr(item, "b64_json", None):
            return base64.b64decode(item.b64_json), Usage()
        raise AIProviderError("The image provider returned no image data.")
