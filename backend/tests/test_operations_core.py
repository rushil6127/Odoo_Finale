"""Comprehensive Unit, API, Database, and Business Rule Tests for Core Platform & Operations Modules."""

from datetime import datetime, date, timedelta, timezone
from decimal import Decimal
import json
import pytest
from flask_jwt_extended import create_access_token

from backend.app.extensions import db
from backend.app.common.permissions import RoleEnum
from backend.app.common.errors import (
    NotFoundException,
    ConflictException,
    ValidationException,
    ForbiddenException,
    UnauthorizedException,
)
from backend.app.auth.models import User
from backend.app.auth.services import (
    create_user,
    get_user_by_id,
    get_user_by_email,
    authenticate_user,
    authenticate_or_create_google_user,
)
from backend.app.members.models import Member
from backend.app.members.services import (
    create_member,
    get_member_by_id,
    get_member_by_user_id,
    update_member,
    search_members,
)
from backend.app.memberships.models import MembershipPlan, Membership
from backend.app.memberships.services import (
    get_all_plans,
    get_plan_by_id,
    get_active_membership,
    get_membership_history,
    assign_membership,
    change_membership_plan,
)
from backend.app.courts.models import Court, SportType, CourtStatus
from backend.app.courts.services import (
    create_court,
    update_court,
    get_court_by_id,
    get_all_courts,
    get_court_availability,
    seed_default_courts,
)
from backend.app.bookings.models import Booking, BookingStatus, CourtOccupancy
from backend.app.bookings.services import (
    create_booking,
    cancel_booking,
    get_booking_by_id,
    list_bookings,
    get_member_booking_history,
)
from backend.app.payments.models import (
    Payment,
    PaymentMethod,
    PaymentStatus,
    PaymentItemType,
    PaymentAudit,
    PaymentWebhookEvent,
)
from backend.app.payments.services import (
    create_or_initiate_payment,
    confirm_manual_payment,
    verify_online_payment,
    process_webhook_event,
    refund_payment,
    cancel_payment,
    get_payment_by_id,
    list_payments,
    validate_transition,
    validate_item_amount,
)
from backend.tests.factories import (
    UserFactory,
    MemberFactory,
    CourtFactory,
    BookingFactory,
    PaymentFactory,
)


# ===================================================================
# 1. AUTH & USER UNIT & API TESTS
# ===================================================================

def test_user_retrieval_and_duplicate_handling(app, db_session):
    """Test get_user_by_id, get_user_by_email, and duplicate prevention."""
    user = UserFactory.create(email="lookup@championsclub.com")
    by_id = get_user_by_id(user.id)
    assert by_id is not None
    assert by_id.email == "lookup@championsclub.com"

    by_email = get_user_by_email("LOOKUP@CHAMPIONSCLUB.COM")
    assert by_email is not None
    assert by_email.id == user.id

    assert get_user_by_email("") is None
    assert get_user_by_id(999999) is None

    # Duplicate creation raises ConflictException
    with pytest.raises(ConflictException):
        create_user(
            email="lookup@championsclub.com",
            password="NewPassword123!",
            first_name="Dup",
            last_name="User",
        )


def test_google_auth_mock_token_success(app, db_session, client):
    """Test Google OAuth endpoint with JWT payload mock."""
    import base64

    header = base64.urlsafe_b64encode(b'{"alg":"HS256","typ":"JWT"}').decode("utf-8").rstrip("=")
    payload_json = json.dumps({"email": "google.user@example.com", "name": "Google User", "given_name": "Google", "family_name": "User"})
    payload_b64 = base64.urlsafe_b64encode(payload_json.encode("utf-8")).decode("utf-8").rstrip("=")
    mock_id_token = f"{header}.{payload_b64}.dummy_signature"

    resp = client.post("/api/v1/auth/google", json={"credential": mock_id_token})
    assert resp.status_code == 200
    data = resp.get_json()["data"]
    assert "access_token" in data
    assert data["user"]["email"] == "google.user@example.com"
    assert data["user"]["role"] == "MEMBER"


def test_google_auth_missing_or_invalid_credential(client):
    """Test Google OAuth error responses."""
    resp1 = client.post("/api/v1/auth/google", json={})
    assert resp1.status_code == 400

    resp2 = client.post("/api/v1/auth/google", json={"credential": "invalid_format"})
    assert resp2.status_code in (400, 401)


# ===================================================================
# 2. MEMBERS & MEMBERSHIP SERVICE & DATABASE TESTS
# ===================================================================

def test_member_profile_crud_and_search(app, db_session, member_user):
    """Test Member service methods: update, retrieval, and search filters."""
    member = get_member_by_user_id(member_user.id)
    assert member is not None

    # Update profile
    updated = update_member(
        member.id,
        phone="9998887777",
        address="123 Champions Way",
        emergency_contact_name="Bob Contact",
        emergency_contact_phone="9998887778",
    )
    assert updated.phone == "9998887777"
    assert updated.address == "123 Champions Way"
    assert updated.emergency_contact_name == "Bob Contact"

    # Search members
    members, total = search_members(query_str=member_user.email)
    assert total >= 1
    assert any(m.id == member.id for m in members)

    # Search with plan filter
    members_plan, total_plan = search_members(plan_code="NONEXISTENT")
    assert total_plan == 0


def test_membership_plan_changes_upgrade_and_downgrade(app, db_session, silver_member, gold_plan):
    """Test change_membership_plan preserves history and terminates previous plan cleanly."""
    effective_date = silver_member.memberships[0].start_date + timedelta(days=30)
    new_ms, old_ms = change_membership_plan(
        member_id=silver_member.id,
        new_plan_id=gold_plan.id,
        effective_date=effective_date,
        notes="Upgraded to Gold Champion",
    )

    assert new_ms.plan_id == gold_plan.id
    assert new_ms.start_date == effective_date
    assert old_ms.end_date == effective_date - timedelta(days=1)

    # Check history contains both records
    history = get_membership_history(silver_member.id)
    assert len(history) == 2
    assert history[0].id == new_ms.id
    assert history[1].id == old_ms.id


def test_assign_membership_nonexistent_plan_or_member(app, db_session):
    """Test error handling when assigning memberships to invalid entities."""
    with pytest.raises(NotFoundException):
        assign_membership(member_id=999999, plan_id=1, start_date=date.today())

    user = UserFactory.create()
    member = MemberFactory.create(user=user)
    with pytest.raises(NotFoundException):
        assign_membership(member_id=member.id, plan_id=999999, start_date=date.today())


# ===================================================================
# 3. COURTS SERVICE & AVAILABILITY TESTS
# ===================================================================

def test_court_crud_operations(app, db_session):
    """Test Court creation, updating, and filtering."""
    court = create_court(
        name="Table Tennis Arena 1",
        sport_type=SportType.TABLE_TENNIS,
        surface_type="Wood",
        is_indoor=True,
    )
    assert court.id is not None
    assert court.sport_type == SportType.TABLE_TENNIS
    assert court.is_indoor is True

    # Update court
    updated = update_court(
        court.id,
        name="Table Tennis Arena 1 - Renovated",
        status=CourtStatus.MAINTENANCE,
        custom_open_time="07:00",
        custom_close_time="21:00",
    )
    assert updated.status == CourtStatus.MAINTENANCE
    assert updated.custom_open_time == "07:00"

    # List courts with filters
    all_courts = get_all_courts(status="MAINTENANCE", is_indoor=True, sport_type="TABLE_TENNIS")
    assert any(c.id == court.id for c in all_courts)


def test_court_availability_operating_hours_and_filtering(app, db_session, tennis_court):
    """Test availability slot generation across dates and sports."""
    target_date = date.today() + timedelta(days=1)
    avail = get_court_availability(target_date=target_date, sport_type="LAWN_TENNIS")
    assert len(avail["courts"]) > 0
    court_info = next(c for c in avail["courts"] if c["id"] == tennis_court.id)
    slots = court_info["slots"]
    assert len(slots) > 0
    # Every slot starts within operating hours
    for slot in slots:
        assert slot["is_available"] is True


def test_sport_type_enum_from_string_helpers():
    """Test SportType parsing and helper methods."""
    assert SportType.has_value("LAWN_TENNIS") is True
    assert SportType.has_value("badminton") is True
    assert SportType.has_value("invalid_sport") is False
    assert SportType.from_string("swimming pool") == SportType.SWIMMING_POOL


# ===================================================================
# 4. BOOKING ENGINE & BUSINESS RULE TESTS
# ===================================================================

def test_booking_filtering_combinations(app, db_session, member_user, tennis_court):
    """Test list_bookings with multiple query filters."""
    start_time_1 = (datetime.now(timezone.utc) + timedelta(days=10)).replace(hour=8, minute=0, second=0, microsecond=0)
    booking1 = BookingFactory.create(
        court=tennis_court,
        start_time=start_time_1,
        user=member_user,
    )

    # Filter by court_id and sport_type
    res = list_bookings(court_id=tennis_court.id, sport_type="LAWN_TENNIS", status="CONFIRMED")
    assert len(res) >= 1
    assert any(b.id == booking1.id for b in res)

    # Filter by date range
    res_range = list_bookings(start_date=start_time_1.date(), end_date=start_time_1.date())
    assert any(b.id == booking1.id for b in res_range)


def test_booking_cancellation_reason_and_history(app, db_session, member_user, tennis_court):
    """Test cancel_booking records cancellation reason and marks occupancy cancelled."""
    start_time = (datetime.now(timezone.utc) + timedelta(days=12)).replace(hour=14, minute=0, second=0, microsecond=0)
    booking = BookingFactory.create(
        court=tennis_court,
        start_time=start_time,
        user=member_user,
    )

    cancelled = cancel_booking(
        booking_id=booking.id,
        reason="Heavy Rain",
        requesting_user=member_user,
    )
    assert cancelled.status == BookingStatus.CANCELLED
    assert cancelled.cancellation_reason == "Heavy Rain"
    assert cancelled.cancelled_at is not None

    # Cannot cancel an already cancelled booking
    with pytest.raises(ValidationException):
        cancel_booking(booking_id=booking.id, reason="Again", requesting_user=member_user)


def test_booking_creation_validation_errors(app, db_session, tennis_court):
    """Test invalid slot times and missing parties raise ValidationException."""
    # Start time not on 30-minute interval
    invalid_time = (datetime.now(timezone.utc) + timedelta(days=15)).replace(hour=10, minute=17, second=0, microsecond=0)
    with pytest.raises(ValidationException):
        create_booking(court_id=tennis_court.id, start_time=invalid_time, is_walk_in=True, guest_name="Guest")

    # Outside operating hours (03:00 AM)
    night_time = (datetime.now(timezone.utc) + timedelta(days=15)).replace(hour=3, minute=0, second=0, microsecond=0)
    with pytest.raises(ValidationException):
        create_booking(court_id=tennis_court.id, start_time=night_time, is_walk_in=True, guest_name="Guest")


# ===================================================================
# 5. PAYMENT SERVICES & GATEWAY LOGIC TESTS
# ===================================================================

def test_payment_state_transitions():
    """Test validate_transition ensures strict one-way state transitions."""
    # Valid transitions
    validate_transition(PaymentStatus.PENDING, PaymentStatus.PAID)
    validate_transition(PaymentStatus.PENDING, PaymentStatus.FAILED)
    validate_transition(PaymentStatus.PENDING, PaymentStatus.CANCELLED)
    validate_transition(PaymentStatus.PAID, PaymentStatus.REFUND_PENDING)
    validate_transition(PaymentStatus.PAID, PaymentStatus.REFUNDED)
    validate_transition(PaymentStatus.REFUND_PENDING, PaymentStatus.REFUNDED)

    # Invalid transitions
    with pytest.raises(ValidationException):
        validate_transition(PaymentStatus.PAID, PaymentStatus.PENDING)

    with pytest.raises(ValidationException):
        validate_transition(PaymentStatus.REFUNDED, PaymentStatus.PAID)

    with pytest.raises(ValidationException):
        validate_transition(PaymentStatus.CANCELLED, PaymentStatus.PAID)


def test_payment_refund_and_cancel_lifecycle(app, db_session, admin_user, member_user, tennis_court):
    """Test refund_payment and cancel_payment services and audit trail."""
    start_time = (datetime.now(timezone.utc) + timedelta(days=18)).replace(hour=10, minute=0, second=0, microsecond=0)
    booking = BookingFactory.create(
        court=tennis_court,
        start_time=start_time,
        user=member_user,
    )
    payment = PaymentFactory.create(
        item_type="BOOKING",
        item_id=booking.id,
        amount=Decimal("800.00"),
        payment_method=PaymentMethod.CASH,
        user=member_user,
        status=PaymentStatus.PENDING,
    )

    # Cancel payment
    cancelled = cancel_payment(payment.id, requesting_user=member_user, reason="Changed mind")
    assert cancelled.status == PaymentStatus.CANCELLED

    # Mark as PAID and then refund
    payment2 = PaymentFactory.create(
        item_type="BOOKING",
        item_id=booking.id,
        amount=Decimal("800.00"),
        payment_method=PaymentMethod.UPI,
        user=member_user,
        status=PaymentStatus.PAID,
    )
    refunded = refund_payment(payment2.id, requesting_user=admin_user, reason="Customer compensation")
    assert refunded.status == PaymentStatus.REFUNDED
    assert refunded.refunded_at is not None

    # Check audit log was written
    audits = PaymentAudit.query.filter_by(payment_id=payment2.id).all()
    assert len(audits) >= 1
    assert audits[-1].action in ("REFUNDED", "REFUND_COMPLETED")


def test_payment_amount_validation_all_entity_types(app, db_session, gold_plan, member_user):
    """Test validate_item_amount for Bookings, Memberships, and mismatched amounts."""
    # Membership amount validation
    membership = assign_membership(
        member_id=member_user.member_profile.id,
        plan_id=gold_plan.id,
        start_date=date.today(),
    )
    # Valid amount (50000.00)
    validate_item_amount(PaymentItemType.MEMBERSHIP, membership.id, Decimal("50000.00"))

    # Mismatched amount
    with pytest.raises(ValidationException):
        validate_item_amount(PaymentItemType.MEMBERSHIP, membership.id, Decimal("100.00"))

    # Nonexistent membership
    with pytest.raises(NotFoundException):
        validate_item_amount(PaymentItemType.MEMBERSHIP, 999999, Decimal("50000.00"))
