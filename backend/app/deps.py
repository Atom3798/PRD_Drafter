"""Shared FastAPI dependencies: JWT verification and the per-request DB client.

The important idea in this file is ``get_supabase_client``. It builds a
Supabase client authenticated **as the calling user**, using their JWT and the
anon key - never the service role key. Every query therefore runs under Row
Level Security, so a forgotten ``.eq("user_id", ...)`` in application code
cannot leak another user's data. RLS is the enforcement boundary; application
code is only the first line.
"""

from __future__ import annotations

import logging
from typing import Annotated

from fastapi import Depends, Request
from jose import JWTError, jwt
from pydantic import BaseModel
from supabase import Client, create_client

from app.config import settings
from app.core.errors import AuthError

logger = logging.getLogger("prd.auth")

#: Supabase signs user tokens with this audience claim.
_EXPECTED_AUDIENCE = "authenticated"
_ALGORITHM = "HS256"


class CurrentUser(BaseModel):
    """The authenticated caller, derived solely from verified JWT claims.

    A ``user_id`` in a request body is never trusted - only this.
    """

    id: str
    email: str | None = None
    role: str | None = None


def get_bearer_token(request: Request) -> str:
    """Pull the raw token out of the Authorization header."""
    header = request.headers.get("Authorization") or request.headers.get(
        "authorization"
    )
    if not header:
        raise AuthError("Missing Authorization header.")

    scheme, _, token = header.partition(" ")
    if scheme.lower() != "bearer" or not token.strip():
        raise AuthError("Authorization header must be 'Bearer <token>'.")
    return token.strip()


BearerToken = Annotated[str, Depends(get_bearer_token)]


def get_current_user(token: BearerToken) -> CurrentUser:
    """Verify signature, expiry and audience; return the caller's identity."""
    try:
        claims = jwt.decode(
            token,
            settings.SUPABASE_JWT_SECRET,
            algorithms=[_ALGORITHM],
            audience=_EXPECTED_AUDIENCE,
            options={"require_exp": True, "require_sub": True},
        )
    except JWTError as exc:
        # Deliberately vague to the client; the reason is logged, not returned.
        logger.info("JWT rejected: %s", type(exc).__name__)
        raise AuthError("Your session is invalid or has expired.") from exc

    subject = claims.get("sub")
    if not subject:
        raise AuthError("Token is missing a subject claim.")

    return CurrentUser(
        id=subject,
        email=claims.get("email"),
        role=claims.get("role"),
    )


CurrentUserDep = Annotated[CurrentUser, Depends(get_current_user)]


def get_supabase_client(token: BearerToken) -> Client:
    """A Supabase client scoped to the caller, so RLS applies to every query."""
    client = create_client(settings.SUPABASE_URL, settings.SUPABASE_ANON_KEY)
    client.postgrest.auth(token)
    return client


SupabaseDep = Annotated[Client, Depends(get_supabase_client)]


def get_anon_supabase_client() -> Client:
    """Unauthenticated client, for health checks only.

    Carries no user context, so RLS will refuse it any row. That is fine -
    the health check only needs to prove the database answers.
    """
    return create_client(settings.SUPABASE_URL, settings.SUPABASE_ANON_KEY)
