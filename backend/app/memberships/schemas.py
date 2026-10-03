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


class MembershipRequestCreateSchema(Schema):
    """Schema for submitting a manual offline membership request with payment screenshot."""

    plan_id = fields.Integer(required=True, error_messages={"required": "Plan ID is required."})
    transaction_reference = fields.String(
        required=True,
        validate=validate.Length(min=3, max=100),
        error_messages={"required": "Transaction reference/UTR number is required."},
    )
    screenshot_url = fields.String(required=False, allow_none=True)
    payment_method = fields.String(
        required=False,
        load_default="UPI_QR",
        validate=validate.OneOf(["UPI_QR", "BANK_TRANSFER", "CARD", "CASH", "OTHER"]),
    )
    amount_paid = fields.Float(required=True, error_messages={"required": "Amount paid is required."})
    requester_notes = fields.String(required=False, allow_none=True)


class MembershipRequestReviewSchema(Schema):
    """Schema for Admin/Owner review of a membership request."""

    action = fields.String(
        required=True,
        validate=validate.OneOf(["APPROVE", "REJECT"]),
        error_messages={"required": "Action must be APPROVE or REJECT."},
    )
    review_notes = fields.String(required=False, allow_none=True)

