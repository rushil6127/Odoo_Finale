from datetime import date, datetime, time, timedelta
from typing import List, Optional, Dict, Any, Tuple
from flask import current_app
from backend.app.extensions import db
from backend.app.courts.models import Court, SportType, CourtStatus
from backend.app.common.errors import NotFoundException, ValidationException, ConflictException


def parse_time_str(time_str: str) -> time:
    """Parse 'HH:MM' string into a datetime.time object."""
    parts = time_str.strip().split(":")
    return time(int(parts[0]), int(parts[1]))


# ---------------------------------------------------------
# Candidate Slot Generation (Availability Foundation)
# ---------------------------------------------------------

def generate_candidate_slots(
    target_date: date,
    open_time_str: Optional[str] = None,
    close_time_str: Optional[str] = None,
    slot_duration_minutes: Optional[int] = None,
    slot_interval_minutes: Optional[int] = None,
) -> List[Dict[str, Any]]:
    """Generate candidate time slots for a single court on a target date.

    Adheres to configurable operating hours and slot step intervals without
    overrunning the closing time.
    """
    config = current_app.config if current_app else {}

    open_str = open_time_str or config.get("COURT_OPEN_TIME", "06:00")
    close_str = close_time_str or config.get("COURT_CLOSE_TIME", "22:00")
    duration = slot_duration_minutes or config.get("COURT_SLOT_DURATION_MINUTES", 60)
    interval = slot_interval_minutes or config.get("COURT_SLOT_INTERVAL_MINUTES", 30)

    open_t = parse_time_str(open_str)
    close_t = parse_time_str(close_str)

    open_dt = datetime.combine(target_date, open_t)
    close_dt = datetime.combine(target_date, close_t)

    slots = []
    current_start = open_dt

    while current_start + timedelta(minutes=duration) <= close_dt:
        slot_end = current_start + timedelta(minutes=duration)

        slots.append({
            "slot_index": len(slots),
            "start_time": current_start.strftime("%H:%M"),
            "end_time": slot_end.strftime("%H:%M"),
            "start_datetime": current_start.isoformat(),
            "end_datetime": slot_end.isoformat(),
            "duration_minutes": duration,
            "is_available": True,
        })

        current_start += timedelta(minutes=interval)

    return slots


def get_court_availability(
    target_date: date,
    sport_type: Optional[str] = None,
    court_id: Optional[int] = None,
) -> Dict[str, Any]:
    """Retrieve candidate availability for all bookable (ACTIVE) courts on a date.

    Excludes MAINTENANCE and INACTIVE courts.
    """
    config = current_app.config if current_app else {}
    open_str = config.get("COURT_OPEN_TIME", "06:00")
    close_str = config.get("COURT_CLOSE_TIME", "22:00")
    duration = config.get("COURT_SLOT_DURATION_MINUTES", 60)
    interval = config.get("COURT_SLOT_INTERVAL_MINUTES", 30)

    query = Court.query.filter(Court.status == CourtStatus.ACTIVE)

    if court_id:
        query = query.filter(Court.id == court_id)

    if sport_type:
        if not SportType.has_value(sport_type):
            raise ValidationException(
                message=f"Unsupported sport type '{sport_type}'. Supported sports are TENNIS, PADEL, BADMINTON, BOX_CRICKET.",
                details={"sport_type": ["Must be one of: TENNIS, PADEL, BADMINTON, BOX_CRICKET."]},
            )
        enum_sport = SportType.from_string(sport_type)
        query = query.filter(Court.sport_type == enum_sport)

    active_courts = query.order_by(Court.sport_type.asc(), Court.name.asc()).all()

    court_availability_list = []
    for court in active_courts:
        court_slots = generate_candidate_slots(
            target_date=target_date,
            open_time_str=court.custom_open_time or open_str,
            close_time_str=court.custom_close_time or close_str,
            slot_duration_minutes=duration,
            slot_interval_minutes=interval,
        )

        court_dict = court.to_dict()
        court_dict["slots"] = court_slots
        court_dict["total_candidate_slots"] = len(court_slots)
        court_availability_list.append(court_dict)

    return {
        "date": target_date.isoformat(),
        "operating_hours": {
            "open_time": open_str,
            "close_time": close_str,
            "slot_duration_minutes": duration,
            "slot_interval_minutes": interval,
        },
        "total_active_courts": len(active_courts),
        "courts": court_availability_list,
    }


# ---------------------------------------------------------
# Court Management CRUD
# ---------------------------------------------------------

def create_court(
    name: str,
    sport_type: str,
    surface_type: Optional[str] = None,
    is_indoor: bool = False,
    status: CourtStatus = CourtStatus.ACTIVE,
    custom_open_time: Optional[str] = None,
    custom_close_time: Optional[str] = None,
    features: Optional[Dict[str, Any]] = None,
    description: Optional[str] = None,
) -> Court:
    """Create a new court."""
    normalized_name = name.strip()
    if not SportType.has_value(sport_type):
        raise ValidationException(
            message=f"Unsupported sport type '{sport_type}'. Supported sports are TENNIS, PADEL, BADMINTON, BOX_CRICKET.",
            details={"sport_type": ["Must be one of: TENNIS, PADEL, BADMINTON, BOX_CRICKET."]},
        )

    enum_sport = SportType.from_string(sport_type)

    existing = Court.query.filter_by(name=normalized_name).first()
    if existing:
        raise ConflictException(f"A court with the name '{normalized_name}' already exists.")

    court = Court(
        name=normalized_name,
        sport_type=enum_sport,
        surface_type=surface_type.strip() if surface_type else None,
        is_indoor=is_indoor,
        status=status,
        custom_open_time=custom_open_time.strip() if custom_open_time else None,
        custom_close_time=custom_close_time.strip() if custom_close_time else None,
        features=features or {},
        description=description.strip() if description else None,
    )

    db.session.add(court)
    db.session.commit()
    return court


def get_court_by_id(court_id: int) -> Optional[Court]:
    """Retrieve court by ID."""
    return db.session.get(Court, court_id)


def get_all_courts(
    sport_type: Optional[str] = None,
    status: Optional[str] = None,
    is_indoor: Optional[bool] = None,
    search_query: Optional[str] = None,
) -> List[Court]:
    """Retrieve and filter courts."""
    query = Court.query

    if sport_type:
        if not SportType.has_value(sport_type):
            raise ValidationException(
                message=f"Unsupported sport type '{sport_type}'. Supported sports are TENNIS, PADEL, BADMINTON, BOX_CRICKET.",
            )
        query = query.filter(Court.sport_type == SportType.from_string(sport_type))

    if status:
        try:
            status_enum = CourtStatus(status.upper().strip())
            query = query.filter(Court.status == status_enum)
        except ValueError:
            raise ValidationException(f"Invalid court status '{status}'. Must be ACTIVE, MAINTENANCE, or INACTIVE.")

    if is_indoor is not None:
        query = query.filter(Court.is_indoor == is_indoor)

    if search_query and search_query.strip():
        term = f"%{search_query.strip()}%"
        query = query.filter(Court.name.ilike(term))

    return query.order_by(Court.sport_type.asc(), Court.name.asc()).all()


def update_court(court_id: int, **kwargs) -> Court:
    """Update court attributes."""
    court = db.session.get(Court, court_id)
    if not court:
        raise NotFoundException(f"Court with ID {court_id} not found.")

    if "name" in kwargs and kwargs["name"]:
        name = kwargs["name"].strip()
        existing = Court.query.filter(Court.name == name, Court.id != court_id).first()
        if existing:
            raise ConflictException(f"A court with the name '{name}' already exists.")
        court.name = name

    if "sport_type" in kwargs and kwargs["sport_type"]:
        sport = kwargs["sport_type"]
        if isinstance(sport, str):
            if not SportType.has_value(sport):
                raise ValidationException(f"Unsupported sport type '{sport}'.")
            court.sport_type = SportType.from_string(sport)
        else:
            court.sport_type = sport

    if "status" in kwargs and kwargs["status"]:
        status = kwargs["status"]
        if isinstance(status, str):
            court.status = CourtStatus(status.upper().strip())
        else:
            court.status = status

    for field in ("surface_type", "is_indoor", "custom_open_time", "custom_close_time", "features", "description"):
        if field in kwargs:
            setattr(court, field, kwargs[field])

    db.session.commit()
    return court


# ---------------------------------------------------------
# Idempotent Court Seeder
# ---------------------------------------------------------

SEED_COURTS_DATA = [
    # Tennis Courts
    {
        "name": "Centre Court (Grass)",
        "sport_type": "TENNIS",
        "surface_type": "Grass",
        "is_indoor": False,
        "status": CourtStatus.ACTIVE,
        "features": {"floodlights": True, "spectator_seating": True, "grass_lawn": True},
        "description": "Championship grass lawn court for elite play.",
    },
    {
        "name": "Tennis Court 1 (Clay)",
        "sport_type": "TENNIS",
        "surface_type": "Clay",
        "is_indoor": False,
        "status": CourtStatus.ACTIVE,
        "features": {"floodlights": True, "red_clay": True},
        "description": "Professional red clay tennis court.",
    },
    {
        "name": "Tennis Court 2 (Hard)",
        "sport_type": "TENNIS",
        "surface_type": "Hard",
        "is_indoor": False,
        "status": CourtStatus.ACTIVE,
        "features": {"floodlights": True, "acrylic_hard": True},
        "description": "All-weather acrylic hard court.",
    },
    # Padel Courts
    {
        "name": "Padel Court 1 (Panoramic Glass)",
        "sport_type": "PADEL",
        "surface_type": "Synthetic Turf",
        "is_indoor": False,
        "status": CourtStatus.ACTIVE,
        "features": {"panoramic_glass": True, "led_floodlights": True},
        "description": "World-class panoramic glass padel arena.",
    },
    {
        "name": "Padel Court 2",
        "sport_type": "PADEL",
        "surface_type": "Synthetic Turf",
        "is_indoor": False,
        "status": CourtStatus.ACTIVE,
        "features": {"led_floodlights": True},
        "description": "Standard padel court with synthetic grass.",
    },
    # Badminton Courts
    {
        "name": "Badminton Arena - Court 1",
        "sport_type": "BADMINTON",
        "surface_type": "Wooden",
        "is_indoor": True,
        "status": CourtStatus.ACTIVE,
        "features": {"air_conditioned": True, "bwa_standard_wooden_flooring": True},
        "description": "Indoor air-conditioned badminton court with professional wooden flooring.",
    },
    {
        "name": "Badminton Arena - Court 2",
        "sport_type": "BADMINTON",
        "surface_type": "Wooden",
        "is_indoor": True,
        "status": CourtStatus.ACTIVE,
        "features": {"air_conditioned": True, "bwa_standard_wooden_flooring": True},
        "description": "Indoor air-conditioned badminton court.",
    },
    # Box Cricket
    {
        "name": "Box Cricket Turf Arena",
        "sport_type": "BOX_CRICKET",
        "surface_type": "Synthetic Turf",
        "is_indoor": False,
        "status": CourtStatus.ACTIVE,
        "features": {"enclosed_netting": True, "high_power_floodlights": True, "astroturf": True},
        "description": "Fully enclosed floodlit box cricket arena with high-density astroturf.",
    },
]


def seed_default_courts() -> List[Court]:
    """Idempotently seed the initial sports courts for Champions Club."""
    seeded = []
    for data in SEED_COURTS_DATA:
        court = Court.query.filter_by(name=data["name"]).first()
        if court is None:
            court = Court(
                name=data["name"],
                sport_type=SportType.from_string(data["sport_type"]),
                surface_type=data["surface_type"],
                is_indoor=data["is_indoor"],
                status=data["status"],
                features=data["features"],
                description=data["description"],
            )
            db.session.add(court)
        else:
            court.sport_type = SportType.from_string(data["sport_type"])
            court.surface_type = data["surface_type"]
            court.is_indoor = data["is_indoor"]
            court.status = data["status"]
            court.features = data["features"]
            court.description = data["description"]
        seeded.append(court)

    db.session.commit()
    return seeded
