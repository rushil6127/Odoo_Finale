import enum
import threading
from datetime import date, datetime, time, timedelta
from decimal import Decimal
from typing import Optional, Dict, Any, List, Tuple

from sqlalchemy import func, or_
from backend.app.extensions import db
from backend.app.common.utils import utc_now
from backend.app.common.errors import (
    NotFoundException,
    ValidationException,
    ConflictException,
    BusinessRuleException,
)
from backend.app.members.models import Member
from backend.app.memberships.services import get_active_membership
from backend.app.payments.models import Payment, PaymentItemType, PaymentStatus, PaymentMethod
from backend.app.payments.services import (
    create_or_initiate_payment,
    confirm_manual_payment,
    refund_payment,
    get_payment_for_item,
)
from backend.app.pos.models import (
    POSTable,
    TableStatus,
    POSMenuCategory,
    POSMenuItem,
    StaffShift,
    ShiftStatus,
    POSTab,
    TabStatus,
    TabPaymentStatus,
    POSOrderItem,
    KitchenStatus,
    ALLOWED_KITCHEN_TRANSITIONS,
    generate_tab_reference,
    generate_shift_reference,
)

_pos_lock = threading.Lock()

# Standard plan discount percentages for bar/cafeteria if not explicitly defined in plan benefits JSON
DEFAULT_TIER_POS_DISCOUNTS = {
    "GOLD": Decimal("15.00"),
    "SILVER": Decimal("10.00"),
    "JUNIOR": Decimal("5.00"),
}


# ---------------------------------------------------------
# Table Services
# ---------------------------------------------------------

def get_table(table_id: int) -> POSTable:
    """Fetch table by ID or raise 404."""
    table = db.session.get(POSTable, table_id)
    if not table:
        raise NotFoundException(f"Table with ID {table_id} not found.")
    return table


def list_tables(
    status: Optional[str] = None,
    is_active: Optional[bool] = None,
) -> List[POSTable]:
    """List tables with optional status and activity filtering."""
    query = POSTable.query
    if status:
        query = query.filter(POSTable.status == TableStatus(status.upper().strip()))
    if is_active is not None:
        query = query.filter(POSTable.is_active == is_active)
    return query.order_by(POSTable.table_number.asc()).all()


def create_table(table_number: str, name: Optional[str] = None, capacity: int = 4) -> POSTable:
    """Create a new cafeteria / bar table."""
    clean_num = table_number.strip().upper()
    existing = POSTable.query.filter_by(table_number=clean_num).first()
    if existing:
        raise ConflictException(f"Table '{clean_num}' already exists.", code="DUPLICATE_TABLE")

    if capacity <= 0:
        raise ValidationException("Table capacity must be positive.", code="INVALID_CAPACITY")

    table = POSTable(
        table_number=clean_num,
        name=name.strip() if name else None,
        capacity=capacity,
        status=TableStatus.AVAILABLE,
        is_active=True,
    )
    db.session.add(table)
    db.session.commit()
    return table


def update_table(
    table_id: int,
    name: Optional[str] = None,
    capacity: Optional[int] = None,
    status: Optional[str] = None,
    is_active: Optional[bool] = None,
) -> POSTable:
    """Update table properties."""
    table = get_table(table_id)
    if name is not None:
        table.name = name.strip() if name else None
    if capacity is not None:
        if capacity <= 0:
            raise ValidationException("Table capacity must be positive.", code="INVALID_CAPACITY")
        table.capacity = capacity
    if status is not None:
        table.status = TableStatus(status.upper().strip())
    if is_active is not None:
        table.is_active = is_active

    db.session.commit()
    return table


# ---------------------------------------------------------
# Menu Services
# ---------------------------------------------------------

def get_menu_category(category_id: int) -> POSMenuCategory:
    """Fetch menu category by ID."""
    cat = db.session.get(POSMenuCategory, category_id)
    if not cat:
        raise NotFoundException(f"Menu category with ID {category_id} not found.")
    return cat


def list_menu_categories(is_active: Optional[bool] = True) -> List[POSMenuCategory]:
    """List menu categories."""
    query = POSMenuCategory.query
    if is_active is not None:
        query = query.filter(POSMenuCategory.is_active == is_active)
    return query.order_by(POSMenuCategory.display_order.asc(), POSMenuCategory.name.asc()).all()


def create_menu_category(name: str, slug: str, display_order: int = 0) -> POSMenuCategory:
    """Create a new menu category."""
    clean_slug = slug.strip().lower()
    existing = POSMenuCategory.query.filter_by(slug=clean_slug).first()
    if existing:
        raise ConflictException(f"Category slug '{clean_slug}' already exists.", code="DUPLICATE_CATEGORY")

    cat = POSMenuCategory(
        name=name.strip(),
        slug=clean_slug,
        display_order=display_order,
        is_active=True,
    )
    db.session.add(cat)
    db.session.commit()
    return cat


def get_menu_item(item_id: int) -> POSMenuItem:
    """Fetch menu item by ID."""
    item = db.session.get(POSMenuItem, item_id)
    if not item:
        raise NotFoundException(f"Menu item with ID {item_id} not found.")
    return item


def list_menu_items(
    category_id: Optional[int] = None,
    category_slug: Optional[str] = None,
    is_available: Optional[bool] = None,
    is_active: Optional[bool] = True,
    search: Optional[str] = None,
) -> List[POSMenuItem]:
    """List menu items with filters."""
    query = POSMenuItem.query
    if category_id:
        query = query.filter(POSMenuItem.category_id == category_id)
    elif category_slug:
        query = query.join(POSMenuCategory).filter(POSMenuCategory.slug == category_slug)

    if is_available is not None:
        query = query.filter(POSMenuItem.is_available == is_available)
    if is_active is not None:
        query = query.filter(POSMenuItem.is_active == is_active)
    if search:
        term = f"%{search.strip()}%"
        query = query.filter(or_(POSMenuItem.name.ilike(term), POSMenuItem.code.ilike(term)))

    return query.order_by(POSMenuItem.name.asc()).all()


def create_menu_item(
    category_id: int,
    code: str,
    name: str,
    price: float | Decimal,
    description: Optional[str] = None,
    tax_rate: float | Decimal = Decimal("0.0500"),
    preparation_time_minutes: int = 10,
) -> POSMenuItem:
    """Create a new cafeteria / bar food or beverage item."""
    clean_code = code.strip().upper()
    existing = POSMenuItem.query.filter_by(code=clean_code).first()
    if existing:
        raise ConflictException(f"Menu item with code '{clean_code}' already exists.", code="DUPLICATE_ITEM_CODE")

    cat = get_menu_category(category_id)
    dec_price = Decimal(str(price))
    if dec_price < Decimal("0.00"):
        raise ValidationException("Price cannot be negative.", code="INVALID_PRICE")

    item = POSMenuItem(
        category_id=cat.id,
        code=clean_code,
        name=name.strip(),
        description=description.strip() if description else None,
        price=dec_price,
        tax_rate=Decimal(str(tax_rate)),
        is_available=True,
        is_active=True,
        preparation_time_minutes=preparation_time_minutes,
    )
    db.session.add(item)
    db.session.commit()
    return item


def update_menu_item(
    item_id: int,
    category_id: Optional[int] = None,
    name: Optional[str] = None,
    price: Optional[float | Decimal] = None,
    description: Optional[str] = None,
    tax_rate: Optional[float | Decimal] = None,
    is_available: Optional[bool] = None,
    is_active: Optional[bool] = None,
    preparation_time_minutes: Optional[int] = None,
) -> POSMenuItem:
    """Update menu item details."""
    item = get_menu_item(item_id)
    if category_id is not None:
        cat = get_menu_category(category_id)
        item.category_id = cat.id
    if name is not None:
        item.name = name.strip()
    if price is not None:
        dec_price = Decimal(str(price))
        if dec_price < Decimal("0.00"):
            raise ValidationException("Price cannot be negative.", code="INVALID_PRICE")
        item.price = dec_price
    if description is not None:
        item.description = description.strip() if description else None
    if tax_rate is not None:
        item.tax_rate = Decimal(str(tax_rate))
    if is_available is not None:
        item.is_available = is_available
    if is_active is not None:
        item.is_active = is_active
    if preparation_time_minutes is not None:
        item.preparation_time_minutes = preparation_time_minutes

    db.session.commit()
    return item


# ---------------------------------------------------------
# Staff Shift Services
# ---------------------------------------------------------

def get_shift(shift_id: int) -> StaffShift:
    """Fetch shift by ID."""
    shift = db.session.get(StaffShift, shift_id)
    if not shift:
        raise NotFoundException(f"Shift with ID {shift_id} not found.")
    return shift


def get_active_shift_for_user(user_id: int) -> Optional[StaffShift]:
    """Retrieve active shift for a given staff user."""
    return StaffShift.query.filter_by(user_id=user_id, status=ShiftStatus.ACTIVE).first()


def start_shift(
    user_id: int,
    starting_cash: float | Decimal = Decimal("0.00"),
    notes: Optional[str] = None,
) -> StaffShift:
    """Start a new work shift for a staff member."""
    existing = get_active_shift_for_user(user_id)
    if existing:
        raise ConflictException(
            f"User already has an active shift ({existing.shift_reference}). Please end it first.",
            code="ACTIVE_SHIFT_EXISTS",
        )

    dec_cash = Decimal(str(starting_cash))
    if dec_cash < Decimal("0.00"):
        raise ValidationException("Starting cash cannot be negative.", code="INVALID_CASH")

    shift = StaffShift(
        shift_reference=generate_shift_reference("SFT"),
        user_id=user_id,
        start_time=utc_now(),
        status=ShiftStatus.ACTIVE,
        starting_cash=dec_cash,
        notes=notes.strip() if notes else None,
    )
    db.session.add(shift)
    db.session.commit()
    return shift


def end_shift(
    shift_id: int,
    ending_cash: Optional[float | Decimal] = None,
    notes: Optional[str] = None,
) -> StaffShift:
    """Close an active shift."""
    shift = get_shift(shift_id)
    if shift.status == ShiftStatus.CLOSED:
        return shift

    dec_ending = Decimal(str(ending_cash)) if ending_cash is not None else None
    if dec_ending is not None and dec_ending < Decimal("0.00"):
        raise ValidationException("Ending cash cannot be negative.", code="INVALID_CASH")

    shift.status = ShiftStatus.CLOSED
    shift.end_time = utc_now()
    if dec_ending is not None:
        shift.ending_cash = dec_ending
    if notes:
        shift.notes = f"{shift.notes}\n{notes}".strip() if shift.notes else notes.strip()

    db.session.commit()
    return shift


def list_shifts(
    user_id: Optional[int] = None,
    status: Optional[str] = None,
    page: int = 1,
    per_page: int = 20,
) -> Tuple[List[StaffShift], int]:
    """List staff shifts with filters and pagination."""
    query = StaffShift.query
    if user_id:
        query = query.filter(StaffShift.user_id == user_id)
    if status:
        query = query.filter(StaffShift.status == ShiftStatus(status.upper().strip()))

    total = query.count()
    paginated = (
        query.order_by(StaffShift.start_time.desc())
        .offset((page - 1) * per_page)
        .limit(per_page)
        .all()
    )
    return paginated, total


# ---------------------------------------------------------
# Member Discount Calculations
# ---------------------------------------------------------

def get_member_pos_discount_pct(member_id: Optional[int]) -> Decimal:
    """Calculate member discount percentage for bar / cafeteria.
    
    Rules:
    - Guests / walk-ins: 0%
    - Expired members: 0%
    - Active Gold: 15% (or plan.benefits.pos_discount_pct)
    - Active Silver: 10% (or plan.benefits.pos_discount_pct)
    - Active Junior: 5% (or plan.benefits.pos_discount_pct)
    - Never accepts client-supplied discounts.
    """
    if not member_id:
        return Decimal("0.00")

    member = db.session.get(Member, member_id)
    if not member:
        return Decimal("0.00")

    active_ms = get_active_membership(member.id)
    if not active_ms or not active_ms.plan:
        return Decimal("0.00")

    plan = active_ms.plan
    # Check if benefits dict specifies cafeteria / pos discount
    if plan.benefits and isinstance(plan.benefits, dict):
        custom_pct = plan.benefits.get("pos_discount_pct") or plan.benefits.get("fnb_discount_pct")
        if custom_pct is not None:
            return Decimal(str(custom_pct))

    # Standard tier fallback
    plan_code = plan.code.upper().strip() if plan.code else ""
    return DEFAULT_TIER_POS_DISCOUNTS.get(plan_code, Decimal("0.00"))


# ---------------------------------------------------------
# Tab & Order Services
# ---------------------------------------------------------

def get_tab(tab_id: int) -> POSTab:
    """Fetch tab by ID or raise 404."""
    tab = db.session.get(POSTab, tab_id)
    if not tab:
        raise NotFoundException(f"POS Tab with ID {tab_id} not found.")
    return tab


def open_tab(
    table_id: int,
    opened_by_user: Any,
    member_id: Optional[int] = None,
    customer_name: Optional[str] = None,
    shift_id: Optional[int] = None,
    notes: Optional[str] = None,
) -> POSTab:
    """Open a cafeteria / bar tab on a table.
    
    Guarantees:
    - Occupies table; rejects if table is already occupied or has an open tab.
    - Automatically checks active membership and snapshots plan discount.
    - Associates order with staff member and their active shift.
    """
    with _pos_lock:
        table = get_table(table_id)
        if not table.is_active:
            raise BusinessRuleException(f"Table '{table.table_number}' is inactive.", code="TABLE_INACTIVE")

        # Check if table already has an OPEN tab
        existing_open_tab = POSTab.query.filter(
            POSTab.table_id == table.id,
            POSTab.status.in_([TabStatus.OPEN, TabStatus.PAID]),
        ).first()
        if existing_open_tab or table.status == TableStatus.OCCUPIED:
            raise ConflictException(
                f"Table '{table.table_number}' is already occupied with tab '{existing_open_tab.tab_reference if existing_open_tab else 'active'}'. Only one open tab per table allowed.",
                code="TABLE_OCCUPIED",
            )

        # Determine shift
        active_shift = None
        if shift_id:
            active_shift = get_shift(shift_id)
            if active_shift.status != ShiftStatus.ACTIVE:
                raise ValidationException("Specified shift is closed.", code="SHIFT_CLOSED")
        else:
            active_shift = get_active_shift_for_user(opened_by_user.id)
            if not active_shift:
                raise ValidationException(
                    "Staff member does not have an active shift. Please start a shift first.",
                    code="NO_ACTIVE_SHIFT",
                )

        # Member & discount determination
        member = None
        calc_discount_pct = Decimal("0.00")
        if member_id:
            member = db.session.get(Member, member_id)
            if not member:
                raise NotFoundException(f"Member with ID {member_id} not found.")
            calc_discount_pct = get_member_pos_discount_pct(member.id)
            customer_name = customer_name or (member.user.full_name if member.user else f"Member #{member.id}")
        else:
            customer_name = customer_name or f"Guest - Table {table.table_number}"

        tab_ref = generate_tab_reference("TAB")
        tab = POSTab(
            tab_reference=tab_ref,
            table_id=table.id,
            shift_id=active_shift.id,
            opened_by_user_id=opened_by_user.id,
            member_id=member.id if member else None,
            customer_name=customer_name.strip(),
            status=TabStatus.OPEN,
            subtotal_amount=Decimal("0.00"),
            discount_amount=Decimal("0.00"),
            discount_pct=calc_discount_pct,
            tax_amount=Decimal("0.00"),
            total_amount=Decimal("0.00"),
            paid_amount=Decimal("0.00"),
            payment_status=TabPaymentStatus.UNPAID,
            notes=notes.strip() if notes else None,
            opened_at=utc_now(),
        )
        db.session.add(tab)

        # Set table status to OCCUPIED
        table.status = TableStatus.OCCUPIED

        db.session.commit()
        return tab


def _recalculate_tab_financials(tab: POSTab) -> None:
    """Recalculate subtotal, discount, 5% GST tax, and total amount across all items on tab."""
    subtotal = Decimal("0.00")
    discount = Decimal("0.00")
    tax = Decimal("0.00")
    total = Decimal("0.00")

    for item in tab.items:
        if item.kitchen_status == KitchenStatus.CANCELLED:
            continue
        unit_p = Decimal(str(item.unit_price))
        qty = Decimal(item.quantity)
        item_sub = (unit_p * qty).quantize(Decimal("0.01"))
        item_disc = (item_sub * (item.discount_pct / Decimal("100.00"))).quantize(Decimal("0.01"))
        item_taxable = item_sub - item_disc
        item_tax = (item_taxable * Decimal(str(item.tax_rate))).quantize(Decimal("0.01"))
        item_tot = item_taxable + item_tax

        item.subtotal_amount = item_sub
        item.discount_amount = item_disc
        item.tax_amount = item_tax
        item.total_amount = item_tot

        subtotal += item_sub
        discount += item_disc
        tax += item_tax
        total += item_tot

    tab.subtotal_amount = subtotal
    tab.discount_amount = discount
    tab.tax_amount = tax
    tab.total_amount = total
    db.session.flush()


def add_items_to_tab(
    tab_id: int,
    items_data: List[Dict[str, Any]],
    requesting_user: Any,
) -> POSTab:
    """Add food/beverage items to an open tab, snapshotting prices and 5% GST."""
    with _pos_lock:
        tab = get_tab(tab_id)
        if tab.status != TabStatus.OPEN:
            raise BusinessRuleException(
                f"Cannot add items to tab '{tab.tab_reference}' in status '{tab.status.value}'.",
                code="TAB_NOT_OPEN",
            )

        if not items_data:
            raise ValidationException("At least one item must be added.", code="EMPTY_ITEMS")

        for entry in items_data:
            menu_item_id = entry.get("menu_item_id")
            quantity = entry.get("quantity", 1)
            notes = entry.get("notes")

            if quantity <= 0:
                raise ValidationException("Quantity must be greater than zero.", code="INVALID_QUANTITY")

            menu_item = db.session.get(POSMenuItem, menu_item_id)
            if not menu_item:
                raise NotFoundException(f"Menu item with ID {menu_item_id} not found.")

            if not menu_item.is_active or not menu_item.is_available:
                raise BusinessRuleException(
                    f"Menu item '{menu_item.name}' is currently unavailable.",
                    code="ITEM_UNAVAILABLE",
                )

            unit_price = Decimal(str(menu_item.price))
            item_subtotal = (unit_price * Decimal(quantity)).quantize(Decimal("0.01"))
            item_discount = (item_subtotal * (tab.discount_pct / Decimal("100.00"))).quantize(Decimal("0.01"))
            item_taxable = item_subtotal - item_discount
            item_tax = (item_taxable * Decimal("0.0500")).quantize(Decimal("0.01"))
            item_total = item_taxable + item_tax

            order_item = POSOrderItem(
                tab_id=tab.id,
                menu_item_id=menu_item.id,
                item_name=menu_item.name,
                unit_price=unit_price,
                quantity=quantity,
                discount_pct=tab.discount_pct,
                discount_amount=item_discount,
                tax_rate=Decimal("0.0500"),  # 5% GST
                tax_amount=item_tax,
                subtotal_amount=item_subtotal,
                total_amount=item_total,
                kitchen_status=KitchenStatus.PENDING,
                notes=notes.strip() if notes else None,
            )
            db.session.add(order_item)

        db.session.flush()
        _recalculate_tab_financials(tab)
        db.session.commit()
        return tab


def send_tab_to_kitchen(tab_id: int, requesting_user: Any) -> POSTab:
    """Send all pending items on a tab to the kitchen queue (PENDING -> QUEUED)."""
    with _pos_lock:
        tab = get_tab(tab_id)
        if tab.status != TabStatus.OPEN:
            raise BusinessRuleException("Cannot send items for a closed or voided tab.", code="TAB_NOT_OPEN")

        pending_items = [item for item in tab.items if item.kitchen_status == KitchenStatus.PENDING]
        if not pending_items:
            return tab

        now = utc_now()
        for item in pending_items:
            item.kitchen_status = KitchenStatus.QUEUED
            item.sent_to_kitchen_at = now

        db.session.commit()
        return tab


def update_kitchen_item_status(
    item_id: int,
    target_status: str,
    requesting_user: Any,
) -> POSOrderItem:
    """Transition a kitchen order item strictly forward through its preparation lifecycle."""
    with _pos_lock:
        item = db.session.get(POSOrderItem, item_id)
        if not item:
            raise NotFoundException(f"Order item with ID {item_id} not found.")

        target_enum = KitchenStatus(target_status.upper().strip())
        if item.kitchen_status == target_enum:
            return item

        allowed = ALLOWED_KITCHEN_TRANSITIONS.get(item.kitchen_status, set())
        if target_enum not in allowed:
            raise ValidationException(
                f"Invalid kitchen transition from '{item.kitchen_status.value}' to '{target_enum.value}'. "
                f"Kitchen status moves forward in order only (QUEUED -> PREPARING -> READY -> SERVED).",
                code="INVALID_KITCHEN_TRANSITION",
            )

        item.kitchen_status = target_enum
        now = utc_now()
        if target_enum == KitchenStatus.READY:
            item.prepared_at = now
        elif target_enum == KitchenStatus.SERVED:
            item.served_at = now

        db.session.commit()
        return item


def list_kitchen_queue(status: Optional[str] = None) -> List[POSOrderItem]:
    """Retrieve active kitchen display queue (QUEUED, PREPARING, READY)."""
    query = POSOrderItem.query
    if status:
        query = query.filter(POSOrderItem.kitchen_status == KitchenStatus(status.upper().strip()))
    else:
        query = query.filter(
            POSOrderItem.kitchen_status.in_([
                KitchenStatus.QUEUED,
                KitchenStatus.PREPARING,
                KitchenStatus.READY,
            ])
        )
    return query.order_by(POSOrderItem.sent_to_kitchen_at.asc()).all()


def pay_tab(
    tab_id: int,
    payment_method: str,
    amount: Optional[Decimal | float] = None,
    staff_user: Any = None,
    notes: Optional[str] = None,
) -> POSTab:
    """Settle payment for a tab using the shared payment service (CASH, CARD, UPI)."""
    with _pos_lock:
        tab = get_tab(tab_id)
        if tab.status in (TabStatus.CLOSED, TabStatus.VOIDED):
            raise BusinessRuleException("Cannot take payment on a closed or voided tab.", code="TAB_INACTIVE")

        clean_method = payment_method.upper().strip()
        if clean_method not in ("CASH", "CARD", "UPI"):
            raise ValidationException(
                f"Invalid payment method '{payment_method}'. Must be CASH, CARD, or UPI.",
                code="INVALID_PAYMENT_METHOD",
            )

        unpaid_balance = tab.total_amount - tab.paid_amount
        if unpaid_balance <= Decimal("0.00"):
            tab.payment_status = TabPaymentStatus.PAID
            tab.status = TabStatus.PAID
            db.session.commit()
            return tab

        pay_amount = Decimal(str(amount)) if amount is not None else unpaid_balance
        if pay_amount <= Decimal("0.00"):
            raise ValidationException("Payment amount must be greater than zero.", code="INVALID_AMOUNT")

        if pay_amount > unpaid_balance:
            pay_amount = unpaid_balance

        # 1. Use shared payment service to record payment
        payment = create_or_initiate_payment(
            item_type="POS_ORDER",
            item_id=tab.id,
            amount=pay_amount,
            payment_method=clean_method,
            user_id=tab.opened_by_user_id,
            member_id=tab.member_id,
            notes=notes or f"Payment for POS Tab {tab.tab_reference}",
        )

        # 2. Confirm manual tender through shared payment service
        confirm_manual_payment(
            payment_id=payment.id,
            staff_user=staff_user,
            notes=f"Settled POS tab {tab.tab_reference} via {clean_method}",
        )

        # 3. Update tab financial progress
        tab.paid_amount += pay_amount
        tab.payment_method = clean_method

        if tab.paid_amount >= tab.total_amount:
            tab.payment_status = TabPaymentStatus.PAID
            tab.status = TabStatus.PAID
        else:
            tab.payment_status = TabPaymentStatus.PARTIALLY_PAID

        db.session.commit()
        return tab


def close_tab(tab_id: int, staff_user: Any) -> POSTab:
    """Close a tab and free the associated table.
    
    Guarantees:
    - Tab can only be closed once fully paid.
    - Closing frees the table (sets status to AVAILABLE).
    """
    with _pos_lock:
        tab = get_tab(tab_id)
        if tab.status == TabStatus.CLOSED:
            return tab

        if tab.status == TabStatus.VOIDED:
            raise BusinessRuleException("Cannot close a voided tab.", code="TAB_VOIDED")

        # Must be fully paid before closing
        if tab.paid_amount < tab.total_amount or tab.payment_status != TabPaymentStatus.PAID:
            raise BusinessRuleException(
                f"Tab '{tab.tab_reference}' cannot be closed until it is fully paid. "
                f"Total: ₹{tab.total_amount}, Paid: ₹{tab.paid_amount}.",
                code="TAB_UNPAID",
            )

        tab.status = TabStatus.CLOSED
        tab.closed_at = utc_now()
        tab.closed_by_user_id = staff_user.id if staff_user else None

        # Free the table
        if tab.table:
            tab.table.status = TableStatus.AVAILABLE

        db.session.commit()

        try:
            from backend.app.tasks.dispatcher import safe_enqueue_task
            from backend.app.tasks.jobs import send_order_notification_task
            safe_enqueue_task(send_order_notification_task, "POS", tab.id)
        except Exception:
            pass

        return tab


def void_tab(tab_id: int, reason: str, staff_user: Any) -> POSTab:
    """Void a tab, cancelling unpaid orders and freeing the table."""
    with _pos_lock:
        tab = get_tab(tab_id)
        if tab.status == TabStatus.CLOSED:
            raise BusinessRuleException("Cannot void an already closed tab.", code="CANNOT_VOID_CLOSED_TAB")

        if not reason or not reason.strip():
            raise ValidationException("A reason must be provided to void a tab.", code="REASON_REQUIRED")

        tab.status = TabStatus.VOIDED
        tab.void_reason = reason.strip()
        tab.closed_at = utc_now()
        tab.closed_by_user_id = staff_user.id if staff_user else None

        # Free the table
        if tab.table:
            tab.table.status = TableStatus.AVAILABLE

        db.session.commit()
        return tab


def list_tabs(
    status: Optional[str] = None,
    table_id: Optional[int] = None,
    shift_id: Optional[int] = None,
    member_id: Optional[int] = None,
    page: int = 1,
    per_page: int = 20,
) -> Tuple[List[POSTab], int]:
    """List tabs with filtering and pagination."""
    query = POSTab.query
    if status:
        query = query.filter(POSTab.status == TabStatus(status.upper().strip()))
    if table_id:
        query = query.filter(POSTab.table_id == table_id)
    if shift_id:
        query = query.filter(POSTab.shift_id == shift_id)
    if member_id:
        query = query.filter(POSTab.member_id == member_id)

    total = query.count()
    paginated = (
        query.order_by(POSTab.opened_at.desc())
        .offset((page - 1) * per_page)
        .limit(per_page)
        .all()
    )
    return paginated, total


# ---------------------------------------------------------
# Daily Sales Analytics
# ---------------------------------------------------------

def get_daily_sales_report(target_date: Optional[date] = None) -> Dict[str, Any]:
    """Compile daily sales report from persisted closed tabs and paid payments.
    
    Guarantees:
    - Daily sales come from persisted closed tabs and paid payments.
    - Broken down by payment method (CASH, CARD, UPI) and by staff shift.
    - Includes 5% GST tax and member discounts breakdowns.
    """
    if target_date is None:
        target_date = utc_now().date()

    target_str = target_date.isoformat()
    start_dt = datetime.combine(target_date - timedelta(days=1), time(12, 0))
    end_dt = datetime.combine(target_date + timedelta(days=1), time(12, 0))

    # 1. Closed tabs on target date
    closed_tabs = POSTab.query.filter(
        POSTab.status == TabStatus.CLOSED,
        or_(
            func.date(POSTab.closed_at) == target_str,
            (POSTab.closed_at >= start_dt) & (POSTab.closed_at <= end_dt)
        )
    ).all()

    # 2. Paid payments on target date for POS_ORDER
    paid_payments = Payment.query.filter(
        Payment.item_type == PaymentItemType.POS_ORDER,
        Payment.status == PaymentStatus.PAID,
        or_(
            func.date(Payment.paid_at) == target_str,
            (Payment.paid_at >= start_dt) & (Payment.paid_at <= end_dt)
        )
    ).all()

    total_gross = sum((tab.subtotal_amount for tab in closed_tabs), Decimal("0.00"))
    total_discount = sum((tab.discount_amount for tab in closed_tabs), Decimal("0.00"))
    total_tax = sum((tab.tax_amount for tab in closed_tabs), Decimal("0.00"))
    total_net_sales = sum((tab.total_amount for tab in closed_tabs), Decimal("0.00"))
    total_payments = sum((p.amount for p in paid_payments), Decimal("0.00"))

    # Breakdown by payment method
    by_method: Dict[str, Dict[str, Any]] = {
        "CASH": {"amount": 0.0, "count": 0},
        "CARD": {"amount": 0.0, "count": 0},
        "UPI": {"amount": 0.0, "count": 0},
    }
    for p in paid_payments:
        method_key = p.payment_method.value if hasattr(p.payment_method, "value") else str(p.payment_method)
        if method_key not in by_method:
            by_method[method_key] = {"amount": 0.0, "count": 0}
        by_method[method_key]["amount"] = round(by_method[method_key]["amount"] + float(p.amount), 2)
        by_method[method_key]["count"] += 1

    # Breakdown by shift
    shifts_map: Dict[int, Dict[str, Any]] = {}
    for tab in closed_tabs:
        s_id = tab.shift_id
        if s_id not in shifts_map:
            shift = tab.shift
            shifts_map[s_id] = {
                "shift_id": s_id,
                "shift_reference": shift.shift_reference if shift else None,
                "staff_name": f"{shift.user.first_name} {shift.user.last_name}" if shift and shift.user else "Staff",
                "start_time": shift.start_time.isoformat() if shift and shift.start_time else None,
                "end_time": shift.end_time.isoformat() if shift and shift.end_time else None,
                "status": shift.status.value if shift and hasattr(shift.status, "value") else "ACTIVE",
                "total_sales": Decimal("0.00"),
                "total_tabs": 0,
                "by_method": {"CASH": 0.0, "CARD": 0.0, "UPI": 0.0},
            }
        shifts_map[s_id]["total_sales"] += tab.total_amount
        shifts_map[s_id]["total_tabs"] += 1
        if tab.payment_method in shifts_map[s_id]["by_method"]:
            shifts_map[s_id]["by_method"][tab.payment_method] = round(
                shifts_map[s_id]["by_method"][tab.payment_method] + float(tab.total_amount), 2
            )

    shifts_list = []
    for s_info in shifts_map.values():
        shifts_list.append({
            **s_info,
            "total_sales": float(s_info["total_sales"]),
        })

    return {
        "date": target_date.isoformat(),
        "total_closed_tabs": len(closed_tabs),
        "total_gross_amount": float(total_gross),
        "total_discount_amount": float(total_discount),
        "total_tax_amount": float(total_tax),
        "total_sales": float(total_net_sales),
        "total_payments_collected": float(total_payments),
        "by_payment_method": by_method,
        "by_shift": shifts_list,
    }


# ---------------------------------------------------------
# Seed POS Data (Tables & Menu Catalog)
# ---------------------------------------------------------

SEED_TABLES = [
    {"table_number": "T1", "name": "Lounge Table 1", "capacity": 4},
    {"table_number": "T2", "name": "Lounge Table 2", "capacity": 4},
    {"table_number": "T3", "name": "Court View 1", "capacity": 2},
    {"table_number": "T4", "name": "Court View 2", "capacity": 2},
    {"table_number": "BAR-1", "name": "Espresso Bar High-Top 1", "capacity": 1},
    {"table_number": "BAR-2", "name": "Espresso Bar High-Top 2", "capacity": 1},
]

SEED_CATEGORIES = [
    {"name": "Beverages", "slug": "beverages", "display_order": 1},
    {"name": "Healthy Kitchen", "slug": "healthy-kitchen", "display_order": 2},
    {"name": "Snacks & Grills", "slug": "snacks-grills", "display_order": 3},
]

SEED_MENU_ITEMS = [
    {
        "category_slug": "beverages",
        "code": "BEV-ESP",
        "name": "Artisan Single-Origin Espresso",
        "price": Decimal("120.00"),
        "description": "Double shot roasted Arabica blend.",
        "preparation_time_minutes": 5,
    },
    {
        "category_slug": "beverages",
        "code": "BEV-PROT",
        "name": "Whey Recovery Protein Smoothie",
        "price": Decimal("250.00"),
        "description": "Whey isolate, fresh berries, banana, and almond milk.",
        "preparation_time_minutes": 8,
    },
    {
        "category_slug": "beverages",
        "code": "BEV-COOL",
        "name": "Electrolyte Citrus Cooler",
        "price": Decimal("140.00"),
        "description": "Cold-pressed lemon, mint, Himalayan pink salt and electrolyte infusion.",
        "preparation_time_minutes": 5,
    },
    {
        "category_slug": "healthy-kitchen",
        "code": "FOOD-BOWL",
        "name": "Quinoa Avocado Power Bowl",
        "price": Decimal("320.00"),
        "description": "Organic quinoa, Hass avocado, edamame, roasted peppers, and lemon tahini dressing.",
        "preparation_time_minutes": 15,
    },
    {
        "category_slug": "snacks-grills",
        "code": "FOOD-WRAP",
        "name": "Grilled Chicken Caesar Wrap",
        "price": Decimal("280.00"),
        "description": "Herb-marinated grilled chicken breast, romaine lettuce, parmesan, in whole-wheat tortilla.",
        "preparation_time_minutes": 12,
    },
    {
        "category_slug": "snacks-grills",
        "code": "FOOD-PANEER",
        "name": "Paneer Tikka Protein Sandwich",
        "price": Decimal("240.00"),
        "description": "Tandoori spiced cottage cheese, grilled bell peppers, and mint chutney on multigrain bread.",
        "preparation_time_minutes": 12,
    },
]


def seed_pos_data() -> None:
    """Seed default tables, categories, and menu items."""
    for t_data in SEED_TABLES:
        existing = POSTable.query.filter_by(table_number=t_data["table_number"]).first()
        if not existing:
            db.session.add(POSTable(
                table_number=t_data["table_number"],
                name=t_data["name"],
                capacity=t_data["capacity"],
                status=TableStatus.AVAILABLE,
                is_active=True,
            ))

    cat_map = {}
    for c_data in SEED_CATEGORIES:
        existing = POSMenuCategory.query.filter_by(slug=c_data["slug"]).first()
        if not existing:
            cat = POSMenuCategory(
                name=c_data["name"],
                slug=c_data["slug"],
                display_order=c_data["display_order"],
                is_active=True,
            )
            db.session.add(cat)
            db.session.flush()
            cat_map[c_data["slug"]] = cat
        else:
            cat_map[c_data["slug"]] = existing

    for m_data in SEED_MENU_ITEMS:
        existing = POSMenuItem.query.filter_by(code=m_data["code"]).first()
        if not existing:
            cat = cat_map.get(m_data["category_slug"])
            if cat:
                db.session.add(POSMenuItem(
                    category_id=cat.id,
                    code=m_data["code"],
                    name=m_data["name"],
                    price=m_data["price"],
                    description=m_data["description"],
                    tax_rate=Decimal("0.0500"),
                    is_available=True,
                    is_active=True,
                    preparation_time_minutes=m_data["preparation_time_minutes"],
                ))

    db.session.commit()
