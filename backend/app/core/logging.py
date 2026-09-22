"""Logging setup and per-request correlation ids.

The correlation id is generated once per request, attached to every log line
emitted while handling it, and echoed back in the ``X-Correlation-ID`` header
(and inside 5xx error bodies) so a user-reported failure can be found in the
logs.
"""

from __future__ import annotations

import logging
import sys
import uuid
from contextvars import ContextVar

_correlation_id: ContextVar[str] = ContextVar("correlation_id", default="-")

#: Secrets must never be written to a log, even by accident.
_REDACT_KEYS = (
    "api_key",
    "apikey",
    "authorization",
    "anon_key",
    "service_role",
    "jwt_secret",
    "password",
    "access_token",
    "refresh_token",
)


def set_correlation_id(value: str | None = None) -> str:
    cid = value or str(uuid.uuid4())
    _correlation_id.set(cid)
    return cid


def get_correlation_id() -> str:
    return _correlation_id.get()


class CorrelationIdFilter(logging.Filter):
    """Make ``%(correlation_id)s`` available to every record."""

    def filter(self, record: logging.LogRecord) -> bool:
        if not hasattr(record, "correlation_id"):
            record.correlation_id = get_correlation_id()
        return True


class RedactingFilter(logging.Filter):
    """Coarse backstop against logging a secret.

    This is not a substitute for not logging secrets in the first place; it
    exists so that one careless ``logger.info(payload)`` does not put an API
    key on disk.
    """

    def filter(self, record: logging.LogRecord) -> bool:
        try:
            message = record.getMessage()
        except Exception:  # pragma: no cover - defensive
            return True
        lowered = message.lower()
        if any(key in lowered for key in _REDACT_KEYS):
            record.msg = _redact(message)
            record.args = ()
        return True


def _redact(message: str) -> str:
    out: list[str] = []
    for token in message.split():
        lowered = token.lower()
        if any(key in lowered for key in _REDACT_KEYS) and (
            "=" in token or ":" in token
        ):
            separator = "=" if "=" in token else ":"
            head, _, _ = token.partition(separator)
            out.append(f"{head}{separator}[REDACTED]")
        elif token.startswith(("sk-", "eyJ")) and len(token) > 20:
            out.append("[REDACTED]")
        else:
            out.append(token)
    return " ".join(out)


def configure_logging(level: str = "INFO") -> None:
    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(
        logging.Formatter(
            "%(asctime)s %(levelname)-8s [%(correlation_id)s] %(name)s: %(message)s",
            datefmt="%H:%M:%S",
        )
    )
    handler.addFilter(CorrelationIdFilter())
    handler.addFilter(RedactingFilter())

    root = logging.getLogger()
    root.handlers.clear()
    root.addHandler(handler)
    root.setLevel(level.upper())

    # uvicorn installs its own noisy handlers; route them through ours.
    for name in ("uvicorn", "uvicorn.error", "uvicorn.access"):
        lg = logging.getLogger(name)
        lg.handlers.clear()
        lg.propagate = True

    # httpx logs every outbound request at INFO, which is mostly noise here.
    logging.getLogger("httpx").setLevel("WARNING")
    logging.getLogger("hpack").setLevel("WARNING")
