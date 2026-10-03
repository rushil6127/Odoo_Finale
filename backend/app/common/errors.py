import logging
from typing import Optional, Any
from flask import Flask
from marshmallow import ValidationError
from werkzeug.exceptions import HTTPException
from sqlalchemy.exc import IntegrityError, SQLAlchemyError
from flask_jwt_extended import JWTManager
from backend.app.common.responses import error_response

logger = logging.getLogger(__name__)


# ---------------------------------------------------------
# Custom Domain & Application Exception Hierarchy
# ---------------------------------------------------------

class AppException(Exception):
    """Base application exception for all domain and operational errors."""

    code = "APPLICATION_ERROR"
    message = "An application error occurred"
    status_code = 400

    def __init__(
        self,
        message: Optional[str] = None,
        code: Optional[str] = None,
        status_code: Optional[int] = None,
        details: Optional[Any] = None,
    ):
        super().__init__(message or self.message)
        self.message = message or self.message
        self.code = code or self.code
        self.status_code = status_code or self.status_code
        self.details = details


class BadRequestException(AppException):
    code = "BAD_REQUEST"
    message = "Invalid request"
    status_code = 400


class BusinessRuleException(AppException):
    code = "BUSINESS_RULE_VIOLATION"
    message = "Operation violates a business rule"
    status_code = 400


class UnauthorizedException(AppException):
    code = "UNAUTHORIZED"
    message = "Authentication required"
    status_code = 401


class ForbiddenException(AppException):
    code = "FORBIDDEN"
    message = "Access denied"
    status_code = 403


class NotFoundException(AppException):
    code = "NOT_FOUND"
    message = "Resource not found"
    status_code = 404


class MethodNotAllowedException(AppException):
    code = "METHOD_NOT_ALLOWED"
    message = "Method not allowed for this endpoint"
    status_code = 405


class ConflictException(AppException):
    code = "CONFLICT"
    message = "Resource conflict occurred"
    status_code = 409


class BookingConflictException(ConflictException):
    code = "BOOKING_CONFLICT"
    message = "The court is already booked for this time."


class InsufficientStockException(ConflictException):
    code = "INSUFFICIENT_STOCK"
    message = "Requested product is out of stock."


class ValidationException(AppException):
    code = "VALIDATION_ERROR"
    message = "Validation failed"
    status_code = 422


# ---------------------------------------------------------
# JWT Error Handler Registration
# ---------------------------------------------------------

def register_jwt_error_handlers(jwt_manager: JWTManager):
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


# ---------------------------------------------------------
# Flask Global Error Handler Registration
# ---------------------------------------------------------

def register_error_handlers(app: Flask, jwt_manager: Optional[JWTManager] = None):
    """Register global JSON error handlers on the Flask application."""

    if jwt_manager is not None:
        register_jwt_error_handlers(jwt_manager)

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
        logger.warning("Database integrity error: %s", str(e))
        return error_response(
            code="CONFLICT",
            message="A database integrity or uniqueness constraint was violated.",
            status_code=409,
        )

    @app.errorhandler(SQLAlchemyError)
    def handle_sqlalchemy_error(e: SQLAlchemyError):
        logger.exception("Database error occurred: %s", str(e))
        return error_response(
            code="DATABASE_ERROR",
            message="A database error occurred. Please try again later.",
            status_code=500,
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
        logger.exception("Unhandled internal exception: %s", str(e))
        return error_response(
            code="INTERNAL_SERVER_ERROR",
            message="An unexpected error occurred. Please try again later.",
            status_code=500,
        )
