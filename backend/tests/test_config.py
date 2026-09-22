"""Settings parsing, especially from a real .env file.

The dotenv path is tested separately from plain environment variables because
pydantic-settings treats them differently: a list-typed field read from a
dotenv file is JSON-decoded before any validator runs. That difference caused
a real startup failure - `CORS_ORIGINS=http://localhost:5173` is perfectly
valid config but is not valid JSON - and it only appeared once an actual .env
existed, not in any test using env vars.
"""

from __future__ import annotations

from pathlib import Path

import pytest
from pydantic import ValidationError

from app.config import Settings

BASE_ENV = """\
SUPABASE_URL=http://127.0.0.1:54321
SUPABASE_ANON_KEY=test-anon-key-0123456789abcdef
SUPABASE_JWT_SECRET=test-jwt-secret-0123456789
AI_PROVIDER=claude
ANTHROPIC_API_KEY=test-key
"""


def write_env(tmp_path: Path, extra: str = "") -> Path:
    env_file = tmp_path / ".env"
    env_file.write_text(BASE_ENV + extra, encoding="utf-8")
    return env_file


#: conftest puts fake values in os.environ for the rest of the suite, and env
#: vars outrank a dotenv file. These tests are about the FILE, so the vars have
#: to be cleared or they would silently mask what the file says.
MANAGED_VARS = (
    "SUPABASE_URL",
    "SUPABASE_ANON_KEY",
    "SUPABASE_JWT_SECRET",
    "SUPABASE_SERVICE_ROLE_KEY",
    "AI_PROVIDER",
    "ANTHROPIC_API_KEY",
    "OPENAI_API_KEY",
    "GEMINI_API_KEY",
    "CORS_ORIGINS",
    "ENVIRONMENT",
)


@pytest.fixture(autouse=True)
def isolate_environment(monkeypatch: pytest.MonkeyPatch) -> None:
    for name in MANAGED_VARS:
        monkeypatch.delenv(name, raising=False)


def load(tmp_path: Path, extra: str = "") -> Settings:
    return Settings(_env_file=write_env(tmp_path, extra))  # type: ignore[call-arg]


# ---------------------------------------------------------------------------
# CORS_ORIGINS - the regression this file exists for
# ---------------------------------------------------------------------------


def test_single_origin_from_dotenv(tmp_path: Path) -> None:
    """The exact line that used to crash the backend on startup."""
    settings = load(tmp_path, "CORS_ORIGINS=http://localhost:5173\n")

    assert settings.CORS_ORIGINS == ["http://localhost:5173"]


def test_comma_separated_origins_from_dotenv(tmp_path: Path) -> None:
    settings = load(
        tmp_path, "CORS_ORIGINS=http://localhost:5173,http://localhost:4173\n"
    )

    assert settings.CORS_ORIGINS == [
        "http://localhost:5173",
        "http://localhost:4173",
    ]


def test_origins_tolerate_surrounding_whitespace(tmp_path: Path) -> None:
    settings = load(
        tmp_path, "CORS_ORIGINS= http://localhost:5173 , http://localhost:4173 \n"
    )

    assert settings.CORS_ORIGINS == [
        "http://localhost:5173",
        "http://localhost:4173",
    ]


def test_json_list_of_origins_still_works(tmp_path: Path) -> None:
    settings = load(tmp_path, 'CORS_ORIGINS=["http://a.test","http://b.test"]\n')

    assert settings.CORS_ORIGINS == ["http://a.test", "http://b.test"]


def test_origins_default_to_the_vite_dev_server(tmp_path: Path) -> None:
    assert load(tmp_path).CORS_ORIGINS == ["http://localhost:5173"]


# ---------------------------------------------------------------------------
# Fail-loud behaviour
# ---------------------------------------------------------------------------


def test_missing_supabase_url_is_rejected(tmp_path: Path) -> None:
    env_file = tmp_path / ".env"
    env_file.write_text(
        BASE_ENV.replace("SUPABASE_URL=http://127.0.0.1:54321\n", ""), encoding="utf-8"
    )

    with pytest.raises(ValidationError, match="SUPABASE_URL"):
        Settings(_env_file=env_file)  # type: ignore[call-arg]


def test_provider_without_its_key_is_rejected(tmp_path: Path) -> None:
    """Choosing gemini with no GEMINI_API_KEY must fail at startup."""
    with pytest.raises(ValidationError, match="GEMINI_API_KEY"):
        load(tmp_path, "AI_PROVIDER=gemini\n")


def test_unknown_provider_is_rejected(tmp_path: Path) -> None:
    with pytest.raises(ValidationError, match="AI_PROVIDER"):
        load(tmp_path, "AI_PROVIDER=llama\n")


def test_trailing_slash_is_stripped_from_supabase_url(tmp_path: Path) -> None:
    """A trailing slash produces doubled slashes in every request path."""
    env_file = tmp_path / ".env"
    env_file.write_text(
        BASE_ENV.replace(
            "SUPABASE_URL=http://127.0.0.1:54321",
            "SUPABASE_URL=http://127.0.0.1:54321/",
        ),
        encoding="utf-8",
    )
    settings = Settings(_env_file=env_file)  # type: ignore[call-arg]

    assert settings.SUPABASE_URL == "http://127.0.0.1:54321"


def test_wildcard_cors_is_refused_outside_development(tmp_path: Path) -> None:
    with pytest.raises(ValidationError, match="CORS_ORIGINS"):
        load(tmp_path, "ENVIRONMENT=production\nCORS_ORIGINS=*\n")


def test_active_provider_key_selects_the_right_one(tmp_path: Path) -> None:
    settings = load(tmp_path, "OPENAI_API_KEY=openai-key\n")

    assert settings.active_provider_key == "test-key"
