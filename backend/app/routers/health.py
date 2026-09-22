"""Liveness and dependency health. The only unauthenticated endpoints."""

from __future__ import annotations

import logging
import time

from fastapi import APIRouter
from fastapi.responses import JSONResponse

from app.config import settings
from app.deps import get_anon_supabase_client

logger = logging.getLogger("prd.health")

router = APIRouter(prefix="/api/health", tags=["health"])


@router.get("")
@router.get("/")
async def health() -> dict[str, str]:
    """Process is up. Says nothing about dependencies."""
    return {
        "status": "ok",
        "version": settings.APP_VERSION,
        "environment": settings.ENVIRONMENT,
    }


@router.get("/db")
async def health_db() -> JSONResponse:
    """Round-trip the database.

    Runs as the anonymous role, so RLS returns zero rows - that is the
    expected result. We are proving reachability, not reading data. A 503
    here is what the frontend's 'database unreachable' banner keys off.
    """
    started = time.perf_counter()
    try:
        client = get_anon_supabase_client()
        client.table("prds").select("id").limit(1).execute()
    except Exception as exc:
        latency_ms = round((time.perf_counter() - started) * 1000, 1)
        logger.warning("DB health check failed after %sms: %s", latency_ms, exc)
        return JSONResponse(
            status_code=503,
            content={
                "status": "error",
                "latency_ms": latency_ms,
                "detail": "Could not reach Supabase. Check SUPABASE_URL and "
                "that the migrations have been run.",
            },
        )

    return JSONResponse(
        status_code=200,
        content={
            "status": "ok",
            "latency_ms": round((time.perf_counter() - started) * 1000, 1),
        },
    )
