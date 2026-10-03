from decimal import Decimal
from datetime import date, datetime, timedelta
import pytest
from flask_jwt_extended import create_access_token
from backend.app.extensions import db
from backend.app.common.permissions import RoleEnum
from backend.app.common.errors import (
    ValidationException,
    ConflictException,
    ForbiddenException,
    InsufficientStockException,
    BusinessRuleException,
    NotFoundException,
)
from backend.app.auth.models import User
from backend.app.auth.services import create_user
from backend.app.members.models import Member
from backend.app.members.services import create_member
from backend.app.memberships.models import MembershipPlan, Membership, MembershipStatus
from backend.app.memberships.services import seed_membership_plans, assign_membership
from backend.app.inventory.models import ProductCategory, Product, InventoryMovement, MovementType
from backend.app.inventory.services import create_category, create_product, update_product, get_product
from backend.app.payments.models import Payment, PaymentStatus
from backend.app.payments.providers import FakePaymentProvider, set_payment_provider
from backend.app.payments.services import get_payment_for_item
from backend.app.shop.models import ShopOrder, ShopOrderItem, OrderType, FulfillmentType, ShopOrderStatus
from backend.app.shop.services import (
    create_shop_order,
    update_order_status,
    cancel_shop_order,
    get_shop_order,
    calculate_item_discount_pct,
    calculate_shop_quote,
)


def auth_header(user: User) -> dict:
    """Generate JWT authorization header for the given user."""
    token = create_access_token(identity=user)
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture(autouse=True)
def setup_fake_provider():
    """Inject FakePaymentProvider for all tests by default."""
    fake_prov = FakePaymentProvider(
        key_id="rzp_test_fake_key_shop",
        key_secret="fake_secret_key_shop",
        webhook_secret="fake_webhook_secret_shop",
    )
    set_payment_provider(fake_prov)
    yield fake_prov
    set_payment_provider(None)


@pytest.fixture
def seed_plans(app, db_session):
    """Seed Gold, Silver, and Junior membership plans."""
    return seed_membership_plans()


@pytest.fixture
def owner_user(app, db_session):
    return create_user(
        email="owner.shop@club.com",
        password="Password123!",
        first_name="Club",
        last_name="Owner",
        role=RoleEnum.OWNER,
    )


@pytest.fixture
def shop_staff_user(app, db_session):
    return create_user(
        email="staff.shop@club.com",
        password="Password123!",
        first_name="Shop",
        last_name="Staff",
        role=RoleEnum.SHOP_STAFF,
    )


@pytest.fixture
def front_desk_user(app, db_session):
    return create_user(
        email="frontdesk.shop@club.com",
        password="Password123!",
        first_name="Front",
        last_name="Desk",
        role=RoleEnum.FRONT_DESK,
    )


@pytest.fixture
def gold_member_user(app, db_session, seed_plans):
    """Create a Gold tier member."""
    user = create_user(
        email="gold.shop@club.com",
        password="Password123!",
        first_name="Gold",
        last_name="Shopper",
        role=RoleEnum.MEMBER,
    )
    member = create_member(user_id=user.id, phone="9876500001")
    plan = MembershipPlan.query.filter_by(code="GOLD").first()
    assign_membership(
        member_id=member.id,
        plan_id=plan.id,
        start_date=date(2026, 1, 1),
        duration_months=12,
    )
    return user, member


@pytest.fixture
def silver_member_user(app, db_session, seed_plans):
    """Create a Silver tier member."""
    user = create_user(
        email="silver.shop@club.com",
        password="Password123!",
        first_name="Silver",
        last_name="Shopper",
        role=RoleEnum.MEMBER,
    )
    member = create_member(user_id=user.id, phone="9876500002")
    plan = MembershipPlan.query.filter_by(code="SILVER").first()
    assign_membership(
        member_id=member.id,
        plan_id=plan.id,
        start_date=date(2026, 1, 1),
        duration_months=12,
    )
    return user, member


@pytest.fixture
def junior_member_user(app, db_session, seed_plans):
    """Create a Junior tier member."""
    user = create_user(
        email="junior.shop@club.com",
        password="Password123!",
        first_name="Junior",
        last_name="Shopper",
        role=RoleEnum.MEMBER,
    )
    member = create_member(
        user_id=user.id,
        phone="9876500003",
        date_of_birth=date(2012, 5, 10),  # Under 18
    )
    plan = MembershipPlan.query.filter_by(code="JUNIOR").first()
    assign_membership(
        member_id=member.id,
        plan_id=plan.id,
        start_date=date(2026, 1, 1),
        duration_months=12,
    )
    return user, member


@pytest.fixture
def expired_member_user(app, db_session, seed_plans):
    """Create a member with an expired membership."""
    user = create_user(
        email="expired.shop@club.com",
        password="Password123!",
        first_name="Expired",
        last_name="Shopper",
        role=RoleEnum.MEMBER,
    )
    member = create_member(user_id=user.id, phone="9876500004")
    plan = MembershipPlan.query.filter_by(code="GOLD").first()
    # Expired in 2025
    assign_membership(
        member_id=member.id,
        plan_id=plan.id,
        start_date=date(2025, 1, 1),
        duration_months=6,
    )
    return user, member


@pytest.fixture
def test_catalog(app, db_session):
    """Seed categories and products for testing."""
    cat_rackets = create_category(name="Rackets", slug="rackets")
    cat_balls = create_category(name="Balls", slug="balls")
    cat_shoes = create_category(name="Shoes", slug="shoes")
    cat_apparel = create_category(name="Apparel", slug="apparel")
    cat_accessories = create_category(name="Accessories", slug="accessories")

    p_racket = create_product(
        sku="TEST-RCK-01",
        name="Wilson Pro Staff 97",
        category_id=cat_rackets.id,
        price=10000.00,
        cost_price=7000.00,
        stock_quantity=10,
    )
    p_ball = create_product(
        sku="TEST-BAL-01",
        name="US Open Tennis Balls (Can of 3)",
        category_id=cat_balls.id,
        price=500.00,
        cost_price=300.00,
        stock_quantity=50,
    )
    p_shoe = create_product(
        sku="TEST-SHOE-01",
        name="Asics Court FF 3 Footwear",
        category_id=cat_shoes.id,
        price=6000.00,
        cost_price=4000.00,
        stock_quantity=10,
    )
    p_polo = create_product(
        sku="TEST-APP-01",
        name="Champions Club Team Polo",
        category_id=cat_apparel.id,
        price=1000.00,
        cost_price=500.00,
        stock_quantity=20,
    )
    p_strings = create_product(
        sku="TEST-ACC-01",
        name="Luxilon ALU Power Stringing Reel",
        category_id=cat_accessories.id,
        price=1200.00,
        cost_price=700.00,
        stock_quantity=15,
    )

    return {
        "racket": p_racket,
        "ball": p_ball,
        "shoe": p_shoe,
        "polo": p_polo,
        "strings": p_strings,
    }


# ---------------------------------------------------------
# Test Cases
# ---------------------------------------------------------

def test_counter_and_online_orders_reduce_same_stock(app, db_session, test_catalog, shop_staff_user, gold_member_user):
    """Counter and online orders both reduce the same underlying inventory source."""
    racket = test_catalog["racket"]
    assert racket.stock_quantity == 10
    user, member = gold_member_user

    # 1. Counter Order (Walk-in counter sale)
    counter_order = create_shop_order(
        order_type="COUNTER",
        fulfillment_type="PICKUP",
        items_data=[{"product_id": racket.id, "quantity": 3}],
        customer_name="Walk-in Guest",
        payment_method="CASH",
        requesting_user=shop_staff_user,
    )
    assert counter_order.status == ShopOrderStatus.CONFIRMED
    assert counter_order.payment_status == "PAID"
    # Stock reduced from 10 to 7
    reloaded_racket = get_product(racket.id)
    assert reloaded_racket.stock_quantity == 7

    # 2. Online Order (by Gold member)
    online_order = create_shop_order(
        order_type="ONLINE",
        fulfillment_type="PICKUP",
        items_data=[{"product_id": racket.id, "quantity": 2}],
        member_id=member.id,
        requesting_user=user,
    )
    assert online_order.status == ShopOrderStatus.PENDING
    assert online_order.payment_status == "PENDING"
    # Stock reduced from 7 to 5
    reloaded_racket_2 = get_product(racket.id)
    assert reloaded_racket_2.stock_quantity == 5


def test_insufficient_stock_rolls_back_whole_order(app, db_session, test_catalog, shop_staff_user):
    """If any product has insufficient stock, the transaction rolls back and leaves all stock intact."""
    racket = test_catalog["racket"]  # stock 10
    shoe = test_catalog["shoe"]      # stock 10

    initial_orders_count = ShopOrder.query.count()

    # Attempt to order 2 rackets (available: 10) and 25 shoes (available: 10)
    with pytest.raises(InsufficientStockException) as exc_info:
        create_shop_order(
            order_type="COUNTER",
            fulfillment_type="PICKUP",
            items_data=[
                {"product_id": racket.id, "quantity": 2},
                {"product_id": shoe.id, "quantity": 25},
            ],
            customer_name="Overdemand Customer",
            requesting_user=shop_staff_user,
        )

    assert "INSUFFICIENT_STOCK" in str(exc_info.value.code)

    # Verify no stock was deducted from racket or shoe
    assert get_product(racket.id).stock_quantity == 10
    assert get_product(shoe.id).stock_quantity == 10
    # Verify no order was saved
    assert ShopOrder.query.count() == initial_orders_count


def test_member_discounts_matrix_and_uncovered_products(
    app, db_session, test_catalog, gold_member_user, silver_member_user, junior_member_user, expired_member_user, shop_staff_user
):
    """Test updated discounts:
    Gold: 20% on apparel, strings & gear
    Silver: 10% on Pro Shop equipment & apparel
    Junior: 15% on junior racket stringing, balls & footwear
    Uncovered products receive 0%.
    Expired members receive 0%.
    """
    gold_user, gold_member = gold_member_user
    silver_user, silver_member = silver_member_user
    junior_user, junior_member = junior_member_user
    expired_user, expired_member = expired_member_user

    p_polo = test_catalog["polo"]       # Apparel (₹1000)
    p_racket = test_catalog["racket"]   # Racket/Gear (₹10000)
    p_ball = test_catalog["ball"]       # Balls (₹500)
    p_shoe = test_catalog["shoe"]       # Shoes/Footwear (₹6000)
    p_strings = test_catalog["strings"] # Accessories/Strings (₹1200)

    # 1. Gold Member:
    # - Polo (Apparel): 20% -> ₹800
    # - Racket (Gear): 20% -> ₹8000
    # - Strings (Accessories/Strings): 20% -> ₹960
    # - Ball (Balls): 0% (uncovered for Gold) -> ₹500
    # - Shoe (Shoes): 0% (uncovered for Gold) -> ₹6000
    gold_order = create_shop_order(
        order_type="ONLINE",
        fulfillment_type="PICKUP",
        items_data=[
            {"product_id": p_polo.id, "quantity": 1},
            {"product_id": p_racket.id, "quantity": 1},
            {"product_id": p_ball.id, "quantity": 1},
        ],
        member_id=gold_member.id,
        requesting_user=gold_user,
    )
    items_map = {item.product_sku: item for item in gold_order.items}
    assert items_map[p_polo.sku].discount_pct == Decimal("20.00")
    assert items_map[p_polo.sku].total_price == Decimal("800.00")

    assert items_map[p_racket.sku].discount_pct == Decimal("20.00")
    assert items_map[p_racket.sku].total_price == Decimal("8000.00")

    assert items_map[p_ball.sku].discount_pct == Decimal("0.00")
    assert items_map[p_ball.sku].total_price == Decimal("500.00")

    # 2. Silver Member:
    # - Pro Shop equipment & apparel: Rackets 10%, Apparel 10%
    # - Balls 0%
    silver_order = create_shop_order(
        order_type="ONLINE",
        fulfillment_type="PICKUP",
        items_data=[
            {"product_id": p_racket.id, "quantity": 1},
            {"product_id": p_polo.id, "quantity": 1},
            {"product_id": p_ball.id, "quantity": 1},
        ],
        member_id=silver_member.id,
        requesting_user=silver_user,
    )
    s_items = {item.product_sku: item for item in silver_order.items}
    assert s_items[p_racket.sku].discount_pct == Decimal("10.00")
    assert s_items[p_racket.sku].total_price == Decimal("9000.00")

    assert s_items[p_polo.sku].discount_pct == Decimal("10.00")
    assert s_items[p_polo.sku].total_price == Decimal("900.00")

    assert s_items[p_ball.sku].discount_pct == Decimal("0.00")
    assert s_items[p_ball.sku].total_price == Decimal("500.00")

    # 3. Junior Member:
    # - 15% on junior racket stringing, balls & footwear
    # - Balls 15%, Shoes 15%, Strings 15%
    # - Adult Rackets 0%, Apparel 0%
    junior_order = create_shop_order(
        order_type="ONLINE",
        fulfillment_type="PICKUP",
        items_data=[
            {"product_id": p_ball.id, "quantity": 1},
            {"product_id": p_shoe.id, "quantity": 1},
            {"product_id": p_strings.id, "quantity": 1},
            {"product_id": p_polo.id, "quantity": 1},
        ],
        member_id=junior_member.id,
        requesting_user=junior_user,
    )
    j_items = {item.product_sku: item for item in junior_order.items}
    assert j_items[p_ball.sku].discount_pct == Decimal("15.00")
    assert j_items[p_ball.sku].total_price == Decimal("425.00")

    assert j_items[p_shoe.sku].discount_pct == Decimal("15.00")
    assert j_items[p_shoe.sku].total_price == Decimal("5100.00")

    assert j_items[p_strings.sku].discount_pct == Decimal("15.00")
    assert j_items[p_strings.sku].total_price == Decimal("1020.00")

    assert j_items[p_polo.sku].discount_pct == Decimal("0.00")
    assert j_items[p_polo.sku].total_price == Decimal("1000.00")

    # 4. Expired Member:
    # - 0% discount on all products
    expired_order = create_shop_order(
        order_type="ONLINE",
        fulfillment_type="PICKUP",
        items_data=[{"product_id": p_polo.id, "quantity": 1}],
        member_id=expired_member.id,
        requesting_user=expired_user,
    )
    assert expired_order.items[0].discount_pct == Decimal("0.00")
    assert expired_order.items[0].total_price == Decimal("1000.00")


def test_price_snapshot_unchanged_after_product_price_change(app, db_session, test_catalog, shop_staff_user):
    """Order item snapshot prices remain unchanged even after product price in catalog changes."""
    polo = test_catalog["polo"]  # original price: 1000.00
    order = create_shop_order(
        order_type="COUNTER",
        fulfillment_type="PICKUP",
        items_data=[{"product_id": polo.id, "quantity": 2}],
        customer_name="Snapshot Tester",
        payment_method="CASH",
        requesting_user=shop_staff_user,
    )
    assert order.total_amount == Decimal("2000.00")
    assert order.items[0].unit_price == Decimal("1000.00")

    # Later, catalog price increases to ₹1500
    update_product(polo.id, price=1500.00)
    assert get_product(polo.id).price == Decimal("1500.00")

    # Re-query order and verify historical snapshot is unchanged
    reloaded_order = get_shop_order(order.id)
    assert reloaded_order.total_amount == Decimal("2000.00")
    assert reloaded_order.items[0].unit_price == Decimal("1000.00")
    assert reloaded_order.items[0].total_price == Decimal("2000.00")


def test_delivery_requires_address_and_pickup_does_not(app, db_session, test_catalog, gold_member_user):
    """Delivery requires an address; pickup does not."""
    user, member = gold_member_user
    ball = test_catalog["ball"]

    # Delivery without address -> raises ValidationException
    with pytest.raises(ValidationException) as exc_info:
        create_shop_order(
            order_type="ONLINE",
            fulfillment_type="DELIVERY",
            items_data=[{"product_id": ball.id, "quantity": 1}],
            member_id=member.id,
            delivery_address="",
            requesting_user=user,
        )
    assert "DELIVERY_ADDRESS_REQUIRED" in str(exc_info.value.code)

    # Delivery with address -> succeeds
    order_del = create_shop_order(
        order_type="ONLINE",
        fulfillment_type="DELIVERY",
        items_data=[{"product_id": ball.id, "quantity": 1}],
        member_id=member.id,
        delivery_address="42 Wimbledon Lane, Bengaluru, KA 560001",
        requesting_user=user,
    )
    assert order_del.delivery_address == "42 Wimbledon Lane, Bengaluru, KA 560001"

    # Pickup without address -> succeeds
    order_pick = create_shop_order(
        order_type="ONLINE",
        fulfillment_type="PICKUP",
        items_data=[{"product_id": ball.id, "quantity": 1}],
        member_id=member.id,
        delivery_address=None,
        requesting_user=user,
    )
    assert order_pick.delivery_address is None


def test_cancel_restores_stock_and_handles_payment(app, db_session, test_catalog, shop_staff_user):
    """Cancelling an order restores stock through inventory service and handles payment refund."""
    racket = test_catalog["racket"]
    initial_stock = racket.stock_quantity  # 10

    # Create counter order with CASH payment
    order = create_shop_order(
        order_type="COUNTER",
        fulfillment_type="PICKUP",
        items_data=[{"product_id": racket.id, "quantity": 4}],
        customer_name="Cancel Tester",
        payment_method="CASH",
        requesting_user=shop_staff_user,
    )
    assert racket.stock_quantity == 6
    assert order.status == ShopOrderStatus.CONFIRMED
    assert order.payment_status == "PAID"

    # Payment in DB should be PAID
    payment = get_payment_for_item("SHOP_ORDER", order.id)
    assert payment is not None
    assert payment.status == PaymentStatus.PAID

    # Cancel the order
    cancelled_order = cancel_shop_order(
        order_id=order.id,
        reason="Customer changed their mind",
        requesting_user=shop_staff_user,
    )
    assert cancelled_order.status == ShopOrderStatus.CANCELLED
    assert cancelled_order.cancellation_reason == "Customer changed their mind"

    # Stock is restored to 10
    reloaded_racket = get_product(racket.id)
    assert reloaded_racket.stock_quantity == initial_stock

    # Verify inventory movement was logged for cancellation
    last_mov = InventoryMovement.query.filter_by(product_id=racket.id).order_by(InventoryMovement.created_at.desc()).first()
    assert last_mov.movement_type == MovementType.STOCK_IN
    assert "ORDER_CANCELLED" in last_mov.reason
    assert last_mov.quantity_change == 4

    # Payment status was updated to REFUNDED
    reloaded_payment = db.session.get(Payment, payment.id)
    assert reloaded_payment.status == PaymentStatus.REFUNDED
    assert cancelled_order.payment_status == "REFUNDED"


def test_invalid_status_transition_rejected(app, db_session, test_catalog, shop_staff_user):
    """Invalid status transitions are rejected with ValidationException."""
    ball = test_catalog["ball"]
    order = create_shop_order(
        order_type="COUNTER",
        fulfillment_type="PICKUP",
        items_data=[{"product_id": ball.id, "quantity": 1}],
        customer_name="Transition Tester",
        payment_method="CASH",
        requesting_user=shop_staff_user,
    )
    assert order.status == ShopOrderStatus.CONFIRMED

    # Cannot transition CONFIRMED backwards to PENDING
    with pytest.raises(ValidationException) as exc_info:
        update_order_status(order.id, target_status="PENDING", requesting_user=shop_staff_user)
    assert "INVALID_STATUS_TRANSITION" in str(exc_info.value.code)

    # Valid transition CONFIRMED -> PROCESSING
    update_order_status(order.id, target_status="PROCESSING", requesting_user=shop_staff_user)
    assert order.status == ShopOrderStatus.PROCESSING

    # Valid transition PROCESSING -> READY_FOR_PICKUP
    update_order_status(order.id, target_status="READY_FOR_PICKUP", requesting_user=shop_staff_user)
    assert order.status == ShopOrderStatus.READY_FOR_PICKUP

    # Valid transition READY_FOR_PICKUP -> COMPLETED
    update_order_status(order.id, target_status="COMPLETED", requesting_user=shop_staff_user)
    assert order.status == ShopOrderStatus.COMPLETED

    # Completed order cannot be cancelled
    with pytest.raises(BusinessRuleException) as exc_info2:
        cancel_shop_order(order.id, reason="Late cancel attempt", requesting_user=shop_staff_user)
    assert "ORDER_ALREADY_COMPLETED" in str(exc_info2.value.code)


# ---------------------------------------------------------
# API Tests
# ---------------------------------------------------------

def test_api_member_sees_only_own_orders(client, test_catalog, gold_member_user, silver_member_user, shop_staff_user):
    """A member sees only their own orders via 'my-orders' and direct detail routes."""
    gold_user, gold_member = gold_member_user
    silver_user, silver_member = silver_member_user
    ball = test_catalog["ball"]

    # Gold places an order
    res_gold = client.post(
        "/api/v1/shop/orders",
        headers=auth_header(gold_user),
        json={
            "order_type": "ONLINE",
            "fulfillment_type": "PICKUP",
            "items": [{"product_id": ball.id, "quantity": 2}],
        },
    )
    assert res_gold.status_code == 201
    gold_order_id = res_gold.get_json()["data"]["order"]["id"]

    # Silver places an order
    res_silver = client.post(
        "/api/v1/shop/orders",
        headers=auth_header(silver_user),
        json={
            "order_type": "ONLINE",
            "fulfillment_type": "PICKUP",
            "items": [{"product_id": ball.id, "quantity": 1}],
        },
    )
    assert res_silver.status_code == 201
    silver_order_id = res_silver.get_json()["data"]["order"]["id"]

    # Silver calls /my-orders -> should only see silver's order
    res_my_orders = client.get("/api/v1/shop/orders/my-orders", headers=auth_header(silver_user))
    assert res_my_orders.status_code == 200
    orders = res_my_orders.get_json()["data"]["orders"]
    order_ids = [o["id"] for o in orders]
    assert silver_order_id in order_ids
    assert gold_order_id not in order_ids

    # Silver tries to view Gold's order detail -> 403 Forbidden
    res_forbidden = client.get(f"/api/v1/shop/orders/{gold_order_id}", headers=auth_header(silver_user))
    assert res_forbidden.status_code == 403

    # Gold views own order -> 200 OK
    res_own = client.get(f"/api/v1/shop/orders/{gold_order_id}", headers=auth_header(gold_user))
    assert res_own.status_code == 200

    # Staff views Gold's order -> 200 OK
    res_staff = client.get(f"/api/v1/shop/orders/{gold_order_id}", headers=auth_header(shop_staff_user))
    assert res_staff.status_code == 200


def test_api_counter_order_role_restrictions(client, test_catalog, gold_member_user, shop_staff_user, front_desk_user):
    """COUNTER orders can only be placed by staff (SHOP_STAFF, FRONT_DESK, etc.), not by MEMBER."""
    ball = test_catalog["ball"]
    gold_user, _ = gold_member_user

    counter_payload = {
        "order_type": "COUNTER",
        "fulfillment_type": "PICKUP",
        "items": [{"product_id": ball.id, "quantity": 1}],
        "customer_name": "Walk-in Guest",
        "payment_method": "CASH",
    }

    # Member attempts COUNTER order -> 403 Forbidden
    res_member = client.post("/api/v1/shop/orders", headers=auth_header(gold_user), json=counter_payload)
    assert res_member.status_code == 403

    # Front Desk attempts COUNTER order -> 201 Created
    res_fd = client.post("/api/v1/shop/orders", headers=auth_header(front_desk_user), json=counter_payload)
    assert res_fd.status_code == 201
    assert res_fd.get_json()["data"]["order"]["order_type"] == "COUNTER"

    # Shop Staff attempts COUNTER order -> 201 Created
    res_staff = client.post("/api/v1/shop/orders", headers=auth_header(shop_staff_user), json=counter_payload)
    assert res_staff.status_code == 201


def test_quote_endpoint_and_service_discount_calculation(client, test_catalog, gold_member_user):
    """POST /api/v1/shop/quote returns accurate live price quote without creating orders or deducting stock."""
    racket = test_catalog["racket"]  # price: 10000, initial stock: 10
    polo = test_catalog["polo"]  # price: 2000, initial stock: 20
    gold_user, _ = gold_member_user

    quote_payload = {
        "items": [
            {"product_id": racket.id, "quantity": 2},
            {"product_id": polo.id, "quantity": 1},
        ]
    }

    # As Gold Member: 20% discount on racket (20000 * 0.20 = 4000) and polo (1000 * 0.20 = 200)
    res_gold = client.post("/api/v1/shop/quote", headers=auth_header(gold_user), json=quote_payload)
    assert res_gold.status_code == 200
    data = res_gold.get_json()["data"]["quote"]
    assert data["subtotal_amount"] == 21000.0
    assert data["discount_amount"] == 4200.0
    assert data["total_amount"] == 16800.0
    assert data["plan_code"] == "GOLD"
    assert data["member_discount_applied"] is True

    # Confirm stock was untouched
    assert racket.stock_quantity == 10
    assert polo.stock_quantity == 20

    # Unauthenticated / guest quote (0% discount)
    res_guest = client.post("/api/v1/shop/quote", json=quote_payload)
    assert res_guest.status_code == 200
    guest_data = res_guest.get_json()["data"]["quote"]
    assert guest_data["subtotal_amount"] == 21000.0
    assert guest_data["discount_amount"] == 0.0
    assert guest_data["total_amount"] == 21000.0
    assert guest_data["member_discount_applied"] is False


def test_online_payment_verification_syncs_order_status(client, test_catalog, gold_member_user, setup_fake_provider):
    """Verifying online payment transitions ShopOrder to PAID and CONFIRMED."""
    racket = test_catalog["racket"]
    gold_user, _ = gold_member_user
    fake_prov = setup_fake_provider

    # Create online order (10000 - 20% Gold discount = 8000)
    order_res = client.post(
        "/api/v1/shop/orders",
        headers=auth_header(gold_user),
        json={
            "order_type": "ONLINE",
            "fulfillment_type": "PICKUP",
            "items": [{"product_id": racket.id, "quantity": 1}],
            "payment_method": "ONLINE",
        },
    )
    assert order_res.status_code == 201
    order_data = order_res.get_json()["data"]["order"]
    order_id = order_data["id"]
    assert order_data["status"] == "PENDING"
    assert order_data["payment_status"] == "PENDING"

    # Fetch linked payment
    payment = get_payment_for_item("SHOP_ORDER", order_id)
    assert payment is not None
    assert payment.gateway_order_id is not None

    payment_id = "pay_test_shop_999"
    valid_sig = fake_prov.generate_signature(payment.gateway_order_id, payment_id)
    fake_prov.payments[payment_id] = {
        "id": payment_id,
        "amount": 800000,
        "currency": "INR",
        "status": "captured",
    }

    # Verify payment via centralized verify endpoint
    verify_res = client.post(
        "/api/v1/payments/verify",
        headers=auth_header(gold_user),
        json={
            "razorpay_order_id": payment.gateway_order_id,
            "razorpay_payment_id": payment_id,
            "razorpay_signature": valid_sig,
        },
    )
    assert verify_res.status_code == 200
    assert verify_res.get_json()["data"]["status"] == "PAID"

    # Reload order -> payment_status should be PAID and status CONFIRMED
    reloaded_order = get_shop_order(order_id)
    assert reloaded_order.payment_status == "PAID"
    assert reloaded_order.status == ShopOrderStatus.CONFIRMED


