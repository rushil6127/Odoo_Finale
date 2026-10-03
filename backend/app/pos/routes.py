from datetime import date
from flask import Blueprint, request
from flask_jwt_extended import jwt_required, current_user
from marshmallow import ValidationError

from backend.app.common.permissions import RoleEnum, roles_required, staff_required
from backend.app.common.errors import ValidationException
from backend.app.common.responses import success_response
from backend.app.pos.models import (
    POSTable,
    POSTab,
    StaffShift,
    POSMenuItem,
    POSMenuCategory,
)
from backend.app.pos.schemas import (
    CreateTableSchema,
    UpdateTableSchema,
    CreateMenuItemSchema,
    UpdateMenuItemSchema,
    CreateMenuCategorySchema,
    StartShiftSchema,
    EndShiftSchema,
    OpenTabSchema,
    AddTabItemsSchema,
    UpdateKitchenStatusSchema,
    PayTabSchema,
    VoidTabSchema,
)
from backend.app.pos.services import (
    get_table,
    list_tables,
    create_table,
    update_table,
    get_menu_category,
    list_menu_categories,
    create_menu_category,
    get_menu_item,
    list_menu_items,
    create_menu_item,
    update_menu_item,
    get_shift,
    get_active_shift_for_user,
    start_shift,
    end_shift,
    list_shifts,
    get_tab,
    open_tab,
    add_items_to_tab,
    send_tab_to_kitchen,
    update_kitchen_item_status,
    list_kitchen_queue,
    pay_tab,
    close_tab,
    void_tab,
    list_tabs,
    get_daily_sales_report,
)

pos_bp = Blueprint("pos", __name__, url_prefix="/api/v1/pos")

POS_STAFF_ROLES = (
    RoleEnum.BAR_STAFF,
    RoleEnum.FRONT_DESK,
    RoleEnum.ADMIN,
    RoleEnum.OWNER,
)


# ---------------------------------------------------------
# Table Endpoints
# ---------------------------------------------------------

@pos_bp.route("/tables", methods=["GET"])
@roles_required(*POS_STAFF_ROLES)
def api_list_tables():
    """List all cafeteria / bar tables with live occupancy status."""
    status = request.args.get("status")
    is_active = request.args.get("is_active")
    active_bool = is_active.lower() == "true" if is_active is not None else None

    tables = list_tables(status=status, is_active=active_bool)
    return success_response(data=[t.to_dict(include_current_tab=True) for t in tables])


@pos_bp.route("/tables", methods=["POST"])
@roles_required(RoleEnum.BAR_STAFF, RoleEnum.ADMIN, RoleEnum.OWNER)
def api_create_table():
    """Create a new table."""
    payload = request.get_json() or {}
    try:
        data = CreateTableSchema().load(payload)
    except ValidationError as err:
        raise ValidationException("Validation failed.", details=err.messages)

    table = create_table(
        table_number=data["table_number"],
        name=data.get("name"),
        capacity=data.get("capacity", 4),
    )
    return success_response(
        data=table.to_dict(include_current_tab=False),
        message=f"Table '{table.table_number}' created successfully.",
        status_code=201,
    )


@pos_bp.route("/tables/<int:table_id>", methods=["GET"])
@roles_required(*POS_STAFF_ROLES)
def api_get_table(table_id: int):
    """Get table details."""
    table = get_table(table_id)
    return success_response(data=table.to_dict(include_current_tab=True))


@pos_bp.route("/tables/<int:table_id>", methods=["PUT", "PATCH"])
@roles_required(RoleEnum.BAR_STAFF, RoleEnum.ADMIN, RoleEnum.OWNER)
def api_update_table(table_id: int):
    """Update table properties."""
    payload = request.get_json() or {}
    try:
        data = UpdateTableSchema().load(payload)
    except ValidationError as err:
        raise ValidationException("Validation failed.", details=err.messages)

    table = update_table(
        table_id=table_id,
        name=data.get("name"),
        capacity=data.get("capacity"),
        status=data.get("status"),
        is_active=data.get("is_active"),
    )
    return success_response(
        data=table.to_dict(include_current_tab=True),
        message="Table updated successfully.",
    )


# ---------------------------------------------------------
# Menu Endpoints
# ---------------------------------------------------------

@pos_bp.route("/menu/categories", methods=["GET"])
@jwt_required()
def api_list_categories():
    """List menu categories."""
    categories = list_menu_categories()
    return success_response(data=[c.to_dict() for c in categories])


@pos_bp.route("/menu/categories", methods=["POST"])
@roles_required(RoleEnum.BAR_STAFF, RoleEnum.ADMIN, RoleEnum.OWNER)
def api_create_category():
    """Create a new menu category."""
    payload = request.get_json() or {}
    try:
        data = CreateMenuCategorySchema().load(payload)
    except ValidationError as err:
        raise ValidationException("Validation failed.", details=err.messages)

    cat = create_menu_category(
        name=data["name"],
        slug=data["slug"],
        display_order=data.get("display_order", 0),
    )
    return success_response(
        data=cat.to_dict(),
        message=f"Category '{cat.name}' created.",
        status_code=201,
    )


@pos_bp.route("/menu", methods=["GET"])
@jwt_required()
def api_list_menu():
    """List menu items with categories and filters."""
    cat_id = request.args.get("category_id", type=int)
    cat_slug = request.args.get("category_slug")
    is_avail = request.args.get("is_available")
    avail_bool = is_avail.lower() == "true" if is_avail is not None else None
    search = request.args.get("search")

    items = list_menu_items(
        category_id=cat_id,
        category_slug=cat_slug,
        is_available=avail_bool,
        search=search,
    )
    return success_response(data=[i.to_dict() for i in items])


@pos_bp.route("/menu", methods=["POST"])
@roles_required(RoleEnum.BAR_STAFF, RoleEnum.ADMIN, RoleEnum.OWNER)
def api_create_menu_item():
    """Create a new menu item."""
    payload = request.get_json() or {}
    try:
        data = CreateMenuItemSchema().load(payload)
    except ValidationError as err:
        raise ValidationException("Validation failed.", details=err.messages)

    item = create_menu_item(
        category_id=data["category_id"],
        code=data["code"],
        name=data["name"],
        price=data["price"],
        description=data.get("description"),
        tax_rate=data.get("tax_rate", "0.0500"),
        preparation_time_minutes=data.get("preparation_time_minutes", 10),
    )
    return success_response(
        data=item.to_dict(),
        message=f"Menu item '{item.name}' created.",
        status_code=201,
    )


@pos_bp.route("/menu/<int:item_id>", methods=["PUT", "PATCH"])
@roles_required(RoleEnum.BAR_STAFF, RoleEnum.ADMIN, RoleEnum.OWNER)
def api_update_menu_item(item_id: int):
    """Update a menu item."""
    payload = request.get_json() or {}
    try:
        data = UpdateMenuItemSchema().load(payload)
    except ValidationError as err:
        raise ValidationException("Validation failed.", details=err.messages)

    item = update_menu_item(
        item_id=item_id,
        category_id=data.get("category_id"),
        name=data.get("name"),
        price=data.get("price"),
        description=data.get("description"),
        tax_rate=data.get("tax_rate"),
        is_available=data.get("is_available"),
        is_active=data.get("is_active"),
        preparation_time_minutes=data.get("preparation_time_minutes"),
    )
    return success_response(data=item.to_dict(), message="Menu item updated.")


# ---------------------------------------------------------
# Staff Shift Endpoints
# ---------------------------------------------------------

@pos_bp.route("/shifts/start", methods=["POST"])
@roles_required(*POS_STAFF_ROLES)
def api_start_shift():
    """Start an active shift for the calling staff member."""
    payload = request.get_json() or {}
    try:
        data = StartShiftSchema().load(payload)
    except ValidationError as err:
        raise ValidationException("Validation failed.", details=err.messages)

    shift = start_shift(
        user_id=current_user.id,
        starting_cash=data.get("starting_cash", "0.00"),
        notes=data.get("notes"),
    )
    return success_response(
        data=shift.to_dict(),
        message=f"Shift {shift.shift_reference} started.",
        status_code=201,
    )


@pos_bp.route("/shifts/end", methods=["POST"])
@roles_required(*POS_STAFF_ROLES)
def api_end_shift():
    """End the current staff member's active shift."""
    payload = request.get_json() or {}
    try:
        data = EndShiftSchema().load(payload)
    except ValidationError as err:
        raise ValidationException("Validation failed.", details=err.messages)

    active_shift = get_active_shift_for_user(current_user.id)
    if not active_shift:
        raise ValidationException("No active shift found to close.", code="NO_ACTIVE_SHIFT")

    shift = end_shift(
        shift_id=active_shift.id,
        ending_cash=data.get("ending_cash"),
        notes=data.get("notes"),
    )
    return success_response(data=shift.to_dict(), message="Shift closed successfully.")


@pos_bp.route("/shifts/current", methods=["GET"])
@roles_required(*POS_STAFF_ROLES)
def api_current_shift():
    """Get the active shift for the calling user."""
    shift = get_active_shift_for_user(current_user.id)
    return success_response(data=shift.to_dict() if shift else None)


@pos_bp.route("/shifts", methods=["GET"])
@roles_required(*POS_STAFF_ROLES)
def api_list_shifts():
    """List shifts with filters."""
    user_id = request.args.get("user_id", type=int)
    status = request.args.get("status")
    page = request.args.get("page", 1, type=int)
    per_page = request.args.get("per_page", 20, type=int)

    shifts, total = list_shifts(user_id=user_id, status=status, page=page, per_page=per_page)
    return success_response(
        data=[s.to_dict() for s in shifts],
        meta={"page": page, "per_page": per_page, "total": total},
    )


# ---------------------------------------------------------
# Tab Endpoints (Orders, Kitchen, Billing)
# ---------------------------------------------------------

@pos_bp.route("/tabs", methods=["POST"])
@roles_required(*POS_STAFF_ROLES)
def api_open_tab():
    """Open a tab for a table."""
    payload = request.get_json() or {}
    try:
        data = OpenTabSchema().load(payload)
    except ValidationError as err:
        raise ValidationException("Validation failed.", details=err.messages)

    tab = open_tab(
        table_id=data["table_id"],
        opened_by_user=current_user,
        member_id=data.get("member_id"),
        customer_name=data.get("customer_name"),
        shift_id=data.get("shift_id"),
        notes=data.get("notes"),
    )
    return success_response(
        data=tab.to_dict(include_items=True),
        message=f"Tab '{tab.tab_reference}' opened on table {tab.table.table_number}.",
        status_code=201,
    )


@pos_bp.route("/tabs", methods=["GET"])
@roles_required(*POS_STAFF_ROLES)
def api_list_tabs():
    """List tabs with status and table filters."""
    status = request.args.get("status")
    table_id = request.args.get("table_id", type=int)
    shift_id = request.args.get("shift_id", type=int)
    member_id = request.args.get("member_id", type=int)
    page = request.args.get("page", 1, type=int)
    per_page = request.args.get("per_page", 20, type=int)

    tabs, total = list_tabs(
        status=status,
        table_id=table_id,
        shift_id=shift_id,
        member_id=member_id,
        page=page,
        per_page=per_page,
    )
    return success_response(
        data=[t.to_dict(include_items=False) for t in tabs],
        meta={"page": page, "per_page": per_page, "total": total},
    )


@pos_bp.route("/tabs/<int:tab_id>", methods=["GET"])
@roles_required(*POS_STAFF_ROLES)
def api_get_tab(tab_id: int):
    """Get full tab details including line items, discounts, 5% GST, and payment status."""
    tab = get_tab(tab_id)
    return success_response(data=tab.to_dict(include_items=True))


@pos_bp.route("/tabs/<int:tab_id>/items", methods=["POST"])
@roles_required(*POS_STAFF_ROLES)
def api_add_items(tab_id: int):
    """Add food/beverage items to an open tab."""
    payload = request.get_json() or {}
    try:
        data = AddTabItemsSchema().load(payload)
    except ValidationError as err:
        raise ValidationException("Validation failed.", details=err.messages)

    tab = add_items_to_tab(
        tab_id=tab_id,
        items_data=data["items"],
        requesting_user=current_user,
    )
    return success_response(
        data=tab.to_dict(include_items=True),
        message="Items successfully added to tab.",
    )


@pos_bp.route("/tabs/<int:tab_id>/kitchen/send", methods=["POST"])
@roles_required(*POS_STAFF_ROLES)
def api_send_to_kitchen(tab_id: int):
    """Send all pending items on a tab to the kitchen display queue."""
    tab = send_tab_to_kitchen(tab_id=tab_id, requesting_user=current_user)
    return success_response(
        data=tab.to_dict(include_items=True),
        message=f"Order items sent to kitchen for tab {tab.tab_reference}.",
    )


@pos_bp.route("/tabs/<int:tab_id>/pay", methods=["POST"])
@roles_required(*POS_STAFF_ROLES)
def api_pay_tab(tab_id: int):
    """Record payment for a tab via CASH, CARD, or UPI through the shared payment foundation."""
    payload = request.get_json() or {}
    try:
        data = PayTabSchema().load(payload)
    except ValidationError as err:
        raise ValidationException("Validation failed.", details=err.messages)

    tab = pay_tab(
        tab_id=tab_id,
        payment_method=data["payment_method"],
        amount=data.get("amount"),
        staff_user=current_user,
        notes=data.get("notes"),
    )
    return success_response(
        data=tab.to_dict(include_items=True),
        message=f"Payment recorded via {data['payment_method']}. Tab status is now {tab.status.value}.",
    )


@pos_bp.route("/tabs/<int:tab_id>/close", methods=["POST"])
@roles_required(*POS_STAFF_ROLES)
def api_close_tab(tab_id: int):
    """Close a fully-paid tab and free the associated table."""
    tab = close_tab(tab_id=tab_id, staff_user=current_user)
    return success_response(
        data=tab.to_dict(include_items=True),
        message=f"Tab {tab.tab_reference} closed. Table {tab.table.table_number} is now available.",
    )


@pos_bp.route("/tabs/<int:tab_id>/void", methods=["POST"])
@roles_required(*POS_STAFF_ROLES)
def api_void_tab(tab_id: int):
    """Void an open tab, cancelling orders and freeing the table."""
    payload = request.get_json() or {}
    try:
        data = VoidTabSchema().load(payload)
    except ValidationError as err:
        raise ValidationException("Validation failed.", details=err.messages)

    tab = void_tab(tab_id=tab_id, reason=data["reason"], staff_user=current_user)
    return success_response(
        data=tab.to_dict(include_items=True),
        message=f"Tab {tab.tab_reference} voided. Table {tab.table.table_number} freed.",
    )


# ---------------------------------------------------------
# Kitchen Queue & Status Management
# ---------------------------------------------------------

@pos_bp.route("/kitchen/queue", methods=["GET"])
@roles_required(*POS_STAFF_ROLES)
def api_kitchen_queue():
    """Retrieve active kitchen display queue (QUEUED, PREPARING, READY)."""
    status = request.args.get("status")
    items = list_kitchen_queue(status=status)
    return success_response(data=[i.to_dict() for i in items])


@pos_bp.route("/kitchen/items/<int:item_id>/status", methods=["POST"])
@roles_required(*POS_STAFF_ROLES)
def api_update_kitchen_status(item_id: int):
    """Advance a kitchen order item status forward (QUEUED -> PREPARING -> READY -> SERVED)."""
    payload = request.get_json() or {}
    try:
        data = UpdateKitchenStatusSchema().load(payload)
    except ValidationError as err:
        raise ValidationException("Validation failed.", details=err.messages)

    item = update_kitchen_item_status(
        item_id=item_id,
        target_status=data["kitchen_status"],
        requesting_user=current_user,
    )
    return success_response(
        data=item.to_dict(),
        message=f"Kitchen item status updated to '{item.kitchen_status.value}'.",
    )


# ---------------------------------------------------------
# Daily Sales Analytics
# ---------------------------------------------------------

@pos_bp.route("/daily-sales", methods=["GET"])
@roles_required(*POS_STAFF_ROLES)
def api_daily_sales():
    """Get persisted daily sales report broken down by payment method and by staff shift."""
    date_str = request.args.get("date")
    target_d = None
    if date_str:
        try:
            target_d = date.fromisoformat(date_str.strip())
        except ValueError:
            raise ValidationException("Invalid date format. Use YYYY-MM-DD.", code="INVALID_DATE")

    report = get_daily_sales_report(target_date=target_d)
    return success_response(data=report)
