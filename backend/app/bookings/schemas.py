from marshmallow import Schema, fields, validate, validates_schema, ValidationError


class BookingCreateSchema(Schema):
    """Validation schema for creating a court reservation."""

    court_id = fields.Integer(required=True, error_messages={"required": "court_id is required."})
    start_time = fields.DateTime(
        required=True,
        error_messages={"required": "start_time (ISO-8601 format) is required."},
    )
    member_id = fields.Integer(allow_none=True, load_default=None)
    is_walk_in = fields.Boolean(load_default=False)
    is_social_play = fields.Boolean(load_default=False)
    guest_name = fields.String(
        allow_none=True,
        load_default=None,
        validate=validate.Length(max=100),
    )
    guest_phone = fields.String(
        allow_none=True,
        load_default=None,
        validate=validate.Length(max=20),
    )
    guest_email = fields.Email(allow_none=True, load_default=None)
    notes = fields.String(allow_none=True, load_default=None)

    @validates_schema
    def validate_party_info(self, data, **kwargs):
        """Ensure either member_id or walk-in guest details are provided."""
        is_walk_in = data.get("is_walk_in", False)
        member_id = data.get("member_id")
        guest_name = data.get("guest_name")

        if is_walk_in:
            if not guest_name or not guest_name.strip():
                raise ValidationError(
                    "Guest name is required for walk-in bookings.",
                    field_name="guest_name",
                )


class BookingCancelSchema(Schema):
    """Validation schema for cancelling a court reservation."""

    reason = fields.String(
        allow_none=True,
        load_default="Customer requested cancellation",
        validate=validate.Length(max=500),
    )


class BookingFilterSchema(Schema):
    """Validation schema for querying and filtering bookings."""

    court_id = fields.Integer(allow_none=True)
    member_id = fields.Integer(allow_none=True)
    sport_type = fields.String(
        allow_none=True,
        validate=validate.OneOf(
            ["TENNIS", "PADEL", "BADMINTON", "BOX_CRICKET"],
            error="sport_type must be TENNIS, PADEL, BADMINTON, or BOX_CRICKET.",
        ),
    )
    date = fields.Date(allow_none=True)
    start_date = fields.Date(allow_none=True)
    end_date = fields.Date(allow_none=True)
    status = fields.String(
        allow_none=True,
        validate=validate.OneOf(
            ["CONFIRMED", "CANCELLED", "COMPLETED"],
            error="status must be CONFIRMED, CANCELLED, or COMPLETED.",
        ),
    )
    is_walk_in = fields.Boolean(allow_none=True)
    is_social_play = fields.Boolean(allow_none=True)
