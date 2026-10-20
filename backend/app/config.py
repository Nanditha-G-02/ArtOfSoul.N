"""Central configuration. Every value can be overridden with an environment variable."""
from functools import lru_cache
from pathlib import Path

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict

BASE_DIR = Path(__file__).resolve().parent.parent


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=(BASE_DIR / ".env", BASE_DIR.parent / ".env"), extra="ignore")

    app_name: str = "ArtOfSoul.N"
    environment: str = "development"

    # --- Database & storage ---
    database_url: str = f"sqlite:///{BASE_DIR / 'data' / 'artofsoul.db'}"
    storage_dir: Path = BASE_DIR / "data" / "storage"
    max_upload_mb: int = 12

    # --- Auth ---
    jwt_secret: str = Field(default="change-me-in-production-please-32+chars", min_length=32)
    jwt_algorithm: str = "HS256"
    access_token_minutes: int = 60 * 24 * 7

    # --- HTTP ---
    cors_origins: str = "http://localhost:5174,http://127.0.0.1:5174"
    rate_limit_ai_per_minute: int = 12

    tutor_name: str = "G"

    # --- Local single-user mode: no sign-up; the browser gets a session for the one local learner ---
    local_mode: bool = True

    # --- Local voice (free): Piper TTS. Falls back to the browser's built-in voice if the model file is missing ---
    piper_voice: Path = BASE_DIR.parent / "models" / "piper" / "en_US-ljspeech-medium.onnx"

    # --- Free, local AI (default): Ollama ---
    ollama_url: str = "http://localhost:11434"
    ollama_num_ctx: int = 16384          # context window; Ollama's own default is too small for syllabus prompts
    ollama_timeout_seconds: float = 900.0  # local models on CPU can be slow
    ollama_keep_alive: str = "60m"
    ollama_think: bool = False             # Gemma 4 "thinking" mode: much slower, rarely needed here
    prefetch_next_lesson: bool = True      # write the next lesson in the background while you study
    # --- Free, local image generation (optional): Stable Diffusion WebUI / Forge started with --api ---
    sd_webui_url: str = "http://127.0.0.1:7860"
    sd_steps: int = 25

    # --- Optional paid/cloud providers (keys live only on the server) ---
    anthropic_api_key: str | None = None
    anthropic_base_url: str | None = None
    openai_api_key: str | None = None
    openai_base_url: str | None = None   # any OpenAI-compatible endpoint (e.g. LM Studio, a free-tier cloud API)
    ai_timeout_seconds: float = 90.0

    # --- Model roles: "provider:model". Providers: ollama | anthropic | openai ; image: sdwebui | openai | none ---
    # Defaults use ONE free local model for every role so only one model is loaded in memory.
    model_teacher: str = "ollama:gemma4:e4b"
    model_curriculum: str = "ollama:gemma4:e4b"
    model_vision: str = "ollama:gemma4:e4b"
    model_assessment: str = "ollama:gemma4:e4b"
    model_coordinator: str = "ollama:gemma4:e4b"
    model_exercise: str = "ollama:gemma4:e4b"
    model_image: str = "none:"

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    s = Settings()
    s.storage_dir.mkdir(parents=True, exist_ok=True)
    if s.database_url.startswith("sqlite:///"):
        Path(s.database_url.removeprefix("sqlite:///")).parent.mkdir(parents=True, exist_ok=True)
    return s
