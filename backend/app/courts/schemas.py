from marshmallow import Schema, fields, validate
from backend.app.courts.models import SportType, CourtStatus


class CourtCreateSchema(Schema):
    """Schema for creating a new sports court."""

    name = fields.String(
        required=True,
        validate=validate.Length(min=1, max=100),
        error_messages={"required": "Court name is required."},
    )
    sport_type = fields.Enum(
        SportType,
        by_value=True,
        required=True,
        error_messages={
            "required": "Sport type is required.",
            "invalid": "Unsupported sport type. Supported sports are TENNIS, PADEL, BADMINTON, BOX_CRICKET.",
        },
    )
    surface_type = fields.String(required=False, allow_none=True)
    is_indoor = fields.Boolean(required=False, load_default=False)
    status = fields.Enum(
        CourtStatus,
        by_value=True,
        required=False,
        load_default=CourtStatus.ACTIVE,
    )
    custom_open_time = fields.String(
        required=False,
        allow_none=True,
        validate=validate.Regexp(r"^([01]\d|2[0-3]):[0-5]\d$", error="Format must be HH:MM (24-hour)."),
    )
    custom_close_time = fields.String(
        required=False,
        allow_none=True,
        validate=validate.Regexp(r"^([01]\d|2[0-3]):[0-5]\d$", error="Format must be HH:MM (24-hour)."),
    )
    features = fields.Dict(required=False, allow_none=True)
    description = fields.String(required=False, allow_none=True)


class CourtUpdateSchema(Schema):
    """Schema for updating court details."""

    name = fields.String(required=False, validate=validate.Length(min=1, max=100))
    sport_type = fields.Enum(
        SportType,
        by_value=True,
        required=False,
        error_messages={
            "invalid": "Unsupported sport type. Supported sports are TENNIS, PADEL, BADMINTON, BOX_CRICKET.",
        },
    )
    surface_type = fields.String(required=False, allow_none=True)
    is_indoor = fields.Boolean(required=False)
    status = fields.Enum(CourtStatus, by_value=True, required=False)
    custom_open_time = fields.String(
        required=False,
        allow_none=True,
        validate=validate.Regexp(r"^([01]\d|2[0-3]):[0-5]\d$", error="Format must be HH:MM (24-hour)."),
    )
    custom_close_time = fields.String(
        required=False,
        allow_none=True,
        validate=validate.Regexp(r"^([01]\d|2[0-3]):[0-5]\d$", error="Format must be HH:MM (24-hour)."),
    )
    features = fields.Dict(required=False, allow_none=True)
    description = fields.String(required=False, allow_none=True)


class CourtAvailabilityQuerySchema(Schema):
    """Schema for querying court availability on a specific date."""

    date = fields.Date(
        required=True,
        error_messages={
            "required": "Date parameter is required.",
            "invalid": "Invalid date parameter. Format must be YYYY-MM-DD.",
        },
    )
    sport_type = fields.String(required=False, allow_none=True)
    court_id = fields.Integer(required=False, allow_none=True)
