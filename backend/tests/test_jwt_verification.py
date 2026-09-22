"""Asymmetric (ES256) token verification and the attacks it must refuse.

Supabase signs user tokens with an asymmetric key and publishes the public
half as a JWKS. These tests mint real ES256 tokens against a generated key
pair, so the verification path is exercised end to end rather than mocked.

The attack cases matter more than the happy path. In particular
`test_hs256_header_cannot_reuse_an_asymmetric_token` covers algorithm
confusion: a token that claims HS256 while carrying an ES256 payload, hoping
the server will verify it using the public key as an HMAC secret. Our
verification picks the key from the token's `alg`, which is only safe because
each branch restricts `algorithms` to its own scheme - this test is what
proves that restriction is real.
"""

from __future__ import annotations

import base64
import json
import time
from typing import Any

import pytest
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import ec
from fastapi.testclient import TestClient
from jose import jwt

from app.core.jwks import JwksCache
from app.deps import get_supabase_client
from app.main import app
from tests.conftest import TEST_JWT_SECRET
from tests.test_auth import PROFILE_ROW, PROTECTED_URL

USER_ID = "33333333-3333-4333-8333-333333333333"
KID = "test-signing-key"


def b64url(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode()


@pytest.fixture(scope="module")
def keypair() -> tuple[Any, dict[str, Any]]:
    """An EC P-256 key pair plus its public half as a JWK."""
    private_key = ec.generate_private_key(ec.SECP256R1())
    numbers = private_key.public_key().public_numbers()

    jwk = {
        "kty": "EC",
        "crv": "P-256",
        "kid": KID,
        "alg": "ES256",
        "use": "sig",
        "x": b64url(numbers.x.to_bytes(32, "big")),
        "y": b64url(numbers.y.to_bytes(32, "big")),
    }
    return private_key, jwk


@pytest.fixture(autouse=True)
def jwks_serving_our_key(keypair: tuple[Any, dict[str, Any]], monkeypatch):
    """Point the verifier's cache at our generated key, no network needed."""
    _, jwk = keypair

    cache = JwksCache("http://test.invalid")
    cache._keys = {KID: jwk}  # noqa: SLF001 - test seam
    cache._fetched_at = time.monotonic()  # noqa: SLF001
    monkeypatch.setattr("app.deps._jwks_cache", cache)

    fake_db = _stub_supabase()
    app.dependency_overrides[get_supabase_client] = lambda: fake_db
    yield
    app.dependency_overrides.clear()


def _stub_supabase():
    from unittest.mock import MagicMock

    fake = MagicMock()
    fake.table.return_value.select.return_value.eq.return_value.limit.return_value.execute.return_value = MagicMock(
        data=[{**PROFILE_ROW, "id": USER_ID}]
    )
    return fake


def es256_token(private_key: Any, **overrides: Any) -> str:
    now = int(time.time())
    claims: dict[str, Any] = {
        "sub": USER_ID,
        "email": "es256@example.com",
        "aud": "authenticated",
        "role": "authenticated",
        "iat": now,
        "exp": now + 3600,
    }
    claims.update(overrides)

    pem = private_key.private_bytes(
        encoding=serialization.Encoding.PEM,
        format=serialization.PrivateFormat.PKCS8,
        encryption_algorithm=serialization.NoEncryption(),
    )
    return jwt.encode(claims, pem.decode(), algorithm="ES256", headers={"kid": KID})


# ---------------------------------------------------------------------------
# Accepted
# ---------------------------------------------------------------------------


def test_valid_es256_token_is_accepted(
    client: TestClient, keypair: tuple[Any, dict[str, Any]]
) -> None:
    private_key, _ = keypair
    token = es256_token(private_key)

    response = client.get(PROTECTED_URL, headers={"Authorization": f"Bearer {token}"})

    assert response.status_code == 200


def test_hs256_tokens_still_work_alongside_es256(client: TestClient) -> None:
    """Older projects sign with a shared secret; both must be supported."""
    now = int(time.time())
    token = jwt.encode(
        {
            "sub": USER_ID,
            "aud": "authenticated",
            "iat": now,
            "exp": now + 3600,
        },
        TEST_JWT_SECRET,
        algorithm="HS256",
    )

    response = client.get(PROTECTED_URL, headers={"Authorization": f"Bearer {token}"})

    assert response.status_code == 200


# ---------------------------------------------------------------------------
# Refused
# ---------------------------------------------------------------------------


def test_token_signed_by_a_different_key_is_refused(client: TestClient) -> None:
    other_key = ec.generate_private_key(ec.SECP256R1())

    response = client.get(
        PROTECTED_URL,
        headers={"Authorization": f"Bearer {es256_token(other_key)}"},
    )

    assert response.status_code == 401


def test_unknown_kid_is_refused(
    client: TestClient, keypair: tuple[Any, dict[str, Any]]
) -> None:
    """A kid we cannot resolve must fail closed, not fall through."""
    private_key, _ = keypair
    token = es256_token(private_key)
    header = json.loads(
        base64.urlsafe_b64decode(
            token.split(".")[0] + "=" * (-len(token.split(".")[0]) % 4)
        )
    )
    header["kid"] = "a-key-we-have-never-seen"
    tampered = ".".join(
        [
            b64url(json.dumps(header, separators=(",", ":")).encode()),
            token.split(".")[1],
            token.split(".")[2],
        ]
    )

    response = client.get(PROTECTED_URL, headers={"Authorization": f"Bearer {tampered}"})

    assert response.status_code == 401


def test_tampered_payload_is_refused(
    client: TestClient, keypair: tuple[Any, dict[str, Any]]
) -> None:
    """Swap the subject, keep the signature - privilege escalation attempt."""
    private_key, _ = keypair
    head, payload, signature = es256_token(private_key).split(".")

    claims = json.loads(base64.urlsafe_b64decode(payload + "=" * (-len(payload) % 4)))
    claims["sub"] = "00000000-0000-4000-8000-000000000000"
    forged = f"{head}.{b64url(json.dumps(claims, separators=(',', ':')).encode())}.{signature}"

    response = client.get(PROTECTED_URL, headers={"Authorization": f"Bearer {forged}"})

    assert response.status_code == 401


def test_hs256_header_cannot_reuse_an_asymmetric_token(
    client: TestClient, keypair: tuple[Any, dict[str, Any]]
) -> None:
    """Algorithm confusion.

    Relabel an ES256 token as HS256 and hope the server verifies it with the
    public key as an HMAC secret. Each branch accepts only its own algorithm,
    so this must fail.
    """
    private_key, _ = keypair
    _, payload, signature = es256_token(private_key).split(".")
    forged = (
        b64url(json.dumps({"alg": "HS256", "typ": "JWT"}).encode())
        + f".{payload}.{signature}"
    )

    response = client.get(PROTECTED_URL, headers={"Authorization": f"Bearer {forged}"})

    assert response.status_code == 401


def test_expired_es256_token_is_refused(
    client: TestClient, keypair: tuple[Any, dict[str, Any]]
) -> None:
    private_key, _ = keypair
    token = es256_token(private_key, exp=int(time.time()) - 60)

    response = client.get(PROTECTED_URL, headers={"Authorization": f"Bearer {token}"})

    assert response.status_code == 401


def test_wrong_audience_es256_token_is_refused(
    client: TestClient, keypair: tuple[Any, dict[str, Any]]
) -> None:
    private_key, _ = keypair
    token = es256_token(private_key, aud="some-other-service")

    response = client.get(PROTECTED_URL, headers={"Authorization": f"Bearer {token}"})

    assert response.status_code == 401
