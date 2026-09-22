"""Response bodies.

Error responses do not appear here - every failure exits through the single
envelope in `core/errors.py`.
"""

from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, Field

from app.models.prd import (
    Assumption,
    GroupName,
    PrdStatus,
    PrdSummary,
    PrdVersionSummary,
    SectionKey,
)


class PrdListResponse(BaseModel):
    items: list[PrdSummary] = Field(default_factory=list)
    #: Total matching the filter, not the length of `items` - the dashboard
    #: needs it to paginate.
    total: int = 0


class GenerationStatusResponse(BaseModel):
    """Polled when a client reconnects mid-generation."""

    status: PrdStatus
    generation_error: str | None = None
    started_at: datetime | None = None


class GroupOutcome(BaseModel):
    """Per-group result, so the UI can show which of the four succeeded.

    A partial failure still persists the groups that worked, and the user is
    offered a retry of only the failed ones.
    """

    group: GroupName
    succeeded: bool
    #: Plain language, safe to show. Never a provider error string.
    error: str | None = None


class GenerationResultResponse(BaseModel):
    status: PrdStatus
    groups: list[GroupOutcome] = Field(default_factory=list)
    section_count: int = 0
    assumption_count: int = 0


class RegenerateSectionResponse(BaseModel):
    section_key: SectionKey
    #: Shape depends on the section's render type - prose is a string, list
    #: sections are arrays, structured sections are arrays of objects.
    content: object
    #: Assumptions for this section only; they replace the previous ones for
    #: this section rather than appending.
    assumptions: list[Assumption] = Field(default_factory=list)
    version_number: int | None = None


class VersionListResponse(BaseModel):
    items: list[PrdVersionSummary] = Field(default_factory=list)


class HealthResponse(BaseModel):
    status: str
    version: str
    environment: str


class DbHealthResponse(BaseModel):
    status: str
    latency_ms: float
    detail: str | None = None
