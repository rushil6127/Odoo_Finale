from decimal import Decimal
from marshmallow import Schema, fields, validate, validates, ValidationError, post_load


class ProductCategoryCreateSchema(Schema):
    """Schema for validating category creation payloads."""

    name = fields.String(
        required=True,
        validate=[validate.Length(min=1, max=100)],
        error_messages={"required": "Category name is required."},
    )
    slug = fields.String(
        required=False,
        allow_none=True,
        validate=[validate.Length(min=1, max=100)],
    )
    description = fields.String(
        required=False,
        allow_none=True,
    )


class ProductCategoryUpdateSchema(Schema):
    """Schema for validating category update payloads."""

    name = fields.String(
        required=False,
        validate=[validate.Length(min=1, max=100)],
    )
    slug = fields.String(
        required=False,
        allow_none=True,
        validate=[validate.Length(min=1, max=100)],
    )
    description = fields.String(
        required=False,
        allow_none=True,
    )
    is_active = fields.Boolean(
        required=False,
    )


class ProductCreateSchema(Schema):
    """Schema for creating a new product."""

    sku = fields.String(
        required=True,
        validate=[validate.Length(min=2, max=50)],
        error_messages={"required": "Product SKU is required."},
    )
    name = fields.String(
        required=True,
        validate=[validate.Length(min=1, max=200)],
        error_messages={"required": "Product name is required."},
    )
    category_id = fields.Integer(
        required=True,
        validate=[validate.Range(min=1)],
        error_messages={"required": "Category ID is required."},
    )
    price = fields.Decimal(
        required=True,
        as_string=True,
        validate=[validate.Range(min=Decimal("0.01"))],
        error_messages={"required": "Price is required."},
    )
    cost_price = fields.Decimal(
        required=False,
        allow_none=True,
        as_string=True,
        validate=[validate.Range(min=Decimal("0.00"))],
    )
    stock_quantity = fields.Integer(
        required=False,
        load_default=0,
        validate=[validate.Range(min=0)],
    )
    low_stock_threshold = fields.Integer(
        required=False,
        load_default=5,
        validate=[validate.Range(min=0)],
    )
    description = fields.String(
        required=False,
        allow_none=True,
    )
    barcode = fields.String(
        required=False,
        allow_none=True,
        validate=[validate.Length(max=100)],
    )
    image_url = fields.String(
        required=False,
        allow_none=True,
        validate=[validate.Length(max=500)],
    )


class ProductUpdateSchema(Schema):
    """Schema for updating product details.
    
    Direct updates to stock_quantity are explicitly disallowed;
    all stock changes must go through stock-in, stock-out, or adjust.
    """

    name = fields.String(
        required=False,
        validate=[validate.Length(min=1, max=200)],
    )
    category_id = fields.Integer(
        required=False,
        validate=[validate.Range(min=1)],
    )
    price = fields.Decimal(
        required=False,
        as_string=True,
        validate=[validate.Range(min=Decimal("0.01"))],
    )
    cost_price = fields.Decimal(
        required=False,
        allow_none=True,
        as_string=True,
        validate=[validate.Range(min=Decimal("0.00"))],
    )
    low_stock_threshold = fields.Integer(
        required=False,
        validate=[validate.Range(min=0)],
    )
    description = fields.String(
        required=False,
        allow_none=True,
    )
    is_active = fields.Boolean(
        required=False,
    )
    barcode = fields.String(
        required=False,
        allow_none=True,
        validate=[validate.Length(max=100)],
    )
    image_url = fields.String(
        required=False,
        allow_none=True,
        validate=[validate.Length(max=500)],
    )

    @validates("price")
    def validate_price(self, value):
        if value is not None and value <= 0:
            raise ValidationError("Product price must be greater than zero.")


class StockInSchema(Schema):
    """Schema for restocking inventory."""

    quantity = fields.Integer(
        required=True,
        validate=[validate.Range(min=1)],
        error_messages={"required": "Restock quantity is required."},
    )
    reason = fields.String(
        required=True,
        validate=[validate.Length(min=1, max=255)],
        error_messages={"required": "Reason for stock-in is required."},
    )
    notes = fields.String(
        required=False,
        allow_none=True,
    )
    reference_id = fields.String(
        required=False,
        allow_none=True,
        validate=[validate.Length(max=100)],
    )


class StockOutSchema(Schema):
    """Schema for inventory deduction (e.g. counter sale, online order, damage, write-off)."""

    quantity = fields.Integer(
        required=True,
        validate=[validate.Range(min=1)],
        error_messages={"required": "Deduction quantity is required."},
    )
    reason = fields.String(
        required=True,
        validate=[validate.Length(min=1, max=255)],
        error_messages={"required": "Reason for stock-out is required."},
    )
    notes = fields.String(
        required=False,
        allow_none=True,
    )
    reference_id = fields.String(
        required=False,
        allow_none=True,
        validate=[validate.Length(max=100)],
    )


class StockAdjustSchema(Schema):
    """Schema for stock quantity adjustment / audit reconciliation."""

    new_quantity = fields.Integer(
        required=True,
        validate=[validate.Range(min=0)],
        error_messages={"required": "Adjusted stock quantity is required."},
    )
    reason = fields.String(
        required=True,
        validate=[validate.Length(min=1, max=255)],
        error_messages={"required": "Reason for stock adjustment is required."},
    )
    notes = fields.String(
        required=False,
        allow_none=True,
    )
    reference_id = fields.String(
        required=False,
        allow_none=True,
        validate=[validate.Length(max=100)],
    )


class InventoryValidationItemSchema(Schema):
    """Individual item within an inventory availability check."""

    product_id = fields.Integer(
        required=True,
        validate=[validate.Range(min=1)],
        error_messages={"required": "product_id is required."},
    )
    quantity = fields.Integer(
        required=True,
        validate=[validate.Range(min=1)],
        error_messages={"required": "quantity is required."},
    )


class InventoryValidationSchema(Schema):
    """Batch inventory availability validation schema."""

    items = fields.List(
        fields.Nested(InventoryValidationItemSchema),
        required=True,
        validate=[validate.Length(min=1)],
        error_messages={"required": "List of items is required."},
    )
