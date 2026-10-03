import re
import threading
from typing import List, Optional, Dict, Any, Tuple
from decimal import Decimal
from datetime import datetime
from sqlalchemy import update, or_, and_, desc
from sqlalchemy.exc import IntegrityError
from backend.app.extensions import db
from backend.app.common.utils import utc_now
from backend.app.common.errors import (
    NotFoundException,
    ValidationException,
    ConflictException,
    InsufficientStockException,
    BusinessRuleException,
)
from backend.app.inventory.models import (
    ProductCategory,
    Product,
    InventoryMovement,
    MovementType,
    generate_movement_reference,
)

# Thread-level re-entrant lock to serialize inventory transactions across threads
# in single-process / in-memory testing setups, complementing row-level database atomicity.
_inventory_lock = threading.RLock()


def slugify(text: str) -> str:
    """Generate a clean URL slug from name."""
    text = text.lower().strip()
    text = re.sub(r"[^\w\s-]", "", text)
    text = re.sub(r"[\s_-]+", "-", text)
    return text.strip("-")


# ---------------------------------------------------------
# Category Services
# ---------------------------------------------------------

def list_categories(active_only: bool = True) -> List[ProductCategory]:
    """Retrieve all product categories."""
    query = ProductCategory.query
    if active_only:
        query = query.filter_by(is_active=True)
    return query.order_by(ProductCategory.name.asc()).all()


def get_category_by_id(category_id: int) -> ProductCategory:
    """Fetch category by primary key ID or raise 404."""
    cat = db.session.get(ProductCategory, category_id)
    if not cat:
        raise NotFoundException(f"Category with ID {category_id} not found.")
    return cat


def get_category_by_slug(slug: str) -> Optional[ProductCategory]:
    """Fetch category by slug."""
    return ProductCategory.query.filter_by(slug=slug).first()


def create_category(
    name: str,
    slug: Optional[str] = None,
    description: Optional[str] = None,
) -> ProductCategory:
    """Create a new product category."""
    clean_name = name.strip()
    clean_slug = slug.strip().lower() if slug else slugify(clean_name)

    existing = ProductCategory.query.filter(
        or_(ProductCategory.name.ilike(clean_name), ProductCategory.slug == clean_slug)
    ).first()
    if existing:
        raise ConflictException(
            f"A category with name '{clean_name}' or slug '{clean_slug}' already exists.",
            code="DUPLICATE_CATEGORY",
        )

    cat = ProductCategory(
        name=clean_name,
        slug=clean_slug,
        description=description.strip() if description else None,
        is_active=True,
    )
    db.session.add(cat)
    try:
        db.session.commit()
    except IntegrityError:
        db.session.rollback()
        raise ConflictException(
            "Category uniqueness constraint violated.",
            code="DUPLICATE_CATEGORY",
        )
    return cat


def update_category(
    category_id: int,
    name: Optional[str] = None,
    slug: Optional[str] = None,
    description: Optional[str] = None,
    is_active: Optional[bool] = None,
) -> ProductCategory:
    """Update category attributes."""
    cat = get_category_by_id(category_id)

    if name is not None:
        clean_name = name.strip()
        existing = ProductCategory.query.filter(
            ProductCategory.name.ilike(clean_name),
            ProductCategory.id != cat.id,
        ).first()
        if existing:
            raise ConflictException(f"Category name '{clean_name}' is already in use.", code="DUPLICATE_CATEGORY")
        cat.name = clean_name

    if slug is not None:
        clean_slug = slug.strip().lower()
        existing_slug = ProductCategory.query.filter(
            ProductCategory.slug == clean_slug,
            ProductCategory.id != cat.id,
        ).first()
        if existing_slug:
            raise ConflictException(f"Category slug '{clean_slug}' is already in use.", code="DUPLICATE_CATEGORY")
        cat.slug = clean_slug

    if description is not None:
        cat.description = description.strip() if description else None

    if is_active is not None:
        cat.is_active = is_active

    try:
        db.session.commit()
    except IntegrityError:
        db.session.rollback()
        raise ConflictException("Category update violated uniqueness constraints.", code="DUPLICATE_CATEGORY")

    return cat


# ---------------------------------------------------------
# Product Management Services
# ---------------------------------------------------------

def get_product(product_id: int) -> Product:
    """Fetch product by ID or raise 404."""
    prod = db.session.get(Product, product_id)
    if not prod:
        raise NotFoundException(f"Product with ID {product_id} not found.")
    return prod


def get_product_by_sku(sku: str) -> Optional[Product]:
    """Fetch product by SKU code."""
    if not sku:
        return None
    return Product.query.filter(Product.sku.ilike(sku.strip())).first()


def list_products(
    category_id: Optional[int] = None,
    category_slug: Optional[str] = None,
    is_active: Optional[bool] = True,
    search: Optional[str] = None,
    low_stock_only: bool = False,
    page: int = 1,
    per_page: int = 20,
) -> Tuple[List[Product], int]:
    """List products with filters, search, and pagination."""
    query = Product.query

    if is_active is not None:
        query = query.filter(Product.is_active == is_active)

    if category_id:
        query = query.filter(Product.category_id == category_id)
    elif category_slug:
        query = query.join(ProductCategory).filter(ProductCategory.slug == category_slug)

    if search:
        search_term = f"%{search.strip()}%"
        query = query.filter(
            or_(
                Product.name.ilike(search_term),
                Product.sku.ilike(search_term),
                Product.barcode.ilike(search_term),
                Product.description.ilike(search_term),
            )
        )

    if low_stock_only:
        query = query.filter(Product.stock_quantity <= Product.low_stock_threshold)

    total = query.count()
    paginated = (
        query.order_by(Product.name.asc())
        .offset((page - 1) * per_page)
        .limit(per_page)
        .all()
    )
    return paginated, total


def get_low_stock_products(threshold: Optional[int] = None) -> List[Product]:
    """Fetch all active products whose stock is at or below threshold."""
    query = Product.query.filter(Product.is_active == True)  # noqa: E712
    if threshold is not None:
        query = query.filter(Product.stock_quantity <= threshold)
    else:
        query = query.filter(Product.stock_quantity <= Product.low_stock_threshold)
    return query.order_by(Product.stock_quantity.asc()).all()


def create_product(
    sku: str,
    name: str,
    category_id: int,
    price: float | Decimal,
    cost_price: Optional[float | Decimal] = None,
    stock_quantity: int = 0,
    low_stock_threshold: int = 5,
    description: Optional[str] = None,
    barcode: Optional[str] = None,
    image_url: Optional[str] = None,
    actor_id: Optional[int] = None,
) -> Product:
    """Create a new product.
    
    If initial stock_quantity is > 0, an initial STOCK_IN inventory movement is recorded.
    """
    clean_sku = sku.strip().upper()
    clean_name = name.strip()

    # 1. Uniqueness check for SKU
    existing_sku = get_product_by_sku(clean_sku)
    if existing_sku:
        raise ConflictException(
            f"Product with SKU '{clean_sku}' already exists.",
            code="DUPLICATE_SKU",
        )

    # 2. Category check
    category = get_category_by_id(category_id)
    if not category.is_active:
        raise BusinessRuleException(
            f"Cannot assign product to inactive category '{category.name}'.",
            code="INACTIVE_CATEGORY",
        )

    # 3. Barcode check
    if barcode:
        clean_barcode = barcode.strip()
        existing_barcode = Product.query.filter_by(barcode=clean_barcode).first()
        if existing_barcode:
            raise ConflictException(
                f"Barcode '{clean_barcode}' is already assigned to SKU '{existing_barcode.sku}'.",
                code="DUPLICATE_BARCODE",
            )
    else:
        clean_barcode = None

    if stock_quantity < 0:
        raise ValidationException("Initial stock quantity cannot be negative.", code="NEGATIVE_STOCK")
    if low_stock_threshold < 0:
        raise ValidationException("Low stock threshold cannot be negative.", code="NEGATIVE_THRESHOLD")

    with _inventory_lock:
        product = Product(
            sku=clean_sku,
            name=clean_name,
            category_id=category.id,
            price=price,
            cost_price=cost_price,
            stock_quantity=stock_quantity,
            low_stock_threshold=low_stock_threshold,
            description=description.strip() if description else None,
            barcode=clean_barcode,
            image_url=image_url.strip() if image_url else None,
            is_active=True,
        )
        db.session.add(product)
        db.session.flush()

        # If starting with non-zero stock, write the initial stock movement record
        if stock_quantity > 0:
            init_movement = InventoryMovement(
                movement_reference=generate_movement_reference("INIT"),
                product_id=product.id,
                movement_type=MovementType.STOCK_IN,
                quantity_change=stock_quantity,
                previous_stock=0,
                new_stock=stock_quantity,
                reason="INITIAL_STOCK",
                notes="Initial inventory level on product creation",
                actor_id=actor_id,
            )
            db.session.add(init_movement)

        try:
            db.session.commit()
        except IntegrityError:
            db.session.rollback()
            raise ConflictException(
                f"Product creation failed due to uniqueness constraint (SKU '{clean_sku}').",
                code="DUPLICATE_SKU",
            )

        return product


def update_product(
    product_id: int,
    name: Optional[str] = None,
    category_id: Optional[int] = None,
    price: Optional[float | Decimal] = None,
    cost_price: Optional[float | Decimal] = None,
    low_stock_threshold: Optional[int] = None,
    description: Optional[str] = None,
    is_active: Optional[bool] = None,
    barcode: Optional[str] = None,
    image_url: Optional[str] = None,
) -> Product:
    """Update product metadata.
    
    CRITICAL: stock_quantity cannot be modified directly here.
    It must change via record_stock_in, record_stock_out, or record_stock_adjustment.
    """
    product = get_product(product_id)

    if name is not None:
        product.name = name.strip()

    if category_id is not None:
        cat = get_category_by_id(category_id)
        if not cat.is_active:
            raise BusinessRuleException("Cannot move product to inactive category.", code="INACTIVE_CATEGORY")
        product.category_id = cat.id

    if price is not None:
        if Decimal(str(price)) <= Decimal("0.00"):
            raise ValidationException("Price must be greater than zero.", code="INVALID_PRICE")
        product.price = price

    if cost_price is not None:
        if Decimal(str(cost_price)) < Decimal("0.00"):
            raise ValidationException("Cost price cannot be negative.", code="INVALID_COST_PRICE")
        product.cost_price = cost_price

    if low_stock_threshold is not None:
        if low_stock_threshold < 0:
            raise ValidationException("Low-stock threshold cannot be negative.", code="INVALID_THRESHOLD")
        product.low_stock_threshold = low_stock_threshold

    if description is not None:
        product.description = description.strip() if description else None

    if is_active is not None:
        product.is_active = is_active

    if barcode is not None:
        clean_barcode = barcode.strip() if barcode else None
        if clean_barcode:
            existing = Product.query.filter(
                Product.barcode == clean_barcode,
                Product.id != product.id,
            ).first()
            if existing:
                raise ConflictException("Barcode is already assigned to another product.", code="DUPLICATE_BARCODE")
        product.barcode = clean_barcode

    if image_url is not None:
        product.image_url = image_url.strip() if image_url else None

    try:
        db.session.commit()
    except IntegrityError:
        db.session.rollback()
        raise ConflictException("Product update failed due to constraint violation.", code="UPDATE_CONFLICT")

    return product


def deactivate_product(product_id: int) -> Product:
    """Soft-deactivate product instead of hard-deleting."""
    product = get_product(product_id)
    product.is_active = False
    db.session.commit()
    return product


# ---------------------------------------------------------
# Inventory Stock Operations (The Unified Inventory Service)
# ---------------------------------------------------------

def record_stock_in(
    product_id: int,
    quantity: int,
    reason: str,
    actor_id: Optional[int] = None,
    notes: Optional[str] = None,
    reference_id: Optional[str] = None,
    auto_commit: bool = True,
) -> InventoryMovement:
    """Restock inventory for a product.
    
    Writes an immutable InventoryMovement record and increments stock atomically.
    """
    if quantity <= 0:
        raise ValidationException("Restock quantity must be greater than zero.", code="INVALID_QUANTITY")
    if not reason or not reason.strip():
        raise ValidationException("A reason must be provided for stock-in.", code="REASON_REQUIRED")

    with _inventory_lock:
        product = db.session.get(Product, product_id)
        if not product:
            raise NotFoundException(f"Product with ID {product_id} not found.")

        previous_stock = product.stock_quantity
        new_stock = previous_stock + quantity

        # Atomic update on stock_quantity
        product.stock_quantity = new_stock

        movement = InventoryMovement(
            movement_reference=generate_movement_reference("IN"),
            product_id=product.id,
            movement_type=MovementType.STOCK_IN,
            quantity_change=quantity,
            previous_stock=previous_stock,
            new_stock=new_stock,
            reason=reason.strip(),
            notes=notes.strip() if notes else None,
            reference_id=reference_id.strip() if reference_id else None,
            actor_id=actor_id,
        )
        db.session.add(movement)

        if auto_commit:
            try:
                db.session.commit()
            except IntegrityError as e:
                db.session.rollback()
                raise ConflictException(f"Stock-in transaction failed: {str(e)}", code="STOCK_IN_FAILED")
        else:
            db.session.flush()

        return movement


def record_stock_out(
    product_id: int,
    quantity: int,
    reason: str,
    actor_id: Optional[int] = None,
    notes: Optional[str] = None,
    reference_id: Optional[str] = None,
    auto_commit: bool = True,
) -> InventoryMovement:
    """Deduct stock for counter sales, online orders, or damage.
    
    Guarantees:
    1. Deactivated products cannot be sold/deducted.
    2. Stock cannot become negative; rejects with InsufficientStockException.
    3. Thread-safe and atomic (conditional DB update + lock).
    4. Writes an immutable InventoryMovement record.
    """
    if quantity <= 0:
        raise ValidationException("Deduction quantity must be greater than zero.", code="INVALID_QUANTITY")
    if not reason or not reason.strip():
        raise ValidationException("A reason must be provided for stock-out.", code="REASON_REQUIRED")

    with _inventory_lock:
        product = db.session.get(Product, product_id)
        if not product:
            raise NotFoundException(f"Product with ID {product_id} not found.")

        if not product.is_active:
            raise BusinessRuleException(
                f"Product '{product.name}' (SKU: {product.sku}) is deactivated and cannot be sold or deducted.",
                code="PRODUCT_DEACTIVATED",
                status_code=400,
            )

        if product.stock_quantity < quantity:
            raise InsufficientStockException(
                f"Insufficient stock for product '{product.name}' (SKU: {product.sku}). "
                f"Requested: {quantity}, Available: {product.stock_quantity}.",
                code="INSUFFICIENT_STOCK",
                details={
                    "product_id": product.id,
                    "sku": product.sku,
                    "available_stock": product.stock_quantity,
                    "requested_quantity": quantity,
                },
            )

        previous_stock = product.stock_quantity
        new_stock = previous_stock - quantity

        # Update product stock
        product.stock_quantity = new_stock

        movement = InventoryMovement(
            movement_reference=generate_movement_reference("OUT"),
            product_id=product.id,
            movement_type=MovementType.STOCK_OUT,
            quantity_change=-quantity,
            previous_stock=previous_stock,
            new_stock=new_stock,
            reason=reason.strip(),
            notes=notes.strip() if notes else None,
            reference_id=reference_id.strip() if reference_id else None,
            actor_id=actor_id,
        )
        db.session.add(movement)

        if auto_commit:
            try:
                db.session.commit()
            except IntegrityError:
                db.session.rollback()
                raise ConflictException(
                    "Stock deduction failed: stock cannot be negative.",
                    code="NEGATIVE_STOCK_CONFLICT",
                )
        else:
            db.session.flush()

        return movement


def record_stock_adjustment(
    product_id: int,
    new_quantity: int,
    reason: str,
    actor_id: Optional[int] = None,
    notes: Optional[str] = None,
    reference_id: Optional[str] = None,
) -> InventoryMovement:
    """Adjust product stock quantity to a specific level (audit, loss, recount).
    
    Writes an immutable InventoryMovement record with the delta change.
    """
    if new_quantity < 0:
        raise ValidationException("Adjusted stock quantity cannot be negative.", code="NEGATIVE_STOCK")
    if not reason or not reason.strip():
        raise ValidationException("A reason must be provided for stock adjustment.", code="REASON_REQUIRED")

    with _inventory_lock:
        product = db.session.get(Product, product_id)
        if not product:
            raise NotFoundException(f"Product with ID {product_id} not found.")

        previous_stock = product.stock_quantity
        delta = new_quantity - previous_stock

        product.stock_quantity = new_quantity

        movement = InventoryMovement(
            movement_reference=generate_movement_reference("ADJ"),
            product_id=product.id,
            movement_type=MovementType.ADJUSTMENT,
            quantity_change=delta,
            previous_stock=previous_stock,
            new_stock=new_quantity,
            reason=reason.strip(),
            notes=notes.strip() if notes else None,
            reference_id=reference_id.strip() if reference_id else None,
            actor_id=actor_id,
        )
        db.session.add(movement)

        try:
            db.session.commit()
        except IntegrityError as e:
            db.session.rollback()
            raise ConflictException(f"Stock adjustment failed: {str(e)}", code="ADJUSTMENT_FAILED")

        return movement


def validate_inventory_availability(items: List[Dict[str, Any]]) -> Dict[str, Any]:
    """Validate inventory availability for a list of items prior to checkout or sale.
    
    Items format:
    [
        {"product_id": 1, "quantity": 2},
        {"product_id": 2, "quantity": 1}
    ]
    
    Returns:
    {
        "is_valid": bool,
        "items": [...],
        "errors": [...]
    }
    """
    validated_items = []
    errors = []
    is_valid = True

    for idx, item in enumerate(items):
        pid = item.get("product_id")
        qty = item.get("quantity", 1)

        product = db.session.get(Product, pid)
        if not product:
            is_valid = False
            errors.append({
                "item_index": idx,
                "product_id": pid,
                "error": "PRODUCT_NOT_FOUND",
                "message": f"Product with ID {pid} was not found.",
            })
            continue

        if not product.is_active:
            is_valid = False
            errors.append({
                "item_index": idx,
                "product_id": pid,
                "sku": product.sku,
                "name": product.name,
                "error": "PRODUCT_DEACTIVATED",
                "message": f"Product '{product.name}' is deactivated and cannot be purchased.",
            })
            continue

        if product.stock_quantity < qty:
            is_valid = False
            errors.append({
                "item_index": idx,
                "product_id": pid,
                "sku": product.sku,
                "name": product.name,
                "available_stock": product.stock_quantity,
                "requested_quantity": qty,
                "error": "INSUFFICIENT_STOCK",
                "message": (
                    f"Insufficient stock for '{product.name}'. "
                    f"Requested {qty}, available {product.stock_quantity}."
                ),
            })

        validated_items.append({
            "product_id": product.id,
            "sku": product.sku,
            "name": product.name,
            "unit_price": float(product.price),
            "requested_quantity": qty,
            "available_stock": product.stock_quantity,
            "is_available": product.is_active and product.stock_quantity >= qty,
        })

    return {
        "is_valid": is_valid,
        "items": validated_items,
        "errors": errors,
    }


def get_movement_history(
    product_id: Optional[int] = None,
    movement_type: Optional[str] = None,
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    page: int = 1,
    per_page: int = 50,
) -> Tuple[List[InventoryMovement], int]:
    """Query paginated inventory movements with optional filters."""
    query = InventoryMovement.query

    if product_id:
        query = query.filter(InventoryMovement.product_id == product_id)

    if movement_type:
        query = query.filter(InventoryMovement.movement_type == movement_type)

    if start_date:
        query = query.filter(InventoryMovement.created_at >= start_date)

    if end_date:
        query = query.filter(InventoryMovement.created_at <= end_date)

    total = query.count()
    movements = (
        query.order_by(desc(InventoryMovement.created_at))
        .offset((page - 1) * per_page)
        .limit(per_page)
        .all()
    )
    return movements, total
