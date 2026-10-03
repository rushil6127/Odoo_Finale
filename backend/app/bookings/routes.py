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
