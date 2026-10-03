"""Centralized Exception and Error Handling Middleware for Champions Club backend."""
import logging
from typing import Optional, Any
from flask import Flask, g
from marshmallow import ValidationError
from werkzeug.exceptions import HTTPException
from sqlalchemy.exc import IntegrityError, SQLAlchemyError
from flask_jwt_extended import JWTManager

from backend.app.common.responses import error_response
from backend.app.common.errors import (
    AppException,
    BadRequestException,
    BusinessRuleException,
    UnauthorizedException,
    ForbiddenException,
    NotFoundException,
    MethodNotAllowedException,
    ConflictException,
    BookingConflictException,
    InsufficientStockException,
    ValidationException,
    TooManyRequestsException,
)

logger = logging.getLogger("backend.middleware.error_handler")


def register_jwt_error_callbacks(jwt_manager: JWTManager) -> None:
    """Register custom JSON error callbacks on JWTManager."""

    @jwt_manager.unauthorized_loader
    def custom_unauthorized_response(err_str: str):
        return error_response(
            code="UNAUTHORIZED",
            message=err_str or "Missing Authorization Header",
            status_code=401,
        )

    @jwt_manager.invalid_token_loader
    def custom_invalid_token_response(err_str: str):
        return error_response(
            code="INVALID_TOKEN",
            message=err_str or "Invalid JWT token",
            status_code=401,
        )

    @jwt_manager.expired_token_loader
    def custom_expired_token_response(jwt_header, jwt_payload):
        return error_response(
            code="TOKEN_EXPIRED",
            message="Token has expired",
            status_code=401,
        )

    @jwt_manager.revoked_token_loader
    def custom_revoked_token_response(jwt_header, jwt_payload):
        return error_response(
            code="TOKEN_REVOKED",
            message="Token has been revoked",
            status_code=401,
        )

    @jwt_manager.needs_fresh_token_loader
    def custom_needs_fresh_token_response(jwt_header, jwt_payload):
        return error_response(
            code="FRESH_TOKEN_REQUIRED",
            message="Fresh token required to access this resource",
            status_code=401,
        )


def register_error_handler_middleware(app: Flask, jwt_manager: Optional[JWTManager] = None) -> None:
    """Register global JSON error handlers and JWT callbacks on the Flask application."""

    if jwt_manager is not None:
        register_jwt_error_callbacks(jwt_manager)

    @app.errorhandler(AppException)
    def handle_app_exception(e: AppException):
        return error_response(
            code=e.code,
            message=e.message,
            status_code=e.status_code,
            details=e.details,
        )

    @app.errorhandler(ValidationError)
    def handle_marshmallow_validation(e: ValidationError):
        return error_response(
            code="VALIDATION_ERROR",
            message="Invalid request payload",
            status_code=422,
            details=e.messages,
        )

    @app.errorhandler(IntegrityError)
    def handle_integrity_error(e: IntegrityError):
        req_id = getattr(g, "request_id", "-")
        logger.warning("Database integrity error [request_id=%s]: %s", req_id, str(e))
        return error_response(
            code="CONFLICT",
            message="A database integrity or uniqueness constraint was violated.",
            status_code=409,
        )

    @app.errorhandler(SQLAlchemyError)
    def handle_sqlalchemy_error(e: SQLAlchemyError):
        req_id = getattr(g, "request_id", "-")
        logger.exception("Database error occurred [request_id=%s]: %s", req_id, str(e))
        return error_response(
            code="DATABASE_ERROR",
            message="A database error occurred. Please try again later.",
            status_code=500,
        )

    try:
        from flask_limiter.errors import RateLimitExceeded

        @app.errorhandler(RateLimitExceeded)
        def handle_rate_limit_exceeded(e: RateLimitExceeded):
            req_id = getattr(g, "request_id", "-")
            logger.warning("Rate limit exceeded [request_id=%s]: %s", req_id, str(e.description))
            return error_response(
                code="TOO_MANY_REQUESTS",
                message="Too many requests. Please try again later.",
                status_code=429,
                details={"retry_after": getattr(e, "retry_after", None)} if getattr(e, "retry_after", None) else None,
            )
    except ImportError:
        pass

    @app.errorhandler(429)
    def handle_429(e):
        return error_response(
            code="TOO_MANY_REQUESTS",
            message="Too many requests. Please try again later.",
            status_code=429,
        )

    @app.errorhandler(HTTPException)
    def handle_http_exception(e: HTTPException):
        code_name = e.name.upper().replace(" ", "_")
        return error_response(
            code=code_name,
            message=e.description or str(e),
            status_code=e.code or 500,
        )

    @app.errorhandler(Exception)
    def handle_generic_exception(e: Exception):
        req_id = getattr(g, "request_id", "-")
        logger.exception("Unhandled internal exception [request_id=%s]: %s", req_id, str(e))
        return error_response(
            code="INTERNAL_SERVER_ERROR",
            message="An unexpected error occurred. Please try again later.",
            status_code=500,
        )
