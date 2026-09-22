"""FastAPI application entrypoint.

Run with::

    uvicorn app.main:app --reload --port 8000

This is a long-running ASGI process on purpose. PRD generation takes 30-90
seconds, which is past the execution ceiling of most serverless platforms, so
do not restructure it into short-lived handlers. See the README's Deployment
note.
"""

from __future__ import annotations

import logging
from collections.abc import Awaitable, Callable
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.core.errors import register_exception_handlers
from app.core.logging import configure_logging, set_correlation_id
from app.routers import health

configure_logging(settings.LOG_LEVEL)
logger = logging.getLogger("prd.main")


@asynccontextmanager
async def lifespan(_: FastAPI):
    logger.info(
        "Starting PRD Drafter API v%s (env=%s, ai_provider=%s)",
        settings.APP_VERSION,
        settings.ENVIRONMENT,
        settings.AI_PROVIDER,
    )
    logger.info("CORS origins allowed: %s", ", ".join(settings.CORS_ORIGINS))
    yield
    logger.info("Shutting down.")


app = FastAPI(
    title="PRD Drafter API",
    description="Turns a guided interview into a structured product requirements document.",
    version=settings.APP_VERSION,
    lifespan=lifespan,
    docs_url="/docs" if settings.is_development else None,
    redoc_url=None,
)

# Explicit origins only. A wildcard here would let any site on the internet
# make credentialed calls with a user's token.
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type"],
    expose_headers=["X-Correlation-ID", "Retry-After"],
)


@app.middleware("http")
async def correlation_id_middleware(
    request: Request, call_next: Callable[[Request], Awaitable[Response]]
) -> Response:
    """Tag each request so its log lines can be found later."""
    cid = set_correlation_id(request.headers.get("X-Correlation-ID"))
    response = await call_next(request)
    response.headers["X-Correlation-ID"] = cid
    return response


register_exception_handlers(app)

app.include_router(health.router)


@app.get("/", include_in_schema=False)
async def root() -> dict[str, str]:
    return {
        "service": "PRD Drafter API",
        "version": settings.APP_VERSION,
        "docs": "/docs" if settings.is_development else "disabled",
        "health": "/api/health",
    }
