"""Row Level Security: user A must not be able to reach user B's data.

This is the one test in the suite that cannot be faked. RLS is enforced by
Postgres, so proving it works means talking to a real Postgres. Everything
here is therefore marked `integration` and skips when no database is
configured.

It runs against either a local Supabase (`supabase start`) or a cloud
project - it only needs credentials in `backend/.env`.

    pytest -m integration

Why this matters: the backend queries as the calling user rather than with
the service role key, so these policies are the ownership boundary. If they
are wrong, every other safeguard in the app is decorative.
"""

from __future__ import annotations

import contextlib
import time
import uuid
from pathlib import Path
from typing import Any

import pytest

pytestmark = pytest.mark.integration

ENV_FILE = Path(__file__).resolve().parents[1] / ".env"
PLACEHOLDERS = ("xxxx", "your-jwt-secret", "eyJ...", "")


def _load_env_file() -> dict[str, str]:
    """Read backend/.env directly.

    conftest.py puts fake credentials in os.environ for the unit tests, so we
    cannot read them from there - we need the real ones.
    """
    if not ENV_FILE.exists():
        return {}
    values: dict[str, str] = {}
    for line in ENV_FILE.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, value = line.partition("=")
        values[key.strip()] = value.split("#")[0].strip().strip("\"'")
    return values


def _real_credentials() -> tuple[str, str] | None:
    env = _load_env_file()
    url = env.get("SUPABASE_URL", "")
    anon = env.get("SUPABASE_ANON_KEY", "")
    if not url or not anon:
        return None
    if any(p and p in url for p in PLACEHOLDERS[:1]):
        return None
    if anon in PLACEHOLDERS or url in PLACEHOLDERS:
        return None
    return url, anon


CREDENTIALS = _real_credentials()

requires_database = pytest.mark.skipif(
    CREDENTIALS is None,
    reason=(
        "No Supabase credentials in backend/.env. Run `supabase start` for a "
        "local stack, or point .env at a cloud project, then re-run with "
        "`pytest -m integration`."
    ),
)


def _signed_in_client(email: str, password: str) -> Any:
    """Create a user and return a client authenticated as them."""
    from supabase import create_client

    assert CREDENTIALS is not None
    url, anon = CREDENTIALS
    client = create_client(url, anon)

    try:
        client.auth.sign_up({"email": email, "password": password})
    except Exception as exc:  # already registered is fine; anything else is not
        if "already" not in str(exc).lower():
            raise

    try:
        session = client.auth.sign_in_with_password(
            {"email": email, "password": password}
        )
    except Exception as exc:
        pytest.skip(
            "Could not sign in a test user. If this says the email needs "
            "confirming, disable email confirmation for local development "
            f"(Auth > Providers > Email). Original error: {exc}"
        )

    if not session or not session.session:
        pytest.skip("Sign-in returned no session; email confirmation is likely on.")

    client.postgrest.auth(session.session.access_token)
    return client


@pytest.fixture(scope="module")
def user_a() -> Any:
    stamp = f"{int(time.time())}-{uuid.uuid4().hex[:6]}"
    return _signed_in_client(f"rls-a-{stamp}@example.com", "test-password-a-123!")


@pytest.fixture(scope="module")
def user_b() -> Any:
    stamp = f"{int(time.time())}-{uuid.uuid4().hex[:6]}"
    return _signed_in_client(f"rls-b-{stamp}@example.com", "test-password-b-123!")


@pytest.fixture
def prd_owned_by_a(user_a: Any) -> Any:
    """A PRD belonging to user A, cleaned up afterwards."""
    created = (
        user_a.table("prds")
        .insert({"title": "User A's private PRD", "inputs": {"idea": "secret"}})
        .execute()
    )
    assert created.data, "user A could not create their own PRD"
    prd = created.data[0]
    yield prd
    with contextlib.suppress(Exception):
        user_a.table("prds").delete().eq("id", prd["id"]).execute()


# ---------------------------------------------------------------------------
# The owner can do everything
# ---------------------------------------------------------------------------


@requires_database
def test_owner_can_read_their_own_prd(user_a: Any, prd_owned_by_a: Any) -> None:
    result = user_a.table("prds").select("*").eq("id", prd_owned_by_a["id"]).execute()
    assert len(result.data) == 1


@requires_database
def test_owner_can_update_their_own_prd(user_a: Any, prd_owned_by_a: Any) -> None:
    result = (
        user_a.table("prds")
        .update({"title": "Renamed by the owner"})
        .eq("id", prd_owned_by_a["id"])
        .execute()
    )
    assert result.data[0]["title"] == "Renamed by the owner"


# ---------------------------------------------------------------------------
# Nobody else can do anything. This is the point of the file.
# ---------------------------------------------------------------------------


@requires_database
def test_other_user_cannot_read_the_prd(user_b: Any, prd_owned_by_a: Any) -> None:
    """RLS filters rather than errors, so 'not found' is the correct outcome."""
    result = user_b.table("prds").select("*").eq("id", prd_owned_by_a["id"]).execute()
    assert result.data == [], "user B could read user A's PRD"


@requires_database
def test_other_user_cannot_see_it_in_a_list(user_b: Any, prd_owned_by_a: Any) -> None:
    result = user_b.table("prds").select("id").execute()
    visible = {row["id"] for row in result.data}
    assert prd_owned_by_a["id"] not in visible


@requires_database
def test_other_user_cannot_update_the_prd(
    user_a: Any, user_b: Any, prd_owned_by_a: Any
) -> None:
    user_b.table("prds").update({"title": "Hijacked"}).eq(
        "id", prd_owned_by_a["id"]
    ).execute()

    after = user_a.table("prds").select("title").eq("id", prd_owned_by_a["id"]).execute()
    assert after.data[0]["title"] != "Hijacked", "user B modified user A's PRD"


@requires_database
def test_other_user_cannot_delete_the_prd(
    user_a: Any, user_b: Any, prd_owned_by_a: Any
) -> None:
    user_b.table("prds").delete().eq("id", prd_owned_by_a["id"]).execute()

    after = user_a.table("prds").select("id").eq("id", prd_owned_by_a["id"]).execute()
    assert len(after.data) == 1, "user B deleted user A's PRD"


@requires_database
def test_other_user_cannot_create_a_prd_owned_by_someone_else(
    user_a: Any, user_b: Any
) -> None:
    """The insert policy's `with check` must stop forged ownership."""
    a_id = user_a.auth.get_user().user.id

    try:
        result = (
            user_b.table("prds").insert({"title": "Planted", "user_id": a_id}).execute()
        )
        inserted = result.data
    except Exception:
        # Postgres refusing the write is the expected path.
        inserted = []

    assert not inserted, "user B created a PRD owned by user A"


@requires_database
def test_other_user_cannot_read_version_history(
    user_a: Any, user_b: Any, prd_owned_by_a: Any
) -> None:
    user_a.table("prd_versions").insert(
        {
            "prd_id": prd_owned_by_a["id"],
            "version_number": 1,
            "content": {"executive_summary": "private"},
            "change_summary": "initial",
        }
    ).execute()

    result = (
        user_b.table("prd_versions")
        .select("*")
        .eq("prd_id", prd_owned_by_a["id"])
        .execute()
    )
    assert result.data == [], "user B read user A's version history"


@requires_database
def test_other_user_cannot_read_a_profile(user_a: Any, user_b: Any) -> None:
    a_id = user_a.auth.get_user().user.id

    result = user_b.table("profiles").select("*").eq("id", a_id).execute()
    assert result.data == [], "user B read user A's profile"


@requires_database
def test_signup_created_a_profile_row(user_a: Any) -> None:
    """Guards the handle_new_user() trigger from silently going missing."""
    a_id = user_a.auth.get_user().user.id

    result = user_a.table("profiles").select("*").eq("id", a_id).execute()
    assert len(result.data) == 1, "no profile row - is the signup trigger installed?"


# ---------------------------------------------------------------------------
# Anonymous access
# ---------------------------------------------------------------------------


@requires_database
def test_anonymous_client_can_read_nothing(prd_owned_by_a: Any) -> None:
    """The anon key is public. Without a JWT it must reach no rows at all."""
    from supabase import create_client

    assert CREDENTIALS is not None
    anon_client = create_client(*CREDENTIALS)

    result = anon_client.table("prds").select("*").execute()
    assert result.data == [], "the anon key alone could read PRDs"
