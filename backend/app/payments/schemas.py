from marshmallow import Schema, fields, validate, validates, ValidationError
from decimal import Decimal
from backend.app.payments.models import PaymentMethod, PaymentStatus, PaymentItemType


class PaymentCreateSchema(Schema):
    """Validation schema for creating or initiating a payment."""

    item_type = fields.String(
        required=True,
        validate=validate.OneOf(
            [t.value for t in PaymentItemType],
            error="item_type must be one of: BOOKING, MEMBERSHIP, SHOP_ORDER, POS_ORDER, INVOICE.",
        ),
    )
    item_id = fields.Integer(required=True, error_messages={"required": "item_id is required."})
    amount = fields.Decimal(
        required=True,
        as_string=True,
        error_messages={"required": "amount is required."},
    )
    payment_method = fields.String(
        required=True,
        validate=validate.OneOf(
            [m.value for m in PaymentMethod],
            error="payment_method must be one of: CASH, CARD, UPI, ONLINE.",
        ),
    )
    notes = fields.String(allow_none=True, load_default=None)

    @validates("amount")
    def validate_amount(self, value):
        if value <= Decimal("0.00"):
            raise ValidationError("Payment amount must be greater than zero.")


class PaymentVerifySchema(Schema):
    """Validation schema for verifying a Razorpay online checkout."""

    razorpay_order_id = fields.String(
        required=True, error_messages={"required": "razorpay_order_id is required."}
    )
    razorpay_payment_id = fields.String(
        required=True, error_messages={"required": "razorpay_payment_id is required."}
    )
    razorpay_signature = fields.String(
        required=True, error_messages={"required": "razorpay_signature is required."}
    )


class PaymentConfirmSchema(Schema):
    """Validation schema for manual staff confirmation of offline payments."""

    notes = fields.String(allow_none=True, load_default="Manual payment confirmed by staff")


class PaymentRefundSchema(Schema):
    """Validation schema for refunding a payment."""

    reason = fields.String(
        allow_none=True,
        load_default="Staff initiated refund",
        validate=validate.Length(max=500),
    )


class PaymentFilterSchema(Schema):
    """Validation schema for querying and filtering payment records."""

    status = fields.String(
        allow_none=True,
        validate=validate.OneOf(
            [s.value for s in PaymentStatus],
            error="Invalid payment status filter.",
        ),
    )
    payment_method = fields.String(
        allow_none=True,
        validate=validate.OneOf(
            [m.value for m in PaymentMethod],
            error="Invalid payment method filter.",
        ),
    )
    item_type = fields.String(
        allow_none=True,
        validate=validate.OneOf(
            [t.value for t in PaymentItemType],
            error="Invalid item type filter.",
        ),
    )
    item_id = fields.Integer(allow_none=True)
    user_id = fields.Integer(allow_none=True)
    member_id = fields.Integer(allow_none=True)
    start_date = fields.Date(allow_none=True)
    end_date = fields.Date(allow_none=True)
