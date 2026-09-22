"""JWKS fetching and caching, for asymmetrically-signed Supabase JWTs.

Supabase now signs user tokens with an asymmetric signing key (ES256 by
default) and publishes the public half at
``/auth/v1/.well-known/jwks.json``. Older projects used a shared HS256 secret
instead. Both are still in the wild, so `deps.py` picks a path based on the
token's own ``alg`` header and this module serves the asymmetric side.

The key set is cached because it changes only on key rotation, and fetching
it on every request would put an HTTP round trip in front of every API call.
A token whose ``kid`` is unknown triggers exactly one refetch, which is what
makes rotation work without a restart.
"""

from __future__ import annotations

import logging
import threading
import time
from typing import Any

import httpx

logger = logging.getLogger("prd.jwks")

#: Long enough to keep the cache useful, short enough that a rotation heals
#: on its own even if no unknown-kid refetch is triggered.
CACHE_TTL_SECONDS = 600
_FETCH_TIMEOUT_SECONDS = 5.0

#: Signature algorithms we will accept. Deliberately excludes "none".
SUPPORTED_ASYMMETRIC_ALGORITHMS = frozenset({"ES256", "RS256", "ES384", "RS384"})


class JwksError(RuntimeError):
    """The key set could not be fetched or did not contain the needed key."""


class JwksCache:
    """Thread-safe cache of one project's JWKS."""

    def __init__(self, supabase_url: str) -> None:
        self._url = f"{supabase_url.rstrip('/')}/auth/v1/.well-known/jwks.json"
        self._keys: dict[str, dict[str, Any]] = {}
        self._fetched_at: float = 0.0
        self._lock = threading.Lock()

    @property
    def _is_stale(self) -> bool:
        return (time.monotonic() - self._fetched_at) > CACHE_TTL_SECONDS

    def get_key(self, kid: str | None) -> dict[str, Any]:
        """Public key for ``kid``, refetching once if it is unknown."""
        key = self._lookup(kid)
        if key is not None and not self._is_stale:
            return key

        self.refresh()

        key = self._lookup(kid)
        if key is None:
            raise JwksError(
                f"No signing key matching kid={kid!r} in the project's key set."
            )
        return key

    def _lookup(self, kid: str | None) -> dict[str, Any] | None:
        with self._lock:
            if not self._keys:
                return None
            if kid is None:
                # A single-key set is unambiguous; more than one needs a kid.
                if len(self._keys) == 1:
                    return next(iter(self._keys.values()))
                return None
            return self._keys.get(kid)

    def refresh(self) -> None:
        try:
            response = httpx.get(self._url, timeout=_FETCH_TIMEOUT_SECONDS)
            response.raise_for_status()
            payload = response.json()
        except (httpx.HTTPError, ValueError) as exc:
            raise JwksError(f"Could not fetch the key set: {exc}") from exc

        keys = {
            key["kid"]: key
            for key in payload.get("keys", [])
            if isinstance(key, dict) and key.get("kid")
        }
        if not keys:
            raise JwksError("The project's key set is empty.")

        with self._lock:
            self._keys = keys
            self._fetched_at = time.monotonic()

        logger.info("Loaded %s signing key(s) from the project key set.", len(keys))

    def clear(self) -> None:
        """Drop the cache. Used by tests."""
        with self._lock:
            self._keys = {}
            self._fetched_at = 0.0
