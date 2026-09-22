"""Health endpoints and the error envelope.

These are the Phase 1 acceptance checks: the app boots, the unauthenticated
endpoints answer, and failures come back in the one documented shape.
"""

from __future__ import annotations

from unittest.mock import MagicMock, patch

from fastapi.testclient import TestClient


def test_health_returns_ok(client: TestClient) -> None:
    response = client.get("/api/health")

    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "ok"
    assert body["version"]


def test_health_needs_no_auth(client: TestClient) -> None:
    """Health checks must work before a user has signed in."""
    assert client.get("/api/health").status_code == 200


def test_health_db_ok_when_query_succeeds(client: TestClient) -> None:
    fake_client = MagicMock()
    fake_client.table.return_value.select.return_value.limit.return_value.execute.return_value = MagicMock()

    with patch("app.routers.health.get_anon_supabase_client", return_value=fake_client):
        response = client.get("/api/health/db")

    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "ok"
    assert isinstance(body["latency_ms"], (int, float))


def test_health_db_returns_503_when_unreachable(client: TestClient) -> None:
    """The frontend's 'database unreachable' banner keys off this 503."""
    with patch(
        "app.routers.health.get_anon_supabase_client",
        side_effect=ConnectionError("no route to host"),
    ):
        response = client.get("/api/health/db")

    assert response.status_code == 503
    assert response.json()["status"] == "error"


def test_health_db_does_not_leak_internal_detail(client: TestClient) -> None:
    """Provider and driver error strings must never reach the client."""
    with patch(
        "app.routers.health.get_anon_supabase_client",
        side_effect=ConnectionError("postgres://user:hunter2@10.0.0.1:5432 refused"),
    ):
        response = client.get("/api/health/db")

    assert "hunter2" not in response.text
    assert "10.0.0.1" not in response.text


def test_correlation_id_header_is_returned(client: TestClient) -> None:
    """Every response carries an id that ties it to its server-side logs."""
    response = client.get("/api/health")
    assert response.headers.get("X-Correlation-ID")


def test_unknown_route_uses_the_error_envelope(client: TestClient) -> None:
    response = client.get("/api/does-not-exist")

    assert response.status_code == 404
    body = response.json()
    assert "error" in body
    assert set(body["error"]) >= {"code", "message"}
