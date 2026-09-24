"""PRD persistence.

Every function here takes a Supabase client already authenticated as the
caller, so RLS scopes each query to that user's rows. The explicit
``.eq("user_id", ...)`` filters are belt-and-braces: if one were ever dropped,
RLS would still refuse the row. That ordering matters - the database is the
boundary, this module is the convenience layer on top of it.
"""

from __future__ import annotations

import logging
from typing import Any
from uuid import UUID

from supabase import Client

from app.core.errors import DatabaseError, NotFoundError
from app.models.prd import (
    Prd,
    PrdContent,
    PrdStatus,
    PrdSummary,
    PrdVersionSummary,
)
from app.models.requests import UpdatePrdRequest

logger = logging.getLogger("prd.service")

TABLE = "prds"
VERSIONS_TABLE = "prd_versions"

#: Columns the dashboard needs. Deliberately excludes `inputs` and `content`,
#: which are large and never rendered in a list.
SUMMARY_COLUMNS = "id, title, status, created_at, updated_at, content"

MAX_PAGE_SIZE = 100


def _to_prd(row: dict[str, Any]) -> Prd:
    return Prd.model_validate(row)


def _to_summary(row: dict[str, Any]) -> PrdSummary:
    """Build a list item, counting populated sections from the content blob."""
    content = row.get("content")
    section_count = 0
    if content:
        try:
            section_count = PrdContent.model_validate(content).populated_section_count()
        except Exception:  # noqa: BLE001 - a malformed blob must not break the list
            logger.warning("Unreadable content on PRD %s", row.get("id"))

    return PrdSummary(
        id=row["id"],
        title=row["title"],
        status=row["status"],
        created_at=row["created_at"],
        updated_at=row["updated_at"],
        section_count=section_count,
    )


def _escape_search(term: str) -> str:
    """Neutralise PostgREST's ILIKE wildcards so a search for '%' is literal."""
    return term.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")


# ---------------------------------------------------------------------------
# Reads
# ---------------------------------------------------------------------------


def list_prds(
    db: Client,
    user_id: str,
    *,
    search: str | None = None,
    status: PrdStatus | None = None,
    limit: int = 20,
    offset: int = 0,
) -> tuple[list[PrdSummary], int]:
    """A page of the caller's PRDs, newest first, plus the total match count."""
    limit = max(1, min(limit, MAX_PAGE_SIZE))
    offset = max(0, offset)

    try:
        query = (
            db.table(TABLE)
            .select(SUMMARY_COLUMNS, count="exact")
            .eq("user_id", user_id)
        )
        if search and search.strip():
            query = query.ilike("title", f"%{_escape_search(search.strip())}%")
        if status is not None:
            query = query.eq("status", status.value)

        result = (
            query.order("updated_at", desc=True)
            .range(offset, offset + limit - 1)
            .execute()
        )
    except Exception as exc:
        logger.warning("PRD list failed: %s", exc)
        raise DatabaseError() from exc

    items = [_to_summary(row) for row in (result.data or [])]
    total = result.count if result.count is not None else len(items)
    return items, total


def get_prd(db: Client, prd_id: UUID | str, user_id: str) -> Prd:
    """One PRD in full. Raises NotFoundError when missing OR not the caller's.

    The two cases are deliberately indistinguishable: confirming that an id
    exists but belongs to someone else leaks information.
    """
    try:
        result = (
            db.table(TABLE)
            .select("*")
            .eq("id", str(prd_id))
            .eq("user_id", user_id)
            .limit(1)
            .execute()
        )
    except Exception as exc:
        logger.warning("PRD fetch failed: %s", exc)
        raise DatabaseError() from exc

    if not result.data:
        raise NotFoundError()
    return _to_prd(result.data[0])


# ---------------------------------------------------------------------------
# Writes
# ---------------------------------------------------------------------------


def create_prd(db: Client, user_id: str, title: str | None = None) -> Prd:
    """A fresh draft. The wizard starts writing into it immediately."""
    payload = {
        # Set explicitly from the verified JWT rather than relying on the
        # column default, so the row's owner is obvious at the call site.
        "user_id": user_id,
        "title": (title or "").strip() or "Untitled PRD",
        "status": PrdStatus.DRAFT.value,
        "inputs": {},
        "assumptions": [],
        "wizard_step": 1,
    }

    try:
        result = db.table(TABLE).insert(payload).execute()
    except Exception as exc:
        logger.warning("PRD create failed: %s", exc)
        raise DatabaseError() from exc

    if not result.data:
        raise DatabaseError("The PRD could not be created.")
    return _to_prd(result.data[0])


def update_prd(
    db: Client, prd_id: UUID | str, user_id: str, patch: UpdatePrdRequest
) -> Prd:
    """Apply a partial update, merging JSONB rather than replacing it.

    This is the autosave path. A PATCH carrying one wizard answer must leave
    the other eighteen alone, so `inputs` and `content` are read, merged and
    written back instead of overwriting the column.
    """
    if not patch.has_changes():
        return get_prd(db, prd_id, user_id)

    current = get_prd(db, prd_id, user_id)

    payload: dict[str, Any] = {}
    if patch.title is not None:
        payload["title"] = patch.title
    if patch.wizard_step is not None:
        payload["wizard_step"] = patch.wizard_step
    if patch.inputs is not None:
        payload["inputs"] = {**current.inputs.model_dump(), **patch.inputs}
    if patch.content is not None:
        existing = current.content.model_dump() if current.content else {}
        payload["content"] = {**existing, **patch.content}

    try:
        result = (
            db.table(TABLE)
            .update(payload)
            .eq("id", str(prd_id))
            .eq("user_id", user_id)
            .execute()
        )
    except Exception as exc:
        logger.warning("PRD update failed: %s", exc)
        raise DatabaseError() from exc

    if not result.data:
        raise NotFoundError()
    return _to_prd(result.data[0])


def delete_prd(db: Client, prd_id: UUID | str, user_id: str) -> None:
    """Delete a PRD. Versions cascade via the foreign key."""
    try:
        result = (
            db.table(TABLE)
            .delete()
            .eq("id", str(prd_id))
            .eq("user_id", user_id)
            .execute()
        )
    except Exception as exc:
        logger.warning("PRD delete failed: %s", exc)
        raise DatabaseError() from exc

    if not result.data:
        raise NotFoundError()


def duplicate_prd(db: Client, prd_id: UUID | str, user_id: str) -> Prd:
    """Copy a PRD's inputs and content under a new id.

    Version history is deliberately NOT copied: the duplicate is a new
    document, and inheriting another PRD's history would make "restore"
    reach back into a document the user never edited.
    """
    source = get_prd(db, prd_id, user_id)

    payload = {
        "user_id": user_id,
        "title": f"{source.title} (copy)"[:200],
        "status": source.status.value,
        "inputs": source.inputs.model_dump(),
        "content": source.content.model_dump() if source.content else None,
        "assumptions": [a.model_dump() for a in source.assumptions],
        "wizard_step": source.wizard_step,
        "provider": source.provider,
        "model": source.model,
    }

    try:
        result = db.table(TABLE).insert(payload).execute()
    except Exception as exc:
        logger.warning("PRD duplicate failed: %s", exc)
        raise DatabaseError() from exc

    if not result.data:
        raise DatabaseError("The PRD could not be duplicated.")
    return _to_prd(result.data[0])


# ---------------------------------------------------------------------------
# Versions
# ---------------------------------------------------------------------------


def list_versions(
    db: Client, prd_id: UUID | str, user_id: str
) -> list[PrdVersionSummary]:
    """Snapshot history, newest first. Ownership checked via the parent PRD."""
    get_prd(db, prd_id, user_id)

    try:
        result = (
            db.table(VERSIONS_TABLE)
            .select("id, version_number, change_summary, created_at")
            .eq("prd_id", str(prd_id))
            .order("version_number", desc=True)
            .execute()
        )
    except Exception as exc:
        logger.warning("Version list failed: %s", exc)
        raise DatabaseError() from exc

    return [PrdVersionSummary.model_validate(row) for row in (result.data or [])]


def next_version_number(db: Client, prd_id: UUID | str) -> int:
    try:
        result = (
            db.table(VERSIONS_TABLE)
            .select("version_number")
            .eq("prd_id", str(prd_id))
            .order("version_number", desc=True)
            .limit(1)
            .execute()
        )
    except Exception as exc:
        logger.warning("Version number lookup failed: %s", exc)
        raise DatabaseError() from exc

    if not result.data:
        return 1
    return int(result.data[0]["version_number"]) + 1


def snapshot_version(
    db: Client,
    prd_id: UUID | str,
    content: PrdContent,
    change_summary: str,
) -> int:
    """Append an immutable snapshot. Taken on generate and regenerate only."""
    version_number = next_version_number(db, prd_id)

    try:
        db.table(VERSIONS_TABLE).insert(
            {
                "prd_id": str(prd_id),
                "version_number": version_number,
                "content": content.model_dump(),
                "change_summary": change_summary,
            }
        ).execute()
    except Exception as exc:
        logger.warning("Version snapshot failed: %s", exc)
        raise DatabaseError() from exc

    return version_number
