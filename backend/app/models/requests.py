"""Request bodies.

Every one of these is validated by Pydantic before a handler sees it. Note
what is absent: no request body carries a `user_id`. Identity comes from the
verified JWT and nowhere else.
"""

from __future__ import annotations

from typing import Any

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
    # Partial on purpose. Typing these as the full PrdInputs / PrdContent would
    # fill every unsent field with its default, so a PATCH carrying one answer
    # would blank the other eighteen - autosave would quietly destroy work.
    # The service merges these into the stored JSONB; unknown keys are dropped.
    inputs: dict[str, Any] | None = None
    content: dict[str, Any] | None = None
    wizard_step: int | None = Field(default=None, ge=1, le=7)

    @field_validator("inputs")
    @classmethod
    def _clean_inputs(cls, value: dict[str, Any] | None) -> dict[str, Any] | None:
        """Keep only real input fields, trimmed and length-capped."""
        if value is None:
            return None
        allowed = set(PrdInputs.model_fields)
        return {
            key: raw.strip()[:MAX_FIELD_CHARS] if isinstance(raw, str) else raw
            for key, raw in value.items()
            if key in allowed
        }

    @field_validator("content")
    @classmethod
    def _clean_content(cls, value: dict[str, Any] | None) -> dict[str, Any] | None:
        """Keep only real section keys, so the editor cannot invent sections."""
        if value is None:
            return None
        allowed = set(PrdContent.model_fields)
        return {key: raw for key, raw in value.items() if key in allowed}

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
