from marshmallow import Schema, fields, validate, post_load
from backend.app.pos.models import TableStatus, ShiftStatus, KitchenStatus


class CreateTableSchema(Schema):
    table_number = fields.String(required=True, validate=validate.Length(min=1, max=20))
    name = fields.String(load_default=None, validate=validate.Length(max=100))
    capacity = fields.Integer(load_default=4, validate=validate.Range(min=1, max=50))


class UpdateTableSchema(Schema):
    name = fields.String(validate=validate.Length(max=100))
    capacity = fields.Integer(validate=validate.Range(min=1, max=50))
    status = fields.String(validate=validate.OneOf([s.value for s in TableStatus]))
    is_active = fields.Boolean()


class CreateMenuCategorySchema(Schema):
    name = fields.String(required=True, validate=validate.Length(min=1, max=50))
    slug = fields.String(required=True, validate=validate.Length(min=1, max=50))
    display_order = fields.Integer(load_default=0)


class CreateMenuItemSchema(Schema):
    category_id = fields.Integer(required=True)
    code = fields.String(required=True, validate=validate.Length(min=1, max=30))
    name = fields.String(required=True, validate=validate.Length(min=1, max=100))
    description = fields.String(load_default=None)
    price = fields.Decimal(as_string=True, required=True, validate=validate.Range(min=0))
    tax_rate = fields.Decimal(as_string=True, load_default="0.0500", validate=validate.Range(min=0))
    preparation_time_minutes = fields.Integer(load_default=10, validate=validate.Range(min=1))


class UpdateMenuItemSchema(Schema):
    category_id = fields.Integer()
    name = fields.String(validate=validate.Length(min=1, max=100))
    description = fields.String(allow_none=True)
    price = fields.Decimal(as_string=True, validate=validate.Range(min=0))
    tax_rate = fields.Decimal(as_string=True, validate=validate.Range(min=0))
    is_available = fields.Boolean()
    is_active = fields.Boolean()
    preparation_time_minutes = fields.Integer(validate=validate.Range(min=1))


class StartShiftSchema(Schema):
    starting_cash = fields.Decimal(as_string=True, load_default="0.00", validate=validate.Range(min=0))
    notes = fields.String(load_default=None)


class EndShiftSchema(Schema):
    ending_cash = fields.Decimal(as_string=True, load_default=None, validate=validate.Range(min=0))
    notes = fields.String(load_default=None)


class OpenTabSchema(Schema):
    table_id = fields.Integer(required=True)
    member_id = fields.Integer(load_default=None)
    customer_name = fields.String(load_default=None, validate=validate.Length(max=100))
    shift_id = fields.Integer(load_default=None)
    notes = fields.String(load_default=None)


class TabItemInputSchema(Schema):
    menu_item_id = fields.Integer(required=True)
    quantity = fields.Integer(load_default=1, validate=validate.Range(min=1, max=100))
    notes = fields.String(load_default=None, validate=validate.Length(max=255))


class AddTabItemsSchema(Schema):
    items = fields.List(fields.Nested(TabItemInputSchema), required=True, validate=validate.Length(min=1))


class UpdateKitchenStatusSchema(Schema):
    kitchen_status = fields.String(
        required=True,
        validate=validate.OneOf([s.value for s in KitchenStatus if s != KitchenStatus.PENDING]),
    )


class PayTabSchema(Schema):
    payment_method = fields.String(
        required=True,
        validate=validate.OneOf(["CASH", "CARD", "UPI"]),
    )
    amount = fields.Decimal(as_string=True, load_default=None, validate=validate.Range(min=0.01))
    notes = fields.String(load_default=None)


class VoidTabSchema(Schema):
    reason = fields.String(required=True, validate=validate.Length(min=3, max=255))
