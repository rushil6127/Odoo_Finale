from datetime import datetime, date
from flask import Blueprint, request
from flask_jwt_extended import jwt_required, current_user
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


@bookings_bp.route("", methods=["POST"])
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

    # If MEMBER role, enforce self-booking
    if current_user.is_member:
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

    return success_response(
        data=booking.to_dict(),
        message="Booking cancelled successfully.",
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

