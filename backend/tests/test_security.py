import hmac
import hashlib
from datetime import datetime, date, timedelta, timezone
import pytest
from flask_jwt_extended import create_access_token
from backend.app.auth.models import User
from backend.app.auth.services import create_user, reset_login_throttle
from backend.app.members.models import Member
from backend.app.members.services import create_member
from backend.app.memberships.models import MembershipPlan, Membership
from backend.app.memberships.services import assign_membership
from backend.app.courts.models import Court, SportType, CourtStatus
from backend.app.bookings.models import Booking, BookingStatus
from backend.app.bookings.services import create_booking
from backend.app.payments.models import Payment, PaymentMethod, PaymentStatus, PaymentItemType
from backend.app.payments.services import create_or_initiate_payment
from backend.app.common.permissions import RoleEnum
from backend.app.extensions import db


# -------------------------------------------------------------------
# Fixtures
# -------------------------------------------------------------------

@pytest.fixture(autouse=True)
def clean_throttle():
    """Ensure in-memory login throttle is clean before and after each test."""
    reset_login_throttle()
    yield
    reset_login_throttle()


@pytest.fixture
def gold_plan(app, db_session):
    plan = MembershipPlan(
        name="Gold Champion",
        code="GOLD",
        annual_fee=50000.0,
        court_discount_percent=100.0,
        is_active=True,
    )
    db_session.add(plan)
    db_session.commit()
    return plan


@pytest.fixture
def member_user(app, db_session):
    user = create_user(
        email="alice.member@championsclub.com",
        password="MemberPassword123!",
        first_name="Alice",
        last_name="Member",
        role=RoleEnum.MEMBER,
        is_active=True,
    )
    create_member(user_id=user.id, phone="9876543210")
    return user


@pytest.fixture
def other_member_user(app, db_session):
    user = create_user(
        email="bob.member@championsclub.com",
        password="MemberPassword123!",
        first_name="Bob",
        last_name="Member",
        role=RoleEnum.MEMBER,
        is_active=True,
    )
    create_member(user_id=user.id, phone="9876543211")
    return user


@pytest.fixture
def admin_user(app, db_session):
    return create_user(
        email="admin@championsclub.com",
        password="AdminPassword123!",
        first_name="Admin",
        last_name="User",
        role=RoleEnum.ADMIN,
        is_active=True,
    )


@pytest.fixture
def tennis_court(app, db_session):
    court = Court(
        name="Center Court",
        sport_type=SportType.LAWN_TENNIS,
        status=CourtStatus.ACTIVE,
    )
    db_session.add(court)
    db_session.commit()
    return court


def auth_header(user: User) -> dict:
    role_val = user.role.value if hasattr(user.role, "value") else str(user.role)
    token = create_access_token(
        identity=str(user.id),
        additional_claims={"role": role_val, "email": user.email},
    )
    return {"Authorization": f"Bearer {token}"}


# -------------------------------------------------------------------
# 1. Route Map Security Audit Test
# -------------------------------------------------------------------

EXPLICIT_PUBLIC_ENDPOINTS = {
    "static",
    "health.health_check",
    "auth.login",
    "auth.register_member",
    "auth.google_auth",
    "auth.get_roles",
    "membership_plans.list_plans",
    "membership_plans.get_plan_details",
    "courts.list_courts",
    "courts.get_court_details",
    "courts.get_availability",
    "bookings.get_pricing_rules_route",
    "payments.webhook_receiver_route",
    "auth.demo_login",
    # Public CRM & Catalog endpoints
    "crm.api_public_club_info",
    "crm.api_public_plans",
    "crm.api_public_availability",
    "crm.api_public_enquiry",
    "crm.api_public_products",
    "crm.api_request_trial",
    # Public Inventory and Shop catalog endpoints
    "inventory.get_products",
    "inventory.get_categories",
    "inventory.get_category_detail",
    "inventory.get_product_detail",
    "shop.list_products",
    "shop.get_product_detail",
    "shop.list_categories",
}


def test_all_routes_require_auth_or_are_explicitly_public(app, client):
    """Walk Flask url_map and assert every route is either explicitly public or rejects unauthenticated requests."""
    unprotected_endpoints = set()

    for rule in app.url_map.iter_rules():
        endpoint = rule.endpoint
        methods = rule.methods - {"OPTIONS", "HEAD"}

        if endpoint in EXPLICIT_PUBLIC_ENDPOINTS:
            continue

        # If not on explicit public allow-list, unauthenticated request must be rejected (401 or 403)
        for method in methods:
            # Generate placeholder URL
            url = rule.rule
            # Replace int and path params with dummy 1
            import re
            url = re.sub(r"<int:[^>]+>", "1", url)
            url = re.sub(r"<[^>]+>", "1", url)

            resp = client.open(url, method=method)
            # Route must reject unauthenticated requests with 401 Unauthorized or 403 Forbidden
            # (or 404/405/422 if method routing applies, but NOT 200/201 success)
            if resp.status_code in (200, 201):
                unprotected_endpoints.add(f"{endpoint} ({method} {rule.rule})")

    assert len(unprotected_endpoints) == 0, f"Found unprotected routes not in allow-list: {unprotected_endpoints}"


# -------------------------------------------------------------------
# 2. Brute-Force Rate Limiting Test
# -------------------------------------------------------------------

def test_login_brute_force_throttle(client, member_user):
    """5 failed attempts trigger 429 Too Many Requests on subsequent attempts."""
    # 5 failed attempts
    for _ in range(5):
        resp = client.post(
            "/api/v1/auth/login",
            json={"email": member_user.email, "password": "WrongPassword123!"},
        )
        assert resp.status_code == 401
        data = resp.get_json()
        assert data["error"]["code"] == "UNAUTHORIZED"

    # 6th attempt should be blocked with 429 TOO_MANY_REQUESTS
    blocked_resp = client.post(
        "/api/v1/auth/login",
        json={"email": member_user.email, "password": "WrongPassword123!"},
    )
    assert blocked_resp.status_code == 429
    blocked_data = blocked_resp.get_json()
    assert blocked_data["error"]["code"] == "TOO_MANY_REQUESTS"


# -------------------------------------------------------------------
# 3. Mass-Assignment & Tampering Tests
# -------------------------------------------------------------------

def test_mass_assignment_prevented_on_member_registration(client):
    """Public registration cannot escalate role to OWNER or ADMIN."""
    resp = client.post(
        "/api/v1/auth/register",
        json={
            "email": "hacker@test.com",
            "password": "Password123!",
            "first_name": "Eve",
            "last_name": "Hacker",
            "role": "OWNER",
        },
    )
    assert resp.status_code == 201
    data = resp.get_json()["data"]
    # Role must remain MEMBER regardless of what was submitted
    assert data["user"]["role"] == "MEMBER"


def test_mass_assignment_prevented_on_booking_creation(client, member_user, other_member_user, tennis_court):
    """Member cannot inject price, discount, status, or another member_id."""
    headers = auth_header(member_user)
    start_time = (datetime.now(timezone.utc) + timedelta(days=2)).replace(hour=10, minute=0, second=0, microsecond=0)

    # 1. Attempting to book under another member's ID
    payload = {
        "court_id": tennis_court.id,
        "start_time": start_time.isoformat(),
        "member_id": other_member_user.member_profile.id,
    }

    resp = client.post("/api/v1/bookings", json=payload, headers=headers)
    assert resp.status_code == 201
    booking_data = resp.get_json()["data"]

    # Server must bind to authenticated member and calculate price server-side
    assert booking_data["member_id"] == member_user.member_profile.id
    assert float(booking_data["final_price"]) == 800.0
    assert booking_data["status"] == "CONFIRMED"

    # 2. Attempting to inject prohibited fields like final_price/status is rejected by strict validation
    start_time_2 = (datetime.now(timezone.utc) + timedelta(days=2)).replace(hour=11, minute=0, second=0, microsecond=0)
    malicious_payload = {
        "court_id": tennis_court.id,
        "start_time": start_time_2.isoformat(),
        "final_price": 0.0,
        "status": "COMPLETED",
    }
    resp2 = client.post("/api/v1/bookings", json=malicious_payload, headers=headers)
    # Schema validation rejects unexpected mass-assignment properties with 422
    assert resp2.status_code == 422


def test_mass_assignment_prevented_on_payment_amount(client, member_user, tennis_court):
    """Payment cannot be created with a manipulated amount different from booking final price."""
    start_time = (datetime.now(timezone.utc) + timedelta(days=3)).replace(hour=14, minute=0, second=0, microsecond=0)
    booking = create_booking(
        court_id=tennis_court.id,
        start_time=start_time,
        user_id=member_user.id,
        member_id=member_user.member_profile.id,
    )
    assert float(booking.final_price) == 800.0

    headers = auth_header(member_user)
    # Attempt to pay 10.0 INR instead of 800.0 INR
    resp = client.post(
        "/api/v1/payments",
        json={
            "item_type": "BOOKING",
            "item_id": booking.id,
            "amount": 10.0,
            "payment_method": "CASH",
        },
        headers=headers,
    )
    assert resp.status_code in (400, 422)
    assert resp.get_json()["error"]["code"] in ("AMOUNT_MISMATCH", "VALIDATION_ERROR")


# -------------------------------------------------------------------
# 4. IDOR / Ownership Checks Tests
# -------------------------------------------------------------------

def test_member_cannot_read_or_update_other_member_profile(client, member_user, other_member_user):
    """A MEMBER cannot read or update another member's profile via IDOR."""
    headers = auth_header(member_user)
    other_member_id = other_member_user.member_profile.id

    # Attempt GET other member
    get_resp = client.get(f"/api/v1/members/{other_member_id}", headers=headers)
    assert get_resp.status_code == 403

    # Attempt PUT other member
    put_resp = client.put(
        f"/api/v1/members/{other_member_id}",
        json={"phone": "0000000000"},
        headers=headers,
    )
    assert put_resp.status_code == 403


def test_member_cannot_read_other_member_memberships(client, member_user, other_member_user):
    """A MEMBER cannot read another member's membership history or active membership."""
    headers = auth_header(member_user)
    other_member_id = other_member_user.member_profile.id

    # History
    h_resp = client.get(f"/api/v1/members/{other_member_id}/memberships", headers=headers)
    assert h_resp.status_code == 403

    # Active
    a_resp = client.get(f"/api/v1/members/{other_member_id}/memberships/active", headers=headers)
    assert a_resp.status_code == 403


def test_member_cannot_view_or_cancel_other_member_booking(client, member_user, other_member_user, tennis_court):
    """A MEMBER cannot read or cancel another member's booking."""
    start_time = (datetime.now(timezone.utc) + timedelta(days=4)).replace(hour=16, minute=0, second=0, microsecond=0)
    other_booking = create_booking(
        court_id=tennis_court.id,
        start_time=start_time,
        user_id=other_member_user.id,
        member_id=other_member_user.member_profile.id,
    )

    headers = auth_header(member_user)

    # Attempt GET
    get_resp = client.get(f"/api/v1/bookings/{other_booking.id}", headers=headers)
    assert get_resp.status_code == 403

    # Attempt Cancel
    cancel_resp = client.post(f"/api/v1/bookings/{other_booking.id}/cancel", json={"reason": "Hacked"}, headers=headers)
    assert cancel_resp.status_code == 403


def test_member_cannot_initiate_payment_for_other_member_booking(client, member_user, other_member_user, tennis_court):
    """A MEMBER cannot pay for or access another member's payment."""
    start_time = (datetime.now(timezone.utc) + timedelta(days=5)).replace(hour=11, minute=0, second=0, microsecond=0)
    other_booking = create_booking(
        court_id=tennis_court.id,
        start_time=start_time,
        user_id=other_member_user.id,
        member_id=other_member_user.member_profile.id,
    )

    headers = auth_header(member_user)
    resp = client.post(
        "/api/v1/payments",
        json={
            "item_type": "BOOKING",
            "item_id": other_booking.id,
            "amount": 800.0,
            "payment_method": "CASH",
        },
        headers=headers,
    )
    assert resp.status_code == 403


# -------------------------------------------------------------------
# 5. Payment Security & Signature Verification Tests
# -------------------------------------------------------------------

def test_webhook_requires_valid_hmac_signature(app, client):
    """Payment webhook rejects missing or invalid signatures."""
    # Missing signature
    resp = client.post("/api/v1/payments/webhook", json={"event": "payment.captured"})
    assert resp.status_code == 401

    # Invalid signature (returns 422 for invalid signature)
    resp2 = client.post(
        "/api/v1/payments/webhook",
        data=b'{"event":"payment.captured"}',
        headers={"X-Razorpay-Signature": "invalid_hex_signature", "Content-Type": "application/json"},
    )
    assert resp2.status_code in (401, 422)


def test_online_payment_cannot_be_manually_confirmed(client, admin_user, member_user, tennis_court, db_session):
    """ONLINE payment method cannot be manually marked as paid by staff."""
    start_time = (datetime.now(timezone.utc) + timedelta(days=6)).replace(hour=9, minute=0, second=0, microsecond=0)
    booking = create_booking(
        court_id=tennis_court.id,
        start_time=start_time,
        user_id=member_user.id,
        member_id=member_user.member_profile.id,
    )
    payment = Payment(
        payment_reference="PAY-ONLINE-TEST-01",
        item_type=PaymentItemType.BOOKING,
        item_id=booking.id,
        user_id=member_user.id,
        amount=800.0,
        currency="INR",
        payment_method=PaymentMethod.ONLINE,
        status=PaymentStatus.PENDING,
    )
    db_session.add(payment)
    db_session.commit()

    admin_headers = auth_header(admin_user)
    resp = client.post(f"/api/v1/payments/{payment.id}/confirm", json={"notes": "Bypassing gateway"}, headers=admin_headers)
    assert resp.status_code in (400, 422)
    assert "ONLINE" in resp.get_json()["error"]["message"]
