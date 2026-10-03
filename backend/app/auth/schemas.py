from marshmallow import Schema, fields, validate
from backend.app.common.permissions import RoleEnum


class LoginSchema(Schema):
    """Schema for user login credentials."""

    email = fields.Email(
        required=True,
        error_messages={"required": "Email is required.", "invalid": "Invalid email address."},
    )
    password = fields.String(
        required=True,
        load_only=True,
        error_messages={"required": "Password is required."},
    )


class UserRegisterSchema(Schema):
    """Schema for user / staff account creation."""

    email = fields.Email(
        required=True,
        error_messages={"required": "Email is required.", "invalid": "Invalid email address."},
    )
    password = fields.String(
        required=True,
        load_only=True,
        validate=validate.Length(min=6, error="Password must be at least 6 characters."),
        error_messages={"required": "Password is required."},
    )
    first_name = fields.String(
        required=True,
        validate=validate.Length(min=1, max=100),
        error_messages={"required": "First name is required."},
    )
    last_name = fields.String(
        required=True,
        validate=validate.Length(min=1, max=100),
        error_messages={"required": "Last name is required."},
    )
    role = fields.Enum(
        RoleEnum,
        by_value=True,
        required=False,
        load_default=RoleEnum.MEMBER,
    )


class UserResponseSchema(Schema):
    """Schema for serializing user objects in responses."""

    id = fields.Integer(dump_only=True)
    email = fields.Email()
    first_name = fields.String()
    last_name = fields.String()
    full_name = fields.String()
    role = fields.Method("get_role_value")
    is_active = fields.Boolean()
    created_at = fields.DateTime()
    updated_at = fields.DateTime()

    def get_role_value(self, obj):
        if hasattr(obj, "role"):
            role = obj.role
            return role.value if hasattr(role, "value") else str(role)
        return str(obj.get("role", ""))
