"""Model quality profiles for local (Ollama) use, and the learner's saved choice.

The choice is stored in a small JSON file next to the database, so it can be changed from the app without editing
.env. Environment variables still apply when no choice has been saved.
"""
import json
import threading
from pathlib import Path

from ..config import get_settings

TEXT_ROLES = ("teacher", "curriculum", "assessment", "coordinator", "exercise")

PROFILES = {
    "fast": {"label": "Fast", "text": "gemma4:e2b", "vision": "gemma4:e2b",
             "needs": "8 GB RAM", "about": "Quickest replies; simpler lessons and feedback."},
    "balanced": {"label": "Balanced", "text": "gemma4:e4b", "vision": "gemma4:e4b",
                 "needs": "16 GB RAM", "about": "Good lessons at a reasonable speed."},
    "accurate": {"label": "Accurate", "text": "gemma4:12b", "vision": "qwen3-vl:8b",
                 "needs": "NVIDIA GPU with 10 GB+, or 32 GB RAM",
                 "about": "Larger teacher model plus a specialist vision model for much more precise artwork feedback."},
    "best": {"label": "Best", "text": "gemma4:26b", "vision": "gemma4:26b",
             "needs": "GPU with 20 GB+, or 48 GB RAM", "about": "Highest quality; slow without a large GPU."},
}
ALLOWED_MODELS = {m for p in PROFILES.values() for m in (p["text"], p["vision"])}

_lock = threading.Lock()


def _file() -> Path:
    return get_settings().storage_dir.parent / "model_choice.json"


def load() -> dict:
    try:
        return json.loads(_file().read_text())
    except (OSError, ValueError):
        return {}


def save(profile: str) -> dict:
    if profile not in PROFILES:
        raise ValueError("Unknown profile")
    p = PROFILES[profile]
    roles = {r: f"ollama:{p['text']}" for r in TEXT_ROLES}
    roles["vision"] = f"ollama:{p['vision']}"
    data = {"profile": profile, "roles": roles}
    with _lock:
        _file().write_text(json.dumps(data, indent=2))
    return data


def recommend(ram_gb: float | None, vram_gb: float) -> str:
    if vram_gb >= 20 or (ram_gb or 0) >= 46:
        return "best"
    if vram_gb >= 10 or (ram_gb or 0) >= 30:
        return "accurate"
    if (ram_gb or 0) >= 14 or vram_gb >= 6:
        return "balanced"
    return "fast"
