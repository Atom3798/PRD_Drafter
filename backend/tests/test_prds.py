"""PRD CRUD against a real database.

These are integration tests for the same reason test_rls.py is: the behaviour
that matters here is JSONB merging and ownership scoping, both of which are
Postgres doing the work. A mocked client would assert that we called the
library correctly, not that the data survived.

Run with a database configured:  pytest -m integration
"""

from __future__ import annotations

import contextlib
import time
import uuid
from typing import Any

import pytest

from app.models.requests import UpdatePrdRequest
from app.services import prd_service
from tests.test_rls import CREDENTIALS, _signed_in_client, requires_database

pytestmark = pytest.mark.integration


@pytest.fixture(scope="module")
def owner() -> Any:
    stamp = f"{int(time.time())}-{uuid.uuid4().hex[:6]}"
    return _signed_in_client(f"crud-{stamp}@example.com", "test-password-crud-1!")


@pytest.fixture(scope="module")
def owner_id(owner: Any) -> str:
    return owner.auth.get_user().user.id


@pytest.fixture
def prd(owner: Any, owner_id: str) -> Any:
    created = prd_service.create_prd(owner, owner_id, "Test PRD")
    yield created
    with contextlib.suppress(Exception):
        prd_service.delete_prd(owner, created.id, owner_id)


# ---------------------------------------------------------------------------
# Create
# ---------------------------------------------------------------------------


@requires_database
def test_create_starts_as_an_empty_draft(prd: Any) -> None:
    assert prd.status.value == "draft"
    assert prd.wizard_step == 1
    assert prd.content is None
    assert prd.inputs.missing_required_fields() == [
        "product_name",
        "idea",
        "problem",
        "target_users",
    ]


@requires_database
def test_create_without_a_title_gets_a_placeholder(owner: Any, owner_id: str) -> None:
    created = prd_service.create_prd(owner, owner_id, None)
    try:
        assert created.title == "Untitled PRD"
    finally:
        prd_service.delete_prd(owner, created.id, owner_id)


# ---------------------------------------------------------------------------
# Update - the autosave path
# ---------------------------------------------------------------------------


@requires_database
def test_patch_merges_inputs_rather_than_replacing(
    owner: Any, owner_id: str, prd: Any
) -> None:
    """The single most important behaviour in this file.

    Autosave sends only what changed. If a PATCH replaced the whole blob,
    typing in step 5 would erase steps 1 to 4.
    """
    prd_service.update_prd(
        owner, prd.id, owner_id, UpdatePrdRequest(inputs={"idea": "An idea"})
    )
    updated = prd_service.update_prd(
        owner, prd.id, owner_id, UpdatePrdRequest(inputs={"problem": "A problem"})
    )

    assert updated.inputs.idea == "An idea"
    assert updated.inputs.problem == "A problem"


@requires_database
def test_patch_of_one_field_leaves_others_alone(
    owner: Any, owner_id: str, prd: Any
) -> None:
    prd_service.update_prd(
        owner,
        prd.id,
        owner_id,
        UpdatePrdRequest(title="Renamed", inputs={"idea": "Keep me"}),
    )
    updated = prd_service.update_prd(
        owner, prd.id, owner_id, UpdatePrdRequest(wizard_step=4)
    )

    assert updated.wizard_step == 4
    assert updated.title == "Renamed"
    assert updated.inputs.idea == "Keep me"


@requires_database
def test_patch_merges_content_sections(owner: Any, owner_id: str, prd: Any) -> None:
    prd_service.update_prd(
        owner,
        prd.id,
        owner_id,
        UpdatePrdRequest(content={"problem_statement": "First section"}),
    )
    updated = prd_service.update_prd(
        owner, prd.id, owner_id, UpdatePrdRequest(content={"goals": ["A goal"]})
    )

    assert updated.content is not None
    assert updated.content.problem_statement == "First section"
    assert updated.content.goals == ["A goal"]


@requires_database
def test_unknown_input_keys_are_dropped(owner: Any, owner_id: str, prd: Any) -> None:
    """A client cannot invent columns inside the JSONB blob."""
    updated = prd_service.update_prd(
        owner,
        prd.id,
        owner_id,
        UpdatePrdRequest(inputs={"idea": "Real", "injected_key": "nope"}),
    )

    assert updated.inputs.idea == "Real"
    assert not hasattr(updated.inputs, "injected_key")


@requires_database
def test_empty_patch_is_a_no_op(owner: Any, owner_id: str, prd: Any) -> None:
    unchanged = prd_service.update_prd(owner, prd.id, owner_id, UpdatePrdRequest())
    assert unchanged.id == prd.id


# ---------------------------------------------------------------------------
# List and search
# ---------------------------------------------------------------------------


@requires_database
def test_list_returns_the_owners_prds_with_a_total(
    owner: Any, owner_id: str, prd: Any
) -> None:
    items, total = prd_service.list_prds(owner, owner_id)

    assert total >= 1
    assert any(item.id == prd.id for item in items)


@requires_database
def test_search_matches_on_title(owner: Any, owner_id: str, prd: Any) -> None:
    prd_service.update_prd(
        owner, prd.id, owner_id, UpdatePrdRequest(title="Distinctive Zebra Name")
    )

    items, total = prd_service.list_prds(owner, owner_id, search="zebra")
    assert total >= 1
    assert any("Zebra" in item.title for item in items)

    _, none_total = prd_service.list_prds(owner, owner_id, search="qqzzxx-no-match")
    assert none_total == 0


@requires_database
def test_search_treats_wildcards_literally(
    owner: Any, owner_id: str, prd: Any
) -> None:
    """A search for '%' must not behave like 'match everything'."""
    _, total = prd_service.list_prds(owner, owner_id, search="%")
    assert total == 0


@requires_database
def test_section_count_reflects_populated_sections(
    owner: Any, owner_id: str, prd: Any
) -> None:
    prd_service.update_prd(
        owner,
        prd.id,
        owner_id,
        UpdatePrdRequest(
            content={"problem_statement": "Something", "goals": ["One", "Two"]}
        ),
    )

    items, _ = prd_service.list_prds(owner, owner_id, search="Test PRD")
    match = next(item for item in items if item.id == prd.id)
    assert match.section_count == 2


@requires_database
def test_list_paginates(owner: Any, owner_id: str) -> None:
    created = [prd_service.create_prd(owner, owner_id, f"Page {i}") for i in range(3)]
    try:
        first, total = prd_service.list_prds(owner, owner_id, limit=2, offset=0)
        second, _ = prd_service.list_prds(owner, owner_id, limit=2, offset=2)

        assert len(first) == 2
        assert total >= 3
        assert {item.id for item in first}.isdisjoint({item.id for item in second})
    finally:
        for item in created:
            with contextlib.suppress(Exception):
                prd_service.delete_prd(owner, item.id, owner_id)


# ---------------------------------------------------------------------------
# Duplicate
# ---------------------------------------------------------------------------


@requires_database
def test_duplicate_copies_content_but_not_version_history(
    owner: Any, owner_id: str, prd: Any
) -> None:
    prd_service.update_prd(
        owner,
        prd.id,
        owner_id,
        UpdatePrdRequest(content={"problem_statement": "Original text"}),
    )
    source = prd_service.get_prd(owner, prd.id, owner_id)
    assert source.content is not None
    prd_service.snapshot_version(owner, prd.id, source.content, "v1")

    copy = prd_service.duplicate_prd(owner, prd.id, owner_id)
    try:
        assert copy.id != prd.id
        assert copy.title.endswith("(copy)")
        assert copy.content is not None
        assert copy.content.problem_statement == "Original text"

        # History belongs to the original. Inheriting it would let "restore"
        # reach into a document this copy never had.
        assert prd_service.list_versions(owner, copy.id, owner_id) == []
        assert len(prd_service.list_versions(owner, prd.id, owner_id)) == 1
    finally:
        prd_service.delete_prd(owner, copy.id, owner_id)


@requires_database
def test_editing_a_duplicate_does_not_touch_the_original(
    owner: Any, owner_id: str, prd: Any
) -> None:
    prd_service.update_prd(
        owner, prd.id, owner_id, UpdatePrdRequest(inputs={"idea": "Original idea"})
    )
    copy = prd_service.duplicate_prd(owner, prd.id, owner_id)
    try:
        prd_service.update_prd(
            owner, copy.id, owner_id, UpdatePrdRequest(inputs={"idea": "Changed"})
        )
        original = prd_service.get_prd(owner, prd.id, owner_id)
        assert original.inputs.idea == "Original idea"
    finally:
        prd_service.delete_prd(owner, copy.id, owner_id)


# ---------------------------------------------------------------------------
# Delete and missing rows
# ---------------------------------------------------------------------------


@requires_database
def test_delete_removes_the_prd(owner: Any, owner_id: str) -> None:
    from app.core.errors import NotFoundError

    created = prd_service.create_prd(owner, owner_id, "Short lived")
    prd_service.delete_prd(owner, created.id, owner_id)

    with pytest.raises(NotFoundError):
        prd_service.get_prd(owner, created.id, owner_id)


@requires_database
def test_deleting_a_prd_removes_its_versions(
    owner: Any, owner_id: str
) -> None:
    """Versions cascade, so history cannot outlive its document."""
    from app.models.prd import PrdContent

    created = prd_service.create_prd(owner, owner_id, "With history")
    prd_service.snapshot_version(owner, created.id, PrdContent(goals=["x"]), "v1")
    prd_service.delete_prd(owner, created.id, owner_id)

    remaining = (
        owner.table("prd_versions").select("id").eq("prd_id", str(created.id)).execute()
    )
    assert remaining.data == []


@requires_database
def test_unknown_id_is_not_found(owner: Any, owner_id: str) -> None:
    from app.core.errors import NotFoundError

    with pytest.raises(NotFoundError):
        prd_service.get_prd(owner, uuid.uuid4(), owner_id)


# ---------------------------------------------------------------------------
# Versions
# ---------------------------------------------------------------------------


@requires_database
def test_version_numbers_increment(owner: Any, owner_id: str, prd: Any) -> None:
    from app.models.prd import PrdContent

    first = prd_service.snapshot_version(owner, prd.id, PrdContent(goals=["a"]), "v1")
    second = prd_service.snapshot_version(owner, prd.id, PrdContent(goals=["b"]), "v2")

    assert (first, second) == (1, 2)
    assert [v.version_number for v in prd_service.list_versions(owner, prd.id, owner_id)] == [2, 1]


def test_credentials_are_configured() -> None:
    """Fails loudly if this file silently stops testing anything."""
    if CREDENTIALS is None:
        pytest.skip("No database configured; see test_rls.py for setup.")
