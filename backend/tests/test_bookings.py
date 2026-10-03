import concurrent.futures
from datetime import date, datetime, time, timedelta
import pytest
from flask_jwt_extended import create_access_token
from backend.app.extensions import db
from backend.app.common.permissions import RoleEnum
from backend.app.auth.models import User
from backend.app.auth.services import create_user
from backend.app.members.models import Member
from backend.app.members.services import create_member
from backend.app.memberships.models import MembershipPlan, Membership, MembershipStatus
from backend.app.memberships.services import seed_membership_plans, assign_membership
from backend.app.courts.models import Court, SportType, CourtStatus
from backend.app.courts.services import create_court, get_court_availability
from backend.app.bookings.models import Booking, BookingStatus, CourtOccupancy
from backend.app.bookings.services import (
    create_booking,
    cancel_booking,
    get_booking_by_id,
    list_bookings,
    get_member_booking_history,
)


@pytest.fixture
def seed_data(app, db_session):
    """Seed base plans and courts."""
    seed_membership_plans()
    tennis_court = create_court(
        name="Centre Court (Grass)",
        sport_type="LAWN_TENNIS",
        surface_type="Grass",
        is_indoor=False,
    )
    cricket_court = create_court(
        name="Box Cricket Pitch 1",
        sport_type="BOX_CRICKET",
        surface_type="Synthetic Turf",
        is_indoor=False,
    )
    return {"tennis": tennis_court, "cricket": cricket_court, "padel": cricket_court}


@pytest.fixture
def gold_member_user(app, db_session, seed_data):
    """Create a user with an active Gold membership."""
    user = create_user(
        email="gold.member@club.com",
        password="Password123!",
        first_name="Gold",
        last_name="Champion",
        role=RoleEnum.MEMBER,
    )
    member = create_member(user_id=user.id, phone="9876543210")
    gold_plan = MembershipPlan.query.filter_by(code="GOLD").first()
    assign_membership(
        member_id=member.id,
        plan_id=gold_plan.id,
        start_date=date(2026, 1, 1),
        duration_months=12,
        notes="Gold member",
    )
    return user, member


@pytest.fixture
def silver_member_user(app, db_session, seed_data):
    """Create a user with an active Silver membership."""
    user = create_user(
        email="silver.member@club.com",
        password="Password123!",
        first_name="Silver",
        last_name="Tier",
        role=RoleEnum.MEMBER,
    )
    member = create_member(user_id=user.id, phone="9876543211")
    silver_plan = MembershipPlan.query.filter_by(code="SILVER").first()
    assign_membership(
        member_id=member.id,
        plan_id=silver_plan.id,
        start_date=date(2026, 1, 1),
        duration_months=12,
        notes="Silver member",
    )
    return user, member


@pytest.fixture
def expired_member_user(app, db_session, seed_data):
    """Create a user with an expired membership."""
    user = create_user(
        email="expired.member@club.com",
        password="Password123!",
        first_name="Expired",
        last_name="Member",
        role=RoleEnum.MEMBER,
    )
    member = create_member(user_id=user.id, phone="9876543212")
    gold_plan = MembershipPlan.query.filter_by(code="GOLD").first()
    ms = Membership(
        member_id=member.id,
        plan_id=gold_plan.id,
        start_date=date(2025, 1, 1),
        end_date=date(2025, 12, 31),
        status=MembershipStatus.EXPIRED,
    )
    db.session.add(ms)
    db.session.commit()
    return user, member


@pytest.fixture
def front_desk_user(app, db_session):
    """Front desk staff user."""
    return create_user(
        email="frontdesk@club.com",
        password="Password123!",
        first_name="Front",
        last_name="Desk",
        role=RoleEnum.FRONT_DESK,
    )


@pytest.fixture
def admin_user(app, db_session):
    """Admin user."""
    return create_user(
        email="admin@club.com",
        password="Password123!",
        first_name="Admin",
        last_name="User",
        role=RoleEnum.ADMIN,
    )


def auth_header(user: User) -> dict:
    role_str = user.role.value if hasattr(user.role, "value") else str(user.role)
    token = create_access_token(identity=str(user.id), additional_claims={"role": role_str})
    return {"Authorization": f"Bearer {token}"}


# =========================================================================
# UNIT & SERVICE LEVEL TESTS
# =========================================================================

def test_create_booking_service_success(app, db_session, seed_data, gold_member_user):
    """Test standard 1-hour booking creation with occupancy entries."""
    user, member = gold_member_user
    court = seed_data["tennis"]
    start_dt = datetime(2026, 10, 10, 10, 0, 0)

    booking = create_booking(
        court_id=court.id,
        start_time=start_dt,
        user_id=user.id,
        member_id=member.id,
        is_walk_in=False,
    )

    assert booking.id is not None
    assert booking.booking_reference.startswith("BK-")
    assert booking.court_id == court.id
    assert booking.member_id == member.id
    assert booking.status == BookingStatus.CONFIRMED
    assert booking.start_time == start_dt
    assert booking.end_time == start_dt + timedelta(minutes=60)
    assert booking.base_price == 800.0  # Tennis base rate
    assert booking.discount_amount == 800.0  # Gold 100% discount
    assert booking.final_price == 0.0

    # Check that exactly two 30-minute occupancy entries were created
    occupancies = CourtOccupancy.query.filter_by(booking_id=booking.id).all()
    assert len(occupancies) == 2
    slot_starts = [occ.slot_start for occ in occupancies]
    assert start_dt in slot_starts
    assert start_dt + timedelta(minutes=30) in slot_starts


def test_exact_overlap_booking_fails(app, db_session, seed_data, gold_member_user):
    """Two bookings for the exact same slot must raise 409 conflict."""
    user, member = gold_member_user
    court = seed_data["tennis"]
    start_dt = datetime(2026, 10, 10, 10, 0, 0)

    create_booking(
        court_id=court.id,
        start_time=start_dt,
        user_id=user.id,
        member_id=member.id,
    )

    from backend.app.common.errors import ConflictException
    with pytest.raises(ConflictException) as exc_info:
        create_booking(
            court_id=court.id,
            start_time=start_dt,
            user_id=user.id,
            member_id=member.id,
        )
    assert "already booked" in str(exc_info.value) or "scheduling conflict" in str(exc_info.value)


def test_partial_overlap_later_start_fails(app, db_session, seed_data, gold_member_user):
    """Booking 10:30-11:30 when 10:00-11:00 exists must conflict."""
    user, member = gold_member_user
    court = seed_data["tennis"]
    start1 = datetime(2026, 10, 10, 10, 0, 0)
    start2 = datetime(2026, 10, 10, 10, 30, 0)

    create_booking(court_id=court.id, start_time=start1, user_id=user.id, member_id=member.id)

    from backend.app.common.errors import ConflictException
    with pytest.raises(ConflictException):
        create_booking(court_id=court.id, start_time=start2, user_id=user.id, member_id=member.id)


def test_partial_overlap_earlier_start_fails(app, db_session, seed_data, gold_member_user):
    """Booking 09:30-10:30 when 10:00-11:00 exists must conflict."""
    user, member = gold_member_user
    court = seed_data["tennis"]
    start1 = datetime(2026, 10, 10, 10, 0, 0)
    start2 = datetime(2026, 10, 10, 9, 30, 0)

    create_booking(court_id=court.id, start_time=start1, user_id=user.id, member_id=member.id)

    from backend.app.common.errors import ConflictException
    with pytest.raises(ConflictException):
        create_booking(court_id=court.id, start_time=start2, user_id=user.id, member_id=member.id)


def test_adjacent_bookings_succeed(app, db_session, seed_data, gold_member_user):
    """Adjacent bookings (10:00-11:00 and 11:00-12:00) do not overlap and succeed."""
    user, member = gold_member_user
    court = seed_data["tennis"]
    start1 = datetime(2026, 10, 10, 10, 0, 0)
    start2 = datetime(2026, 10, 10, 11, 0, 0)

    b1 = create_booking(court_id=court.id, start_time=start1, user_id=user.id, member_id=member.id)
    b2 = create_booking(court_id=court.id, start_time=start2, user_id=user.id, member_id=member.id)

    assert b1.status == BookingStatus.CONFIRMED
    assert b2.status == BookingStatus.CONFIRMED


def test_daily_booking_limit_third_fails(app, db_session, seed_data, gold_member_user):
    """Member cannot exceed 2 confirmed bookings on the same date."""
    user, member = gold_member_user
    court1 = seed_data["tennis"]
    court2 = seed_data["padel"]
    d = date(2026, 10, 10)

    # 1st booking on day D
    create_booking(court_id=court1.id, start_time=datetime(2026, 10, 10, 8, 0, 0), user_id=user.id, member_id=member.id)
    # 2nd booking on day D
    create_booking(court_id=court1.id, start_time=datetime(2026, 10, 10, 10, 0, 0), user_id=user.id, member_id=member.id)

    # 3rd booking on day D must fail with daily limit error
    from backend.app.common.errors import ValidationException
    with pytest.raises(ValidationException) as exc_info:
        create_booking(court_id=court2.id, start_time=datetime(2026, 10, 10, 14, 0, 0), user_id=user.id, member_id=member.id)
    assert "Daily booking limit" in str(exc_info.value)

    # Booking on the next day D+1 must succeed
    b_next = create_booking(court_id=court1.id, start_time=datetime(2026, 10, 11, 8, 0, 0), user_id=user.id, member_id=member.id)
    assert b_next.status == BookingStatus.CONFIRMED


def test_cancellation_frees_occupancy_and_allows_rebooking(app, db_session, seed_data, gold_member_user):
    """Cancellation updates status, preserves snapshot, frees occupancy, and allows re-booking."""
    user, member = gold_member_user
    court = seed_data["tennis"]
    start_dt = datetime(2026, 10, 10, 10, 0, 0)

    booking = create_booking(court_id=court.id, start_time=start_dt, user_id=user.id, member_id=member.id)
    booking_id = booking.id

    # Occupancies exist
    assert CourtOccupancy.query.filter_by(booking_id=booking_id).count() == 2

    # Cancel booking
    cancelled = cancel_booking(booking_id=booking_id, reason="Member injured")
    assert cancelled.status == BookingStatus.CANCELLED
    assert cancelled.cancellation_reason == "Member injured"
    assert cancelled.cancelled_at is not None
    assert cancelled.final_price == 0.0  # History preserved

    # Occupancies must be deleted
    assert CourtOccupancy.query.filter_by(booking_id=booking_id).count() == 0

    # Now the exact same slot can be booked again!
    new_booking = create_booking(court_id=court.id, start_time=start_dt, user_id=user.id, member_id=member.id)
    assert new_booking.status == BookingStatus.CONFIRMED


def test_walk_in_booking_pricing(app, db_session, seed_data, front_desk_user):
    """Walk-in bookings charge full sport base price without member discount."""
    desk = front_desk_user
    cricket = seed_data["cricket"]
    start_dt = datetime(2026, 10, 10, 14, 0, 0)

    booking = create_booking(
        court_id=cricket.id,
        start_time=start_dt,
        user_id=desk.id,
        is_walk_in=True,
        guest_name="Roger Federer",
        guest_phone="9988776655",
    )

    assert booking.is_walk_in is True
    assert booking.guest_name == "Roger Federer"
    assert booking.base_price == 1500.0  # Box Cricket rate
    assert booking.discount_amount == 0.0
    assert booking.final_price == 1500.0


def test_silver_member_pricing_discount(app, db_session, seed_data, silver_member_user):
    """Silver tier member gets 50% discount snapshot."""
    user, member = silver_member_user
    cricket = seed_data["cricket"]
    start_dt = datetime(2026, 10, 10, 16, 0, 0)

    booking = create_booking(
        court_id=cricket.id,
        start_time=start_dt,
        user_id=user.id,
        member_id=member.id,
    )

    assert booking.base_price == 1500.0
    assert booking.discount_amount == 750.0  # 50% off
    assert booking.final_price == 750.0


def test_expired_member_pricing(app, db_session, seed_data, expired_member_user):
    """Member with expired subscription gets 0% discount."""
    user, member = expired_member_user
    tennis = seed_data["tennis"]
    start_dt = datetime(2026, 10, 10, 9, 0, 0)

    booking = create_booking(
        court_id=tennis.id,
        start_time=start_dt,
        user_id=user.id,
        member_id=member.id,
    )

    assert booking.base_price == 800.0
    assert booking.discount_amount == 0.0
    assert booking.final_price == 800.0


def test_invalid_slot_alignment(app, db_session, seed_data, gold_member_user):
    """Start time not on :00 or :30 must be rejected."""
    user, member = gold_member_user
    tennis = seed_data["tennis"]
    bad_time = datetime(2026, 10, 10, 10, 15, 0)

    from backend.app.common.errors import ValidationException
    with pytest.raises(ValidationException) as exc_info:
        create_booking(court_id=tennis.id, start_time=bad_time, user_id=user.id, member_id=member.id)
    assert "slot interval" in str(exc_info.value)


def test_outside_operating_hours(app, db_session, seed_data, gold_member_user):
    """Start times before 06:00 or sessions ending after 22:00 must be rejected."""
    user, member = gold_member_user
    tennis = seed_data["tennis"]

    from backend.app.common.errors import ValidationException
    # Too early: 05:00
    with pytest.raises(ValidationException):
        create_booking(court_id=tennis.id, start_time=datetime(2026, 10, 10, 5, 0, 0), user_id=user.id, member_id=member.id)

    # Too late: 21:30 (session ends 22:30 > 22:00)
    with pytest.raises(ValidationException):
        create_booking(court_id=tennis.id, start_time=datetime(2026, 10, 10, 21, 30, 0), user_id=user.id, member_id=member.id)


def test_friday_social_play(app, db_session, seed_data, gold_member_user):
    """Friday social play validations and pricing."""
    user, member = gold_member_user
    tennis = seed_data["tennis"]

    # 2026-10-09 is a Friday. Time 18:00 is within 18:00-21:00.
    friday_social = datetime(2026, 10, 9, 18, 0, 0)
    assert friday_social.weekday() == 4

    booking = create_booking(
        court_id=tennis.id,
        start_time=friday_social,
        user_id=user.id,
        member_id=member.id,
        is_social_play=True,
    )
    assert booking.is_social_play is True
    assert booking.base_price == 200.0
    assert booking.final_price == 0.0  # Gold member gets 100% off social play

    # Non-Friday social play attempt (2026-10-10 is Saturday)
    saturday_social = datetime(2026, 10, 10, 18, 0, 0)
    from backend.app.common.errors import ValidationException
    with pytest.raises(ValidationException) as exc_info:
        create_booking(
            court_id=tennis.id,
            start_time=saturday_social,
            user_id=user.id,
            member_id=member.id,
            is_social_play=True,
        )
    assert "only held on Fridays" in str(exc_info.value)


# =========================================================================
# REST API ENDPOINT & RBAC TESTS
# =========================================================================

def test_member_create_booking_api(client, seed_data, gold_member_user):
    """Member creates booking via REST API."""
    user, member = gold_member_user
    tennis = seed_data["tennis"]
    headers = auth_header(user)

    res = client.post(
        "/api/v1/bookings",
        headers=headers,
        json={
            "court_id": tennis.id,
            "start_time": "2026-10-10T10:00:00",
            "notes": "Morning practice",
        },
    )
    assert res.status_code == 201
    body = res.get_json()
    assert body["success"] is True
    data = body["data"]
    assert data["court_id"] == tennis.id
    assert data["member_id"] == member.id
    assert data["status"] == "CONFIRMED"
    assert data["notes"] == "Morning practice"


def test_member_conflict_api_returns_409(client, seed_data, gold_member_user, silver_member_user):
    """API returns 409 conflict envelope when booking overlaps."""
    gold_user, _ = gold_member_user
    silver_user, _ = silver_member_user
    tennis = seed_data["tennis"]

    # 1st booking
    res1 = client.post(
        "/api/v1/bookings",
        headers=auth_header(gold_user),
        json={"court_id": tennis.id, "start_time": "2026-10-10T10:00:00"},
    )
    assert res1.status_code == 201

    # Overlapping 2nd booking
    res2 = client.post(
        "/api/v1/bookings",
        headers=auth_header(silver_user),
        json={"court_id": tennis.id, "start_time": "2026-10-10T10:30:00"},
    )
    assert res2.status_code == 409
    body2 = res2.get_json()
    assert body2["success"] is False
    assert body2["error"]["code"] == "BOOKING_CONFLICT"


def test_member_cannot_cancel_other_member_booking(client, seed_data, gold_member_user, silver_member_user):
    """Member receives 403 when attempting to cancel another member's booking."""
    gold_user, _ = gold_member_user
    silver_user, _ = silver_member_user
    tennis = seed_data["tennis"]

    # Gold creates booking
    res = client.post(
        "/api/v1/bookings",
        headers=auth_header(gold_user),
        json={"court_id": tennis.id, "start_time": "2026-10-10T10:00:00"},
    )
    booking_id = res.get_json()["data"]["id"]

    # Silver attempts to cancel Gold's booking
    res_cancel = client.post(
        f"/api/v1/bookings/{booking_id}/cancel",
        headers=auth_header(silver_user),
        json={"reason": "Malicious attempt"},
    )
    assert res_cancel.status_code == 403
    assert res_cancel.get_json()["success"] is False


def test_front_desk_can_cancel_any_booking(client, seed_data, gold_member_user, front_desk_user):
    """Front desk staff can cancel any booking."""
    gold_user, _ = gold_member_user
    tennis = seed_data["tennis"]

    res = client.post(
        "/api/v1/bookings",
        headers=auth_header(gold_user),
        json={"court_id": tennis.id, "start_time": "2026-10-10T10:00:00"},
    )
    booking_id = res.get_json()["data"]["id"]

    res_cancel = client.post(
        f"/api/v1/bookings/{booking_id}/cancel",
        headers=auth_header(front_desk_user),
        json={"reason": "Court maintenance emergency"},
    )
    assert res_cancel.status_code == 200
    assert res_cancel.get_json()["data"]["status"] == "CANCELLED"


def test_member_history_endpoints(client, seed_data, gold_member_user):
    """Member can fetch their own booking history via /my-history."""
    user, member = gold_member_user
    tennis = seed_data["tennis"]

    client.post(
        "/api/v1/bookings",
        headers=auth_header(user),
        json={"court_id": tennis.id, "start_time": "2026-10-10T10:00:00"},
    )

    res = client.get("/api/v1/bookings/my-history", headers=auth_header(user))
    assert res.status_code == 200
    body = res.get_json()
    assert body["success"] is True
    assert len(body["data"]) == 1
    assert body["data"][0]["court"]["name"] == "Centre Court (Grass)"


def test_availability_endpoint_reflects_occupancies(client, seed_data, gold_member_user):
    """Availability endpoint returns is_available: false for occupied slots."""
    user, _ = gold_member_user
    tennis = seed_data["tennis"]

    # Availability before booking
    res_avail1 = client.get("/api/v1/courts/availability?date=2026-10-10")
    assert res_avail1.status_code == 200
    tennis_court_data1 = next(c for c in res_avail1.get_json()["data"]["courts"] if c["id"] == tennis.id)
    slots_before = tennis_court_data1["slots"]
    slot_10am = next(s for s in slots_before if s["start_time"] == "10:00")
    assert slot_10am["is_available"] is True

    # Book 10:00-11:00
    res_book = client.post(
        "/api/v1/bookings",
        headers=auth_header(user),
        json={"court_id": tennis.id, "start_time": "2026-10-10T10:00:00"},
    )
    assert res_book.status_code == 201
    booking_id = res_book.get_json()["data"]["id"]

    # Availability after booking
    res_avail2 = client.get("/api/v1/courts/availability?date=2026-10-10")
    tennis_court_data2 = next(c for c in res_avail2.get_json()["data"]["courts"] if c["id"] == tennis.id)
    slots_after = tennis_court_data2["slots"]
    # 10:00 slot is occupied
    s_1000 = next(s for s in slots_after if s["start_time"] == "10:00")
    assert s_1000["is_available"] is False
    assert s_1000["reason"] == "OCCUPIED"

    # 10:30 slot overlaps with the 1-hour booking so it is also unavailable!
    s_1030 = next(s for s in slots_after if s["start_time"] == "10:30")
    assert s_1030["is_available"] is False
    assert s_1030["reason"] == "OCCUPIED"

    # 11:00 slot is available
    s_1100 = next(s for s in slots_after if s["start_time"] == "11:00")
    assert s_1100["is_available"] is True

    # Cancel booking
    client.post(f"/api/v1/bookings/{booking_id}/cancel", headers=auth_header(user))

    # Availability after cancel -> 10:00 is available again
    res_avail3 = client.get("/api/v1/courts/availability?date=2026-10-10")
    tennis_court_data3 = next(c for c in res_avail3.get_json()["data"]["courts"] if c["id"] == tennis.id)
    slots_cancel = tennis_court_data3["slots"]
    s_1000_after = next(s for s in slots_cancel if s["start_time"] == "10:00")
    assert s_1000_after["is_available"] is True


def test_simultaneous_concurrent_bookings_race_condition(app, db_session, seed_data, gold_member_user, silver_member_user):
    """Two concurrent threads attempt to book the exact same slot simultaneously: exactly 1 succeeds, 1 gets conflict."""
    db.session.commit()
    gold_user, gold_member = gold_member_user
    silver_user, silver_member = silver_member_user
    court_id = seed_data["tennis"].id
    gold_uid, gold_mid = gold_user.id, gold_member.id
    silver_uid, silver_mid = silver_user.id, silver_member.id
    start_dt = datetime(2026, 10, 10, 10, 0, 0)

    results = []

    def attempt_booking(uid, mid):
        with app.app_context():
            from backend.app.common.errors import ConflictException
            try:
                b = create_booking(
                    court_id=court_id,
                    start_time=start_dt,
                    user_id=uid,
                    member_id=mid,
                )
                results.append(("SUCCESS", b.id))
            except ConflictException as e:
                results.append(("CONFLICT", str(e)))
            except Exception as e:
                results.append(("OTHER_ERROR", f"{type(e).__name__}: {str(e)}"))

    with concurrent.futures.ThreadPoolExecutor(max_workers=2) as executor:
        f1 = executor.submit(attempt_booking, gold_uid, gold_mid)
        f2 = executor.submit(attempt_booking, silver_uid, silver_mid)
        concurrent.futures.wait([f1, f2])

    statuses = [r[0] for r in results]
    assert statuses.count("SUCCESS") == 1, f"Results: {results}"
    assert statuses.count("CONFLICT") == 1, f"Results: {results}"


def test_list_bookings_filters_and_roles(client, seed_data, gold_member_user, front_desk_user):
    """Staff can list and filter bookings by date, status, and sport."""
    gold_user, gold_member = gold_member_user
    tennis = seed_data["tennis"]
    padel = seed_data["padel"]

    # Create bookings
    b1 = create_booking(court_id=tennis.id, start_time=datetime(2026, 10, 10, 8, 0, 0), user_id=gold_user.id, member_id=gold_member.id)
    b2 = create_booking(court_id=padel.id, start_time=datetime(2026, 10, 10, 9, 0, 0), user_id=front_desk_user.id, is_walk_in=True, guest_name="Guest X")

    # Staff list all
    res = client.get("/api/v1/bookings", headers=auth_header(front_desk_user))
    assert res.status_code == 200
    assert len(res.get_json()["data"]) == 2

    # Staff filter by sport
    res_tennis = client.get("/api/v1/bookings?sport_type=LAWN_TENNIS", headers=auth_header(front_desk_user))
    assert len(res_tennis.get_json()["data"]) == 1

    # Staff filter by is_walk_in
    res_walkin = client.get("/api/v1/bookings?is_walk_in=true", headers=auth_header(front_desk_user))
    assert len(res_walkin.get_json()["data"]) == 1
    assert res_walkin.get_json()["data"][0]["guest_name"] == "Guest X"

    # Member list is auto-scoped to own bookings
    res_member = client.get("/api/v1/bookings", headers=auth_header(gold_user))
    assert len(res_member.get_json()["data"]) == 1
    assert res_member.get_json()["data"][0]["id"] == b1.id


def test_get_booking_detail_route(client, seed_data, gold_member_user, silver_member_user, front_desk_user):
    """Booking detail route permissions and not found."""
    gold_user, gold_member = gold_member_user
    silver_user, silver_member = silver_member_user
    tennis = seed_data["tennis"]

    b = create_booking(court_id=tennis.id, start_time=datetime(2026, 10, 10, 8, 0, 0), user_id=gold_user.id, member_id=gold_member.id)

    # Gold views own
    res_gold = client.get(f"/api/v1/bookings/{b.id}", headers=auth_header(gold_user))
    assert res_gold.status_code == 200
    assert res_gold.get_json()["data"]["id"] == b.id

    # Silver views Gold's -> 403
    res_silver = client.get(f"/api/v1/bookings/{b.id}", headers=auth_header(silver_user))
    assert res_silver.status_code == 403

    # Staff views Gold's -> 200
    res_staff = client.get(f"/api/v1/bookings/{b.id}", headers=auth_header(front_desk_user))
    assert res_staff.status_code == 200

    # Non-existent ID -> 404
    res_404 = client.get("/api/v1/bookings/99999", headers=auth_header(front_desk_user))
    assert res_404.status_code == 404


def test_staff_create_walk_in_api(client, seed_data, front_desk_user):
    """Front desk staff creates a walk-in booking via API."""
    cricket = seed_data["cricket"]
    res = client.post(
        "/api/v1/bookings",
        headers=auth_header(front_desk_user),
        json={
            "court_id": cricket.id,
            "start_time": "2026-10-10T15:00:00",
            "is_walk_in": True,
            "guest_name": "Novak Djokovic",
            "guest_phone": "9876500000",
            "notes": "VIP walk-in guest",
        },
    )
    assert res.status_code == 201
    data = res.get_json()["data"]
    assert data["is_walk_in"] is True
    assert data["guest_name"] == "Novak Djokovic"
    assert data["base_price"] == 1500.0
    assert data["final_price"] == 1500.0


def test_member_history_for_staff_and_forbidden_for_other_member(client, seed_data, gold_member_user, silver_member_user, front_desk_user):
    """Staff can view any member history; member cannot view another member's history."""
    gold_user, gold_member = gold_member_user
    silver_user, silver_member = silver_member_user
    tennis = seed_data["tennis"]

    create_booking(court_id=tennis.id, start_time=datetime(2026, 10, 10, 8, 0, 0), user_id=gold_user.id, member_id=gold_member.id)

    # Gold views own history via member route -> 200
    res_own = client.get(f"/api/v1/bookings/members/{gold_member.id}/history", headers=auth_header(gold_user))
    assert res_own.status_code == 200
    assert len(res_own.get_json()["data"]) == 1

    # Silver views Gold's history -> 403
    res_other = client.get(f"/api/v1/bookings/members/{gold_member.id}/history", headers=auth_header(silver_user))
    assert res_other.status_code == 403

    # Staff views Gold's history -> 200
    res_staff = client.get(f"/api/v1/bookings/members/{gold_member.id}/history", headers=auth_header(front_desk_user))
    assert res_staff.status_code == 200
    assert len(res_staff.get_json()["data"]) == 1


