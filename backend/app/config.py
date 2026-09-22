"""Application settings.

Loaded once at import time from environment variables / ``backend/.env``.
Missing or inconsistent configuration raises immediately so the process dies at
startup with a readable message rather than failing on the first request.
"""

from __future__ import annotations

import sys
from functools import lru_cache
from typing import Literal

from pydantic import Field, ValidationError, field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

AIProviderName = Literal["claude", "openai", "gemini"]

#: Which env var must hold an API key for each selectable provider.
PROVIDER_KEY_ENV: dict[str, str] = {
    "claude": "ANTHROPIC_API_KEY",
    "openai": "OPENAI_API_KEY",
    "gemini": "GEMINI_API_KEY",
}


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
        case_sensitive=True,
    )

    # ---- Supabase (all required) ----
    SUPABASE_URL: str
    SUPABASE_ANON_KEY: str
    SUPABASE_JWT_SECRET: str
    # Present for completeness; deliberately unused in this MVP. Every query
    # runs through the caller's JWT so RLS stays in force.
    SUPABASE_SERVICE_ROLE_KEY: str | None = None

    # ---- AI ----
    AI_PROVIDER: AIProviderName = "claude"
    ANTHROPIC_API_KEY: str | None = None
    OPENAI_API_KEY: str | None = None
    GEMINI_API_KEY: str | None = None
    AI_MODEL_OVERRIDE: str | None = None
    AI_TIMEOUT_SECONDS: int = 120
    AI_MAX_RETRIES: int = 1

    # ---- App ----
    CORS_ORIGINS: list[str] = Field(default_factory=lambda: ["http://localhost:5173"])
    RATE_LIMIT_GENERATE_PER_HOUR: int = 10
    RATE_LIMIT_REGENERATE_PER_HOUR: int = 40
    LOG_LEVEL: str = "INFO"
    ENVIRONMENT: str = "development"
    APP_VERSION: str = "0.1.0"

    # ---- Input caps (see SECURITY in the README) ----
    MAX_FIELD_CHARS: int = 5_000
    MAX_TOTAL_INPUT_CHARS: int = 50_000

    @field_validator("CORS_ORIGINS", mode="before")
    @classmethod
    def _split_origins(cls, v: object) -> object:
        """Accept ``a,b,c`` from the environment as well as a JSON list."""
        if isinstance(v, str):
            stripped = v.strip()
            if stripped.startswith("["):
                return v  # let pydantic parse it as JSON
            return [origin.strip() for origin in stripped.split(",") if origin.strip()]
        return v

    @field_validator("SUPABASE_URL")
    @classmethod
    def _validate_supabase_url(cls, v: str) -> str:
        if not v.startswith(("http://", "https://")):
            raise ValueError("must start with http:// or https://")
        return v.rstrip("/")

    @model_validator(mode="after")
    def _require_key_for_selected_provider(self) -> Settings:
        """The provider we are actually going to call must have a key."""
        env_name = PROVIDER_KEY_ENV[self.AI_PROVIDER]
        if not getattr(self, env_name, None):
            raise ValueError(
                f"AI_PROVIDER is '{self.AI_PROVIDER}' but {env_name} is not set. "
                f"Set {env_name} in backend/.env, or change AI_PROVIDER."
            )
        return self

    @model_validator(mode="after")
    def _warn_on_wildcard_cors(self) -> Settings:
        if self.ENVIRONMENT != "development" and "*" in self.CORS_ORIGINS:
            raise ValueError("CORS_ORIGINS may not contain '*' outside development")
        return self

    @property
    def active_provider_key(self) -> str:
        """The API key for the currently selected provider. Never logged."""
        return getattr(self, PROVIDER_KEY_ENV[self.AI_PROVIDER])

    @property
    def is_development(self) -> bool:
        return self.ENVIRONMENT == "development"


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    """Cached accessor. Import this rather than instantiating ``Settings``."""
    return Settings()  # type: ignore[call-arg]


try:
    settings = get_settings()
except ValidationError as exc:  # pragma: no cover - startup path
    missing = [
        ".".join(str(p) for p in err["loc"]) or "(config)"
        for err in exc.errors()
    ]
    sys.stderr.write(
        "\n"
        "=========================================================\n"
        " Configuration error - the backend cannot start.\n"
        "=========================================================\n"
        f" Problem with: {', '.join(missing)}\n\n"
        f"{exc}\n\n"
        " Fix: copy backend/.env.example to backend/.env and fill\n"
        " in the values. See the README for where to find each one.\n"
        "=========================================================\n\n"
    )
    raise SystemExit(1) from exc
