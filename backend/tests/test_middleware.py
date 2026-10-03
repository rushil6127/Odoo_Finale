"""Tests for Flask Middleware Layer (Request ID, Logging, Auth Context, Centralized Error Handling)."""
import json
import logging
import pytest
from flask import Blueprint, jsonify
from backend.app.common.errors import (
    BadRequestException,
    ForbiddenException,
    NotFoundException,
    ConflictException,
    ValidationException,
    AppException,
)
from backend.app.middleware import get_request_id, get_auth_context, REQUEST_ID_HEADER


# -----------------------------------------------------------------------------
# Test Blueprint for Error Simulation
# -----------------------------------------------------------------------------
test_middleware_bp = Blueprint("test_middleware", __name__, url_prefix="/api/v1/test-middleware")


@test_middleware_bp.route("/auth-context", methods=["GET"])
def inspect_auth_context():
    context = get_auth_context()
    return jsonify({"success": True, "data": context}), 200


@test_middleware_bp.route("/raise-app-error", methods=["GET"])
def raise_app_error():
    raise BadRequestException("Custom bad request message", details={"field": "test"})


@test_middleware_bp.route("/raise-conflict", methods=["GET"])
def raise_conflict():
    raise ConflictException("Custom conflict message")


@test_middleware_bp.route("/raise-forbidden", methods=["GET"])
def raise_forbidden():
    raise ForbiddenException("Custom forbidden access")


@test_middleware_bp.route("/raise-validation", methods=["GET"])
def raise_validation():
    raise ValidationException("Validation failed on field", details={"age": ["Must be greater than 18"]})


@test_middleware_bp.route("/raise-500", methods=["GET"])
def raise_unhandled_500():
    # Simulate an unexpected critical crash (e.g. division by zero)
    _ = 1 / 0


@pytest.fixture(autouse=True)
def register_test_blueprint(app):
    """Register the simulation test blueprint on the testing application."""
    if "test_middleware" not in app.blueprints:
        app.register_blueprint(test_middleware_bp)


# =============================================================================
# 1. Request ID Middleware Tests
# =============================================================================

def test_request_id_generated_when_missing(client):
    """Verify incoming request without X-Request-ID gets a generated UUID in response header."""
    res = client.get("/health")
    assert res.status_code == 200
    assert REQUEST_ID_HEADER in res.headers
    req_id = res.headers[REQUEST_ID_HEADER]
    assert len(req_id) >= 16


def test_request_id_preserved_when_provided(client):
    """Verify incoming X-Request-ID is preserved and echoed back in response header."""
    custom_id = "custom-trace-uuid-12345"
    res = client.get("/health", headers={REQUEST_ID_HEADER: custom_id})
    assert res.status_code == 200
    assert res.headers[REQUEST_ID_HEADER] == custom_id


def test_request_id_sanitized_when_malformed(client):
    """Verify invalid/unsafe characters in X-Request-ID are replaced with a safe UUID."""
    unsafe_id = "<script>alert(1)</script>; DROP TABLE users;--"
    res = client.get("/health", headers={REQUEST_ID_HEADER: unsafe_id})
    assert res.status_code == 200
    returned_id = res.headers[REQUEST_ID_HEADER]
    assert returned_id != unsafe_id
    assert "<script>" not in returned_id


def test_request_id_present_on_error_responses(client):
    """Verify X-Request-ID header is present even on 404 and 500 error responses."""
    res_404 = client.get("/api/v1/non-existent-endpoint-xyz")
    assert res_404.status_code == 404
    assert REQUEST_ID_HEADER in res_404.headers

    res_500 = client.get("/api/v1/test-middleware/raise-500")
    assert res_500.status_code == 500
    assert REQUEST_ID_HEADER in res_500.headers


# =============================================================================
# 2. Request Logging Middleware Tests
# =============================================================================

def test_request_logging_captures_metadata(client, caplog):
    """Verify request logging captures HTTP method, path, status, and request ID."""
    with caplog.at_level(logging.INFO):
        res = client.get("/api/v1/auth/roles", headers={REQUEST_ID_HEADER: "test-log-id-999"})
        assert res.status_code == 200

    log_records = [rec.message for rec in caplog.records if "test-log-id-999" in rec.message]
    assert len(log_records) > 0
    log_line = log_records[0]
    assert "request_id=test-log-id-999" in log_line
    assert "method=GET" in log_line
    assert "path=/api/v1/auth/roles" in log_line
    assert "status=200" in log_line
    assert "duration_ms=" in log_line


def test_request_logging_redacts_sensitive_query_parameters(client, caplog):
    """Verify query parameters containing passwords, secrets, or tokens are redacted in logs."""
    with caplog.at_level(logging.INFO):
        client.get(
            "/api/v1/auth/roles?token=my_secret_token_123&password=supersecret&category=tennis",
            headers={REQUEST_ID_HEADER: "redact-test-id"},
        )

    log_records = [rec.message for rec in caplog.records if "redact-test-id" in rec.message]
    assert len(log_records) > 0
    log_line = log_records[0]
    assert "token=[REDACTED]" in log_line
    assert "password=[REDACTED]" in log_line
    assert "my_secret_token_123" not in log_line
    assert "supersecret" not in log_line
    assert "category=tennis" in log_line


def test_noisy_health_endpoint_suppression(client, caplog):
    """Verify /health requests are not logged at INFO level to prevent log pollution."""
    with caplog.at_level(logging.INFO, logger="backend.middleware.request_logging"):
        caplog.clear()
        res = client.get("/health")
        assert res.status_code == 200

    info_health_logs = [
        rec for rec in caplog.records
        if rec.levelname == "INFO" and "/health" in rec.message and rec.name == "backend.middleware.request_logging"
    ]
    assert len(info_health_logs) == 0


# =============================================================================
# 3. Authentication Context Middleware Tests
# =============================================================================

def test_public_endpoint_works_without_jwt(client):
    """Verify public endpoints execute smoothly without any Authorization header."""
    res = client.get("/health")
    assert res.status_code == 200

    roles_res = client.get("/api/v1/auth/roles")
    assert roles_res.status_code == 200
    assert roles_res.get_json()["success"] is True


def test_protected_endpoint_rejects_missing_jwt(client):
    """Verify protected endpoints return standardized 401 error when JWT is missing."""
    res = client.get("/api/v1/auth/me")
    assert res.status_code == 401
    data = res.get_json()
    assert data["success"] is False
    assert data["error"]["code"] == "UNAUTHORIZED"
    assert "Missing Authorization Header" in data["error"]["message"]


def test_protected_endpoint_rejects_invalid_jwt(client):
    """Verify protected endpoints return standardized 401 error on malformed JWT."""
    res = client.get(
        "/api/v1/auth/me",
        headers={"Authorization": "Bearer this.is.an.invalid.token"},
    )
    assert res.status_code == 401
    data = res.get_json()
    assert data["success"] is False
    assert data["error"]["code"] == "INVALID_TOKEN"


def test_auth_context_populated_with_valid_jwt(client, member_user, member_headers):
    """Verify authentication context is safely populated in request context for valid token."""
    res = client.get("/api/v1/test-middleware/auth-context", headers=member_headers)
    assert res.status_code == 200
    data = res.get_json()["data"]
    assert data["is_authenticated"] is True
    assert data["user_id"] == str(member_user.id)
    assert data["role"] == "MEMBER"
    assert data["email"] == member_user.email


def test_auth_context_unauthenticated_on_public_request(client):
    """Verify auth context cleanly reflects unauthenticated state on public requests."""
    res = client.get("/api/v1/test-middleware/auth-context")
    assert res.status_code == 200
    data = res.get_json()["data"]
    assert data["is_authenticated"] is False
    assert data["user_id"] is None
    assert data["role"] is None


def test_razorpay_webhook_works_without_user_jwt(client):
    """Verify webhook endpoint does not require user JWT authorization."""
    # Sending empty body with invalid signature reaches webhook handler and gets MISSING_SIGNATURE (401),
    # verifying it was NOT intercepted/blocked by JWT middleware.
    res = client.post("/api/v1/payments/webhook", json={})
    assert res.status_code == 401
    data = res.get_json()
    assert data["success"] is False
    assert data["error"]["code"] == "MISSING_SIGNATURE"


# =============================================================================
# 4. Role Authorization Tests
# =============================================================================

def test_role_authorization_permits_authorized_role(client, owner_headers):
    """Verify OWNER can access administrative user management endpoints."""
    res = client.get("/api/v1/auth/users", headers=owner_headers)
    assert res.status_code == 200
    data = res.get_json()
    assert data["success"] is True
    assert "users" in data["data"]


def test_role_authorization_blocks_unauthorized_role(client, member_headers):
    """Verify MEMBER is forbidden from accessing administrative user management endpoints."""
    res = client.get("/api/v1/auth/users", headers=member_headers)
    assert res.status_code == 403
    data = res.get_json()
    assert data["success"] is False
    assert data["error"]["code"] == "FORBIDDEN"
    assert "permission" in data["error"]["message"].lower()


def test_disabled_account_forbidden(client, inactive_user):
    """Verify deactivated user account receives 403 Forbidden on role-restricted endpoints."""
    from backend.tests.conftest import make_auth_headers
    headers = make_auth_headers(inactive_user)
    res = client.get("/api/v1/auth/users", headers=headers)
    assert res.status_code == 403
    data = res.get_json()
    assert data["success"] is False
    assert data["error"]["code"] == "FORBIDDEN"
    assert "account is disabled" in data["error"]["message"].lower()


# =============================================================================
# 5. Centralized Error Handling Envelope Tests
# =============================================================================

def test_error_envelope_400_bad_request(client):
    """Verify 400 Bad Request matches standard error envelope format."""
    res = client.get("/api/v1/test-middleware/raise-app-error")
    assert res.status_code == 400
    data = res.get_json()
    assert data["success"] is False
    assert data["error"]["code"] == "BAD_REQUEST"
    assert data["error"]["message"] == "Custom bad request message"
    assert data["error"]["details"] == {"field": "test"}


def test_error_envelope_403_forbidden(client):
    """Verify 403 Forbidden matches standard error envelope format."""
    res = client.get("/api/v1/test-middleware/raise-forbidden")
    assert res.status_code == 403
    data = res.get_json()
    assert data["success"] is False
    assert data["error"]["code"] == "FORBIDDEN"
    assert data["error"]["message"] == "Custom forbidden access"


def test_error_envelope_404_not_found(client):
    """Verify 404 Not Found returns standard error envelope format."""
    res = client.get("/api/v1/non-existent-route-random-404")
    assert res.status_code == 404
    data = res.get_json()
    assert data["success"] is False
    assert data["error"]["code"] == "NOT_FOUND"
    assert "message" in data["error"]


def test_error_envelope_405_method_not_allowed(client):
    """Verify 405 Method Not Allowed returns standard error envelope format."""
    res = client.delete("/health")
    assert res.status_code == 405
    data = res.get_json()
    assert data["success"] is False
    assert data["error"]["code"] == "METHOD_NOT_ALLOWED"


def test_error_envelope_409_conflict(client):
    """Verify 409 Conflict matches standard error envelope format."""
    res = client.get("/api/v1/test-middleware/raise-conflict")
    assert res.status_code == 409
    data = res.get_json()
    assert data["success"] is False
    assert data["error"]["code"] == "CONFLICT"
    assert data["error"]["message"] == "Custom conflict message"


def test_error_envelope_422_validation_error(client):
    """Verify 422 Validation Error matches standard error envelope format with details."""
    res = client.get("/api/v1/test-middleware/raise-validation")
    assert res.status_code == 422
    data = res.get_json()
    assert data["success"] is False
    assert data["error"]["code"] == "VALIDATION_ERROR"
    assert "age" in data["error"]["details"]


def test_error_envelope_500_hides_internal_details(client, caplog):
    """Verify 500 unhandled exceptions return safe public message without exposing stack traces."""
    with caplog.at_level(logging.ERROR):
        res = client.get("/api/v1/test-middleware/raise-500")
        assert res.status_code == 500
        data = res.get_json()

    assert data["success"] is False
    assert data["error"]["code"] == "INTERNAL_SERVER_ERROR"
    assert data["error"]["message"] == "An unexpected error occurred. Please try again later."
    assert "traceback" not in str(data).lower()
    assert "ZeroDivisionError" not in str(data)

    # Verify exception was logged internally
    assert any("division by zero" in rec.message or "Unhandled internal exception" in rec.message for rec in caplog.records)


# =============================================================================
# 6. CORS / Preflight Request Tests
# =============================================================================

def test_cors_preflight_options_request(client):
    """Verify OPTIONS preflight requests pass through without error and with CORS headers."""
    res = client.options(
        "/api/v1/auth/login",
        headers={
            "Origin": "http://localhost:3000",
            "Access-Control-Request-Method": "POST",
            "Access-Control-Request-Headers": "Content-Type,Authorization",
        },
    )
    assert res.status_code == 200
    assert "Access-Control-Allow-Origin" in res.headers
