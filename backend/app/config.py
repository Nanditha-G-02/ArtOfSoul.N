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

    # --- AI providers (keys live only on the server) ---
    anthropic_api_key: str | None = None
    anthropic_base_url: str | None = None
    openai_api_key: str | None = None
    ai_timeout_seconds: float = 90.0

    # --- Model roles: "provider:model" ---
    model_teacher: str = "anthropic:claude-sonnet-5-5"
    model_curriculum: str = "anthropic:claude-sonnet-5-5"
    model_vision: str = "anthropic:claude-sonnet-5-5"
    model_assessment: str = "anthropic:claude-sonnet-5-5"
    model_coordinator: str = "anthropic:claude-haiku-5-5"
    model_exercise: str = "anthropic:claude-haiku-5-5"
    model_image: str = "openai:gpt-image-2"

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
