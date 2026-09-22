"""Profile endpoints, backing the settings page.

Every query here goes through the caller-scoped Supabase client, so RLS
restricts each one to the caller's own row. The user id comes from the
verified JWT - never from the request body.
"""

from __future__ import annotations

import logging

from fastapi import APIRouter, status

from app.core.errors import DatabaseError, NotFoundError
from app.deps import CurrentUserDep, SupabaseDep
from app.models.requests import UpdateProfileRequest
from app.models.responses import DeleteAccountDataResponse, ProfileResponse

logger = logging.getLogger("prd.profile")

router = APIRouter(prefix="/api/profile", tags=["profile"])


@router.get("", response_model=ProfileResponse)
async def get_profile(user: CurrentUserDep, db: SupabaseDep) -> ProfileResponse:
    """The caller's profile row, created by the signup trigger."""
    try:
        result = db.table("profiles").select("*").eq("id", user.id).limit(1).execute()
    except Exception as exc:
        logger.warning("profile read failed: %s", exc)
        raise DatabaseError() from exc

    if not result.data:
        # The handle_new_user() trigger should have created this at signup.
        # Missing means the trigger was not installed - see verify_setup.sql.
        raise NotFoundError(
            "We couldn't find your profile. If this persists, the signup "
            "trigger may be missing from the database."
        )

    return ProfileResponse.model_validate(result.data[0])


@router.patch("", response_model=ProfileResponse)
async def update_profile(
    body: UpdateProfileRequest, user: CurrentUserDep, db: SupabaseDep
) -> ProfileResponse:
    """Update the display name.

    Email is deliberately not editable here: changing it goes through
    Supabase Auth's own confirmation flow, not a plain table write.
    """
    if body.full_name is None:
        return await get_profile(user, db)

    try:
        result = (
            db.table("profiles")
            .update({"full_name": body.full_name.strip() or None})
            .eq("id", user.id)
            .execute()
        )
    except Exception as exc:
        logger.warning("profile update failed: %s", exc)
        raise DatabaseError() from exc

    if not result.data:
        raise NotFoundError()

    return ProfileResponse.model_validate(result.data[0])


@router.delete("/data", status_code=status.HTTP_200_OK)
async def delete_account_data(
    user: CurrentUserDep, db: SupabaseDep
) -> DeleteAccountDataResponse:
    """Delete every PRD belonging to the caller. Irreversible.

    This deliberately does NOT remove the auth account itself. Doing that
    requires Supabase's admin API and therefore the service role key, which
    this MVP does not use - see the README's security notes. The settings
    page labels this accurately rather than promising more than it does.
    """
    try:
        result = db.table("prds").delete().eq("user_id", user.id).execute()
    except Exception as exc:
        logger.warning("account data deletion failed: %s", exc)
        raise DatabaseError() from exc

    deleted = len(result.data or [])
    logger.info("Deleted %s PRDs for user %s", deleted, user.id)

    return DeleteAccountDataResponse(
        deleted_prd_count=deleted,
        auth_account_removed=False,
    )
