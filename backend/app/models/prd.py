"""The shared contract.

This file and `frontend/src/lib/types.ts` describe the same data. They must
stay in sync, and they are FROZEN after Phase 2 - changes need lead approval,
because five people are coding against them.

Two naming collisions are worth understanding before you read further:

1. **`assumptions` means two different things.** There is an `assumptions`
   *section* inside the PRD document (a normal list of stated assumptions,
   part of `PrdContent`), and there is the cross-cutting `Assumption` record
   that flags where the model had to infer something (stored in the `prds`
   table's own `assumptions` column, surfaced in the editor's assumptions
   panel). They are unrelated. The second is the anti-fabrication mechanism.

2. **Generation groups are not document order.** `SECTION_GROUPS` controls
   which sections are produced by which of the four parallel LLM calls.
   `SECTION_ORDER` controls the order a human reads them in. Optimising one
   for the other would make either the latency or the document worse.
"""

from __future__ import annotations

from datetime import datetime
from enum import StrEnum
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator

# ---------------------------------------------------------------------------
# Limits. Mirrored in config.py; see SECURITY in the README.
# ---------------------------------------------------------------------------

MAX_FIELD_CHARS = 5_000
MAX_TOTAL_INPUT_CHARS = 50_000


# ---------------------------------------------------------------------------
# Status
# ---------------------------------------------------------------------------


class PrdStatus(StrEnum):
    """Mirrors the `prd_status` Postgres enum exactly."""

    DRAFT = "draft"
    GENERATING = "generating"
    GENERATED = "generated"
    FAILED = "failed"


Priority = Literal["must", "should", "could"]
Likelihood = Literal["low", "medium", "high"]
Impact = Literal["low", "medium", "high"]
Scope = Literal["mvp", "future"]


# ---------------------------------------------------------------------------
# Section identity
# ---------------------------------------------------------------------------

SectionKey = Literal[
    # strategy
    "product_overview",
    "executive_summary",
    "problem_statement",
    "goals",
    "non_goals",
    "value_proposition",
    # users
    "personas",
    "pain_points",
    "user_stories",
    # requirements
    "functional_requirements",
    "non_functional_requirements",
    "features",
    "user_flow",
    # execution
    "success_metrics",
    "assumptions",
    "constraints",
    "risks",
    "dependencies",
    "competitive_considerations",
    "mvp_scope",
    "future_enhancements",
]

GroupName = Literal["strategy", "users", "requirements", "execution"]

#: Which sections each parallel LLM call is responsible for. Four calls run
#: concurrently, so total latency is roughly the slowest group rather than
#: the sum of twenty-one sections.
SECTION_GROUPS: dict[GroupName, tuple[SectionKey, ...]] = {
    "strategy": (
        "product_overview",
        "executive_summary",
        "problem_statement",
        "goals",
        "non_goals",
        "value_proposition",
    ),
    "users": (
        "personas",
        "pain_points",
        "user_stories",
    ),
    "requirements": (
        "functional_requirements",
        "non_functional_requirements",
        "features",
        "user_flow",
    ),
    "execution": (
        "success_metrics",
        "assumptions",
        "constraints",
        "risks",
        "dependencies",
        "competitive_considerations",
        "mvp_scope",
        "future_enhancements",
    ),
}

#: The order a person reads the finished document in - used by the editor's
#: section nav and by Markdown export. Deliberately different from the
#: generation grouping above.
SECTION_ORDER: tuple[SectionKey, ...] = (
    "executive_summary",
    "product_overview",
    "problem_statement",
    "value_proposition",
    "goals",
    "non_goals",
    "personas",
    "pain_points",
    "user_stories",
    "features",
    "functional_requirements",
    "non_functional_requirements",
    "user_flow",
    "mvp_scope",
    "success_metrics",
    "assumptions",
    "constraints",
    "dependencies",
    "risks",
    "competitive_considerations",
    "future_enhancements",
)

#: Reverse lookup: which group produces a given section.
SECTION_TO_GROUP: dict[SectionKey, GroupName] = {
    key: group for group, keys in SECTION_GROUPS.items() for key in keys
}


def _assert_registry_is_consistent() -> None:
    """Guard against a section being added to one structure but not the other.

    Cheap to run at import; catches a class of bug that would otherwise show
    up as a section silently missing from the editor or the export.
    """
    grouped = {key for keys in SECTION_GROUPS.values() for key in keys}
    ordered = set(SECTION_ORDER)
    if grouped != ordered:
        missing_from_order = sorted(grouped - ordered)
        missing_from_groups = sorted(ordered - grouped)
        raise RuntimeError(
            "Section registry is inconsistent. "
            f"In SECTION_GROUPS but not SECTION_ORDER: {missing_from_order}. "
            f"In SECTION_ORDER but not SECTION_GROUPS: {missing_from_groups}."
        )


_assert_registry_is_consistent()


# ---------------------------------------------------------------------------
# Structured content items
# ---------------------------------------------------------------------------


class Persona(BaseModel):
    name: str
    description: str
    goals: list[str] = Field(default_factory=list)
    frustrations: list[str] = Field(default_factory=list)


class UserStory(BaseModel):
    id: str = Field(description="Stable identifier, e.g. 'US-01'")
    persona: str
    story: str = Field(description="As a ..., I want ..., so that ...")
    acceptance_criteria: list[str] = Field(default_factory=list)
    priority: Priority = "should"


class Requirement(BaseModel):
    id: str = Field(description="'FR-01' for functional, 'NFR-01' for non-functional")
    title: str
    description: str
    priority: Priority = "should"
    rationale: str | None = None


class Feature(BaseModel):
    name: str
    description: str
    user_value: str
    scope: Scope = "mvp"


class Risk(BaseModel):
    description: str
    likelihood: Likelihood = "medium"
    impact: Impact = "medium"
    mitigation: str


class Metric(BaseModel):
    name: str
    definition: str
    #: None when the user supplied no number. The model must NOT invent one -
    #: a plausible-looking fake target is the exact failure this product
    #: exists to avoid.
    target: str | None = None
    timeframe: str | None = None


class Assumption(BaseModel):
    """An inference the model made, recorded rather than hidden.

    This is the anti-fabrication mechanism. When the model has to guess at
    something material to write a section, it says so here instead of
    presenting the guess as fact.
    """

    section_key: SectionKey
    text: str
    #: True when the guess is material and a human should confirm it. These
    #: sort first in the assumptions panel and mark their section amber.
    needs_clarification: bool = False


# ---------------------------------------------------------------------------
# PRD content
# ---------------------------------------------------------------------------


class PrdContent(BaseModel):
    """The generated document.

    Every field defaults to empty. A section the user gave nothing for stays
    empty and gets an Assumption explaining what is missing - it is never
    padded with generic filler.
    """

    model_config = ConfigDict(extra="ignore")

    # strategy
    product_overview: str | None = None
    executive_summary: str | None = None
    problem_statement: str | None = None
    goals: list[str] = Field(default_factory=list)
    non_goals: list[str] = Field(default_factory=list)
    value_proposition: str | None = None

    # users
    personas: list[Persona] = Field(default_factory=list)
    pain_points: list[str] = Field(default_factory=list)
    user_stories: list[UserStory] = Field(default_factory=list)

    # requirements
    functional_requirements: list[Requirement] = Field(default_factory=list)
    non_functional_requirements: list[Requirement] = Field(default_factory=list)
    features: list[Feature] = Field(default_factory=list)
    user_flow: list[str] = Field(default_factory=list)

    # execution
    success_metrics: list[Metric] = Field(default_factory=list)
    assumptions: list[str] = Field(
        default_factory=list,
        description="The document's own assumptions section. NOT the "
        "cross-cutting Assumption records - see the module docstring.",
    )
    constraints: list[str] = Field(default_factory=list)
    risks: list[Risk] = Field(default_factory=list)
    dependencies: list[str] = Field(default_factory=list)
    competitive_considerations: str | None = None
    mvp_scope: list[str] = Field(default_factory=list)
    future_enhancements: list[str] = Field(default_factory=list)

    def is_section_populated(self, key: SectionKey) -> bool:
        value = getattr(self, key, None)
        if value is None:
            return False
        if isinstance(value, str):
            return bool(value.strip())
        return bool(value)

    def populated_section_count(self) -> int:
        return sum(1 for key in SECTION_ORDER if self.is_section_populated(key))

    def empty_section_keys(self) -> list[SectionKey]:
        return [key for key in SECTION_ORDER if not self.is_section_populated(key)]


# ---------------------------------------------------------------------------
# Wizard inputs
# ---------------------------------------------------------------------------


def _cap(value: str | None) -> str:
    """Trim, and hard-cap length.

    Truncating rather than rejecting keeps autosave from failing on a long
    paste. The cap exists to bound token cost and to blunt
    prompt-injection-by-volume, not to police the user.
    """
    if not value:
        return ""
    return value.strip()[:MAX_FIELD_CHARS]


class PrdInputs(BaseModel):
    """Answers from the seven-step wizard.

    Every field is optional at this layer: a draft is saved after every
    keystroke, so a half-filled form must always persist. Readiness to
    generate is a separate question - see `missing_required_fields`.
    """

    model_config = ConfigDict(extra="ignore")

    # Step 1 - Idea
    product_name: str = ""
    idea: str = ""
    product_type: str = ""

    # Step 2 - Problem
    problem: str = ""
    why_now: str = ""
    current_alternatives: str = ""

    # Step 3 - Users
    target_users: str = ""
    personas_input: str = ""
    pain_points_input: str = ""

    # Step 4 - Features
    core_features: str = ""
    nice_to_haves: str = ""
    non_goals_input: str = ""

    # Step 5 - Goals
    business_goals: str = ""
    success_metrics_input: str = ""
    timeline: str = ""

    # Step 6 - Constraints
    platforms: str = ""
    tech_constraints: str = ""
    competitors: str = ""
    other_context: str = ""

    @field_validator("*", mode="before")
    @classmethod
    def _normalise(cls, value: object) -> object:
        return _cap(value) if isinstance(value, str) or value is None else value

    def missing_required_fields(self) -> list[str]:
        """Only four fields gate generation, out of nineteen.

        A user should be able to reach Generate in under two minutes.
        Everything else improves the output but never blocks it.
        """
        required = {
            "product_name": self.product_name,
            "idea": self.idea,
            "problem": self.problem,
            "target_users": self.target_users,
        }
        return [name for name, value in required.items() if not value.strip()]

    @property
    def is_ready_to_generate(self) -> bool:
        return not self.missing_required_fields()

    def total_chars(self) -> int:
        return sum(
            len(value) for value in self.model_dump().values() if isinstance(value, str)
        )

    def sparse_field_names(self) -> list[str]:
        """Optional fields left blank.

        The wizard's review step uses this to warn which sections will come
        back thin, e.g. 'you haven't described success metrics, so that
        section will be marked as needing clarification'.
        """
        required = {"product_name", "idea", "problem", "target_users"}
        return [
            name
            for name, value in self.model_dump().items()
            if name not in required and isinstance(value, str) and not value.strip()
        ]


# ---------------------------------------------------------------------------
# Usage + provenance
# ---------------------------------------------------------------------------


class TokenUsage(BaseModel):
    input_tokens: int = 0
    output_tokens: int = 0
    estimated_cost_usd: float = 0.0

    def __add__(self, other: TokenUsage) -> TokenUsage:
        return TokenUsage(
            input_tokens=self.input_tokens + other.input_tokens,
            output_tokens=self.output_tokens + other.output_tokens,
            estimated_cost_usd=self.estimated_cost_usd + other.estimated_cost_usd,
        )


# ---------------------------------------------------------------------------
# Persisted entities
# ---------------------------------------------------------------------------


class Prd(BaseModel):
    """A full PRD row, inputs and content included."""

    # `model` would otherwise collide with pydantic's protected namespace.
    model_config = ConfigDict(protected_namespaces=())

    id: UUID
    user_id: UUID
    title: str
    status: PrdStatus
    inputs: PrdInputs = Field(default_factory=PrdInputs)
    content: PrdContent | None = None
    assumptions: list[Assumption] = Field(default_factory=list)
    wizard_step: int = 1
    generation_error: str | None = None
    provider: str | None = None
    model: str | None = None
    token_usage: TokenUsage | None = None
    generation_started_at: datetime | None = None
    created_at: datetime
    updated_at: datetime


class PrdSummary(BaseModel):
    """The dashboard list item. Deliberately omits inputs and content."""

    id: UUID
    title: str
    status: PrdStatus
    created_at: datetime
    updated_at: datetime
    section_count: int = 0


class PrdVersion(BaseModel):
    """An immutable snapshot. Taken on generate and regenerate only."""

    id: UUID
    prd_id: UUID
    version_number: int
    content: PrdContent
    change_summary: str
    created_at: datetime


class PrdVersionSummary(BaseModel):
    """Version history list item, without the content payload."""

    id: UUID
    version_number: int
    change_summary: str
    created_at: datetime


# ---------------------------------------------------------------------------
# Per-group generation results
# ---------------------------------------------------------------------------
#
# Each of the four parallel calls returns only its own sections plus any
# assumptions it had to make. Narrow schemas mean a model cannot wander into
# sections it was not asked for, and a validation failure is isolated to one
# group rather than losing the whole document.


class _GroupResult(BaseModel):
    model_config = ConfigDict(extra="ignore")

    #: The model's flagged inferences for this group. Named distinctly from
    #: the document's own `assumptions` SECTION so the two never collide -
    #: `ExecutionGroup` legitimately carries both.
    flagged_assumptions: list[Assumption] = Field(default_factory=list)


class StrategyGroup(_GroupResult):
    product_overview: str | None = None
    executive_summary: str | None = None
    problem_statement: str | None = None
    goals: list[str] = Field(default_factory=list)
    non_goals: list[str] = Field(default_factory=list)
    value_proposition: str | None = None


class UsersGroup(_GroupResult):
    personas: list[Persona] = Field(default_factory=list)
    pain_points: list[str] = Field(default_factory=list)
    user_stories: list[UserStory] = Field(default_factory=list)


class RequirementsGroup(_GroupResult):
    functional_requirements: list[Requirement] = Field(default_factory=list)
    non_functional_requirements: list[Requirement] = Field(default_factory=list)
    features: list[Feature] = Field(default_factory=list)
    user_flow: list[str] = Field(default_factory=list)


class ExecutionGroup(_GroupResult):
    success_metrics: list[Metric] = Field(default_factory=list)
    #: The document's own assumptions SECTION - plain prose bullets that
    #: belong in the PRD. Distinct from `flagged_assumptions` above, which is
    #: metadata about the model's own guesses.
    assumptions: list[str] = Field(default_factory=list)
    constraints: list[str] = Field(default_factory=list)
    risks: list[Risk] = Field(default_factory=list)
    dependencies: list[str] = Field(default_factory=list)
    competitive_considerations: str | None = None
    mvp_scope: list[str] = Field(default_factory=list)
    future_enhancements: list[str] = Field(default_factory=list)


GROUP_MODELS: dict[GroupName, type[_GroupResult]] = {
    "strategy": StrategyGroup,
    "users": UsersGroup,
    "requirements": RequirementsGroup,
    "execution": ExecutionGroup,
}
