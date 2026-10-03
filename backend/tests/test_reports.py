"""
Comprehensive Integration Tests for Owner Dashboard and Revenue Reports.
=========================================================================
Tests verify:
1. Empty database behavior (returns zeros, empty lists, no errors)
2. Strict role restrictions (OWNER and ADMIN allowed; MEMBER, FRONT_DESK, etc. forbidden; unauthenticated rejected)
3. Revenue reconciliation with the payments table (paid less refunds, failed & pending excluded)
4. Accurate GST representation across services (18%), shop (18%), and POS F&B (5%)
5. Timezone boundary adherence (Asia/Kolkata day, week, month boundaries)
6. Operational summaries (bookings today, active memberships, open tabs, pending orders, low stock, CRM leads & follow-ups)
7. Excel export task integration
"""

import pytest
from datetime import date, datetime, timedelta, timezone
from decimal import Decimal
from zoneinfo import ZoneInfo
from flask_jwt_extended import create_access_token

from backend.app.extensions import db
from backend.app.common.utils import utc_now
from backend.app.common.permissions import RoleEnum
from backend.app.auth.services import create_user
from backend.app.courts.models import Court, SportType
from backend.app.bookings.models import Booking, BookingStatus
from backend.app.memberships.models import Membership, MembershipPlan, MembershipStatus
from backend.app.members.models import Member
from backend.app.shop.models import ShopOrder, ShopOrderItem, ShopOrderStatus, OrderType, FulfillmentType
from backend.app.pos.models import (
    POSTable,
    POSTab,
    POSMenuItem,
    POSMenuCategory,
    POSOrderItem,
    StaffShift,
    TabStatus,
    TabPaymentStatus,
    ShiftStatus,
)
from backend.app.inventory.models import Product, ProductCategory
from backend.app.crm.models import CRMLead, CRMFollowUp, LeadStatus, FollowUpStatus, LeadSource, FollowUpType
from backend.app.payments.models import (
    Payment,
    PaymentMethod,
    PaymentStatus,
    PaymentItemType,
    generate_payment_reference,
)


@pytest.fixture
def owner_user(app, db_session):
    return create_user(
        email="owner@championsclub.com",
        password="OwnerPassword123!",
        first_name="Club",
        last_name="Owner",
        role=RoleEnum.OWNER,
    )


@pytest.fixture
def owner_token(owner_user):
    token = create_access_token(
        identity=str(owner_user.id),
        additional_claims={"role": RoleEnum.OWNER.value},
    )
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
def admin_user(app, db_session):
    return create_user(
        email="admin@championsclub.com",
        password="AdminPassword123!",
        first_name="Club",
        last_name="Admin",
        role=RoleEnum.ADMIN,
    )


@pytest.fixture
def admin_token(admin_user):
    token = create_access_token(
        identity=str(admin_user.id),
        additional_claims={"role": RoleEnum.ADMIN.value},
    )
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
def member_user(app, db_session):
    return create_user(
        email="member@championsclub.com",
        password="MemberPassword123!",
        first_name="John",
        last_name="Member",
        role=RoleEnum.MEMBER,
    )


@pytest.fixture
def member_token(member_user):
    token = create_access_token(
        identity=str(member_user.id),
        additional_claims={"role": RoleEnum.MEMBER.value},
    )
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
def front_desk_user(app, db_session):
    return create_user(
        email="desk@championsclub.com",
        password="DeskPassword123!",
        first_name="Front",
        last_name="Desk",
        role=RoleEnum.FRONT_DESK,
    )


@pytest.fixture
def front_desk_token(front_desk_user):
    token = create_access_token(
        identity=str(front_desk_user.id),
        additional_claims={"role": RoleEnum.FRONT_DESK.value},
    )
    return {"Authorization": f"Bearer {token}"}


# ---------------------------------------------------------------------------
# 1. EMPTY DATABASE RETURNS ZEROS, NOT ERRORS
# ---------------------------------------------------------------------------

def test_empty_database_returns_zeros(client, owner_token):
    """An empty database returns 200 OK with zeros, empty arrays, and valid metadata."""
    endpoints = [
        "/api/v1/reports/overview",
        "/api/v1/reports/dashboard",
        "/api/v1/reports/revenue",
        "/api/v1/reports/courts",
        "/api/v1/reports/shop",
        "/api/v1/reports/bar",
        "/api/v1/reports/memberships",
        "/api/v1/reports/operations",
    ]

    for ep in endpoints:
        res = client.get(ep, headers=owner_token)
        assert res.status_code == 200, f"Endpoint {ep} failed on empty database: {res.get_json()}"
        data = res.get_json()
        assert data["success"] is True

    # Check overview content on empty DB
    res = client.get("/api/v1/reports/overview", headers=owner_token)
    payload = res.get_json()["data"]
    assert payload["financial_summary"]["gross_revenue"] == 0.0
    assert payload["financial_summary"]["net_revenue"] == 0.0
    assert payload["financial_summary"]["tax_amount"] == 0.0
    assert payload["financial_summary"]["transactions_count"] == 0
    assert payload["financial_summary"]["refunds_count"] == 0
    assert payload["operational_snapshot"]["bookings_today"] == 0
    assert payload["operational_snapshot"]["active_members"] == 0
    assert payload["operational_snapshot"]["open_bar_tabs"] == 0

    # Check operations content on empty DB
    res_ops = client.get("/api/v1/reports/operations", headers=owner_token)
    ops = res_ops.get_json()["data"]
    assert ops["bookings_today"]["count"] == 0
    assert ops["bookings_today"]["items"] == []
    assert ops["active_memberships"]["total_active"] == 0
    assert ops["open_bar_tabs"]["count"] == 0
    assert ops["low_stock"]["count"] == 0
    assert ops["new_leads"]["count"] == 0
    assert ops["pending_follow_ups"]["count"] == 0


# ---------------------------------------------------------------------------
# 2. ROLE RESTRICTIONS
# ---------------------------------------------------------------------------

def test_role_restrictions(client, owner_token, admin_token, member_token, front_desk_token):
    """OWNER and ADMIN are allowed; MEMBER and staff roles are forbidden (403); unauthenticated (401)."""
    endpoint = "/api/v1/reports/overview"

    # 1. Unauthenticated -> 401
    res = client.get(endpoint)
    assert res.status_code == 401

    # 2. Member -> 403 Forbidden
    res = client.get(endpoint, headers=member_token)
    assert res.status_code == 403

    # 3. Front Desk -> 403 Forbidden
    res = client.get(endpoint, headers=front_desk_token)
    assert res.status_code == 403

    # 4. Admin -> 200 OK
    res = client.get(endpoint, headers=admin_token)
    assert res.status_code == 200

    # 5. Owner -> 200 OK
    res = client.get(endpoint, headers=owner_token)
    assert res.status_code == 200


# ---------------------------------------------------------------------------
# 3. REVENUE RECONCILIATION WITH PAYMENTS TABLE & GST CALCULATION
# ---------------------------------------------------------------------------

def test_revenue_reconciliation_and_gst(client, owner_token, db_session):
    """
    Assert that revenue reconciles with the payments table:
    - Paid payments are summed
    - Refunded payments are deducted
    - Pending and failed payments are excluded
    - GST is correctly calculated (18% for courts/membership/shop, 5% for bar)
    - Net revenue + GST equals Gross Revenue
    """
    now = utc_now()

    # 1. Court booking payment: 1180 INR (PAID, CASH, 18% GST -> Net 1000.00, GST 180.00)
    p_court = Payment(
        payment_reference="PAY-COURT-01",
        amount=Decimal("1180.00"),
        currency="INR",
        payment_method=PaymentMethod.CASH,
        status=PaymentStatus.PAID,
        item_type=PaymentItemType.BOOKING,
        item_id=101,
        paid_at=now,
    )

    # 2. Membership payment: 23600 INR (PAID, ONLINE, 18% GST -> Net 20000.00, GST 3600.00)
    p_member = Payment(
        payment_reference="PAY-MEM-01",
        amount=Decimal("23600.00"),
        currency="INR",
        payment_method=PaymentMethod.ONLINE,
        status=PaymentStatus.PAID,
        item_type=PaymentItemType.MEMBERSHIP,
        item_id=201,
        paid_at=now,
    )

    # 3. Shop order payment: 1180 INR (PAID, UPI, 18% GST -> Net 1000.00, GST 180.00)
    p_shop = Payment(
        payment_reference="PAY-SHOP-01",
        amount=Decimal("1180.00"),
        currency="INR",
        payment_method=PaymentMethod.UPI,
        status=PaymentStatus.PAID,
        item_type=PaymentItemType.SHOP_ORDER,
        item_id=301,
        paid_at=now,
    )

    # 4. Bar POS payment: 1050 INR (PAID, CARD, 5% GST -> Net 1000.00, GST 50.00)
    p_bar = Payment(
        payment_reference="PAY-BAR-01",
        amount=Decimal("1050.00"),
        currency="INR",
        payment_method=PaymentMethod.CARD,
        status=PaymentStatus.PAID,
        item_type=PaymentItemType.POS_ORDER,
        item_id=401,
        paid_at=now,
    )

    # 5. Refunded payment: 500 INR (REFUNDED, CASH, Courts) -> Deducted from gross
    p_refunded = Payment(
        payment_reference="PAY-REFUND-01",
        amount=Decimal("500.00"),
        currency="INR",
        payment_method=PaymentMethod.CASH,
        status=PaymentStatus.REFUNDED,
        item_type=PaymentItemType.BOOKING,
        item_id=102,
        paid_at=now,
        refunded_at=now,
    )

    # 6. Failed payment: 999 INR -> EXCLUDED
    p_failed = Payment(
        payment_reference="PAY-FAILED-01",
        amount=Decimal("999.00"),
        currency="INR",
        payment_method=PaymentMethod.UPI,
        status=PaymentStatus.FAILED,
        item_type=PaymentItemType.BOOKING,
        item_id=103,
        paid_at=None,
    )

    # 7. Pending payment: 5000 INR -> EXCLUDED
    p_pending = Payment(
        payment_reference="PAY-PENDING-01",
        amount=Decimal("5000.00"),
        currency="INR",
        payment_method=PaymentMethod.ONLINE,
        status=PaymentStatus.PENDING,
        item_type=PaymentItemType.MEMBERSHIP,
        item_id=202,
        paid_at=None,
    )

    db_session.add_all([p_court, p_member, p_shop, p_bar, p_refunded, p_failed, p_pending])
    db_session.commit()

    # Query overview
    res = client.get("/api/v1/reports/overview?period=today", headers=owner_token)
    assert res.status_code == 200
    data = res.get_json()["data"]

    financial = data["financial_summary"]
    # Total Gross Paid = 1180 + 23600 + 1180 + 1050 = 27010.00
    # Total Refunded = 500.00
    # Expected Gross Revenue = 27010.00 - 500.00 = 26510.00
    assert financial["paid_amount"] == 27010.0
    assert financial["refunded_amount"] == 500.0
    assert financial["gross_revenue"] == 26510.0
    assert financial["transactions_count"] == 4
    assert financial["refunds_count"] == 1

    # Verify reconciliation: gross_revenue == net_revenue + tax_amount (within 1 cent rounding)
    assert abs(financial["gross_revenue"] - (financial["net_revenue"] + financial["tax_amount"])) < 0.05

    # Check breakdown by stream
    streams = data["stream_breakdown"]
    assert streams["courts"]["gross_revenue"] == 1180.0 - 500.0  # 680.0
    assert streams["courts"]["refunded_amount"] == 500.0
    assert streams["memberships"]["gross_revenue"] == 23600.0
    assert streams["shop"]["gross_revenue"] == 1180.0
    assert streams["bar"]["gross_revenue"] == 1050.0

    # Bar 5% GST check: 1050 / 1.05 = 1000.00 Net, 50.00 GST
    assert streams["bar"]["net_revenue"] == 1000.0
    assert streams["bar"]["tax_amount"] == 50.0

    # Check payment methods
    methods = data["payment_methods"]
    assert methods["ONLINE"]["gross_revenue"] == 23600.0
    assert methods["CARD"]["gross_revenue"] == 1050.0
    assert methods["UPI"]["gross_revenue"] == 1180.0
    assert methods["CASH"]["gross_revenue"] == 1180.0 - 500.0  # 680.0


# ---------------------------------------------------------------------------
# 4. TIMEZONE BOUNDARY BEHAVIOR (Asia/Kolkata)
# ---------------------------------------------------------------------------

def test_timezone_boundaries(client, owner_token, db_session):
    """
    Test day/week boundaries in Asia/Kolkata timezone:
    Asia/Kolkata is UTC+05:30.
    A payment at 19:00 UTC on Day 1 is 00:30 on Day 2 in Kolkata.
    It must belong to Day 2 when queried in local time.
    """
    club_tz = ZoneInfo("Asia/Kolkata")
    now_kolkata = datetime.now(club_tz)
    today_date = now_kolkata.date()
    yesterday_date = today_date - timedelta(days=1)

    # Create a payment at 01:00 AM Kolkata today
    dt_today_kolkata = datetime.combine(today_date, datetime.min.time(), tzinfo=club_tz) + timedelta(hours=1)
    dt_today_utc = dt_today_kolkata.astimezone(timezone.utc)

    # Create a payment at 23:00 PM Kolkata yesterday
    dt_yesterday_kolkata = datetime.combine(yesterday_date, datetime.min.time(), tzinfo=club_tz) + timedelta(hours=23)
    dt_yesterday_utc = dt_yesterday_kolkata.astimezone(timezone.utc)

    p_today = Payment(
        payment_reference="PAY-TZ-TODAY",
        amount=Decimal("1000.00"),
        currency="INR",
        payment_method=PaymentMethod.UPI,
        status=PaymentStatus.PAID,
        item_type=PaymentItemType.BOOKING,
        item_id=501,
        paid_at=dt_today_utc,
    )

    p_yesterday = Payment(
        payment_reference="PAY-TZ-YESTERDAY",
        amount=Decimal("2000.00"),
        currency="INR",
        payment_method=PaymentMethod.CASH,
        status=PaymentStatus.PAID,
        item_type=PaymentItemType.BOOKING,
        item_id=502,
        paid_at=dt_yesterday_utc,
    )

    db_session.add_all([p_today, p_yesterday])
    db_session.commit()

    # Query "today" in local timezone
    res = client.get("/api/v1/reports/overview?period=today", headers=owner_token)
    assert res.status_code == 200
    today_data = res.get_json()["data"]

    # Only p_today should be in today's performance
    assert today_data["financial_summary"]["gross_revenue"] == 1000.0
    assert today_data["financial_summary"]["transactions_count"] == 1

    # Query custom date range for yesterday
    res_yest = client.get(
        f"/api/v1/reports/overview?start_date={yesterday_date.isoformat()}&end_date={yesterday_date.isoformat()}",
        headers=owner_token,
    )
    assert res_yest.status_code == 200
    yest_data = res_yest.get_json()["data"]
    assert yest_data["financial_summary"]["gross_revenue"] == 2000.0
    assert yest_data["financial_summary"]["transactions_count"] == 1


# ---------------------------------------------------------------------------
# 5. DETAILED DOMAIN REPORTS (Courts, Shop, Bar, Memberships)
# ---------------------------------------------------------------------------

def test_courts_revenue_report(client, owner_token, db_session):
    """Test /api/v1/reports/courts returns sport breakdown and booking utilization."""
    court = Court(
        name="Tennis Court 1",
        sport_type=SportType.LAWN_TENNIS,
    )
    db_session.add(court)
    db_session.flush()

    today = date.today()
    booking = Booking(
        booking_reference="BK-REP-01",
        court_id=court.id,
        booking_date=today,
        start_time=utc_now(),
        end_time=utc_now() + timedelta(hours=1),
        status=BookingStatus.CONFIRMED,
        base_price=Decimal("800.00"),
        final_price=Decimal("800.00"),
    )
    db_session.add(booking)
    db_session.flush()

    # Associated paid payment (reconciliation)
    payment = Payment(
        payment_reference="PAY-BK-01",
        amount=Decimal("800.00"),
        currency="INR",
        payment_method=PaymentMethod.UPI,
        status=PaymentStatus.PAID,
        item_type=PaymentItemType.BOOKING,
        item_id=booking.id,
        paid_at=utc_now(),
    )
    db_session.add(payment)
    db_session.commit()

    res = client.get("/api/v1/reports/courts?period=today", headers=owner_token)
    assert res.status_code == 200
    data = res.get_json()["data"]

    assert data["financial_summary"]["gross_revenue"] == 800.0
    tennis_entry = next((s for s in data["by_sport"] if s["sport"] in ("LAWN_TENNIS", "TENNIS")), None)
    assert tennis_entry is not None
    assert tennis_entry["bookings_count"] == 1


def test_shop_revenue_report(client, owner_token, db_session):
    """Test /api/v1/reports/shop returns sales channels and top products."""
    cat = ProductCategory(name="Rackets", slug="rackets")
    db_session.add(cat)
    db_session.flush()

    prod = Product(
        sku="RKT-PRO-01",
        name="Wilson Pro Staff",
        price=Decimal("15000.00"),
        category_id=cat.id,
        stock_quantity=10,
    )
    db_session.add(prod)
    db_session.flush()

    order = ShopOrder(
        order_reference="ORD-REP-01",
        order_type=OrderType.COUNTER,
        fulfillment_type=FulfillmentType.PICKUP,
        status=ShopOrderStatus.COMPLETED,
        customer_name="Alice Smith",
        subtotal_amount=Decimal("15000.00"),
        total_amount=Decimal("15000.00"),
    )
    db_session.add(order)
    db_session.flush()

    order_item = ShopOrderItem(
        order_id=order.id,
        product_id=prod.id,
        product_sku=prod.sku,
        product_name=prod.name,
        unit_price=prod.price,
        quantity=1,
        total_price=prod.price,
    )
    db_session.add(order_item)

    payment = Payment(
        payment_reference="PAY-ORD-01",
        amount=Decimal("15000.00"),
        currency="INR",
        payment_method=PaymentMethod.CARD,
        status=PaymentStatus.PAID,
        item_type=PaymentItemType.SHOP_ORDER,
        item_id=order.id,
        paid_at=utc_now(),
    )
    db_session.add(payment)
    db_session.commit()

    res = client.get("/api/v1/reports/shop?period=month", headers=owner_token)
    assert res.status_code == 200
    data = res.get_json()["data"]

    assert data["financial_summary"]["gross_revenue"] == 15000.0
    assert data["orders_summary"]["counter_orders"] == 1
    assert data["orders_summary"]["completed_orders"] == 1
    assert len(data["top_selling_products"]) == 1
    assert data["top_selling_products"][0]["product_sku"] == "RKT-PRO-01"


def test_bar_revenue_report(client, owner_token, db_session, admin_user):
    """Test /api/v1/reports/bar returns tab statistics and top menu items."""
    table = POSTable(table_number="T1", capacity=4)
    db_session.add(table)
    db_session.flush()

    shift = StaffShift(shift_reference="SFT-01", user_id=admin_user.id, starting_cash=Decimal("500.00"))
    db_session.add(shift)
    db_session.flush()

    cat = POSMenuCategory(name="Beverages", slug="beverages")
    db_session.add(cat)
    db_session.flush()

    menu_item = POSMenuItem(
        category_id=cat.id,
        code="BV-01",
        name="Espresso",
        price=Decimal("150.00"),
        tax_rate=Decimal("0.0500"),
    )
    db_session.add(menu_item)
    db_session.flush()

    tab = POSTab(
        tab_reference="TAB-REP-01",
        table_id=table.id,
        shift_id=shift.id,
        opened_by_user_id=admin_user.id,
        customer_name="Bob Bar",
        status=TabStatus.CLOSED,
        subtotal_amount=Decimal("300.00"),
        tax_amount=Decimal("15.00"),
        total_amount=Decimal("315.00"),
        paid_amount=Decimal("315.00"),
        payment_status=TabPaymentStatus.PAID,
    )
    db_session.add(tab)
    db_session.flush()

    order_item = POSOrderItem(
        tab_id=tab.id,
        menu_item_id=menu_item.id,
        item_name=menu_item.name,
        unit_price=Decimal("150.00"),
        quantity=2,
        subtotal_amount=Decimal("300.00"),
        total_amount=Decimal("315.00"),
    )
    db_session.add(order_item)

    payment = Payment(
        payment_reference="PAY-TAB-01",
        amount=Decimal("315.00"),
        currency="INR",
        payment_method=PaymentMethod.UPI,
        status=PaymentStatus.PAID,
        item_type=PaymentItemType.POS_ORDER,
        item_id=tab.id,
        paid_at=utc_now(),
    )
    db_session.add(payment)
    db_session.commit()

    res = client.get("/api/v1/reports/bar?period=month", headers=owner_token)
    assert res.status_code == 200
    data = res.get_json()["data"]

    assert data["financial_summary"]["gross_revenue"] == 315.0
    assert data["financial_summary"]["gst_rate"] == 0.05
    assert data["tabs_summary"]["closed_tabs"] == 1
    assert len(data["top_menu_items"]) == 1
    assert data["top_menu_items"][0]["item_name"] == "Espresso"


def test_memberships_revenue_report(client, owner_token, db_session, member_user):
    """Test /api/v1/reports/memberships returns plan distributions and revenue."""
    member = Member(user_id=member_user.id, phone="9876543210")
    db_session.add(member)
    db_session.flush()

    plan = MembershipPlan(
        code="GOLD",
        name="Gold Annual Plan",
        displayed_monthly_price=Decimal("2000.00"),
        duration_months=12,
        complimentary_months=2,
    )
    db_session.add(plan)
    db_session.flush()

    today = date.today()
    membership = Membership(
        member_id=member.id,
        plan_id=plan.id,
        start_date=today,
        end_date=today + timedelta(days=365),
        status=MembershipStatus.ACTIVE,
        price_paid=Decimal("20000.00"),
    )
    db_session.add(membership)
    db_session.flush()

    payment = Payment(
        payment_reference="PAY-MEM-PLAN-01",
        amount=Decimal("20000.00"),
        currency="INR",
        payment_method=PaymentMethod.ONLINE,
        status=PaymentStatus.PAID,
        item_type=PaymentItemType.MEMBERSHIP,
        item_id=membership.id,
        paid_at=utc_now(),
    )
    db_session.add(payment)
    db_session.commit()

    res = client.get("/api/v1/reports/memberships?period=month", headers=owner_token)
    assert res.status_code == 200
    data = res.get_json()["data"]

    assert data["financial_summary"]["gross_revenue"] == 20000.0
    assert data["subscription_summary"]["total_active_memberships"] == 1
    assert data["subscription_summary"]["active_by_plan"]["GOLD"] == 1


# ---------------------------------------------------------------------------
# 6. OPERATIONAL SUMMARIES WITH ALL 8 REAL ENTITIES
# ---------------------------------------------------------------------------

def test_operational_summary_real_entities(client, owner_token, db_session, admin_user, member_user):
    """Test operational summary accurately tracks all 8 requested operational metrics."""
    today = date.today()

    # 1. Booking today (active) and cancelled booking
    court = Court(name="Badminton Court 1", sport_type=SportType.BADMINTON)
    db_session.add(court)
    db_session.flush()

    b_active = Booking(
        court_id=court.id,
        booking_date=today,
        start_time=utc_now(),
        end_time=utc_now() + timedelta(hours=1),
        status=BookingStatus.CONFIRMED,
        base_price=Decimal("1200.00"),
        final_price=Decimal("1200.00"),
    )
    b_cancelled = Booking(
        court_id=court.id,
        booking_date=today,
        start_time=utc_now() + timedelta(hours=2),
        end_time=utc_now() + timedelta(hours=3),
        status=BookingStatus.CANCELLED,
        base_price=Decimal("1200.00"),
        final_price=Decimal("1200.00"),
    )
    db_session.add_all([b_active, b_cancelled])

    # 2. Active memberships by plan + expiring soon
    member = Member(user_id=member_user.id, phone="9988776655")
    db_session.add(member)
    db_session.flush()

    plan_silver = MembershipPlan(
        code="SILVER",
        name="Silver Plan",
        displayed_monthly_price=Decimal("1000.00"),
    )
    db_session.add(plan_silver)
    db_session.flush()

    # Membership expiring in 5 days (<= 7 days milestone)
    m_expiring = Membership(
        member_id=member.id,
        plan_id=plan_silver.id,
        start_date=today - timedelta(days=360),
        end_date=today + timedelta(days=5),
        status=MembershipStatus.ACTIVE,
    )
    db_session.add(m_expiring)

    # 3. Open bar tab
    table = POSTable(table_number="T2", capacity=2)
    db_session.add(table)
    db_session.flush()

    shift = StaffShift(shift_reference="SFT-OPS", user_id=admin_user.id, starting_cash=Decimal("100.00"))
    db_session.add(shift)
    db_session.flush()

    tab_open = POSTab(
        tab_reference="TAB-OPEN-01",
        table_id=table.id,
        shift_id=shift.id,
        opened_by_user_id=admin_user.id,
        customer_name="Open Guest",
        status=TabStatus.OPEN,
        total_amount=Decimal("450.00"),
        paid_amount=Decimal("0.00"),
    )
    db_session.add(tab_open)

    # 4. Pending shop order
    order_pending = ShopOrder(
        order_reference="ORD-PEND-01",
        status=ShopOrderStatus.PENDING,
        customer_name="Pending Customer",
        total_amount=Decimal("2500.00"),
    )
    db_session.add(order_pending)

    # 5. Low stock product
    cat = ProductCategory(name="Balls", slug="balls")
    db_session.add(cat)
    db_session.flush()

    prod_low = Product(
        sku="BALL-CAN",
        name="Tennis Balls Can",
        price=Decimal("450.00"),
        category_id=cat.id,
        stock_quantity=3,
        low_stock_threshold=5,
    )
    prod_ok = Product(
        sku="BALL-BOX",
        name="Tennis Balls Box",
        price=Decimal("3000.00"),
        category_id=cat.id,
        stock_quantity=50,
        low_stock_threshold=5,
    )
    db_session.add_all([prod_low, prod_ok])

    # 6. New CRM lead & pending follow-up
    lead_new = CRMLead(
        lead_reference="LED-TEST-01",
        first_name="Jane",
        last_name="Prospect",
        email="jane.lead@example.com",
        phone="9123456780",
        source=LeadSource.WEBSITE,
        status=LeadStatus.NEW,
    )
    db_session.add(lead_new)
    db_session.flush()

    follow_up = CRMFollowUp(
        lead_id=lead_new.id,
        assigned_staff_id=admin_user.id,
        follow_up_type=FollowUpType.CALL,
        scheduled_date=utc_now() + timedelta(hours=2),
        status=FollowUpStatus.PENDING,
        notes="Call prospect about Silver plan",
    )
    db_session.add(follow_up)
    db_session.commit()

    # Call operations endpoint
    res = client.get("/api/v1/reports/operations", headers=owner_token)
    assert res.status_code == 200
    ops = res.get_json()["data"]

    # 1. Bookings today (only confirmed, not cancelled)
    assert ops["bookings_today"]["count"] == 1
    assert ops["bookings_today"]["items"][0]["booking_reference"] == b_active.booking_reference

    # 2. Active memberships
    assert ops["active_memberships"]["total_active"] == 1
    assert ops["active_memberships"]["by_plan"]["SILVER"] == 1

    # 3. Expiring soon
    assert ops["memberships_expiring_soon"]["expiring_within_7_days_count"] == 1
    assert ops["memberships_expiring_soon"]["expiring_within_30_days_count"] == 1

    # 4. Open bar tab
    assert ops["open_bar_tabs"]["count"] == 1
    assert ops["open_bar_tabs"]["total_unpaid_balance"] == 450.0

    # 5. Pending shop orders
    assert ops["pending_shop_orders"]["count"] == 1

    # 6. Low stock products
    assert ops["low_stock"]["count"] == 1
    assert ops["low_stock"]["items"][0]["sku"] == "BALL-CAN"

    # 7. New CRM leads
    assert ops["new_leads"]["count"] == 1
    assert ops["new_leads"]["items"][0]["full_name"] == "Jane Prospect"

    # 8. Pending follow-ups
    assert ops["pending_follow_ups"]["count"] == 1


# ---------------------------------------------------------------------------
# 7. EXCEL EXPORT ENDPOINT INTEGRATION
# ---------------------------------------------------------------------------

def test_excel_export_endpoint(client, owner_token):
    """Test POST /api/v1/reports/export successfully queues an Excel report task."""
    # REVENUE export
    res = client.post(
        "/api/v1/reports/export",
        json={"export_type": "REVENUE", "period": "month"},
        headers=owner_token,
    )
    assert res.status_code == 202
    data = res.get_json()["data"]
    assert data["status"] == "QUEUED"
    assert data["export_type"] == "REVENUE"
    assert "task_id" in data

    # BOOKINGS export
    res_bk = client.post(
        "/api/v1/reports/export",
        json={"export_type": "BOOKINGS"},
        headers=owner_token,
    )
    assert res_bk.status_code == 202

    # Invalid export type validation
    res_inv = client.post(
        "/api/v1/reports/export",
        json={"export_type": "INVALID_SCHEMA"},
        headers=owner_token,
    )
    assert res_inv.status_code == 422
    assert res_inv.get_json()["error"]["code"] == "INVALID_EXPORT_TYPE"
