import concurrent.futures
from decimal import Decimal
import pytest
from flask_jwt_extended import create_access_token
from sqlalchemy.exc import IntegrityError
from backend.app.extensions import db
from backend.app.common.permissions import RoleEnum
from backend.app.common.errors import (
    ValidationException,
    ConflictException,
    InsufficientStockException,
    BusinessRuleException,
    NotFoundException,
)
from backend.app.auth.models import User
from backend.app.auth.services import create_user
from backend.app.inventory.models import (
    ProductCategory,
    Product,
    InventoryMovement,
    MovementType,
)
from backend.app.inventory.services import (
    create_category,
    update_category,
    list_categories,
    create_product,
    update_product,
    deactivate_product,
    get_product,
    record_stock_in,
    record_stock_out,
    record_stock_adjustment,
    get_low_stock_products,
    get_movement_history,
    validate_inventory_availability,
)


def auth_header(user: User) -> dict:
    """Generate JWT authorization header for the given user."""
    token = create_access_token(identity=user)
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
def owner_user(app, db_session):
    return create_user(
        email="owner.inv@club.com",
        password="Password123!",
        first_name="Club",
        last_name="Owner",
        role=RoleEnum.OWNER,
    )


@pytest.fixture
def shop_staff_user(app, db_session):
    return create_user(
        email="shop.inv@club.com",
        password="Password123!",
        first_name="Shop",
        last_name="Manager",
        role=RoleEnum.SHOP_STAFF,
    )


@pytest.fixture
def front_desk_user(app, db_session):
    return create_user(
        email="frontdesk.inv@club.com",
        password="Password123!",
        first_name="Desk",
        last_name="Staff",
        role=RoleEnum.FRONT_DESK,
    )


@pytest.fixture
def member_user(app, db_session):
    return create_user(
        email="member.inv@club.com",
        password="Password123!",
        first_name="Club",
        last_name="Member",
        role=RoleEnum.MEMBER,
    )


@pytest.fixture
def test_category(app, db_session):
    """Seed test category."""
    return create_category(
        name="Rackets",
        slug="rackets",
        description="Tennis, padel, and badminton rackets",
    )


# ---------------------------------------------------------
# Unit & Service Tests
# ---------------------------------------------------------

def test_category_crud_and_slug(app, db_session):
    """Categories are data, slug is auto-generated, and uniqueness is enforced."""
    cat = create_category(name="Table Tennis Balls & Accessories")
    assert cat.id is not None
    assert cat.slug == "table-tennis-balls-accessories"
    assert cat.is_active is True

    # Duplicate name fails
    with pytest.raises(ConflictException):
        create_category(name="Table Tennis Balls & Accessories")

    # Update category
    updated = update_category(cat.id, description="High grade accessories", is_active=False)
    assert updated.description == "High grade accessories"
    assert updated.is_active is False


def test_product_creation_and_initial_stock_movement(app, db_session, test_category, shop_staff_user):
    """Creating a product with initial stock creates an initial STOCK_IN movement record."""
    product = create_product(
        sku="RCK-WIL-BLADE",
        name="Wilson Blade 98",
        category_id=test_category.id,
        price=18500.00,
        cost_price=13000.00,
        stock_quantity=10,
        low_stock_threshold=4,
        description="Blade 98 16x19 v8",
        actor_id=shop_staff_user.id,
    )

    assert product.id is not None
    assert product.sku == "RCK-WIL-BLADE"
    assert product.stock_quantity == 10
    assert product.is_low_stock is False
    assert product.is_out_of_stock is False

    # Verify initial movement record
    movements = product.movements.all()
    assert len(movements) == 1
    init_mov = movements[0]
    assert init_mov.movement_type == MovementType.STOCK_IN
    assert init_mov.quantity_change == 10
    assert init_mov.previous_stock == 0
    assert init_mov.new_stock == 10
    assert init_mov.reason == "INITIAL_STOCK"
    assert init_mov.actor_id == shop_staff_user.id


def test_duplicate_sku_rejected(app, db_session, test_category):
    """Duplicate SKU is rejected with a ConflictException."""
    create_product(
        sku="BAL-WIL-CHAMP",
        name="Wilson Championship Tennis Balls",
        category_id=test_category.id,
        price=550.00,
        stock_quantity=50,
    )

    with pytest.raises(ConflictException) as exc_info:
        create_product(
            sku="BAL-WIL-CHAMP",
            name="Wilson Championship Duplicate",
            category_id=test_category.id,
            price=600.00,
        )
    assert "DUPLICATE_SKU" in str(exc_info.value.code)


def test_stock_in_out_adjust_updates_quantity_and_writes_movements(app, db_session, test_category, shop_staff_user):
    """Stock in, stock out, and adjust update quantities and write audit movement records."""
    product = create_product(
        sku="ACC-GRIP-01",
        name="Tourna Grip (Pack of 3)",
        category_id=test_category.id,
        price=450.00,
        stock_quantity=10,
        low_stock_threshold=5,
        actor_id=shop_staff_user.id,
    )

    # 1. Stock In: +15
    mov_in = record_stock_in(
        product_id=product.id,
        quantity=15,
        reason="SUPPLIER_DELIVERY",
        actor_id=shop_staff_user.id,
        reference_id="PO-2026-001",
    )
    assert product.stock_quantity == 25
    assert mov_in.movement_type == MovementType.STOCK_IN
    assert mov_in.quantity_change == 15
    assert mov_in.previous_stock == 10
    assert mov_in.new_stock == 25
    assert mov_in.reference_id == "PO-2026-001"

    # 2. Stock Out: -8
    mov_out = record_stock_out(
        product_id=product.id,
        quantity=8,
        reason="COUNTER_SALE",
        actor_id=shop_staff_user.id,
        reference_id="CS-901",
    )
    assert product.stock_quantity == 17
    assert mov_out.movement_type == MovementType.STOCK_OUT
    assert mov_out.quantity_change == -8
    assert mov_out.previous_stock == 25
    assert mov_out.new_stock == 17

    # 3. Stock Adjust: adjust to 12
    mov_adj = record_stock_adjustment(
        product_id=product.id,
        new_quantity=12,
        reason="PHYSICAL_COUNT_AUDIT",
        actor_id=shop_staff_user.id,
    )
    assert product.stock_quantity == 12
    assert mov_adj.movement_type == MovementType.ADJUSTMENT
    assert mov_adj.quantity_change == -5
    assert mov_adj.previous_stock == 17
    assert mov_adj.new_stock == 12

    # Movement history has 4 records (INIT + IN + OUT + ADJ)
    movements, total = get_movement_history(product_id=product.id)
    assert total == 4


def test_deducting_more_than_available_fails_and_leaves_stock_unchanged(app, db_session, test_category):
    """Deducting more than available stock raises InsufficientStockException and leaves stock unchanged."""
    product = create_product(
        sku="RCK-HEAD-GRAV",
        name="Head Gravity Pro",
        category_id=test_category.id,
        price=19000.00,
        stock_quantity=3,
        low_stock_threshold=2,
    )

    with pytest.raises(InsufficientStockException) as exc_info:
        record_stock_out(
            product_id=product.id,
            quantity=5,
            reason="ONLINE_ORDER",
        )

    assert exc_info.value.code == "INSUFFICIENT_STOCK"
    assert exc_info.value.status_code == 409

    # Re-query to verify stock is completely unchanged
    reloaded = get_product(product.id)
    assert reloaded.stock_quantity == 3


def test_two_concurrent_deductions_of_last_unit(app, db_session, test_category, shop_staff_user):
    """Two concurrent threads attempt to deduct the last remaining unit: exactly 1 succeeds, 1 gets 409 conflict."""
    product = create_product(
        sku="RCK-LAST-UNIT",
        name="Last Available Racket",
        category_id=test_category.id,
        price=15000.00,
        stock_quantity=1,
        actor_id=shop_staff_user.id,
    )
    product_id = product.id
    staff_id = shop_staff_user.id

    results = []

    def attempt_deduction(thread_name):
        with app.app_context():
            from backend.app.common.errors import InsufficientStockException, ConflictException
            try:
                mov = record_stock_out(
                    product_id=product_id,
                    quantity=1,
                    reason=f"CONCURRENT_SALE_{thread_name}",
                    actor_id=staff_id,
                )
                results.append(("SUCCESS", mov.id))
            except (InsufficientStockException, ConflictException) as e:
                results.append(("CONFLICT", str(e)))
            except Exception as e:
                results.append(("OTHER_ERROR", f"{type(e).__name__}: {str(e)}"))

    with concurrent.futures.ThreadPoolExecutor(max_workers=2) as executor:
        f1 = executor.submit(attempt_deduction, "THREAD_1")
        f2 = executor.submit(attempt_deduction, "THREAD_2")
        concurrent.futures.wait([f1, f2])

    statuses = [r[0] for r in results]
    assert statuses.count("SUCCESS") == 1, f"Results: {results}"
    assert statuses.count("CONFLICT") == 1, f"Results: {results}"

    # Verify final stock is exactly 0 (never negative)
    with app.app_context():
        final_prod = get_product(product_id)
        assert final_prod.stock_quantity == 0
        assert final_prod.is_out_of_stock is True


def test_low_stock_boundary(app, db_session, test_category):
    """Test low-stock threshold boundary conditions."""
    product = create_product(
        sku="BAL-BOX-01",
        name="Box of Shuttlecocks",
        category_id=test_category.id,
        price=1200.00,
        stock_quantity=6,
        low_stock_threshold=5,
    )

    # Stock = 6, threshold = 5 -> not low stock
    assert product.is_low_stock is False

    # Stock = 5, threshold = 5 -> exactly at boundary -> IS low stock
    record_stock_out(product.id, quantity=1, reason="SALE")
    assert product.stock_quantity == 5
    assert product.is_low_stock is True

    # Check low stock query
    low_stock_items = get_low_stock_products()
    assert any(p.id == product.id for p in low_stock_items)

    # Restock back to 7 -> no longer low stock
    record_stock_in(product.id, quantity=2, reason="RESTOCK")
    assert product.stock_quantity == 7
    assert product.is_low_stock is False


def test_deactivated_product_cannot_be_sold(app, db_session, test_category):
    """Deactivated product cannot be sold or deducted."""
    product = create_product(
        sku="SHOE-OLD-MODEL",
        name="Discontinued Shoes",
        category_id=test_category.id,
        price=4999.00,
        stock_quantity=10,
    )

    deactivate_product(product.id)
    assert product.is_active is False

    with pytest.raises(BusinessRuleException) as exc_info:
        record_stock_out(product.id, quantity=1, reason="SALE_ATTEMPT")

    assert exc_info.value.code == "PRODUCT_DEACTIVATED"
    assert exc_info.value.status_code == 400
    assert product.stock_quantity == 10


def test_product_update_cannot_modify_stock_directly(app, db_session, test_category):
    """update_product does not allow altering stock_quantity directly."""
    product = create_product(
        sku="ACC-DAMP-01",
        name="Vibration Dampener",
        category_id=test_category.id,
        price=150.00,
        stock_quantity=20,
    )

    # Calling update_product with price and description
    updated = update_product(product.id, price=175.00, description="New silicon dampener")
    assert float(updated.price) == 175.00
    assert updated.stock_quantity == 20  # stock untouched


def test_inventory_batch_validation(app, db_session, test_category):
    """Validate cart items in batch."""
    p1 = create_product(sku="ITEM-1", name="Item 1", category_id=test_category.id, price=100.0, stock_quantity=5)
    p2 = create_product(sku="ITEM-2", name="Item 2", category_id=test_category.id, price=200.0, stock_quantity=1)
    p3 = create_product(sku="ITEM-3", name="Item 3", category_id=test_category.id, price=300.0, stock_quantity=10)
    deactivate_product(p3.id)

    # Case 1: Valid cart
    valid_res = validate_inventory_availability([
        {"product_id": p1.id, "quantity": 2},
        {"product_id": p2.id, "quantity": 1},
    ])
    assert valid_res["is_valid"] is True
    assert len(valid_res["errors"]) == 0

    # Case 2: Insufficient stock on p2 + deactivated on p3 + non-existent p4
    invalid_res = validate_inventory_availability([
        {"product_id": p1.id, "quantity": 1},
        {"product_id": p2.id, "quantity": 3},  # only 1 available
        {"product_id": p3.id, "quantity": 1},  # deactivated
        {"product_id": 99999, "quantity": 1},  # not found
    ])
    assert invalid_res["is_valid"] is False
    assert len(invalid_res["errors"]) == 3


def test_database_check_constraint_prevents_negative_stock(app, db_session, test_category):
    """Database check constraint rejects any direct negative stock write."""
    product = create_product(
        sku="CK-TEST-01",
        name="Constraint Test Product",
        category_id=test_category.id,
        price=100.0,
        stock_quantity=0,
    )

    product.stock_quantity = -5
    with pytest.raises(IntegrityError):
        db.session.commit()
    db.session.rollback()


# ---------------------------------------------------------
# API Endpoint & Role Restriction Tests
# ---------------------------------------------------------

def test_public_read_catalog_endpoints(client, test_category):
    """Public users can view categories and active products without authentication."""
    p = create_product(
        sku="PUB-PROD-01",
        name="Publicly Viewable Racket",
        category_id=test_category.id,
        price=8500.00,
        stock_quantity=15,
    )

    # Categories list
    res_cat = client.get("/api/v1/inventory/categories")
    assert res_cat.status_code == 200
    assert res_cat.get_json()["success"] is True

    # Products list
    res_prod = client.get("/api/v1/inventory/products")
    assert res_prod.status_code == 200
    data = res_prod.get_json()["data"]
    assert any(item["sku"] == "PUB-PROD-01" for item in data["products"])

    # Single product
    res_single = client.get(f"/api/v1/inventory/products/{p.id}")
    assert res_single.status_code == 200
    assert res_single.get_json()["data"]["product"]["sku"] == "PUB-PROD-01"


def test_role_restrictions_on_product_management(client, test_category, member_user, front_desk_user, shop_staff_user, owner_user):
    """Member and Front Desk cannot create/update/delete products; Shop Staff and Owner can."""
    payload = {
        "sku": "ROLE-PROD-01",
        "name": "Role Test Product",
        "category_id": test_category.id,
        "price": "999.00",
        "stock_quantity": 5,
    }

    # Anonymous -> 401
    res_anon = client.post("/api/v1/inventory/products", json=payload)
    assert res_anon.status_code == 401

    # Member -> 403
    res_member = client.post("/api/v1/inventory/products", headers=auth_header(member_user), json=payload)
    assert res_member.status_code == 403

    # Front Desk -> 403
    res_fd = client.post("/api/v1/inventory/products", headers=auth_header(front_desk_user), json=payload)
    assert res_fd.status_code == 403

    # Shop Staff -> 201
    res_shop = client.post("/api/v1/inventory/products", headers=auth_header(shop_staff_user), json=payload)
    assert res_shop.status_code == 201
    prod_id = res_shop.get_json()["data"]["product"]["id"]

    # Member delete -> 403
    res_del_mem = client.delete(f"/api/v1/inventory/products/{prod_id}", headers=auth_header(member_user))
    assert res_del_mem.status_code == 403

    # Owner delete (soft-deactivate) -> 200
    res_del_owner = client.delete(f"/api/v1/inventory/products/{prod_id}", headers=auth_header(owner_user))
    assert res_del_owner.status_code == 200
    assert res_del_owner.get_json()["data"]["product"]["is_active"] is False


def test_role_restrictions_on_stock_operations(client, test_category, member_user, front_desk_user, shop_staff_user):
    """Front Desk can restock and deduct for sales, but cannot adjust; Member cannot do any."""
    prod = create_product(
        sku="STOCK-ROLE-01",
        name="Stock Role Item",
        category_id=test_category.id,
        price=500.0,
        stock_quantity=10,
    )

    # Member stock-in -> 403
    res_mem_in = client.post(
        f"/api/v1/inventory/products/{prod.id}/stock-in",
        headers=auth_header(member_user),
        json={"quantity": 5, "reason": "RESTOCK"},
    )
    assert res_mem_in.status_code == 403

    # Front Desk stock-in -> 200
    res_fd_in = client.post(
        f"/api/v1/inventory/products/{prod.id}/stock-in",
        headers=auth_header(front_desk_user),
        json={"quantity": 5, "reason": "SUPPLIER_SHIPMENT"},
    )
    assert res_fd_in.status_code == 200
    assert res_fd_in.get_json()["data"]["product"]["stock_quantity"] == 15

    # Front Desk stock-out -> 200
    res_fd_out = client.post(
        f"/api/v1/inventory/products/{prod.id}/stock-out",
        headers=auth_header(front_desk_user),
        json={"quantity": 3, "reason": "COUNTER_SALE"},
    )
    assert res_fd_out.status_code == 200
    assert res_fd_out.get_json()["data"]["product"]["stock_quantity"] == 12

    # Front Desk adjust -> 403 (adjust is restricted to SHOP_STAFF/ADMIN/OWNER)
    res_fd_adj = client.post(
        f"/api/v1/inventory/products/{prod.id}/adjust",
        headers=auth_header(front_desk_user),
        json={"new_quantity": 20, "reason": "AUDIT"},
    )
    assert res_fd_adj.status_code == 403

    # Shop Staff adjust -> 200
    res_shop_adj = client.post(
        f"/api/v1/inventory/products/{prod.id}/adjust",
        headers=auth_header(shop_staff_user),
        json={"new_quantity": 20, "reason": "AUDIT"},
    )
    assert res_shop_adj.status_code == 200
    assert res_shop_adj.get_json()["data"]["product"]["stock_quantity"] == 20


def test_api_stock_out_insufficient_returns_409(client, test_category, front_desk_user):
    """API endpoint returns HTTP 409 with INSUFFICIENT_STOCK code when deducting more than stock."""
    prod = create_product(
        sku="API-LOW-STOCK",
        name="API Low Stock Product",
        category_id=test_category.id,
        price=100.0,
        stock_quantity=2,
    )

    res = client.post(
        f"/api/v1/inventory/products/{prod.id}/stock-out",
        headers=auth_header(front_desk_user),
        json={"quantity": 5, "reason": "COUNTER_SALE"},
    )
    assert res.status_code == 409
    body = res.get_json()
    assert body["success"] is False
    assert body["error"]["code"] == "INSUFFICIENT_STOCK"
    assert "Insufficient stock" in body["error"]["message"]


def test_movement_history_and_low_stock_api(client, test_category, shop_staff_user):
    """API endpoints for low-stock and movement history."""
    prod = create_product(
        sku="MOV-PROD-01",
        name="Movement Tracking Product",
        category_id=test_category.id,
        price=350.0,
        stock_quantity=4,
        low_stock_threshold=5,
        actor_id=shop_staff_user.id,
    )

    # Low stock endpoint
    res_low = client.get("/api/v1/inventory/low-stock", headers=auth_header(shop_staff_user))
    assert res_low.status_code == 200
    low_skus = [p["sku"] for p in res_low.get_json()["data"]["products"]]
    assert "MOV-PROD-01" in low_skus

    # Product movements endpoint
    res_mov = client.get(f"/api/v1/inventory/products/{prod.id}/movements", headers=auth_header(shop_staff_user))
    assert res_mov.status_code == 200
    movements = res_mov.get_json()["data"]["movements"]
    assert len(movements) == 1
    assert movements[0]["movement_type"] == "STOCK_IN"
    assert movements[0]["reason"] == "INITIAL_STOCK"

    # All movements endpoint
    res_all_mov = client.get("/api/v1/inventory/movements", headers=auth_header(shop_staff_user))
    assert res_all_mov.status_code == 200
    assert len(res_all_mov.get_json()["data"]["movements"]) >= 1
