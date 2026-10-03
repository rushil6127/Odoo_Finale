from marshmallow import Schema, fields, validate, validates, ValidationError
from backend.app.shop.models import OrderType, FulfillmentType, ShopOrderStatus


class ShopOrderItemCreateSchema(Schema):
    """Schema for an item in a new shop order."""

    product_id = fields.Integer(
        required=True,
        validate=[validate.Range(min=1)],
        error_messages={"required": "product_id is required."},
    )
    quantity = fields.Integer(
        required=True,
        validate=[validate.Range(min=1)],
        error_messages={"required": "quantity is required and must be at least 1."},
    )


class ShopOrderCreateSchema(Schema):
    """Schema for creating a shop order (Counter sale or Online order)."""

    order_type = fields.String(
        required=True,
        validate=[validate.OneOf([e.value for e in OrderType])],
        error_messages={"required": "order_type is required ('COUNTER' or 'ONLINE')."},
    )
    fulfillment_type = fields.String(
        required=True,
        validate=[validate.OneOf([e.value for e in FulfillmentType])],
        error_messages={"required": "fulfillment_type is required ('PICKUP' or 'DELIVERY')."},
    )
    items = fields.List(
        fields.Nested(ShopOrderItemCreateSchema),
        required=True,
        validate=[validate.Length(min=1)],
        error_messages={"required": "At least one item is required in the order."},
    )
    member_id = fields.Integer(
        required=False,
        allow_none=True,
        validate=[validate.Range(min=1)],
    )
    customer_name = fields.String(
        required=False,
        allow_none=True,
        validate=[validate.Length(min=1, max=100)],
    )
    customer_phone = fields.String(
        required=False,
        allow_none=True,
        validate=[validate.Length(max=20)],
    )
    customer_email = fields.Email(
        required=False,
        allow_none=True,
    )
    delivery_address = fields.String(
        required=False,
        allow_none=True,
    )
    payment_method = fields.String(
        required=False,
        allow_none=True,
        validate=[validate.OneOf(["CASH", "CARD", "UPI", "ONLINE"])],
    )
    notes = fields.String(
        required=False,
        allow_none=True,
    )


class ShopOrderStatusUpdateSchema(Schema):
    """Schema for updating an order's lifecycle status."""

    status = fields.String(
        required=True,
        validate=[validate.OneOf([e.value for e in ShopOrderStatus])],
        error_messages={"required": "status is required."},
    )
    notes = fields.String(
        required=False,
        allow_none=True,
    )


class ShopOrderCancelSchema(Schema):
    """Schema for cancelling an order."""

    reason = fields.String(
        required=True,
        validate=[validate.Length(min=1, max=255)],
        error_messages={"required": "Cancellation reason is required."},
    )


class ShopOrderQuoteSchema(Schema):
    """Schema for calculating a read-only price quote and member discount preview."""

    items = fields.List(
        fields.Nested(ShopOrderItemCreateSchema),
        required=True,
        validate=[validate.Length(min=1)],
        error_messages={"required": "At least one item is required to calculate a quote."},
    )

