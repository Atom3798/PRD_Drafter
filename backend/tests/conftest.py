"""Shared pytest fixtures.

`app.config` builds its `Settings` object at import time and raises if a
required variable is missing. So fake credentials must be in the environment
*before* anything under `app.` is imported — which is why this block runs at
module level, above the app imports, rather than inside a fixture.
"""

from __future__ import annotations

import os

# ---- fake env, set before app import ----------------------------------------
# A syntactically valid but meaningless HS256 secret. Tests that need a real
# token mint one with this same secret, so verification round-trips.
TEST_JWT_SECRET = "test-jwt-secret-not-a-real-one-0123456789"

os.environ.setdefault("SUPABASE_URL", "https://test-project.supabase.co")
os.environ.setdefault("SUPABASE_ANON_KEY", "test-anon-key-0123456789abcdef")
os.environ.setdefault("SUPABASE_JWT_SECRET", TEST_JWT_SECRET)
os.environ.setdefault("AI_PROVIDER", "claude")
os.environ.setdefault("ANTHROPIC_API_KEY", "test-anthropic-key")
os.environ.setdefault("ENVIRONMENT", "development")
os.environ.setdefault("LOG_LEVEL", "WARNING")

import time  # noqa: E402
from collections.abc import Iterator  # noqa: E402
from typing import Any  # noqa: E402

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402
from jose import jwt  # noqa: E402

from app.main import app  # noqa: E402


@pytest.fixture
def client() -> Iterator[TestClient]:
    """A TestClient that does not raise on server errors.

    `raise_server_exceptions=False` lets the registered exception handlers
    produce their JSON envelope, which is what we actually want to assert on.
    """
    with TestClient(app, raise_server_exceptions=False) as test_client:
        yield test_client


def make_token(
    *,
    user_id: str = "11111111-1111-4111-8111-111111111111",
    email: str = "user@example.com",
    expires_in: int = 3600,
    secret: str = TEST_JWT_SECRET,
    audience: str = "authenticated",
    **overrides: Any,
) -> str:
    """Mint a Supabase-shaped JWT. Defaults produce a valid one."""
    now = int(time.time())
    claims: dict[str, Any] = {
        "sub": user_id,
        "email": email,
        "aud": audience,
        "role": "authenticated",
        "iat": now,
        "exp": now + expires_in,
    }
    claims.update(overrides)
    return jwt.encode(claims, secret, algorithm="HS256")


@pytest.fixture
def auth_headers() -> dict[str, str]:
    return {"Authorization": f"Bearer {make_token()}"}
