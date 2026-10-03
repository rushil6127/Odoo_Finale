"""Production Flask Middleware Layer for Champions Club."""
from typing import Optional
from flask import Flask
from flask_jwt_extended import JWTManager

from backend.app.middleware.request_id import (
    register_request_id_middleware,
    get_request_id,
    REQUEST_ID_HEADER,
)
from backend.app.middleware.auth import (
    register_auth_middleware,
    get_auth_context,
)
from backend.app.middleware.request_logging import (
    register_request_logging_middleware,
)
from backend.app.middleware.error_handler import (
    register_error_handler_middleware,
)


def init_middleware(app: Flask, jwt_manager: Optional[JWTManager] = None) -> None:
    """Initialize all middleware components on the Flask application in proper pipeline order.

    Pipeline Order:
      1. Request ID (Correlation ID generation & propagation via X-Request-ID)
      2. Auth Context (Safe JWT identity extraction into request context)
      3. Request Logging (Timing, structured logging, safe metadata)
      4. Centralized Error Handlers (Standardized error envelope & security redaction)
    """
    register_request_id_middleware(app)
    register_auth_middleware(app)
    register_request_logging_middleware(app)
    register_error_handler_middleware(app, jwt_manager=jwt_manager)


__all__ = [
    "init_middleware",
    "register_request_id_middleware",
    "register_auth_middleware",
    "register_request_logging_middleware",
    "register_error_handler_middleware",
    "get_request_id",
    "get_auth_context",
    "REQUEST_ID_HEADER",
]
