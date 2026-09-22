"""Request bodies.

Every one of these is validated by Pydantic before a handler sees it. Note
what is absent: no request body carries a `user_id`. Identity comes from the
verified JWT and nowhere else.
"""

from __future__ import annotations

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.models.prd import MAX_FIELD_CHARS, PrdContent, PrdInputs

MAX_TITLE_CHARS = 200
MAX_INSTRUCTION_CHARS = 500


class CreatePrdRequest(BaseModel):
    title: str | None = Field(default=None, max_length=MAX_TITLE_CHARS)


class UpdatePrdRequest(BaseModel):
    """Partial update, used by autosave.

    Every field is optional and `None` means "leave alone". The service layer
    merges rather than replacing - a PATCH carrying only `wizard_step` must
    not wipe `inputs`.
    """

    model_config = ConfigDict(extra="forbid")

    title: str | None = Field(default=None, max_length=MAX_TITLE_CHARS)
    inputs: PrdInputs | None = None
    content: PrdContent | None = None
    wizard_step: int | None = Field(default=None, ge=1, le=7)

    @field_validator("title")
    @classmethod
    def _title_not_blank(cls, value: str | None) -> str | None:
        if value is None:
            return None
        cleaned = value.strip()
        # An empty title would render as a blank row on the dashboard.
        return cleaned or "Untitled PRD"

    def has_changes(self) -> bool:
        return any(
            getattr(self, name) is not None
            for name in ("title", "inputs", "content", "wizard_step")
        )


class RegenerateSectionRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    #: Optional steering, e.g. "make this more technical". Capped because it
    #: is interpolated into a prompt - see the prompt-injection note in
    #: SECURITY. It is wrapped in delimiters and labelled as user data.
    instruction: str | None = Field(default=None, max_length=MAX_INSTRUCTION_CHARS)

    @field_validator("instruction")
    @classmethod
    def _clean(cls, value: str | None) -> str | None:
        if value is None:
            return None
        cleaned = value.strip()[:MAX_INSTRUCTION_CHARS]
        return cleaned or None


class UpdateProfileRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    full_name: str | None = Field(default=None, max_length=MAX_FIELD_CHARS)
