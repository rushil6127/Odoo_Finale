from datetime import date
from flask import Blueprint, request
from backend.app.common.responses import success_response
from backend.app.common.validation import validate_schema
from backend.app.common.permissions import roles_required, RoleEnum
from backend.app.common.errors import NotFoundException, ValidationException
from backend.app.courts.schemas import (
    CourtCreateSchema,
    CourtUpdateSchema,
    CourtAvailabilityQuerySchema,
)
from backend.app.courts.services import (
    get_all_courts,
    get_court_by_id,
    create_court,
    update_court,
    get_court_availability,
)

courts_bp = Blueprint("courts", __name__, url_prefix="/api/v1/courts")


@courts_bp.route("", methods=["GET"])
def list_courts():
    """List and filter courts by sport, status, indoor/outdoor, or keyword."""
    sport_type = request.args.get("sport_type") or request.args.get("sport")
    status = request.args.get("status")
    indoor_param = request.args.get("is_indoor")
    search_query = request.args.get("q")

    is_indoor = None
    if indoor_param is not None:
        is_indoor = indoor_param.lower() in ("true", "1", "yes")

    courts = get_all_courts(
        sport_type=sport_type,
        status=status,
        is_indoor=is_indoor,
        search_query=search_query,
    )

    return success_response(
        data={"courts": [c.to_dict() for c in courts]},
        meta={"total": len(courts)},
        status_code=200,
    )


@courts_bp.route("/availability", methods=["GET"])
def get_availability():
    """Availability foundation endpoint returning candidate time slots for a given date.

    Excludes MAINTENANCE and INACTIVE courts. Returns operating hours and slot metadata.
    """
    date_str = request.args.get("date")
    if not date_str:
        raise ValidationException(
            message="The 'date' query parameter is required in YYYY-MM-DD format.",
            details={"date": ["Missing required date parameter."]},
        )

    try:
        target_date = date.fromisoformat(date_str)
    except (ValueError, TypeError):
        raise ValidationException(
            message=f"Invalid date format '{date_str}'. Expected format is YYYY-MM-DD.",
            details={"date": ["Must be a valid date in YYYY-MM-DD format."]},
        )

    sport_type = request.args.get("sport_type") or request.args.get("sport")
    court_id_raw = request.args.get("court_id")
    court_id = int(court_id_raw) if court_id_raw and court_id_raw.isdigit() else None

    availability_data = get_court_availability(
        target_date=target_date,
        sport_type=sport_type,
        court_id=court_id,
    )

    return success_response(
        data=availability_data,
        status_code=200,
    )


@courts_bp.route("/<int:court_id>", methods=["GET"])
def get_court_details(court_id: int):
    """Retrieve detailed metadata for a single court."""
    court = get_court_by_id(court_id)
    if not court:
        raise NotFoundException(f"Court with ID {court_id} not found.")

    return success_response(
        data={"court": court.to_dict()},
        status_code=200,
    )


@courts_bp.route("", methods=["POST"])
@roles_required(RoleEnum.OWNER, RoleEnum.ADMIN)
@validate_schema(CourtCreateSchema)
def create_new_court(validated_data):
    """Create a new court (Restricted to OWNER and ADMIN)."""
    court = create_court(
        name=validated_data["name"],
        sport_type=validated_data["sport_type"],
        surface_type=validated_data.get("surface_type"),
        is_indoor=validated_data.get("is_indoor", False),
        status=validated_data.get("status"),
        custom_open_time=validated_data.get("custom_open_time"),
        custom_close_time=validated_data.get("custom_close_time"),
        features=validated_data.get("features"),
        description=validated_data.get("description"),
    )

    return success_response(
        data={"court": court.to_dict()},
        message="Court created successfully",
        status_code=201,
    )


@courts_bp.route("/<int:court_id>", methods=["PUT", "PATCH"])
@roles_required(RoleEnum.OWNER, RoleEnum.ADMIN)
@validate_schema(CourtUpdateSchema)
def update_court_endpoint(court_id: int, validated_data):
    """Update court attributes (Restricted to OWNER and ADMIN)."""
    court = update_court(court_id, **validated_data)

    return success_response(
        data={"court": court.to_dict()},
        message="Court updated successfully",
        status_code=200,
    )
