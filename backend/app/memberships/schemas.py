from marshmallow import Schema, fields, validate


class AssignMembershipSchema(Schema):
    """Schema for assigning an initial membership plan."""

    plan_id = fields.Integer(required=True, error_messages={"required": "Plan ID is required."})
    start_date = fields.Date(required=True, error_messages={"required": "Start date is required."})
    duration_months = fields.Integer(required=False, allow_none=True)
    price_paid = fields.Float(required=False, allow_none=True)
    notes = fields.String(required=False, allow_none=True)


class ChangePlanSchema(Schema):
    """Schema for upgrading or downgrading a membership plan."""

    new_plan_id = fields.Integer(required=True, error_messages={"required": "New plan ID is required."})
    effective_date = fields.Date(required=True, error_messages={"required": "Effective date is required."})
    price_paid = fields.Float(required=False, allow_none=True)
    notes = fields.String(required=False, allow_none=True)
