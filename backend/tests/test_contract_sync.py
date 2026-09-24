"""Proves `lib/types.ts` and `models/prd.py` describe the same data.

Two languages cannot share a type, so this test reads the TypeScript source
and compares it against the Pydantic models field by field. It is the thing
standing between us and the classic integration bug where the backend renames
a field, both halves still compile, and the UI silently renders undefined.

If you are here because this test failed: you changed one side of a frozen
contract. Change the other side too, or get lead approval to change neither.
"""

from __future__ import annotations

import re
from pathlib import Path

import pytest

from app.models.prd import (
    FORMAT_SECTIONS,
    MAX_FIELD_CHARS,
    MAX_TOTAL_INPUT_CHARS,
    SECTION_GROUPS,
    SECTION_ORDER,
    Assumption,
    Feature,
    Metric,
    Persona,
    PrdContent,
    PrdInputs,
    PrdStatus,
    Requirement,
    Risk,
    UserStory,
)

TYPES_TS = (
    Path(__file__).resolve().parents[2] / "frontend" / "src" / "lib" / "types.ts"
)


@pytest.fixture(scope="module")
def ts_source() -> str:
    if not TYPES_TS.exists():
        pytest.fail(
            f"Cannot find the frontend contract at {TYPES_TS}. "
            "This test must run from a full checkout - a backend-only "
            "checkout would silently stop verifying the contract."
        )
    return _strip_comments(TYPES_TS.read_text(encoding="utf-8"))


def _strip_comments(source: str) -> str:
    """Remove block and line comments so prose cannot be parsed as fields."""
    source = re.sub(r"/\*.*?\*/", "", source, flags=re.DOTALL)
    return re.sub(r"//[^\n]*", "", source)


def _interface_fields(source: str, name: str) -> set[str]:
    """Field names declared on a TypeScript interface."""
    match = re.search(
        rf"export interface {name}(?:\s+extends\s+\w+)?\s*\{{(.*?)^\}}",
        source,
        flags=re.DOTALL | re.MULTILINE,
    )
    if not match:
        raise AssertionError(f"interface {name} not found in types.ts")
    return set(re.findall(r"^\s*(\w+)\??\s*:", match.group(1), flags=re.MULTILINE))


def _const_string_array(source: str, name: str) -> list[str]:
    """Values of an `export const X = [...] as const` array."""
    match = re.search(
        rf"export const {name}\s*=\s*\[(.*?)\]\s*as const",
        source,
        flags=re.DOTALL,
    )
    if not match:
        raise AssertionError(f"const {name} not found in types.ts")
    return re.findall(r"'([^']+)'", match.group(1))


def _numeric_const(source: str, name: str) -> int:
    match = re.search(rf"export const {name}\s*=\s*([\d_]+)", source)
    if not match:
        raise AssertionError(f"const {name} not found in types.ts")
    return int(match.group(1).replace("_", ""))


def _union_members(source: str, name: str) -> set[str]:
    match = re.search(rf"export type {name}\s*=\s*([^\n]+(?:\n\s*\|[^\n]+)*)", source)
    if not match:
        raise AssertionError(f"type {name} not found in types.ts")
    return set(re.findall(r"'([^']+)'", match.group(1)))


# ---------------------------------------------------------------------------
# Section registry
# ---------------------------------------------------------------------------


def test_section_order_matches_exactly(ts_source: str) -> None:
    """Same sections, same order - export and nav both depend on order."""
    assert _const_string_array(ts_source, "SECTION_ORDER") == list(SECTION_ORDER)


def test_section_groups_match(ts_source: str) -> None:
    """The four parallel calls must cover the same sections on both sides."""
    match = re.search(
        r"export const SECTION_GROUPS[^=]*=\s*\{(.*?)^\}\s*as const",
        ts_source,
        flags=re.DOTALL | re.MULTILINE,
    )
    assert match, "SECTION_GROUPS not found in types.ts"

    ts_groups = {
        group: re.findall(r"'([^']+)'", body)
        for group, body in re.findall(
            r"(\w+):\s*\[(.*?)\]", match.group(1), flags=re.DOTALL
        )
    }

    assert set(ts_groups) == set(SECTION_GROUPS)
    for group, keys in SECTION_GROUPS.items():
        assert ts_groups[group] == list(keys), f"group '{group}' differs"


def test_every_section_appears_in_exactly_one_group() -> None:
    grouped = [key for keys in SECTION_GROUPS.values() for key in keys]
    assert sorted(grouped) == sorted(SECTION_ORDER)
    assert len(grouped) == len(set(grouped)), "a section is in two groups"


def test_there_are_twenty_one_sections() -> None:
    """Guards the '4 calls, not 21' design note against drift."""
    assert len(SECTION_ORDER) == 21


# ---------------------------------------------------------------------------
# Content and inputs
# ---------------------------------------------------------------------------


def test_prd_content_fields_match(ts_source: str) -> None:
    assert _interface_fields(ts_source, "PrdContent") == set(PrdContent.model_fields)


def test_prd_content_covers_every_section() -> None:
    """A section with no field would be generated and then dropped."""
    assert set(PrdContent.model_fields) == set(SECTION_ORDER)


def test_prd_inputs_fields_match(ts_source: str) -> None:
    assert _interface_fields(ts_source, "PrdInputs") == set(PrdInputs.model_fields)


def test_required_input_fields_match(ts_source: str) -> None:
    ts_required = _const_string_array(ts_source, "REQUIRED_INPUT_FIELDS")
    assert sorted(ts_required) == sorted(PrdInputs().missing_required_fields())


def test_only_four_fields_are_required() -> None:
    """The product promise is reaching Generate in under two minutes."""
    assert len(PrdInputs().missing_required_fields()) == 4


def test_required_fields_are_real_input_fields() -> None:
    assert set(PrdInputs().missing_required_fields()) <= set(PrdInputs.model_fields)


# ---------------------------------------------------------------------------
# Structured items
# ---------------------------------------------------------------------------


@pytest.mark.parametrize(
    ("interface_name", "model"),
    [
        ("Persona", Persona),
        ("UserStory", UserStory),
        ("Requirement", Requirement),
        ("Feature", Feature),
        ("Risk", Risk),
        ("Metric", Metric),
        ("Assumption", Assumption),
    ],
)
def test_structured_item_fields_match(
    ts_source: str, interface_name: str, model: type
) -> None:
    assert _interface_fields(ts_source, interface_name) == set(model.model_fields)


# ---------------------------------------------------------------------------
# Enums and limits
# ---------------------------------------------------------------------------


def test_prd_status_matches_the_postgres_enum(ts_source: str) -> None:
    assert _union_members(ts_source, "PrdStatus") == {s.value for s in PrdStatus}


@pytest.mark.parametrize(
    ("ts_name", "py_value"),
    [
        ("MAX_FIELD_CHARS", MAX_FIELD_CHARS),
        ("MAX_TOTAL_INPUT_CHARS", MAX_TOTAL_INPUT_CHARS),
    ],
)
def test_limits_match(ts_source: str, ts_name: str, py_value: int) -> None:
    """A mismatch means the client truncates at a different point than the
    server, which shows up as silently lost text."""
    assert _numeric_const(ts_source, ts_name) == py_value


def test_wizard_step_count_matches_the_update_validator(ts_source: str) -> None:
    from app.models.requests import UpdatePrdRequest

    step_field = UpdatePrdRequest.model_fields["wizard_step"]
    upper_bounds = [
        meta.le for meta in step_field.metadata if hasattr(meta, "le")
    ]
    assert upper_bounds, "wizard_step should carry an upper bound"
    assert _numeric_const(ts_source, "WIZARD_STEP_COUNT") == upper_bounds[0]


# ---------------------------------------------------------------------------
# Document format presets
# ---------------------------------------------------------------------------


def test_format_presets_match(ts_source: str) -> None:
    """Formats decide which sections get generated, so drift here means the
    wizard promises a shape the backend will not produce."""
    match = re.search(
        r"export const FORMAT_SECTIONS[^=]*=\s*\{(.*?)^\}\s*as const",
        ts_source,
        flags=re.DOTALL | re.MULTILINE,
    )
    assert match, "FORMAT_SECTIONS not found in types.ts"

    body = match.group(1)
    ts_formats: dict[str, list[str]] = {}
    for name, block in re.findall(r"(\w+):\s*\[(.*?)\]", body, flags=re.DOTALL):
        ts_formats[name] = re.findall(r"'([^']+)'", block)
    # `comprehensive: SECTION_ORDER` has no bracket literal of its own.
    if "comprehensive" not in ts_formats and "comprehensive: SECTION_ORDER" in body:
        ts_formats["comprehensive"] = list(SECTION_ORDER)

    assert set(ts_formats) == set(FORMAT_SECTIONS)
    for name, keys in FORMAT_SECTIONS.items():
        assert sorted(ts_formats[name]) == sorted(keys), f"format '{name}' differs"


def test_every_format_only_names_real_sections() -> None:
    for name, keys in FORMAT_SECTIONS.items():
        unknown = set(keys) - set(SECTION_ORDER)
        assert not unknown, f"format '{name}' names unknown sections: {unknown}"


def test_every_format_produces_something() -> None:
    """An empty preset would generate a blank document."""
    for name, keys in FORMAT_SECTIONS.items():
        assert keys, f"format '{name}' would generate nothing"


def test_option_fields_have_matching_literals(ts_source: str) -> None:
    """The dropdown values and the Python literals must agree exactly."""
    from typing import get_args

    from app.models.prd import DetailLevel, DocumentAudience, DocumentFormat

    for ts_name, py_type in (
        ("DocumentFormat", DocumentFormat),
        ("DetailLevel", DetailLevel),
        ("DocumentAudience", DocumentAudience),
    ):
        assert _union_members(ts_source, ts_name) == set(get_args(py_type)), ts_name
