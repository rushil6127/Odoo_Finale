import pytest
from datetime import datetime, date
from backend.app.bookings.models import Booking, BookingStatus
from backend.app.bookings.services import create_booking
from backend.app.common.errors import ValidationException


def test_member_daily_booking_limit_is_five(app, db_session, tennis_court, cricket_court, member_user, gold_member):
    """Member can book up to 5 confirmed bookings on the same date, 6th fails."""
    d = date(2026, 11, 20)

    # 1st to 5th booking on day d
    b1 = create_booking(court_id=tennis_court.id, start_time=datetime(2026, 11, 20, 8, 0, 0), user_id=member_user.id, member_id=gold_member.id)
    b2 = create_booking(court_id=tennis_court.id, start_time=datetime(2026, 11, 20, 9, 30, 0), user_id=member_user.id, member_id=gold_member.id)
    b3 = create_booking(court_id=tennis_court.id, start_time=datetime(2026, 11, 20, 11, 0, 0), user_id=member_user.id, member_id=gold_member.id)
    b4 = create_booking(court_id=cricket_court.id, start_time=datetime(2026, 11, 20, 12, 30, 0), user_id=member_user.id, member_id=gold_member.id)
    b5 = create_booking(court_id=cricket_court.id, start_time=datetime(2026, 11, 20, 14, 0, 0), user_id=member_user.id, member_id=gold_member.id)

    assert b1.status == BookingStatus.CONFIRMED
    assert b2.status == BookingStatus.CONFIRMED
    assert b3.status == BookingStatus.CONFIRMED
    assert b4.status == BookingStatus.CONFIRMED
    assert b5.status == BookingStatus.CONFIRMED

    # 6th booking on day d MUST fail with daily limit exceeded
    with pytest.raises(ValidationException) as exc_info:
        create_booking(court_id=cricket_court.id, start_time=datetime(2026, 11, 20, 16, 0, 0), user_id=member_user.id, member_id=gold_member.id)

    err_str = str(exc_info.value)
    assert "Daily booking limit reached. You can book a maximum of 5 slots per day." in err_str


def test_owner_daily_booking_is_unlimited(app, db_session, tennis_court, cricket_court, owner_user):
    """Owner has unlimited daily bookings and can book more than 5 slots on the same day."""
    slots = [
        (tennis_court.id, 8, 0),
        (tennis_court.id, 9, 30),
        (tennis_court.id, 11, 0),
        (tennis_court.id, 12, 30),
        (cricket_court.id, 14, 0),
        (cricket_court.id, 15, 30),
        (cricket_court.id, 17, 0),
        (cricket_court.id, 18, 30),
    ]

    owner_bookings = []
    for c_id, h, m in slots:
        b = create_booking(
            court_id=c_id,
            start_time=datetime(2026, 11, 25, h, m, 0),
            user_id=owner_user.id,
            is_walk_in=True,
            guest_name="Owner VIP Booking",
        )
        owner_bookings.append(b)

    assert len(owner_bookings) == 8
    for b in owner_bookings:
        assert b.status == BookingStatus.CONFIRMED
