"""Request and Response Logging Middleware for Champions Club backend."""
import time
import logging
from typing import Optional, Set
from flask import Flask, Response, g, request, has_request_context

logger = logging.getLogger("backend.middleware.request_logging")

# Endpoints that are skipped from standard INFO logs to reduce noise
NOISY_ENDPOINTS: Set[str] = {"/health", "/favicon.ico"}

# Query parameter keys that must never appear in logs
SENSITIVE_PARAM_KEYS: Set[str] = {
    "password",
    "token",
    "access_token",
    "refresh_token",
    "id_token",
    "secret",
    "key",
    "credential",
    "credentials",
    "cvv",
    "card",
    "pin",
    "signature",
    "razorpay_signature",
    "razorpay_secret",
}


def _get_safe_path_with_query() -> str:
    """Return path and query string with sensitive parameters sanitized."""
    path = request.path
    if not request.args:
        return path

    safe_args = []
    for k, v in request.args.items():
        if k.lower() in SENSITIVE_PARAM_KEYS or any(s in k.lower() for s in ("secret", "token", "pass", "key")):
            safe_args.append(f"{k}=[REDACTED]")
        else:
            safe_args.append(f"{k}={v}")

    return f"{path}?{'&'.join(safe_args)}"


def register_request_logging_middleware(app: Flask) -> None:
    """Register timing and structured request/response logging hooks on the Flask application."""

    @app.before_request
    def start_timer():
        g.request_start_time = time.perf_counter()

    @app.after_request
    def log_request_outcome(response: Response) -> Response:
        start_time = getattr(g, "request_start_time", None)
        if start_time is not None:
            duration_ms = round((time.perf_counter() - start_time) * 1000, 2)
        else:
            duration_ms = 0.0

        path = request.path
        if path in NOISY_ENDPOINTS:
            # Skip or log at DEBUG level
            logger.debug(
                "request_id=%s method=%s path=%s status=%d duration_ms=%.2f",
                getattr(g, "request_id", "-"),
                request.method,
                path,
                response.status_code,
                duration_ms,
            )
            return response

        req_id = getattr(g, "request_id", "-")
        user_id = getattr(g, "auth_user_id", None)
        role = getattr(g, "auth_role", None)

        safe_path = _get_safe_path_with_query()
        status_code = response.status_code

        log_msg = (
            f"request_id={req_id} method={request.method} path={safe_path} "
            f"status={status_code} duration_ms={duration_ms:.2f} "
            f"user_id={user_id or '-'} role={role or '-'}"
        )

        if status_code >= 500:
            logger.error(log_msg)
        elif status_code >= 400:
            logger.warning(log_msg)
        else:
            logger.info(log_msg)

        return response
