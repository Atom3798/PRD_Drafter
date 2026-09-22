"""Error taxonomy and the single JSON error envelope the API returns.

Every error the client sees looks like::

    { "error": { "code": "PRD_NOT_FOUND", "message": "...", "details": {} } }

Provider strings and stack traces never reach the client. They are logged
server-side against a correlation id, and that id is returned in ``details``
so a user can quote it in a bug report.
"""

from __future__ import annotations

import logging
import uuid
from typing import Any

from fastapi import FastAPI, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

logger = logging.getLogger("prd.errors")


class AppError(Exception):
    """Base for every error we raise deliberately."""

    code: str = "INTERNAL_ERROR"
    status_code: int = status.HTTP_500_INTERNAL_SERVER_ERROR
    message: str = "Something went wrong."

    def __init__(
        self,
        message: str | None = None,
        *,
        details: dict[str, Any] | None = None,
    ) -> None:
        self.message = message or self.message
        self.details = details or {}
        super().__init__(self.message)


# ---- 4xx ----------------------------------------------------------------


class AuthError(AppError):
    code = "UNAUTHENTICATED"
    status_code = status.HTTP_401_UNAUTHORIZED
    message = "Your session has expired. Please sign in again."


class NotFoundError(AppError):
    """Also used for 'exists but not yours'.

    We never distinguish the two: telling a caller that a PRD exists but
    belongs to someone else is an information leak.
    """

    code = "PRD_NOT_FOUND"
    status_code = status.HTTP_404_NOT_FOUND
    message = "Not found, or you don't have access to it."


class ValidationFailedError(AppError):
    code = "VALIDATION_FAILED"
    status_code = 422  # renamed across starlette versions; the number is stable
    message = "Some of the submitted data was invalid."


class ConflictError(AppError):
    code = "CONFLICT"
    status_code = status.HTTP_409_CONFLICT
    message = "That conflicts with the current state of this PRD."


class RateLimitError(AppError):
    code = "RATE_LIMITED"
    status_code = status.HTTP_429_TOO_MANY_REQUESTS
    message = "You've hit the limit for now. Try again shortly."


# ---- 5xx ----------------------------------------------------------------


class ConfigError(AppError):
    code = "CONFIG_ERROR"
    status_code = status.HTTP_500_INTERNAL_SERVER_ERROR
    message = "The server is misconfigured."


class AIValidationError(AppError):
    """The model returned JSON we could not coerce into the schema, twice."""

    code = "AI_INVALID_RESPONSE"
    status_code = status.HTTP_502_BAD_GATEWAY
    message = "The AI returned a response we couldn't read. Please try again."


class AIProviderError(AppError):
    code = "AI_PROVIDER_ERROR"
    status_code = status.HTTP_502_BAD_GATEWAY
    message = "The AI service didn't respond. Please try again in a moment."


class GenerationFailedError(AppError):
    code = "GENERATION_FAILED"
    status_code = status.HTTP_502_BAD_GATEWAY
    message = "We couldn't generate your PRD. Your answers are safe - try again."


class DatabaseError(AppError):
    code = "DATABASE_ERROR"
    status_code = status.HTTP_503_SERVICE_UNAVAILABLE
    message = "We couldn't reach the database. Please try again shortly."


# ---- envelope + handlers ------------------------------------------------


def error_body(
    code: str, message: str, details: dict[str, Any] | None = None
) -> dict[str, Any]:
    return {"error": {"code": code, "message": message, "details": details or {}}}


def register_exception_handlers(app: FastAPI) -> None:
    """Attach handlers so *every* failure exits through the same envelope."""

    @app.exception_handler(AppError)
    async def _app_error(_: Request, exc: AppError) -> JSONResponse:
        details = dict(exc.details)
        if exc.status_code >= 500:
            correlation_id = str(uuid.uuid4())
            details["correlation_id"] = correlation_id
            logger.error(
                "%s: %s", exc.code, exc, extra={"correlation_id": correlation_id}
            )
        return JSONResponse(
            status_code=exc.status_code,
            content=error_body(exc.code, exc.message, details),
            headers=(
                {"Retry-After": str(details["retry_after"])}
                if "retry_after" in details
                else None
            ),
        )

    @app.exception_handler(RequestValidationError)
    async def _request_validation(
        _: Request, exc: RequestValidationError
    ) -> JSONResponse:
        fields = [
            {
                "field": ".".join(str(p) for p in err["loc"][1:]) or "body",
                "problem": err["msg"],
            }
            for err in exc.errors()
        ]
        return JSONResponse(
            status_code=422,
            content=error_body(
                "VALIDATION_FAILED",
                "Some of the submitted data was invalid.",
                {"fields": fields},
            ),
        )

    @app.exception_handler(StarletteHTTPException)
    async def _http_exception(
        _: Request, exc: StarletteHTTPException
    ) -> JSONResponse:
        codes = {
            401: "UNAUTHENTICATED",
            403: "FORBIDDEN",
            404: "NOT_FOUND",
            405: "METHOD_NOT_ALLOWED",
            429: "RATE_LIMITED",
        }
        return JSONResponse(
            status_code=exc.status_code,
            content=error_body(
                codes.get(exc.status_code, "HTTP_ERROR"), str(exc.detail)
            ),
        )

    @app.exception_handler(Exception)
    async def _unhandled(_: Request, exc: Exception) -> JSONResponse:
        """Last resort. The client gets an id; the log gets the traceback."""
        correlation_id = str(uuid.uuid4())
        logger.exception(
            "Unhandled exception", extra={"correlation_id": correlation_id}
        )
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content=error_body(
                "INTERNAL_ERROR",
                "Something went wrong on our end. Please try again.",
                {"correlation_id": correlation_id},
            ),
        )
