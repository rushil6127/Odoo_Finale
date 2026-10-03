from marshmallow import Schema, fields, validate


class MemberCreateSchema(Schema):
    """Schema for creating a member profile."""

    user_id = fields.Integer(required=True, error_messages={"required": "User ID is required."})
    phone = fields.String(required=False, allow_none=True)
    date_of_birth = fields.Date(required=False, allow_none=True)
    gender = fields.String(required=False, allow_none=True)
    address = fields.String(required=False, allow_none=True)
    emergency_contact_name = fields.String(required=False, allow_none=True)
    emergency_contact_phone = fields.String(required=False, allow_none=True)


class MemberUpdateSchema(Schema):
    """Schema for updating a member profile."""

    phone = fields.String(required=False, allow_none=True)
    date_of_birth = fields.Date(required=False, allow_none=True)
    gender = fields.String(required=False, allow_none=True)
    address = fields.String(required=False, allow_none=True)
    emergency_contact_name = fields.String(required=False, allow_none=True)
    emergency_contact_phone = fields.String(required=False, allow_none=True)


class MemberSearchQuerySchema(Schema):
    """Schema for member search and pagination parameters."""

    q = fields.String(required=False, allow_none=True)
    plan = fields.String(required=False, allow_none=True)
    is_active = fields.Boolean(required=False, allow_none=True)
    page = fields.Integer(required=False, load_default=1)
    per_page = fields.Integer(required=False, load_default=20)
