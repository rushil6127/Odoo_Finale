import threading
from datetime import date, datetime, time, timedelta
from typing import List, Optional, Dict, Any, Tuple
from flask import current_app
from sqlalchemy.exc import IntegrityError, OperationalError
from backend.app.extensions import db
from backend.app.common.utils import utc_now
from backend.app.common.errors import (
    NotFoundException,
    ValidationException,
    ConflictException,
    ForbiddenException,
)
from backend.app.courts.models import Court, CourtStatus, SportType
from backend.app.courts.services import parse_time_str
from backend.app.members.models import Member
from backend.app.auth.models import User
from backend.app.common.permissions import RoleEnum
from backend.app.bookings.models import (
    Booking,
    BookingStatus,
    CourtOccupancy,
    generate_booking_reference,
)

_booking_lock = threading.Lock()



# ---------------------------------------------------------
# Timing & Operating Hours Validation
# ---------------------------------------------------------

def validate_slot_timing(
    court: Court,
    start_time: datetime,
    duration_minutes: int = 60,
    interval_minutes: int = 30,
    is_social_play: bool = False,
) -> datetime:
    """Validate booking start time, interval alignment, operating hours, and court status.
    
    Returns the calculated end_time.
    """
    if court.status != CourtStatus.ACTIVE:
        raise ValidationException(
            f"Court '{court.name}' is currently {court.status.value} and cannot be booked.",
            code="COURT_UNAVAILABLE",
        )

    # 1. Interval alignment (e.g., must start on :00 or :30)
    if start_time.minute % interval_minutes != 0 or start_time.second != 0 or start_time.microsecond != 0:
        raise ValidationException(
            f"Booking start time must align with the {interval_minutes}-minute slot interval (e.g. :00 or :30).",
            code="INVALID_SLOT_TIME",
        )

    # 2. Duration calculation
    end_time = start_time + timedelta(minutes=duration_minutes)

    # 3. Operating hours check
    config = current_app.config if current_app else {}
    open_str = court.custom_open_time or config.get("COURT_OPEN_TIME", "06:00")
    close_str = court.custom_close_time or config.get("COURT_CLOSE_TIME", "22:00")

    open_t = parse_time_str(open_str)
    close_t = parse_time_str(close_str)

    start_t = start_time.time()
    end_t = end_time.time()

    # Check start is not before open, and end is not after close
    if start_t < open_t or end_t > close_t:
        raise ValidationException(
            f"Requested session ({start_t.strftime('%H:%M')} - {end_t.strftime('%H:%M')}) is outside court operating hours ({open_str} - {close_str}).",
            code="OUTSIDE_OPERATING_HOURS",
        )

    # 4. Friday Social Play specific checks
    if is_social_play:
        social_enabled = config.get("FRIDAY_SOCIAL_PLAY_ENABLED", True)
        if not social_enabled:
            raise ValidationException(
                "Friday Social Play is currently disabled.",
                code="SOCIAL_PLAY_DISABLED",
            )
        # Check weekday: 4 is Friday (Monday is 0)
        if start_time.weekday() != 4:
            raise ValidationException(
                f"Social Play sessions are only held on Fridays (requested day is {start_time.strftime('%A')}).",
                code="INVALID_SOCIAL_PLAY_DAY",
            )
        social_start = parse_time_str(config.get("FRIDAY_SOCIAL_PLAY_START_TIME", "19:00"))
        social_end = parse_time_str(config.get("FRIDAY_SOCIAL_PLAY_END_TIME", "22:00"))
        if start_t < social_start or end_t > social_end:
            raise ValidationException(
                f"Friday Social Play is only scheduled between {social_start.strftime('%H:%M')} and {social_end.strftime('%H:%M')}.",
                code="INVALID_SOCIAL_PLAY_HOURS",
            )

    return end_time


# ---------------------------------------------------------
# Pricing Calculation
# ---------------------------------------------------------

def calculate_booking_price(
    court: Court,
    member_id: Optional[int],
    is_walk_in: bool = False,
    is_social_play: bool = False,
    target_date: Optional[date] = None,
) -> Tuple[float, float, float, Dict[str, Any]]:
    """Calculate snapshot pricing for a court reservation.
    
    Returns (base_price, discount_amount, final_price, pricing_breakdown).
    """
    config = current_app.config if current_app else {}
    target = target_date or date.today()

    # 1. Determine base rate
    if is_social_play:
        base_rate = float(config.get("FRIDAY_SOCIAL_PLAY_BASE_RATE", 300.0))
        rate_source = "FRIDAY_SOCIAL_PLAY_BASE_RATE"
    else:
        sport_rates = config.get("DEFAULT_SPORT_RATES", {
            "LAWN_TENNIS": 800.0,
            "BADMINTON": 400.0,
            "BOX_CRICKET": 1500.0,
        })
        sport_key = court.sport_type.value if hasattr(court.sport_type, "value") else str(court.sport_type)
        base_rate = float(sport_rates.get(sport_key, 0.0))
        rate_source = f"SPORT_BASE_RATE_{sport_key}"

    discount_percentage = 0.0
    discount_tier = "WALK_IN"
    discount_reason = "Standard walk-in rate (no active membership discount)"

    # 2. Determine member discount
    if not is_walk_in and member_id:
        member = db.session.get(Member, member_id)
        if member:
            active_ms = member.get_active_membership(target)
            if active_ms and active_ms.plan:
                plan_code = active_ms.plan.code.upper().strip()
                discounts = config.get("MEMBER_DISCOUNT_PERCENTAGES", {
                    "GOLD": 100.0,
                    "SILVER": 50.0,
                    "JUNIOR": 50.0,
                })
                discount_percentage = float(discounts.get(plan_code, 0.0))
                discount_tier = plan_code
                discount_reason = f"Active {active_ms.plan.name} discount ({discount_percentage:.0f}%)"
            else:
                discount_reason = "Member profile exists but has no active membership on the booking date"

    # 3. Calculate financial totals
    discount_amount = round(base_rate * (discount_percentage / 100.0), 2)
    final_price = max(0.0, round(base_rate - discount_amount, 2))

    breakdown = {
        "rate_source": rate_source,
        "base_price": base_rate,
        "discount_percentage": discount_percentage,
        "discount_amount": discount_amount,
        "final_price": final_price,
        "tier": discount_tier,
        "description": discount_reason,
        "is_social_play": is_social_play,
    }

    return base_rate, discount_amount, final_price, breakdown


# ---------------------------------------------------------
# Daily Booking Limit Check
# ---------------------------------------------------------

def check_daily_booking_limit(
    member_id: Optional[int],
    booking_date: date,
    is_social_play: bool = False,
    user_id: Optional[int] = None,
) -> None:
    """Verify that a member does not exceed the maximum allowed active bookings per day.
    
    Owners and Admins have unlimited bookings (no daily limit applied).
    Members can book up to the configured daily limit (default 5 slots per day).
    """
    if not member_id:
        return

    # 1. Check if user or member is an Owner/Admin - owners have unlimited booking privileges
    if user_id:
        user = db.session.get(User, user_id)
        if user:
            role_val = user.role.value if hasattr(user.role, "value") else str(user.role)
            if role_val in (RoleEnum.OWNER.value, RoleEnum.ADMIN.value, "OWNER", "ADMIN"):
                return

    member = db.session.get(Member, member_id)
    if member and member.user:
        role_val = member.user.role.value if hasattr(member.user.role, "value") else str(member.user.role)
        if role_val in (RoleEnum.OWNER.value, RoleEnum.ADMIN.value, "OWNER", "ADMIN"):
            return

    try:
        from flask_jwt_extended import current_user
        if current_user:
            role_val = current_user.role.value if hasattr(current_user.role, "value") else str(current_user.role)
            if role_val in (RoleEnum.OWNER.value, RoleEnum.ADMIN.value, "OWNER", "ADMIN"):
                return
    except Exception:
        pass

    config = current_app.config if current_app else {}
    social_counts = config.get("SOCIAL_PLAY_COUNTS_TOWARDS_DAILY_LIMIT", False)

    if is_social_play and not social_counts:
        return

    max_limit = int(config.get("MAX_DAILY_BOOKINGS_PER_MEMBER", 5))

    # Count CONFIRMED bookings for this member on the given booking_date
    query = Booking.query.filter(
        Booking.member_id == member_id,
        Booking.booking_date == booking_date,
        Booking.status == BookingStatus.CONFIRMED,
    )
    if not social_counts:
        query = query.filter(Booking.is_social_play.is_(False))

    active_count = query.count()
    if active_count >= max_limit:
        raise ValidationException(
            f"Daily booking limit reached. You can book a maximum of {max_limit} slots per day.",
            code="DAILY_LIMIT_EXCEEDED",
            details={
                "member_id": [f"Member already has {active_count} confirmed booking(s) on this date."],
                "max_limit": max_limit,
            },
        )



# ---------------------------------------------------------
# Core Booking Management
# ---------------------------------------------------------

def create_booking(
    court_id: int,
    start_time: datetime,
    user_id: Optional[int] = None,
    member_id: Optional[int] = None,
    is_walk_in: bool = False,
    is_social_play: bool = False,
    guest_name: Optional[str] = None,
    guest_phone: Optional[str] = None,
    guest_email: Optional[str] = None,
    notes: Optional[str] = None,
) -> Booking:
    """Create a new court reservation with database-level concurrency protection."""
    with _booking_lock:
        court = db.session.get(Court, court_id)
        if not court:
            raise NotFoundException(f"Court with ID {court_id} not found.")

        # 1. Validate timing, operating hours, interval step
        config = current_app.config if current_app else {}
        duration = int(config.get("COURT_SLOT_DURATION_MINUTES", 60))
        interval = int(config.get("COURT_SLOT_INTERVAL_MINUTES", 30))

        end_time = validate_slot_timing(
            court=court,
            start_time=start_time,
            duration_minutes=duration,
            interval_minutes=interval,
            is_social_play=is_social_play,
        )

        booking_date = start_time.date()

        # 2. Validate member & walk-in
        if not is_walk_in:
            if not member_id:
                raise ValidationException(
                    "member_id is required for member bookings. For walk-in bookings, set is_walk_in=true.",
                    code="MEMBER_REQUIRED",
                )
            member = db.session.get(Member, member_id)
            if not member:
                raise NotFoundException(f"Member with ID {member_id} not found.")
        else:
            if not guest_name or not guest_name.strip():
                raise ValidationException(
                    "Guest name is required for walk-in bookings.",
                    code="GUEST_NAME_REQUIRED",
                )

        # 3. Check daily booking limit
        if not is_walk_in and member_id:
            check_daily_booking_limit(
                member_id=member_id,
                booking_date=booking_date,
                is_social_play=is_social_play,
                user_id=user_id,
            )

        # 4. Calculate pricing snapshot
        base_price, discount_amount, final_price, breakdown = calculate_booking_price(
            court=court,
            member_id=member_id if not is_walk_in else None,
            is_walk_in=is_walk_in,
            is_social_play=is_social_play,
            target_date=booking_date,
        )

        # 5. Half-slot timestamps for 1-hour session (e.g. start and start+30m)
        slot1 = start_time
        slot2 = start_time + timedelta(minutes=interval)

        # Pre-check existing occupancy records for clear error reporting
        conflicting_occupancy = CourtOccupancy.query.filter(
            CourtOccupancy.court_id == court.id,
            CourtOccupancy.slot_start.in_([slot1, slot2]),
        ).first()

        if conflicting_occupancy:
            raise ConflictException(
                f"Court '{court.name}' is already booked for the requested time slot.",
                code="BOOKING_CONFLICT",
            )

        # 6. Instantiate Booking
        booking = Booking(
            booking_reference=generate_booking_reference(),
            court_id=court.id,
            member_id=member_id if not is_walk_in else None,
            user_id=user_id,
            booking_date=booking_date,
            start_time=start_time,
            end_time=end_time,
            status=BookingStatus.CONFIRMED,
            is_walk_in=is_walk_in,
            is_social_play=is_social_play,
            guest_name=guest_name.strip() if guest_name else None,
            guest_phone=guest_phone.strip() if guest_phone else None,
            guest_email=guest_email.strip() if guest_email else None,
            base_price=base_price,
            discount_amount=discount_amount,
            final_price=final_price,
            pricing_breakdown=breakdown,
            notes=notes.strip() if notes else None,
        )

        db.session.add(booking)
        db.session.flush()

        # 7. Insert CourtOccupancy records
        occ1 = CourtOccupancy(court_id=court.id, booking_id=booking.id, slot_start=slot1)
        occ2 = CourtOccupancy(court_id=court.id, booking_id=booking.id, slot_start=slot2)
        db.session.add_all([occ1, occ2])

        try:
            db.session.commit()
        except (IntegrityError, OperationalError):
            db.session.rollback()
            raise ConflictException(
                f"Court '{court.name}' is no longer available for the requested time due to a scheduling conflict.",
                code="BOOKING_CONFLICT",
            )

        try:
            from backend.app.tasks.dispatcher import safe_enqueue_task
            from backend.app.tasks.jobs import send_booking_confirmation_task
            safe_enqueue_task(send_booking_confirmation_task, booking.id)
        except Exception:
            pass

        return booking


def cancel_booking(
    booking_id: int,
    reason: Optional[str] = None,
    requesting_user: Optional[Any] = None,
) -> Booking:
    """Cancel a booking, releasing the occupancy slots while preserving the booking record."""
    booking = db.session.get(Booking, booking_id)
    if not booking:
        raise NotFoundException(f"Booking with ID {booking_id} not found.")

    # Check permission if user is provided and is a MEMBER
    if requesting_user and hasattr(requesting_user, "is_member") and requesting_user.is_member:
        if not booking.member or booking.member.user_id != requesting_user.id:
            raise ForbiddenException("You are not authorized to cancel this booking.")

    if booking.status == BookingStatus.CANCELLED:
        raise ValidationException("This booking has already been cancelled.", code="ALREADY_CANCELLED")

    if booking.status == BookingStatus.COMPLETED:
        raise ValidationException("Completed bookings cannot be cancelled.", code="CANNOT_CANCEL_COMPLETED")

    # Free the occupancy half-slots
    CourtOccupancy.query.filter_by(booking_id=booking.id).delete()

    booking.status = BookingStatus.CANCELLED
    booking.cancelled_at = utc_now()
    booking.cancellation_reason = reason or "Customer requested cancellation"

    db.session.commit()
    return booking


def get_booking_by_id(booking_id: int) -> Optional[Booking]:
    """Retrieve booking by ID."""
    return db.session.get(Booking, booking_id)


def get_booking_by_reference(reference: str) -> Optional[Booking]:
    """Retrieve booking by reference code."""
    return Booking.query.filter_by(booking_reference=reference.strip().upper()).first()


def list_bookings(
    court_id: Optional[int] = None,
    member_id: Optional[int] = None,
    sport_type: Optional[str] = None,
    target_date: Optional[date] = None,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    status: Optional[str] = None,
    is_walk_in: Optional[bool] = None,
    is_social_play: Optional[bool] = None,
) -> List[Booking]:
    """Query and filter bookings with eager loaded relationships."""
    query = Booking.query

    if court_id:
        query = query.filter(Booking.court_id == court_id)

    if member_id:
        query = query.filter(Booking.member_id == member_id)

    if sport_type:
        if SportType.has_value(sport_type):
            enum_sport = SportType.from_string(sport_type)
            query = query.join(Court).filter(Court.sport_type == enum_sport)

    if target_date:
        query = query.filter(Booking.booking_date == target_date)
    elif start_date or end_date:
        if start_date:
            query = query.filter(Booking.booking_date >= start_date)
        if end_date:
            query = query.filter(Booking.booking_date <= end_date)

    if status:
        try:
            status_enum = BookingStatus(status.upper().strip())
            query = query.filter(Booking.status == status_enum)
        except ValueError:
            raise ValidationException(f"Invalid booking status '{status}'.")

    if is_walk_in is not None:
        query = query.filter(Booking.is_walk_in == is_walk_in)

    if is_social_play is not None:
        query = query.filter(Booking.is_social_play == is_social_play)

    return query.order_by(Booking.start_time.desc()).all()


def get_member_booking_history(member_id: int) -> List[Booking]:
    """Retrieve complete booking history for a specific member."""
    member = db.session.get(Member, member_id)
    if not member:
        raise NotFoundException(f"Member with ID {member_id} not found.")

    return (
        Booking.query.filter(Booking.member_id == member_id)
        .order_by(Booking.start_time.desc())
        .all()
    )
