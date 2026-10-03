import pytest
from datetime import timedelta
from flask_jwt_extended import create_access_token
from backend.app.auth.models import User
from backend.app.auth.services import create_user, get_user_by_email, authenticate_user
from backend.app.auth.cli import create_owner_command
from backend.app.common.permissions import RoleEnum, roles_required, admin_required, owner_required
from backend.app.common.responses import success_response
from backend.app.extensions import db


@pytest.fixture
def member_user(app, db_session):
    """Create a sample MEMBER user fixture."""
    user = create_user(
        email="member@championsclub.com",
        password="MemberPassword123!",
        first_name="John",
        last_name="Doe",
        role=RoleEnum.MEMBER,
        is_active=True,
    )
    return user


@pytest.fixture
def admin_user(app, db_session):
    """Create a sample ADMIN user fixture."""
    user = create_user(
        email="admin@championsclub.com",
        password="AdminPassword123!",
        first_name="Alice",
        last_name="Admin",
        role=RoleEnum.ADMIN,
        is_active=True,
    )
    return user


@pytest.fixture
def owner_user(app, db_session):
    """Create a sample OWNER user fixture."""
    user = create_user(
        email="owner@championsclub.com",
        password="OwnerPassword123!",
        first_name="Bob",
        last_name="Owner",
        role=RoleEnum.OWNER,
        is_active=True,
    )
    return user


@pytest.fixture
def front_desk_user(app, db_session):
    """Create a sample FRONT_DESK user fixture."""
    user = create_user(
        email="frontdesk@championsclub.com",
        password="StaffPassword123!",
        first_name="Sarah",
        last_name="Desk",
        role=RoleEnum.FRONT_DESK,
        is_active=True,
    )
    return user


@pytest.fixture
def inactive_user(app, db_session):
    """Create a deactivated user fixture."""
    user = create_user(
        email="inactive@championsclub.com",
        password="InactivePassword123!",
        first_name="Inactive",
        last_name="User",
        role=RoleEnum.MEMBER,
        is_active=False,
    )
    return user


def get_auth_headers(user):
    """Helper to generate JWT bearer header for a given user."""
    token = create_access_token(
        identity=str(user.id),
        additional_claims={"role": user.role.value if hasattr(user.role, "value") else str(user.role)},
    )
    return {"Authorization": f"Bearer {token}"}


# ---------------------------------------------------------
# 1. User Model & Password Hashing Tests
# ---------------------------------------------------------

def test_user_password_hashing(app, db_session):
    """Test bcrypt hashing and verification."""
    user = User(
        email="hash_test@club.com",
        first_name="Test",
        last_name="User",
        role=RoleEnum.MEMBER,
    )
    user.set_password("SecretPass123!")
    assert user.password_hash != "SecretPass123!"
    assert user.check_password("SecretPass123!") is True
    assert user.check_password("WrongPassword") is False


def test_user_short_password_rejected(app, db_session):
    """Test setting password under 6 characters raises ValueError."""
    user = User(
        email="short_test@club.com",
        first_name="Test",
        last_name="User",
        role=RoleEnum.MEMBER,
    )
    with pytest.raises(ValueError, match="at least 6 characters"):
        user.set_password("12345")


def test_user_to_dict_safe_serialization(member_user):
    """Test to_dict does not contain password_hash and contains expected fields."""
    d = member_user.to_dict()
    assert "password_hash" not in d
    assert d["email"] == "member@championsclub.com"
    assert d["role"] == "MEMBER"
    assert d["full_name"] == "John Doe"
    assert d["is_active"] is True


# ---------------------------------------------------------
# 2. Login Endpoint Tests
# ---------------------------------------------------------

def test_valid_login(client, member_user):
    """Test login with correct credentials returns 200, JWT and user info."""
    response = client.post(
        "/api/v1/auth/login",
        json={
            "email": "member@championsclub.com",
            "password": "MemberPassword123!",
        },
    )
    assert response.status_code == 200
    data = response.get_json()
    assert data["success"] is True
    assert "access_token" in data["data"]
    assert data["data"]["token_type"] == "Bearer"
    assert data["data"]["user"]["email"] == "member@championsclub.com"
    assert data["data"]["user"]["role"] == "MEMBER"


def test_login_invalid_password_returns_generic_error(client, member_user):
    """Test wrong password returns generic 401 error envelope."""
    response = client.post(
        "/api/v1/auth/login",
        json={
            "email": "member@championsclub.com",
            "password": "WrongPassword456!",
        },
    )
    assert response.status_code == 401
    data = response.get_json()
    assert data["success"] is False
    assert data["error"]["code"] == "UNAUTHORIZED"
    assert data["error"]["message"] == "Invalid email or password."


def test_login_nonexistent_email_returns_generic_error(client, db_session):
    """Test non-existent email returns generic 401 error envelope without leaking existence."""
    response = client.post(
        "/api/v1/auth/login",
        json={
            "email": "nonexistent@championsclub.com",
            "password": "AnyPassword123!",
        },
    )
    assert response.status_code == 401
    data = response.get_json()
    assert data["success"] is False
    assert data["error"]["code"] == "UNAUTHORIZED"
    assert data["error"]["message"] == "Invalid email or password."


def test_login_inactive_user_rejected(client, inactive_user):
    """Test deactivated user account cannot log in."""
    response = client.post(
        "/api/v1/auth/login",
        json={
            "email": "inactive@championsclub.com",
            "password": "InactivePassword123!",
        },
    )
    assert response.status_code == 401
    data = response.get_json()
    assert data["success"] is False
    assert data["error"]["code"] == "UNAUTHORIZED"
    assert "disabled" in data["error"]["message"].lower()


def test_login_missing_fields_validation(client):
    """Test login with missing email/password returns 422 validation error."""
    response = client.post(
        "/api/v1/auth/login",
        json={"email": "member@championsclub.com"},  # missing password
    )
    assert response.status_code == 422
    data = response.get_json()
    assert data["success"] is False
    assert data["error"]["code"] == "VALIDATION_ERROR"
    assert "password" in data["error"]["details"]


# ---------------------------------------------------------
# 3. Current User (/api/v1/auth/me) Endpoint Tests
# ---------------------------------------------------------

def test_get_current_user_success(client, member_user):
    """Test /api/v1/auth/me returns current user profile with valid JWT."""
    headers = get_auth_headers(member_user)
    response = client.get("/api/v1/auth/me", headers=headers)
    assert response.status_code == 200
    data = response.get_json()
    assert data["success"] is True
    assert data["data"]["user"]["id"] == member_user.id
    assert data["data"]["user"]["email"] == "member@championsclub.com"
    assert data["data"]["user"]["role"] == "MEMBER"


def test_get_current_user_unauthorized(client):
    """Test /api/v1/auth/me without token returns 401 envelope."""
    response = client.get("/api/v1/auth/me")
    assert response.status_code == 401
    data = response.get_json()
    assert data["success"] is False
    assert data["error"]["code"] == "UNAUTHORIZED"


def test_get_current_user_invalid_token(client):
    """Test /api/v1/auth/me with forged token returns 401 envelope."""
    headers = {"Authorization": "Bearer bad.token.here"}
    response = client.get("/api/v1/auth/me", headers=headers)
    assert response.status_code == 401
    data = response.get_json()
    assert data["success"] is False
    assert data["error"]["code"] == "INVALID_TOKEN"


def test_get_current_user_expired_token(app, client, member_user):
    """Test /api/v1/auth/me with expired token returns 401 TOKEN_EXPIRED envelope."""
    with app.app_context():
        expired_token = create_access_token(
            identity=str(member_user.id),
            expires_delta=timedelta(seconds=-10),
        )
    headers = {"Authorization": f"Bearer {expired_token}"}
    response = client.get("/api/v1/auth/me", headers=headers)
    assert response.status_code == 401
    data = response.get_json()
    assert data["success"] is False
    assert data["error"]["code"] == "TOKEN_EXPIRED"


# ---------------------------------------------------------
# 4. Role-Based Authorization & Staff Provisioning Tests
# ---------------------------------------------------------

def test_admin_create_staff_user_success(client, admin_user):
    """Test ADMIN can provision new staff account via POST /api/v1/auth/users."""
    headers = get_auth_headers(admin_user)
    payload = {
        "email": "coach.mike@championsclub.com",
        "password": "CoachPassword123!",
        "first_name": "Mike",
        "last_name": "Tyson",
        "role": "COACH",
    }
    response = client.post("/api/v1/auth/users", json=payload, headers=headers)
    assert response.status_code == 201
    data = response.get_json()
    assert data["success"] is True
    assert data["data"]["user"]["email"] == "coach.mike@championsclub.com"
    assert data["data"]["user"]["role"] == "COACH"


def test_owner_create_staff_user_success(client, owner_user):
    """Test OWNER can provision new user account."""
    headers = get_auth_headers(owner_user)
    payload = {
        "email": "bar.staff@championsclub.com",
        "password": "BarPassword123!",
        "first_name": "Dave",
        "last_name": "Bartender",
        "role": "BAR_STAFF",
    }
    response = client.post("/api/v1/auth/users", json=payload, headers=headers)
    assert response.status_code == 201
    data = response.get_json()
    assert data["success"] is True
    assert data["data"]["user"]["role"] == "BAR_STAFF"


def test_member_cannot_create_staff_user(client, member_user):
    """Test MEMBER role receives 403 Forbidden when attempting user creation."""
    headers = get_auth_headers(member_user)
    payload = {
        "email": "hacker@championsclub.com",
        "password": "HackerPassword123!",
        "first_name": "Hack",
        "last_name": "Er",
        "role": "ADMIN",
    }
    response = client.post("/api/v1/auth/users", json=payload, headers=headers)
    assert response.status_code == 403
    data = response.get_json()
    assert data["success"] is False
    assert data["error"]["code"] == "FORBIDDEN"


def test_front_desk_cannot_create_staff_user(client, front_desk_user):
    """Test FRONT_DESK role receives 403 Forbidden on admin endpoint."""
    headers = get_auth_headers(front_desk_user)
    payload = {
        "email": "someone@championsclub.com",
        "password": "SomePassword123!",
        "first_name": "Some",
        "last_name": "One",
        "role": "MEMBER",
    }
    response = client.post("/api/v1/auth/users", json=payload, headers=headers)
    assert response.status_code == 403
    data = response.get_json()
    assert data["success"] is False
    assert data["error"]["code"] == "FORBIDDEN"


def test_duplicate_user_email_conflict(client, admin_user, member_user):
    """Test attempting to create a user with duplicate email returns 409 Conflict."""
    headers = get_auth_headers(admin_user)
    payload = {
        "email": member_user.email,  # duplicate
        "password": "AnotherPassword123!",
        "first_name": "Duplicate",
        "last_name": "User",
        "role": "MEMBER",
    }
    response = client.post("/api/v1/auth/users", json=payload, headers=headers)
    assert response.status_code == 409
    data = response.get_json()
    assert data["success"] is False
    assert data["error"]["code"] == "CONFLICT"


# ---------------------------------------------------------
# 5. CLI Bootstrap Command Tests
# ---------------------------------------------------------

def test_cli_create_owner_command(runner, db_session):
    """Test CLI create-owner command provisions initial owner account."""
    result = runner.invoke(
        create_owner_command,
        [
            "--email", "founder@championsclub.com",
            "--first-name", "Grand",
            "--last-name", "Founder",
            "--password", "SuperSecureFounder123!",
        ],
    )
    assert result.exit_code == 0
    assert "Successfully bootstrapped OWNER account" in result.output

    user = get_user_by_email("founder@championsclub.com")
    assert user is not None
    assert user.role == RoleEnum.OWNER
    assert user.check_password("SuperSecureFounder123!") is True


def test_cli_create_owner_duplicate_aborts(runner, owner_user):
    """Test CLI create-owner aborts gracefully if owner email already exists."""
    result = runner.invoke(
        create_owner_command,
        [
            "--email", owner_user.email,
            "--first-name", "Dup",
            "--last-name", "Owner",
            "--password", "SomePassword123!",
        ],
    )
    assert "already exists" in result.output
