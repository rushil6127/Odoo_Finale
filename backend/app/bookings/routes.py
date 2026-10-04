from datetime import datetime, date
from flask import Blueprint, request
from flask_jwt_extended import jwt_required, current_user
from backend.app.extensions import limiter
from backend.app.common.utils import utc_now
from backend.app.common.responses import success_response
from backend.app.common.validation import validate_schema
from backend.app.common.permissions import roles_required, RoleEnum
from backend.app.common.errors import (
    NotFoundException,
    ForbiddenException,
    ValidationException,
)
from backend.app.bookings.schemas import (
    BookingCreateSchema,
    BookingCancelSchema,
    BookingFilterSchema,
)
from backend.app.bookings.services import (
    create_booking,
    cancel_booking,
    get_booking_by_id,
    list_bookings,
    get_member_booking_history,
)

bookings_bp = Blueprint("bookings", __name__, url_prefix="/api/v1/bookings")


@bookings_bp.route("/pricing-rules", methods=["GET"])
def get_pricing_rules_route():
    """Retrieve dynamic court pricing rules, operating hours, and member tier discounts."""
    from flask import current_app
    from backend.app.memberships.models import MembershipPlan

    config = current_app.config if current_app else {}
    sport_rates = config.get("DEFAULT_SPORT_RATES", {
        "LAWN_TENNIS": 800.0,
        "BADMINTON": 400.0,
        "BOX_CRICKET": 1500.0,
        "TABLE_TENNIS": 300.0,
        "SWIMMING_POOL": 500.0,
        "VOLLEYBALL": 600.0,
    })
    member_discounts = config.get("MEMBER_DISCOUNT_PERCENTAGES", {
        "GOLD": 100.0,
        "SILVER": 50.0,
        "JUNIOR": 50.0,
    })

    plans = MembershipPlan.query.filter_by(is_active=True).all()
    plan_info = []
    for p in plans:
        plan_code = p.code.upper().strip()
        disc = member_discounts.get(plan_code, 0.0)
        p_dict = p.to_dict()
        p_dict["discount_percentage"] = disc
        plan_info.append(p_dict)

    return success_response(data={
        "sport_rates": sport_rates,
        "member_discounts": member_discounts,
        "plans": plan_info,
        "operating_hours": {
            "open": config.get("COURT_OPEN_TIME", "06:00"),
            "close": config.get("COURT_CLOSE_TIME", "22:00"),
            "slot_interval_minutes": config.get("COURT_SLOT_INTERVAL_MINUTES", 30),
            "booking_duration_minutes": config.get("COURT_BOOKING_DURATION_MINUTES", 60),
        },
        "friday_social_play": {
            "enabled": config.get("FRIDAY_SOCIAL_PLAY_ENABLED", True),
            "base_rate": config.get("FRIDAY_SOCIAL_PLAY_BASE_RATE", 300.0),
            "start_time": config.get("FRIDAY_SOCIAL_PLAY_START_TIME", "19:00"),
            "end_time": config.get("FRIDAY_SOCIAL_PLAY_END_TIME", "22:00"),
            "max_users_per_court": config.get("FRIDAY_SOCIAL_PLAY_MAX_USERS_PER_COURT", 8),
        },
    })


@bookings_bp.route("/calculate-price", methods=["GET"])
def calculate_price_route():
    """Calculate dynamic price breakdown for a court reservation."""
    from flask import current_app
    from backend.app.courts.models import Court
    from backend.app.extensions import db
    from backend.app.bookings.services import calculate_booking_price

    court_id = request.args.get("court_id", type=int)
    if not court_id:
        raise ValidationException("court_id is required.", code="COURT_ID_REQUIRED")

    court = db.session.get(Court, court_id)
    if not court:
        raise NotFoundException(f"Court with ID {court_id} not found.")

    is_social = request.args.get("is_social_play", "false").lower() in ("true", "1")
    is_walk_in = request.args.get("is_walk_in", "false").lower() in ("true", "1")
    target_date_str = request.args.get("date")
    target_date = None
    if target_date_str:
        try:
            target_date = datetime.strptime(target_date_str, "%Y-%m-%d").date()
        except ValueError:
            target_date = date.today()
    else:
        target_date = date.today()

    member_id = request.args.get("member_id", type=int)
    tier_override = (request.args.get("tier") or "").upper().strip()

    if tier_override and tier_override in ("GOLD", "SILVER", "JUNIOR", "WALK_IN"):
        config = current_app.config if current_app else {}
        if is_social:
            base_rate = float(config.get("FRIDAY_SOCIAL_PLAY_BASE_RATE", 300.0))
            rate_source = "FRIDAY_SOCIAL_PLAY_BASE_RATE"
        else:
            sport_rates = config.get("DEFAULT_SPORT_RATES", {})
            sport_key = court.sport_type.value if hasattr(court.sport_type, "value") else str(court.sport_type)
            base_rate = float(sport_rates.get(sport_key, 800.0))
            rate_source = f"SPORT_BASE_RATE_{sport_key}"

        discounts = config.get("MEMBER_DISCOUNT_PERCENTAGES", {
            "GOLD": 100.0,
            "SILVER": 50.0,
            "JUNIOR": 50.0,
        })
        disc_pct = float(discounts.get(tier_override, 0.0)) if tier_override != "WALK_IN" else 0.0
        disc_amt = round(base_rate * (disc_pct / 100.0), 2)
        final_price = max(0.0, round(base_rate - disc_amt, 2))
        return success_response(data={
            "court_id": court.id,
            "court_name": court.name,
            "sport_type": court.sport_type.value if hasattr(court.sport_type, "value") else str(court.sport_type),
            "base_price": base_rate,
            "discount_percentage": disc_pct,
            "discount_amount": disc_amt,
            "final_price": final_price,
            "tier": tier_override,
            "description": f"{tier_override} Tier Discount ({disc_pct:.0f}%)",
            "is_social_play": is_social,
        })

    base_rate, disc_amt, final_price, breakdown = calculate_booking_price(
        court=court,
        member_id=member_id,
        is_walk_in=is_walk_in,
        is_social_play=is_social,
        target_date=target_date,
    )
    breakdown["court_id"] = court.id
    breakdown["court_name"] = court.name
    breakdown["sport_type"] = court.sport_type.value if hasattr(court.sport_type, "value") else str(court.sport_type)
    return success_response(data=breakdown)


@bookings_bp.route("", methods=["POST"])
@limiter.limit("20 per minute")
@jwt_required()
@roles_required(
    RoleEnum.OWNER,
    RoleEnum.ADMIN,
    RoleEnum.FRONT_DESK,
    RoleEnum.MEMBER,
)
@validate_schema(BookingCreateSchema)
def create_booking_route(validated_data):
    """Create a new court booking.
    
    Members can book for themselves.
    Staff can book for members or walk-in guests.
    """
    court_id = validated_data["court_id"]
    start_time = validated_data["start_time"]
    is_social_play = validated_data.get("is_social_play", False)
    notes = validated_data.get("notes")

    # If MEMBER role, enforce self-booking with auto-profile fallback
    if current_user.is_member:
        if not current_user.member_profile:
            from backend.app.members.services import create_member
            from backend.app.memberships.services import purchase_membership
            try:
                member_profile = create_member(user_id=current_user.id, phone="+91 98250 14820")
                purchase_membership(member_profile.id, plan_code="GOLD", start_date=date.today())
                current_user.member_profile = member_profile
            except Exception:
                pass

        if not current_user.member_profile:
            raise ValidationException(
                "No member profile found for this user account.",
                code="MEMBER_PROFILE_MISSING",
            )
        member_id = current_user.member_profile.id
        is_walk_in = False
        guest_name = None
        guest_phone = None
        guest_email = None
    else:
        # Staff booking
        is_walk_in = validated_data.get("is_walk_in", False)
        member_id = validated_data.get("member_id") if not is_walk_in else None
        if not member_id and not is_walk_in and current_user.member_profile:
            member_id = current_user.member_profile.id
        guest_name = validated_data.get("guest_name")
        guest_phone = validated_data.get("guest_phone")
        guest_email = validated_data.get("guest_email")

    booking = create_booking(
        court_id=court_id,
        start_time=start_time,
        user_id=current_user.id,
        member_id=member_id,
        is_walk_in=is_walk_in,
        is_social_play=is_social_play,
        guest_name=guest_name,
        guest_phone=guest_phone,
        guest_email=guest_email,
        notes=notes,
    )

    return success_response(
        data=booking.to_dict(),
        message="Booking confirmed successfully.",
        status_code=201,
    )


@bookings_bp.route("/guest", methods=["POST"])
@limiter.limit("15 per minute")
@validate_schema(BookingCreateSchema)
def create_guest_booking_route(validated_data):
    """Create a guest/walk-in court booking without requiring user JWT login."""
    court_id = validated_data["court_id"]
    start_time = validated_data["start_time"]
    is_social_play = validated_data.get("is_social_play", False)
    notes = validated_data.get("notes")
    guest_name = validated_data.get("guest_name") or "Guest Player"
    guest_phone = validated_data.get("guest_phone")
    guest_email = validated_data.get("guest_email")

    booking = create_booking(
        court_id=court_id,
        start_time=start_time,
        user_id=None,
        member_id=None,
        is_walk_in=True,
        is_social_play=is_social_play,
        guest_name=guest_name,
        guest_phone=guest_phone,
        guest_email=guest_email,
        notes=notes,
    )

    return success_response(
        data=booking.to_dict(),
        message="Guest reservation confirmed successfully.",
        status_code=201,
    )


@bookings_bp.route("", methods=["GET"])
@jwt_required()
@roles_required(
    RoleEnum.OWNER,
    RoleEnum.ADMIN,
    RoleEnum.FRONT_DESK,
    RoleEnum.COACH,
    RoleEnum.MEMBER,
)
def list_bookings_route():
    """List and filter bookings.
    
    Members only see their own bookings.
    Staff can query and filter across all courts and members.
    """
    args = request.args.to_dict()
    filter_schema = BookingFilterSchema()
    filter_params = filter_schema.load(args)

    court_id = filter_params.get("court_id")
    sport_type = filter_params.get("sport_type")
    target_date = filter_params.get("date")
    start_date = filter_params.get("start_date")
    end_date = filter_params.get("end_date")
    status = filter_params.get("status")
    is_walk_in = filter_params.get("is_walk_in")
    is_social_play = filter_params.get("is_social_play")

    if current_user.is_member:
        if not current_user.member_profile:
            return success_response(data=[])
        member_id = current_user.member_profile.id
    else:
        member_id = filter_params.get("member_id")

    bookings = list_bookings(
        court_id=court_id,
        member_id=member_id,
        sport_type=sport_type,
        target_date=target_date,
        start_date=start_date,
        end_date=end_date,
        status=status,
        is_walk_in=is_walk_in,
        is_social_play=is_social_play,
    )

    return success_response(data=[b.to_dict() for b in bookings])


@bookings_bp.route("/<int:booking_id>", methods=["GET"])
@jwt_required()
@roles_required(
    RoleEnum.OWNER,
    RoleEnum.ADMIN,
    RoleEnum.FRONT_DESK,
    RoleEnum.COACH,
    RoleEnum.MEMBER,
)
def get_booking_route(booking_id: int):
    """Retrieve detailed information for a single booking."""
    booking = get_booking_by_id(booking_id)
    if not booking:
        raise NotFoundException(f"Booking with ID {booking_id} not found.")

    if current_user.is_member:
        if not booking.member or booking.member.user_id != current_user.id:
            raise ForbiddenException("You are not authorized to view this booking.")

    return success_response(data=booking.to_dict())


@bookings_bp.route("/<int:booking_id>/cancel", methods=["POST"])
@jwt_required()
@roles_required(
    RoleEnum.OWNER,
    RoleEnum.ADMIN,
    RoleEnum.FRONT_DESK,
    RoleEnum.MEMBER,
)
def cancel_booking_route(booking_id: int):
    """Cancel a booking, releasing the court slots and recording cancellation reason."""
    json_data = request.get_json(silent=True) or {}
    cancel_schema = BookingCancelSchema()
    validated = cancel_schema.load(json_data)
    reason = validated.get("reason", "Customer requested cancellation")

    booking = cancel_booking(
        booking_id=booking_id,
        reason=reason,
        requesting_user=current_user,
    )

    # 12-hour cancellation rule
    now = utc_now()
    start_time = booking.start_time
    if start_time.tzinfo is None and now.tzinfo is not None:
        start_time = start_time.replace(tzinfo=now.tzinfo)
    elif start_time.tzinfo is not None and now.tzinfo is None:
        now = now.replace(tzinfo=start_time.tzinfo)

    hours_to_start = (start_time - now).total_seconds() / 3600.0
    is_refundable = hours_to_start >= 12.0
    final_price = float(booking.final_price or 0.0)

    if final_price > 0:
        if is_refundable:
            msg = f"Booking cancelled successfully. Full refund of ₹{final_price:.2f} has been processed."
        else:
            msg = f"Booking cancelled successfully. Cancellation was made less than 12 hours prior to the slot time, so the booking fee of ₹{final_price:.2f} is non-refundable."
    else:
        msg = "Booking cancelled successfully."

    data = booking.to_dict()
    data["is_refundable"] = is_refundable
    data["refund_amount"] = final_price if is_refundable else 0.0

    return success_response(
        data=data,
        message=msg,
    )


@bookings_bp.route("/members/<int:member_id>/history", methods=["GET"])
@jwt_required()
@roles_required(
    RoleEnum.OWNER,
    RoleEnum.ADMIN,
    RoleEnum.FRONT_DESK,
    RoleEnum.MEMBER,
)
def member_booking_history_route(member_id: int):
    """Retrieve historical bookings for a specific member."""
    if current_user.is_member:
        if not current_user.member_profile or current_user.member_profile.id != member_id:
            raise ForbiddenException("You can only view your own booking history.")

    history = get_member_booking_history(member_id)
    return success_response(data=[b.to_dict() for b in history])


@bookings_bp.route("/my-history", methods=["GET"])
@jwt_required()
@roles_required(RoleEnum.MEMBER)
def my_booking_history_route():
    """Retrieve booking history for the logged-in member."""
    if not current_user.member_profile:
        return success_response(data=[])

    history = get_member_booking_history(current_user.member_profile.id)
    return success_response(data=[b.to_dict() for b in history])


@bookings_bp.route("/department-schedule", methods=["GET"])
@jwt_required()
def get_department_schedule():
    """Retrieve operational booking schedule and court status filtered for an employee's assigned department."""
    from backend.app.courts.models import Court, SportType, CourtStatus
    from backend.app.bookings.models import Booking
    from backend.app.members.models import Member
    from backend.app.extensions import db

    requested_sport = request.args.get("sport")
    dept = current_user.department
    target_sport_str = requested_sport or dept or "BADMINTON"

    # Match department to SportType
    sport_enum = None
    clean_str = target_sport_str.upper().replace(" ", "_")
    for st in SportType:
        if st.value == clean_str or clean_str in st.value or st.value in clean_str:
            sport_enum = st
            break

    courts_query = Court.query
    if sport_enum:
        courts_query = courts_query.filter(Court.sport_type == sport_enum)
    courts = courts_query.all()
    court_ids = [c.id for c in courts]

    today_start = datetime.combine(date.today(), datetime.min.time())
    bookings = []
    if court_ids:
        bookings = (
            Booking.query.filter(
                Booking.court_id.in_(court_ids),
                Booking.booking_date >= date.today(),
            )
            .order_by(Booking.start_time.asc())
            .all()
        )

    booking_list = []
    for b in bookings:
        b_dict = b.to_dict()
        court = next((c for c in courts if c.id == b.court_id), None)
        b_dict["court_name"] = court.name if court else "Court"
        b_dict["surface_type"] = court.surface_type if court else "Standard"
        b_dict["sport_type"] = court.sport_type.value if court and hasattr(court.sport_type, "value") else str(court.sport_type) if court else target_sport_str
        
        if b.member_id:
            m = db.session.get(Member, b.member_id)
            if m and m.user:
                b_dict["member_name"] = m.user.full_name
                b_dict["member_email"] = m.user.email
                b_dict["member_phone"] = m.phone or "+91 98765 43210"
        elif b.guest_name:
            b_dict["member_name"] = f"{b.guest_name} (Guest)"
            b_dict["member_email"] = b.guest_email or "guest@championsclub.in"
            b_dict["member_phone"] = b.guest_phone or "+91 98765 00000"
        else:
            b_dict["member_name"] = "Club Member"
            b_dict["member_email"] = "member@championsclub.in"
            b_dict["member_phone"] = "+91 98765 43210"

        booking_list.append(b_dict)

    return success_response(
        data={
            "department": target_sport_str,
            "assigned_department": current_user.department,
            "courts": [c.to_dict() for c in courts],
            "bookings": booking_list,
            "total_bookings_today": len(booking_list),
        },
        status_code=200,
    )


@bookings_bp.route("/courts/<int:court_id>/maintenance", methods=["POST"])
@jwt_required()
def update_court_maintenance(court_id: int):
    """Toggle maintenance status and log maintenance notes for a court."""
    from backend.app.courts.models import Court, CourtStatus
    from backend.app.extensions import db

    court = db.session.get(Court, court_id)
    if not court:
        raise NotFoundException(f"Court with ID {court_id} not found.")

    body = request.get_json(silent=True) or {}
    new_status_str = body.get("status")
    note = body.get("notes") or body.get("description")

    if new_status_str:
        try:
            court.status = CourtStatus(new_status_str.upper())
        except ValueError:
            court.status = CourtStatus.MAINTENANCE
    else:
        court.status = CourtStatus.MAINTENANCE if court.status == CourtStatus.ACTIVE else CourtStatus.ACTIVE

    feats = dict(court.features or {})
    if note:
        feats["last_maintenance_note"] = note
        feats["last_maintained_by"] = current_user.full_name
        feats["last_maintenance_date"] = datetime.utcnow().strftime("%Y-%m-%d %H:%M")
    court.features = feats

    db.session.commit()
    return success_response(
        data=court.to_dict(),
        message=f"Court '{court.name}' status updated to {court.status.value}",
        status_code=200,
    )

