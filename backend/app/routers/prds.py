"""PRD CRUD endpoints.

Thin handlers: validation is Pydantic's job, persistence is the service's,
ownership is RLS's. What is left here is HTTP shape.
"""

from __future__ import annotations

import logging
from uuid import UUID

from fastapi import APIRouter, Query, Response, status

from app.deps import CurrentUserDep, SupabaseDep
from app.models.prd import Prd, PrdStatus
from app.models.requests import CreatePrdRequest, UpdatePrdRequest
from app.models.responses import PrdListResponse, VersionListResponse
from app.services import prd_service

logger = logging.getLogger("prd.router")

router = APIRouter(prefix="/api/prds", tags=["prds"])


@router.get("", response_model=PrdListResponse)
async def list_prds(
    user: CurrentUserDep,
    db: SupabaseDep,
    search: str | None = Query(default=None, max_length=200),
    prd_status: PrdStatus | None = Query(default=None, alias="status"),
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
) -> PrdListResponse:
    items, total = prd_service.list_prds(
        db,
        user.id,
        search=search,
        status=prd_status,
        limit=limit,
        offset=offset,
    )
    return PrdListResponse(items=items, total=total)


@router.post("", response_model=Prd, status_code=status.HTTP_201_CREATED)
async def create_prd(
    body: CreatePrdRequest, user: CurrentUserDep, db: SupabaseDep
) -> Prd:
    return prd_service.create_prd(db, user.id, body.title)


@router.get("/{prd_id}", response_model=Prd)
async def get_prd(prd_id: UUID, user: CurrentUserDep, db: SupabaseDep) -> Prd:
    return prd_service.get_prd(db, prd_id, user.id)


@router.patch("/{prd_id}", response_model=Prd)
async def update_prd(
    prd_id: UUID, body: UpdatePrdRequest, user: CurrentUserDep, db: SupabaseDep
) -> Prd:
    """Autosave target. Merges JSONB rather than replacing it."""
    return prd_service.update_prd(db, prd_id, user.id, body)


@router.delete("/{prd_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_prd(prd_id: UUID, user: CurrentUserDep, db: SupabaseDep) -> Response:
    prd_service.delete_prd(db, prd_id, user.id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post(
    "/{prd_id}/duplicate", response_model=Prd, status_code=status.HTTP_201_CREATED
)
async def duplicate_prd(prd_id: UUID, user: CurrentUserDep, db: SupabaseDep) -> Prd:
    return prd_service.duplicate_prd(db, prd_id, user.id)


@router.get("/{prd_id}/versions", response_model=VersionListResponse)
async def list_versions(
    prd_id: UUID, user: CurrentUserDep, db: SupabaseDep
) -> VersionListResponse:
    return VersionListResponse(items=prd_service.list_versions(db, prd_id, user.id))
