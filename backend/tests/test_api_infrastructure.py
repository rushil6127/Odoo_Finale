import pytest
from datetime import timedelta
from flask import Blueprint
from flask_jwt_extended import jwt_required, create_access_token
from marshmallow import Schema, fields
from sqlalchemy.exc import IntegrityError, SQLAlchemyError
from backend.app.common.responses import success_response, error_response
from backend.app.common.errors import (
    AppException,
    BadRequestException,
    BusinessRuleException,
    UnauthorizedException,
    ForbiddenException,
    NotFoundException,
    ConflictException,
    BookingConflictException,
    InsufficientStockException,
    ValidationException,
)
from backend.app.common.validation import validate_schema

# Blueprint used specifically for testing API infrastructure
test_api_bp = Blueprint("test_api", __name__)


class SamplePayloadSchema(Schema):
    name = fields.String(required=True)
    count = fields.Integer(required=True)
    email = fields.Email(required=False)


@test_api_bp.route("/test/success-default", methods=["GET"])
def route_success_default():
    return success_response()


@test_api_bp.route("/test/success-data", methods=["GET"])
def route_success_data():
    return success_response(
        data={"item_id": 42, "status": "active"},
        message="Item fetched successfully",
        status_code=200,
        meta={"page": 1, "total": 1},
    )


@test_api_bp.route("/test/validation", methods=["POST"])
@validate_schema(SamplePayloadSchema)
def route_validation(validated_data):
    return success_response(data=validated_data, status_code=201)


@test_api_bp.route("/test/business-rule-error", methods=["GET"])
def route_business_rule_error():
    raise BusinessRuleException(
        message="Maximum two bookings per member per day limit reached",
        details={"member_id": 101, "limit": 2},
    )


@test_api_bp.route("/test/unauthorized-error", methods=["GET"])
def route_unauthorized_error():
    raise UnauthorizedException("Authentication token is required")


@test_api_bp.route("/test/forbidden-error", methods=["GET"])
def route_forbidden_error():
    raise ForbiddenException("You do not have permission to access this resource")


@test_api_bp.route("/test/not-found-error", methods=["GET"])
def route_not_found_error():
    raise NotFoundException("Court with ID 42 was not found")


@test_api_bp.route("/test/booking-conflict-error", methods=["GET"])
def route_booking_conflict():
    raise BookingConflictException()


@test_api_bp.route("/test/insufficient-stock-error", methods=["GET"])
def route_insufficient_stock():
    raise InsufficientStockException()


@test_api_bp.route("/test/integrity-error", methods=["GET"])
def route_integrity_error():
    raise IntegrityError("statement", ["params"], Exception("UNIQUE constraint failed: members.email"))


@test_api_bp.route("/test/sqlalchemy-error", methods=["GET"])
def route_sqlalchemy_error():
    raise SQLAlchemyError("Sensitive internal DB query failed")


@test_api_bp.route("/test/internal-error", methods=["GET"])
def route_internal_error():
    raise RuntimeError("Internal critical failure with sensitive details: /etc/passwd")


@test_api_bp.route("/test/jwt-protected", methods=["GET"])
@jwt_required()
def route_jwt_protected():
    return success_response(data={"secret": "accessible"})


@pytest.fixture(autouse=True)
def register_test_blueprint(app):
    """Register the test blueprint once on the test app."""
    if "test_api" not in app.blueprints:
        app.register_blueprint(test_api_bp)


# ---------------------------------------------------------
# Test Cases
# ---------------------------------------------------------

def test_success_response_default(client):
    """Test standard success response with default empty data object."""
    response = client.get("/test/success-default")
    assert response.status_code == 200
    data = response.get_json()
    assert data["success"] is True
    assert data["data"] == {}


def test_success_response_with_data_and_meta(client):
    """Test standard success response with data, message, and pagination meta."""
    response = client.get("/test/success-data")
    assert response.status_code == 200
    data = response.get_json()
    assert data["success"] is True
    assert data["data"]["item_id"] == 42
    assert data["message"] == "Item fetched successfully"
    assert data["meta"]["page"] == 1


def test_validation_success(client):
    """Test that valid request body passes validation decorator."""
    payload = {"name": "Tennis Racket", "count": 5, "email": "member@club.com"}
    response = client.post("/test/validation", json=payload)
    assert response.status_code == 201
    data = response.get_json()
    assert data["success"] is True
    assert data["data"]["name"] == "Tennis Racket"
    assert data["data"]["count"] == 5


def test_validation_failure_missing_fields(client):
    """Test validation failure on missing required fields returns 422 envelope."""
    payload = {"name": "Tennis Racket"}  # missing count
    response = client.post("/test/validation", json=payload)
    assert response.status_code == 422
    data = response.get_json()
    assert data["success"] is False
    assert data["error"]["code"] == "VALIDATION_ERROR"
    assert "count" in data["error"]["details"]


def test_validation_failure_invalid_email(client):
    """Test validation failure on invalid email format returns 422 envelope."""
    payload = {"name": "Racket", "count": 1, "email": "not-an-email"}
    response = client.post("/test/validation", json=payload)
    assert response.status_code == 422
    data = response.get_json()
    assert data["success"] is False
    assert data["error"]["code"] == "VALIDATION_ERROR"
    assert "email" in data["error"]["details"]


def test_validation_failure_missing_json_body(client):
    """Test request without JSON body returns 422 envelope."""
    response = client.post(
        "/test/validation",
        data="non-json-raw-text",
        content_type="text/plain",
    )
    assert response.status_code == 422
    data = response.get_json()
    assert data["success"] is False
    assert data["error"]["code"] == "VALIDATION_ERROR"


def test_business_rule_exception(client):
    """Test business rule violation returns standard 400 envelope."""
    response = client.get("/test/business-rule-error")
    assert response.status_code == 400
    data = response.get_json()
    assert data["success"] is False
    assert data["error"]["code"] == "BUSINESS_RULE_VIOLATION"
    assert "Maximum two bookings" in data["error"]["message"]
    assert data["error"]["details"]["limit"] == 2


def test_unauthorized_exception(client):
    """Test explicit unauthorized exception returns standard 401 envelope."""
    response = client.get("/test/unauthorized-error")
    assert response.status_code == 401
    data = response.get_json()
    assert data["success"] is False
    assert data["error"]["code"] == "UNAUTHORIZED"


def test_forbidden_exception(client):
    """Test forbidden exception returns standard 403 envelope."""
    response = client.get("/test/forbidden-error")
    assert response.status_code == 403
    data = response.get_json()
    assert data["success"] is False
    assert data["error"]["code"] == "FORBIDDEN"


def test_not_found_exception(client):
    """Test explicit not found exception returns standard 404 envelope."""
    response = client.get("/test/not-found-error")
    assert response.status_code == 404
    data = response.get_json()
    assert data["success"] is False
    assert data["error"]["code"] == "NOT_FOUND"


def test_unknown_route_returns_standard_404(client):
    """Test unregistered route returns standard 404 envelope."""
    response = client.get("/api/v1/completely-unknown-route")
    assert response.status_code == 404
    data = response.get_json()
    assert data["success"] is False
    assert data["error"]["code"] == "NOT_FOUND"
    assert "message" in data["error"]


def test_method_not_allowed_returns_standard_405(client):
    """Test sending invalid HTTP method returns standard 405 envelope."""
    response = client.post("/test/success-default")
    assert response.status_code == 405
    data = response.get_json()
    assert data["success"] is False
    assert data["error"]["code"] == "METHOD_NOT_ALLOWED"


def test_booking_conflict_exception(client):
    """Test court booking conflict returns standard 409 envelope."""
    response = client.get("/test/booking-conflict-error")
    assert response.status_code == 409
    data = response.get_json()
    assert data["success"] is False
    assert data["error"]["code"] == "BOOKING_CONFLICT"
    assert data["error"]["message"] == "The court is already booked for this time."


def test_insufficient_stock_exception(client):
    """Test insufficient inventory stock returns standard 409 envelope."""
    response = client.get("/test/insufficient-stock-error")
    assert response.status_code == 409
    data = response.get_json()
    assert data["success"] is False
    assert data["error"]["code"] == "INSUFFICIENT_STOCK"


def test_database_integrity_error_returns_409(client):
    """Test DB uniqueness / constraint error returns clean 409 conflict envelope."""
    response = client.get("/test/integrity-error")
    assert response.status_code == 409
    data = response.get_json()
    assert data["success"] is False
    assert data["error"]["code"] == "CONFLICT"
    assert "UNIQUE constraint failed" not in data["error"]["message"]


def test_sqlalchemy_error_returns_500_without_leak(client):
    """Test database error returns 500 without leaking raw SQL or schema internals."""
    response = client.get("/test/sqlalchemy-error")
    assert response.status_code == 500
    data = response.get_json()
    assert data["success"] is False
    assert data["error"]["code"] == "DATABASE_ERROR"
    assert "Sensitive internal" not in data["error"]["message"]


def test_unhandled_exception_returns_500_without_leak(client):
    """Test unhandled Python exception returns 500 without leaking trace or internals."""
    response = client.get("/test/internal-error")
    assert response.status_code == 500
    data = response.get_json()
    assert data["success"] is False
    assert data["error"]["code"] == "INTERNAL_SERVER_ERROR"
    assert "/etc/passwd" not in data["error"]["message"]
    assert "traceback" not in data["error"]


def test_jwt_missing_token_returns_401_envelope(client):
    """Test accessing protected route without JWT token returns 401 envelope."""
    response = client.get("/test/jwt-protected")
    assert response.status_code == 401
    data = response.get_json()
    assert data["success"] is False
    assert data["error"]["code"] == "UNAUTHORIZED"
    assert "message" in data["error"]


def test_jwt_invalid_token_returns_401_envelope(client):
    """Test accessing protected route with forged/invalid token returns 401 envelope."""
    headers = {"Authorization": "Bearer invalid.fake.token"}
    response = client.get("/test/jwt-protected", headers=headers)
    assert response.status_code == 401
    data = response.get_json()
    assert data["success"] is False
    assert data["error"]["code"] == "INVALID_TOKEN"


def test_jwt_expired_token_returns_401_envelope(app, client):
    """Test accessing protected route with expired token returns 401 envelope."""
    with app.app_context():
        # Create token that expired 10 minutes ago
        expired_token = create_access_token(
            identity="user123",
            expires_delta=timedelta(seconds=-600),
        )

    headers = {"Authorization": f"Bearer {expired_token}"}
    response = client.get("/test/jwt-protected", headers=headers)
    assert response.status_code == 401
    data = response.get_json()
    assert data["success"] is False
    assert data["error"]["code"] == "TOKEN_EXPIRED"
    assert "expired" in data["error"]["message"].lower()


def test_jwt_valid_token_success(app, client):
    """Test accessing protected route with valid JWT token succeeds."""
    with app.app_context():
        valid_token = create_access_token(
            identity="user123",
            expires_delta=timedelta(hours=1),
        )

    headers = {"Authorization": f"Bearer {valid_token}"}
    response = client.get("/test/jwt-protected", headers=headers)
    assert response.status_code == 200
    data = response.get_json()
    assert data["success"] is True
    assert data["data"]["secret"] == "accessible"
