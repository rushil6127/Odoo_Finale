"""Tests for Flask-Limiter rate limiting across sensitive and public endpoints."""
import pytest
from datetime import datetime, timedelta, date
from backend.app.extensions import limiter, db
from backend.app.auth.models import User
from backend.app.auth.services import create_user
from backend.app.members.services import create_member
from backend.app.memberships.models import MembershipPlan
from backend.app.memberships.services import seed_membership_plans, assign_membership, get_plan_by_code
from backend.app.courts.models import Court, SportType, CourtStatus
from backend.app.common.permissions import RoleEnum
from flask_jwt_extended import create_access_token


@pytest.fixture(autouse=True)
def reset_limiter_storage(app):
    """Reset the limiter storage between tests."""
    limiter.reset()
    yield
    limiter.reset()


@pytest.fixture
def test_member_user(app, db_session):
    seed_membership_plans()
    gold_plan = get_plan_by_code("GOLD")
    user = create_user(
        email="ratelimit.member@championsclub.example.com",
        password="Password123!",
        first_name="RateLimit",
        last_name="Tester",
        role=RoleEnum.MEMBER,
        is_active=True,
    )
    member = create_member(user_id=user.id, phone="+91 98250 14820")
    assign_membership(
        member_id=member.id,
        plan_id=gold_plan.id,
        start_date=date.today(),
        duration_months=12,
        notes="Rate limit fixture membership",
    )
    return user, member


@pytest.fixture
def test_court(app, db_session):
    court = Court(
        name="RL Test Court",
        sport_type=SportType.BADMINTON,
        status=CourtStatus.ACTIVE,
    )
    db_session.add(court)
    db_session.commit()
    return court


def test_login_rate_limiting(client):
    """Repeated login attempts beyond the threshold must be blocked with HTTP 429."""
    limiter.reset()
    blocked = False
    status_codes = []

    for i in range(25):
        resp = client.post(
            "/api/v1/auth/login",
            json={"email": f"fake_user_{i}@example.com", "password": "WrongPassword123!"},
        )
        status_codes.append(resp.status_code)
        if resp.status_code == 429:
            blocked = True
            body = resp.get_json()
            assert body["success"] is False
            assert body["error"]["code"] == "TOO_MANY_REQUESTS"
            assert "Too many" in body["error"]["message"]
            break

    assert blocked, f"Expected 429 Too Many Requests within 25 login attempts, but received: {status_codes}"


def test_crm_public_enquiries_rate_limiting(client):
    """Repeated public CRM enquiry submissions must trigger HTTP 429."""
    limiter.reset()
    blocked = False
    status_codes = []

    for i in range(20):
        resp = client.post(
            "/api/v1/crm/public/enquiries",
            json={
                "full_name": f"Lead Number {i}",
                "email": f"lead_{i}@example.com",
                "phone": "+91 98765 43210",
                "preferred_sport": "LAWN_TENNIS",
                "notes": "Inquiring about membership tier pricing.",
            },
        )
        status_codes.append(resp.status_code)
        if resp.status_code == 429:
            blocked = True
            body = resp.get_json()
            assert body["success"] is False
            assert body["error"]["code"] == "TOO_MANY_REQUESTS"
            assert "Too many requests" in body["error"]["message"]
            break

    assert blocked, f"Expected 429 Too Many Requests for CRM enquiries, got: {status_codes}"


def test_booking_rate_limiting(client, test_member_user, test_court):
    """Rapid booking requests from the same user identity must be rate-limited."""
    limiter.reset()
    user, member = test_member_user
    token = create_access_token(
        identity=str(user.id),
        additional_claims={"role": user.role.value, "email": user.email},
    )
    headers = {"Authorization": f"Bearer {token}"}

    blocked = False
    status_codes = []
    base_time = datetime.now() + timedelta(days=3)

    for i in range(25):
        slot_time = (base_time + timedelta(hours=i)).replace(minute=0, second=0, microsecond=0)
        resp = client.post(
            "/api/v1/bookings",
            headers=headers,
            json={
                "court_id": test_court.id,
                "start_time": slot_time.isoformat(),
                "notes": f"Rate limit booking attempt {i}",
            },
        )
        status_codes.append(resp.status_code)
        if resp.status_code == 429:
            blocked = True
            body = resp.get_json()
            assert body["success"] is False
            assert body["error"]["code"] == "TOO_MANY_REQUESTS"
            assert "Too many requests" in body["error"]["message"]
            break

    assert blocked, f"Expected 429 for rapid bookings, got: {status_codes}"


def test_standard_error_envelope_on_429(client):
    """Ensure HTTP 429 responses conform precisely to the standard error JSON envelope."""
    limiter.reset()
    for i in range(20):
        resp = client.post(
            "/api/v1/crm/public/enquiries",
            json={
                "full_name": f"Spam Lead {i}",
                "email": f"spam_{i}@example.com",
                "phone": "+91 98765 00000",
                "preferred_sport": "BADMINTON",
                "notes": "Testing rate limit envelope",
            },
        )
        if resp.status_code == 429:
            data = resp.get_json()
            assert "success" in data
            assert data["success"] is False
            assert "error" in data
            assert data["error"]["code"] == "TOO_MANY_REQUESTS"
            assert "Too many requests. Please try again later." in data["error"]["message"]
            return

    pytest.fail("Failed to trigger 429 to verify JSON error envelope.")


def test_daily_booking_limit_third_slot_rejection(client, test_member_user, test_court):
    """A member attempting a 3rd booking on the same day is rejected with exact message."""
    limiter.reset()
    user, member = test_member_user
    token = create_access_token(
        identity=str(user.id),
        additional_claims={"role": user.role.value, "email": user.email},
    )
    headers = {"Authorization": f"Bearer {token}"}

    test_day = (datetime.now() + timedelta(days=5)).replace(minute=0, second=0, microsecond=0)
    slot1 = test_day.replace(hour=8)
    slot2 = test_day.replace(hour=10)
    slot3 = test_day.replace(hour=14)

    # 1st booking on test_day
    r1 = client.post(
        "/api/v1/bookings",
        headers=headers,
        json={"court_id": test_court.id, "start_time": slot1.isoformat()},
    )
    assert r1.status_code == 201

    # 2nd booking on test_day
    r2 = client.post(
        "/api/v1/bookings",
        headers=headers,
        json={"court_id": test_court.id, "start_time": slot2.isoformat()},
    )
    assert r2.status_code == 201

    # 3rd booking on test_day MUST FAIL
    r3 = client.post(
        "/api/v1/bookings",
        headers=headers,
        json={"court_id": test_court.id, "start_time": slot3.isoformat()},
    )
    assert r3.status_code in (400, 422)
    err = r3.get_json()
    assert err["success"] is False
    assert err["error"]["code"] == "DAILY_LIMIT_EXCEEDED"
    assert "Daily booking limit reached. You can book a maximum of 2 slots per day." in err["error"]["message"]
