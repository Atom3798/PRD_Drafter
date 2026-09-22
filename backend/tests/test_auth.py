"""JWT verification.

These run without a database: verification is pure signature checking, so
every case here is exercised for real rather than mocked. The database-backed
ownership checks live in test_rls.py.
"""

from __future__ import annotations

from typing import Any
from unittest.mock import MagicMock

import pytest
from fastapi.testclient import TestClient
from jose import jwt

from app.deps import get_supabase_client
from app.main import app
from tests.conftest import TEST_JWT_SECRET, make_token

PROTECTED_URL = "/api/profile"

PROFILE_ROW = {
    "id": "11111111-1111-4111-8111-111111111111",
    "email": "user@example.com",
    "full_name": "Test User",
    "created_at": "2026-01-01T00:00:00+00:00",
}


@pytest.fixture
def db_returning_profile():
    """Stub Supabase so a request can get past the DB and prove auth passed."""
    fake = MagicMock()
    fake.table.return_value.select.return_value.eq.return_value.limit.return_value.execute.return_value = MagicMock(
        data=[PROFILE_ROW]
    )
    app.dependency_overrides[get_supabase_client] = lambda: fake
    yield fake
    app.dependency_overrides.clear()


# ---------------------------------------------------------------------------
# Accepted
# ---------------------------------------------------------------------------


def test_valid_token_is_accepted(client: TestClient, db_returning_profile: Any) -> None:
    response = client.get(
        PROTECTED_URL, headers={"Authorization": f"Bearer {make_token()}"}
    )

    assert response.status_code == 200
    assert response.json()["email"] == "user@example.com"


def test_identity_comes_from_the_token_not_the_request(
    client: TestClient, db_returning_profile: MagicMock
) -> None:
    """The row is looked up by the `sub` claim, never by client-supplied id."""
    token = make_token(user_id="22222222-2222-4222-8222-222222222222")

    client.get(PROTECTED_URL, headers={"Authorization": f"Bearer {token}"})

    eq_call = db_returning_profile.table.return_value.select.return_value.eq
    eq_call.assert_called_once_with("id", "22222222-2222-4222-8222-222222222222")


# ---------------------------------------------------------------------------
# Rejected
# ---------------------------------------------------------------------------


@pytest.mark.parametrize(
    ("label", "headers"),
    [
        ("missing header", {}),
        ("empty header", {"Authorization": ""}),
        ("no scheme", {"Authorization": "abc.def.ghi"}),
        ("wrong scheme", {"Authorization": "Basic dXNlcjpwYXNz"}),
        ("bearer with no token", {"Authorization": "Bearer "}),
        ("malformed token", {"Authorization": "Bearer not-a-jwt"}),
        ("truncated token", {"Authorization": "Bearer eyJhbGciOiJIUzI1NiJ9.abc"}),
    ],
)
def test_bad_authorization_headers_are_rejected(
    client: TestClient, label: str, headers: dict[str, str]
) -> None:
    response = client.get(PROTECTED_URL, headers=headers)

    assert response.status_code == 401, label
    assert response.json()["error"]["code"] == "UNAUTHENTICATED"


def test_expired_token_is_rejected(client: TestClient) -> None:
    token = make_token(expires_in=-60)

    response = client.get(PROTECTED_URL, headers={"Authorization": f"Bearer {token}"})

    assert response.status_code == 401


def test_token_signed_with_the_wrong_secret_is_rejected(client: TestClient) -> None:
    """The forgery case. A token we did not sign must never be honoured."""
    token = make_token(secret="an-attacker-chosen-secret")

    response = client.get(PROTECTED_URL, headers={"Authorization": f"Bearer {token}"})

    assert response.status_code == 401


def test_token_with_wrong_audience_is_rejected(client: TestClient) -> None:
    """Blocks tokens minted by Supabase for a different purpose."""
    token = make_token(audience="some-other-service")

    response = client.get(PROTECTED_URL, headers={"Authorization": f"Bearer {token}"})

    assert response.status_code == 401


def test_token_without_a_subject_is_rejected(client: TestClient) -> None:
    import time

    now = int(time.time())
    token = jwt.encode(
        {"aud": "authenticated", "iat": now, "exp": now + 3600},
        TEST_JWT_SECRET,
        algorithm="HS256",
    )

    response = client.get(PROTECTED_URL, headers={"Authorization": f"Bearer {token}"})

    assert response.status_code == 401


def test_unsigned_token_is_rejected(client: TestClient) -> None:
    """The classic `alg: none` downgrade.

    Hand-assembled rather than built with jose, which refuses to *produce*
    such a token - we need to prove we also refuse to *accept* one.
    """
    import base64
    import json as json_module

    def b64(payload: dict[str, Any]) -> str:
        raw = json_module.dumps(payload, separators=(",", ":")).encode()
        return base64.urlsafe_b64encode(raw).rstrip(b"=").decode()

    token = (
        b64({"alg": "none", "typ": "JWT"})
        + "."
        + b64({"sub": "attacker", "aud": "authenticated", "exp": 9_999_999_999})
        + "."
    )

    response = client.get(PROTECTED_URL, headers={"Authorization": f"Bearer {token}"})

    assert response.status_code == 401


def test_rejection_does_not_explain_why(client: TestClient) -> None:
    """Distinguishing 'expired' from 'bad signature' helps an attacker."""
    expired = client.get(
        PROTECTED_URL,
        headers={"Authorization": f"Bearer {make_token(expires_in=-60)}"},
    )
    forged = client.get(
        PROTECTED_URL,
        headers={"Authorization": f"Bearer {make_token(secret='wrong')}"},
    )

    assert expired.json()["error"]["message"] == forged.json()["error"]["message"]


def test_health_stays_public(client: TestClient) -> None:
    """Auth must not have been applied globally by accident."""
    assert client.get("/api/health").status_code == 200
