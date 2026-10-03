import pytest
from datetime import date, datetime
from decimal import Decimal
from flask_jwt_extended import create_access_token

from backend.app.extensions import db
from backend.app.common.permissions import RoleEnum
from backend.app.auth.services import create_user
from backend.app.members.services import create_member
from backend.app.memberships.services import (
    seed_membership_plans,
    assign_membership,
    get_plan_by_code,
)
from backend.app.memberships.models import Membership, MembershipStatus
from backend.app.common.errors import (
    ConflictException,
    ValidationException,
    BusinessRuleException,
    ForbiddenException,
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
    KitchenStatus,
)
from backend.app.pos.services import (
    create_table,
    create_menu_category,
    create_menu_item,
    start_shift,
    end_shift,
    open_tab,
    add_items_to_tab,
    send_tab_to_kitchen,
    update_kitchen_item_status,
    pay_tab,
    close_tab,
    void_tab,
    get_daily_sales_report,
    get_member_pos_discount_pct,
)


@pytest.fixture
def seeded_plans(app, db_session):
    return seed_membership_plans()


@pytest.fixture
def bar_staff_user(app, db_session):
    return create_user(
        email="bar.staff@championsclub.com",
        password="Password123!",
        first_name="Barista",
        last_name="Bob",
        role=RoleEnum.BAR_STAFF,
    )


@pytest.fixture
def bar_staff_token(bar_staff_user):
    token = create_access_token(
        identity=str(bar_staff_user.id),
        additional_claims={"role": RoleEnum.BAR_STAFF.value},
    )
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
def member_user(app, db_session):
    user = create_user(
        email="pos.member@example.com",
        password="Password123!",
        first_name="Roger",
        last_name="Federer",
        role=RoleEnum.MEMBER,
    )
    member = create_member(
        user_id=user.id,
        phone="+919876543210",
        date_of_birth=date(1990, 5, 20),
        gender="Male",
        address="123 Tennis Court",
    )
    return user, member


@pytest.fixture
def member_token(member_user):
    user, _ = member_user
    token = create_access_token(
        identity=str(user.id),
        additional_claims={"role": RoleEnum.MEMBER.value},
    )
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
def pos_setup(app, db_session, bar_staff_user):
    """Setup standard table, shift, category, and items for tests."""
    table = create_table("T1", name="Lounge Table 1", capacity=4)
    table2 = create_table("T2", name="Lounge Table 2", capacity=4)
    shift = start_shift(user_id=bar_staff_user.id, starting_cash=Decimal("500.00"), notes="Morning shift")

    cat = create_menu_category(name="Beverages", slug="beverages", display_order=1)
    cat_food = create_menu_category(name="Food", slug="food", display_order=2)

    item1 = create_menu_item(
        category_id=cat.id,
        code="BEV-SMOOTHIE",
        name="Recovery Smoothie",
        price=Decimal("250.00"),
        tax_rate=Decimal("0.0500"),
    )
    item2 = create_menu_item(
        category_id=cat_food.id,
        code="FOOD-WRAP",
        name="Chicken Wrap",
        price=Decimal("280.00"),
        tax_rate=Decimal("0.0500"),
    )
    return {
        "table": table,
        "table2": table2,
        "shift": shift,
        "item1": item1,
        "item2": item2,
    }


def test_full_pos_lifecycle_and_daily_sales(app, db_session, seeded_plans, bar_staff_user, member_user, pos_setup):
    """Complete workflow:
    Open tab -> Add items -> Kitchen flow -> Member discount (15% Gold) -> 5% GST -> Pay (UPI) -> Close -> Sales recorded.
    """
    _, member = member_user
    # Assign Gold membership
    gold_plan = get_plan_by_code("GOLD")
    assign_membership(member_id=member.id, plan_id=gold_plan.id, start_date=date.today())

    table = pos_setup["table"]
    item1 = pos_setup["item1"]
    item2 = pos_setup["item2"]
    shift = pos_setup["shift"]

    # 1. Open tab
    tab = open_tab(
        table_id=table.id,
        opened_by_user=bar_staff_user,
        member_id=member.id,
        shift_id=shift.id,
    )
    assert tab.status == TabStatus.OPEN
    assert tab.discount_pct == Decimal("15.00")
    assert table.status == TableStatus.OCCUPIED

    # 2. Add items
    add_items_to_tab(
        tab_id=tab.id,
        items_data=[
            {"menu_item_id": item1.id, "quantity": 1},
            {"menu_item_id": item2.id, "quantity": 1},
        ],
        requesting_user=bar_staff_user,
    )

    # Subtotal = 250 + 280 = 530.00
    # Discount (15%) = 37.50 + 42.00 = 79.50
    # Taxable = 212.50 + 238.00 = 450.50
    # 5% GST = 10.62 + 11.90 = 22.52
    # Total = 450.50 + 22.52 = 473.02
    assert tab.subtotal_amount == Decimal("530.00")
    assert tab.discount_amount == Decimal("79.50")
    assert tab.tax_amount == Decimal("22.52")
    assert tab.total_amount == Decimal("473.02")

    # 3. Send to kitchen
    send_tab_to_kitchen(tab_id=tab.id, requesting_user=bar_staff_user)
    for order_item in tab.items:
        assert order_item.kitchen_status == KitchenStatus.QUEUED

    # 4. Advance kitchen status forward
    for order_item in tab.items:
        update_kitchen_item_status(order_item.id, "PREPARING", bar_staff_user)
        assert order_item.kitchen_status == KitchenStatus.PREPARING

        update_kitchen_item_status(order_item.id, "READY", bar_staff_user)
        assert order_item.kitchen_status == KitchenStatus.READY

        update_kitchen_item_status(order_item.id, "SERVED", bar_staff_user)
        assert order_item.kitchen_status == KitchenStatus.SERVED

    # 5. Pay tab via UPI through shared payment foundation
    pay_tab(
        tab_id=tab.id,
        payment_method="UPI",
        amount=Decimal("473.02"),
        staff_user=bar_staff_user,
    )
    assert tab.payment_status == TabPaymentStatus.PAID
    assert tab.status == TabStatus.PAID
    assert tab.paid_amount == Decimal("473.02")

    # 6. Close tab
    close_tab(tab_id=tab.id, staff_user=bar_staff_user)
    assert tab.status == TabStatus.CLOSED
    assert table.status == TableStatus.AVAILABLE

    # 7. Check daily sales report
    report = get_daily_sales_report(target_date=date.today())
    assert report["total_closed_tabs"] == 1
    assert report["total_sales"] == 473.02
    assert report["total_tax_amount"] == 22.52
    assert report["total_discount_amount"] == 79.50
    assert report["by_payment_method"]["UPI"]["amount"] == 473.02
    assert report["by_payment_method"]["UPI"]["count"] == 1
    assert len(report["by_shift"]) == 1
    assert report["by_shift"][0]["total_sales"] == 473.02


def test_second_tab_on_occupied_table_rejected(app, db_session, bar_staff_user, pos_setup):
    """Only one open tab per table; opening a second tab must be rejected."""
    table = pos_setup["table"]
    shift = pos_setup["shift"]

    # Open first tab
    open_tab(
        table_id=table.id,
        opened_by_user=bar_staff_user,
        shift_id=shift.id,
    )
    assert table.status == TableStatus.OCCUPIED

    # Attempt second tab on same table
    with pytest.raises(ConflictException) as exc_info:
        open_tab(
            table_id=table.id,
            opened_by_user=bar_staff_user,
            shift_id=shift.id,
        )
    assert "already occupied" in str(exc_info.value).lower()


def test_member_discounts_matrix_active_vs_expired_vs_guest(app, db_session, seeded_plans, bar_staff_user, member_user, pos_setup):
    """Verify tier discounts: Gold (15%), Silver (10%), Junior (5%), Expired (0%), Guest (0%)."""
    user, member = member_user

    gold_plan = get_plan_by_code("GOLD")
    silver_plan = get_plan_by_code("SILVER")
    junior_plan = get_plan_by_code("JUNIOR")

    # 1. Gold member -> 15%
    ms_gold = assign_membership(member_id=member.id, plan_id=gold_plan.id, start_date=date.today())
    assert get_member_pos_discount_pct(member.id) == Decimal("15.00")

    # 2. Silver member -> 10%
    ms_gold.status = MembershipStatus.CANCELLED
    ms_silver = assign_membership(member_id=member.id, plan_id=silver_plan.id, start_date=date.today())
    assert get_member_pos_discount_pct(member.id) == Decimal("10.00")

    # 3. Junior member -> 5%
    member.date_of_birth = date(date.today().year - 15, 1, 1)
    db.session.commit()
    ms_silver.status = MembershipStatus.CANCELLED
    ms_junior = assign_membership(member_id=member.id, plan_id=junior_plan.id, start_date=date.today())
    assert get_member_pos_discount_pct(member.id) == Decimal("5.00")

    # 4. Expired member -> 0%
    ms_junior.status = MembershipStatus.EXPIRED
    db.session.commit()
    assert get_member_pos_discount_pct(member.id) == Decimal("0.00")

    # 5. Non-member / Walk-in Guest -> 0%
    assert get_member_pos_discount_pct(None) == Decimal("0.00")


def test_price_snapshot_unchanged_after_menu_item_price_change(app, db_session, bar_staff_user, pos_setup):
    """Menu item price adjustments do not alter snapshotted prices on existing tabs."""
    table = pos_setup["table"]
    item = pos_setup["item1"]  # original price: 250.00
    shift = pos_setup["shift"]

    tab = open_tab(table_id=table.id, opened_by_user=bar_staff_user, shift_id=shift.id)
    add_items_to_tab(tab_id=tab.id, items_data=[{"menu_item_id": item.id, "quantity": 1}], requesting_user=bar_staff_user)

    # Change menu item catalog price to 350.00
    item.price = Decimal("350.00")
    db.session.commit()

    # Verify tab item still has 250.00
    db.session.refresh(tab)
    assert tab.items[0].unit_price == Decimal("250.00")
    assert tab.subtotal_amount == Decimal("250.00")


def test_closing_unpaid_tab_rejected(app, db_session, bar_staff_user, pos_setup):
    """A tab cannot be closed until it is fully paid."""
    table = pos_setup["table"]
    item = pos_setup["item1"]
    shift = pos_setup["shift"]

    tab = open_tab(table_id=table.id, opened_by_user=bar_staff_user, shift_id=shift.id)
    add_items_to_tab(tab_id=tab.id, items_data=[{"menu_item_id": item.id, "quantity": 1}], requesting_user=bar_staff_user)

    # Attempt to close without paying
    with pytest.raises(BusinessRuleException) as exc_info:
        close_tab(tab_id=tab.id, staff_user=bar_staff_user)
    assert "fully paid" in str(exc_info.value).lower()
    assert tab.status == TabStatus.OPEN
    assert table.status == TableStatus.OCCUPIED


def test_kitchen_status_transitions_strict_forward_only(app, db_session, bar_staff_user, pos_setup):
    """Kitchen status must move forward in order only (QUEUED -> PREPARING -> READY -> SERVED)."""
    table = pos_setup["table"]
    item = pos_setup["item1"]
    shift = pos_setup["shift"]

    tab = open_tab(table_id=table.id, opened_by_user=bar_staff_user, shift_id=shift.id)
    add_items_to_tab(tab_id=tab.id, items_data=[{"menu_item_id": item.id, "quantity": 1}], requesting_user=bar_staff_user)
    send_tab_to_kitchen(tab_id=tab.id, requesting_user=bar_staff_user)

    order_item = tab.items[0]
    assert order_item.kitchen_status == KitchenStatus.QUEUED

    # 1. Reject backward transition from QUEUED to PENDING
    with pytest.raises(ValidationException):
        update_kitchen_item_status(order_item.id, "PENDING", bar_staff_user)

    # 2. Reject skipping directly from QUEUED to SERVED
    with pytest.raises(ValidationException):
        update_kitchen_item_status(order_item.id, "SERVED", bar_staff_user)

    # 3. Advance to PREPARING
    update_kitchen_item_status(order_item.id, "PREPARING", bar_staff_user)
    assert order_item.kitchen_status == KitchenStatus.PREPARING

    # 4. Reject backward transition from PREPARING to QUEUED
    with pytest.raises(ValidationException):
        update_kitchen_item_status(order_item.id, "QUEUED", bar_staff_user)

    # 5. Advance to READY, then SERVED
    update_kitchen_item_status(order_item.id, "READY", bar_staff_user)
    assert order_item.kitchen_status == KitchenStatus.READY
    update_kitchen_item_status(order_item.id, "SERVED", bar_staff_user)
    assert order_item.kitchen_status == KitchenStatus.SERVED


def test_void_tab_frees_table(app, db_session, bar_staff_user, pos_setup):
    """Voiding a tab cancels the order and frees the table."""
    table = pos_setup["table"]
    item = pos_setup["item1"]
    shift = pos_setup["shift"]

    tab = open_tab(table_id=table.id, opened_by_user=bar_staff_user, shift_id=shift.id)
    add_items_to_tab(tab_id=tab.id, items_data=[{"menu_item_id": item.id, "quantity": 1}], requesting_user=bar_staff_user)
    assert table.status == TableStatus.OCCUPIED

    void_tab(tab_id=tab.id, reason="Customer left before food preparation", staff_user=bar_staff_user)
    assert tab.status == TabStatus.VOIDED
    assert tab.void_reason == "Customer left before food preparation"
    assert table.status == TableStatus.AVAILABLE


def test_api_member_cannot_access_pos_operations(client, member_token, bar_staff_token, pos_setup):
    """Role restriction: Regular member cannot open or manage tabs."""
    table = pos_setup["table"]

    # Member attempt to open tab -> 403 Forbidden
    resp = client.post(
        "/api/v1/pos/tabs",
        headers=member_token,
        json={"table_id": table.id},
    )
    assert resp.status_code == 403

    # Member attempt to list tabs -> 403 Forbidden
    resp = client.get("/api/v1/pos/tabs", headers=member_token)
    assert resp.status_code == 403

    # Bar staff can open tab -> 201 Created
    resp_staff = client.post(
        "/api/v1/pos/tabs",
        headers=bar_staff_token,
        json={"table_id": table.id},
    )
    assert resp_staff.status_code == 201
    assert resp_staff.json["success"] is True


def test_daily_sales_equal_sum_of_closed_tabs_and_payments(app, db_session, bar_staff_user, pos_setup):
    """Daily sales must strictly reconcile with persisted closed tabs and completed payments."""
    table1 = pos_setup["table"]
    table2 = pos_setup["table2"]
    item1 = pos_setup["item1"]  # 250 + 5% = 262.50
    shift = pos_setup["shift"]

    # Tab 1: CASH
    tab1 = open_tab(table_id=table1.id, opened_by_user=bar_staff_user, shift_id=shift.id)
    add_items_to_tab(tab_id=tab1.id, items_data=[{"menu_item_id": item1.id, "quantity": 1}], requesting_user=bar_staff_user)
    pay_tab(tab_id=tab1.id, payment_method="CASH", staff_user=bar_staff_user)
    close_tab(tab_id=tab1.id, staff_user=bar_staff_user)

    # Tab 2: CARD
    tab2 = open_tab(table_id=table2.id, opened_by_user=bar_staff_user, shift_id=shift.id)
    add_items_to_tab(tab_id=tab2.id, items_data=[{"menu_item_id": item1.id, "quantity": 2}], requesting_user=bar_staff_user)
    pay_tab(tab_id=tab2.id, payment_method="CARD", staff_user=bar_staff_user)
    close_tab(tab_id=tab2.id, staff_user=bar_staff_user)

    expected_tab1 = tab1.total_amount
    expected_tab2 = tab2.total_amount
    expected_total = expected_tab1 + expected_tab2

    report = get_daily_sales_report(target_date=date.today())
    assert report["total_closed_tabs"] == 2
    assert Decimal(str(report["total_sales"])) == expected_total
    assert Decimal(str(report["total_payments_collected"])) == expected_total
    assert Decimal(str(report["by_payment_method"]["CASH"]["amount"])) == expected_tab1
    assert Decimal(str(report["by_payment_method"]["CARD"]["amount"])) == expected_tab2
