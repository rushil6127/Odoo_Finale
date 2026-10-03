import logging
from flask import Flask
from marshmallow import ValidationError
from werkzeug.exceptions import HTTPException
from backend.app.common.responses import error_response

logger = logging.getLogger(__name__)


class AppException(Exception):
    """Base application exception for handled domain errors."""

    def __init__(
        self,
        code: str = "APPLICATION_ERROR",
        message: str = "An application error occurred",
        status_code: int = 400,
        details=None,
    ):
        super().__init__(message)
        self.code = code
        self.message = message
        self.status_code = status_code
        self.details = details


class NotFoundException(AppException):
    def __init__(self, message: str = "Resource not found", details=None):
        super().__init__(
            code="NOT_FOUND",
            message=message,
            status_code=404,
            details=details,
        )


class UnauthorizedException(AppException):
    def __init__(self, message: str = "Authentication required", details=None):
        super().__init__(
            code="UNAUTHORIZED",
            message=message,
            status_code=401,
            details=details,
        )


class ForbiddenException(AppException):
    def __init__(self, message: str = "Access denied", details=None):
        super().__init__(
            code="FORBIDDEN",
            message=message,
            status_code=403,
            details=details,
        )


class ConflictException(AppException):
    def __init__(self, message: str = "Resource conflict", details=None):
        super().__init__(
            code="CONFLICT",
            message=message,
            status_code=409,
            details=details,
        )


class ValidationException(AppException):
    def __init__(self, message: str = "Validation failed", details=None):
        super().__init__(
            code="VALIDATION_ERROR",
            message=message,
            status_code=422,
            details=details,
        )


def register_error_handlers(app: Flask):
    """Register custom JSON error handlers on the Flask application."""

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

    @app.errorhandler(HTTPException)
    def handle_http_exception(e: HTTPException):
        code_name = e.name.upper().replace(" ", "_")
        return error_response(
            code=code_name,
            message=e.description,
            status_code=e.code or 500,
        )

    @app.errorhandler(Exception)
    def handle_generic_exception(e: Exception):
        logger.exception("Unhandled server exception: %s", str(e))
        return error_response(
            code="INTERNAL_SERVER_ERROR",
            message="An unexpected error occurred. Please try again later.",
            status_code=500,
        )
