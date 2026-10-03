from flask import Blueprint, request
from flask_jwt_extended import jwt_required, current_user
from backend.app.common.responses import success_response
from backend.app.common.validation import validate_schema
from backend.app.common.permissions import roles_required, RoleEnum
from backend.app.common.errors import NotFoundException, ForbiddenException, ValidationException
from backend.app.inventory.schemas import (
    ProductCategoryCreateSchema,
    ProductCategoryUpdateSchema,
    ProductCreateSchema,
    ProductUpdateSchema,
    StockInSchema,
    StockOutSchema,
    StockAdjustSchema,
    InventoryValidationSchema,
)
from backend.app.inventory.services import (
    list_categories,
    get_category_by_id,
    create_category,
    update_category,
    list_products,
    get_product,
    create_product,
    update_product,
    deactivate_product,
    record_stock_in,
    record_stock_out,
    record_stock_adjustment,
    get_low_stock_products,
    get_movement_history,
    validate_inventory_availability,
)

inventory_bp = Blueprint("inventory", __name__, url_prefix="/api/v1/inventory")


# ---------------------------------------------------------
# Category Endpoints
# ---------------------------------------------------------

@inventory_bp.route("/categories", methods=["GET"])
@jwt_required(optional=True)
def get_categories():
    """List product categories.
    
    Exposed publicly for the catalog. Non-staff callers receive active categories only.
    Staff can pass ?active_only=false to inspect inactive categories.
    """
    is_staff = current_user is not None and getattr(current_user, "is_staff", False)
    active_param = request.args.get("active_only")
    active_only = True
    if is_staff and active_param is not None:
        active_only = active_param.lower() in ("true", "1", "yes")

    categories = list_categories(active_only=active_only)
    return success_response(
        data={"categories": [c.to_dict(include_products_count=True) for c in categories]},
        meta={"total": len(categories)},
        status_code=200,
    )


@inventory_bp.route("/categories/<int:category_id>", methods=["GET"])
@jwt_required(optional=True)
def get_category_detail(category_id: int):
    """Retrieve details for a specific category."""
    category = get_category_by_id(category_id)
    is_staff = current_user is not None and getattr(current_user, "is_staff", False)
    if not category.is_active and not is_staff:
        raise NotFoundException(f"Category with ID {category_id} not found.")

    return success_response(
        data={"category": category.to_dict(include_products_count=True)},
        status_code=200,
    )


@inventory_bp.route("/categories", methods=["POST"])
@roles_required(RoleEnum.OWNER, RoleEnum.ADMIN, RoleEnum.SHOP_STAFF)
@validate_schema(ProductCategoryCreateSchema)
def create_new_category(validated_data):
    """Create a new product category."""
    category = create_category(
        name=validated_data["name"],
        slug=validated_data.get("slug"),
        description=validated_data.get("description"),
    )
    return success_response(
        data={"category": category.to_dict()},
        message=f"Category '{category.name}' created successfully.",
        status_code=201,
    )


@inventory_bp.route("/categories/<int:category_id>", methods=["PUT", "PATCH"])
@roles_required(RoleEnum.OWNER, RoleEnum.ADMIN, RoleEnum.SHOP_STAFF)
@validate_schema(ProductCategoryUpdateSchema)
def update_category_endpoint(category_id: int, validated_data):
    """Update category metadata or activation status."""
    category = update_category(
        category_id=category_id,
        name=validated_data.get("name"),
        slug=validated_data.get("slug"),
        description=validated_data.get("description"),
        is_active=validated_data.get("is_active"),
    )
    return success_response(
        data={"category": category.to_dict()},
        message=f"Category '{category.name}' updated successfully.",
        status_code=200,
    )


# ---------------------------------------------------------
# Product Catalog & Management Endpoints
# ---------------------------------------------------------

@inventory_bp.route("/products", methods=["GET"])
@jwt_required(optional=True)
def get_products():
    """List and filter products.
    
    Public catalog: unauthenticated visitors and members view active products.
    Staff can filter by is_active=false and low_stock_only=true.
    """
    is_staff = current_user is not None and getattr(current_user, "is_staff", False)

    category_id = request.args.get("category_id", type=int)
    category_slug = request.args.get("category") or request.args.get("category_slug")
    search_query = request.args.get("q") or request.args.get("search")
    low_stock_param = request.args.get("low_stock_only")
    low_stock_only = False
    if is_staff and low_stock_param is not None:
        low_stock_only = low_stock_param.lower() in ("true", "1", "yes")

    page = max(1, request.args.get("page", 1, type=int))
    per_page = min(100, max(1, request.args.get("per_page", 20, type=int)))

    # Permission check for inactive products
    active_param = request.args.get("is_active")
    if is_staff and active_param is not None:
        is_active = active_param.lower() in ("true", "1", "yes")
    else:
        is_active = True

    products, total = list_products(
        category_id=category_id,
        category_slug=category_slug,
        is_active=is_active,
        search=search_query,
        low_stock_only=low_stock_only,
        page=page,
        per_page=per_page,
    )

    return success_response(
        data={"products": [p.to_dict(include_cost=is_staff) for p in products]},
        meta={
            "total": total,
            "page": page,
            "per_page": per_page,
            "pages": (total + per_page - 1) // per_page if total > 0 else 1,
        },
        status_code=200,
    )


@inventory_bp.route("/products/<int:product_id>", methods=["GET"])
@jwt_required(optional=True)
def get_product_detail(product_id: int):
    """Retrieve details for a single product."""
    product = get_product(product_id)
    is_staff = current_user is not None and getattr(current_user, "is_staff", False)
    if not product.is_active and not is_staff:
        raise NotFoundException(f"Product with ID {product_id} not found.")

    return success_response(
        data={"product": product.to_dict(include_cost=is_staff)},
        status_code=200,
    )


@inventory_bp.route("/products", methods=["POST"])
@roles_required(RoleEnum.OWNER, RoleEnum.ADMIN, RoleEnum.SHOP_STAFF)
@validate_schema(ProductCreateSchema)
def create_new_product(validated_data):
    """Create a new product catalog item."""
    actor_id = getattr(current_user, "id", None)
    product = create_product(
        sku=validated_data["sku"],
        name=validated_data["name"],
        category_id=validated_data["category_id"],
        price=validated_data["price"],
        cost_price=validated_data.get("cost_price"),
        stock_quantity=validated_data.get("stock_quantity", 0),
        low_stock_threshold=validated_data.get("low_stock_threshold", 5),
        description=validated_data.get("description"),
        barcode=validated_data.get("barcode"),
        image_url=validated_data.get("image_url"),
        actor_id=actor_id,
    )

    return success_response(
        data={"product": product.to_dict()},
        message=f"Product '{product.name}' (SKU: {product.sku}) created successfully.",
        status_code=201,
    )


@inventory_bp.route("/products/<int:product_id>", methods=["PUT", "PATCH"])
@roles_required(RoleEnum.OWNER, RoleEnum.ADMIN, RoleEnum.SHOP_STAFF)
@validate_schema(ProductUpdateSchema)
def update_product_endpoint(product_id: int, validated_data):
    """Update product details.
    
    Direct updates to stock_quantity are rejected by schema and service.
    """
    product = update_product(
        product_id=product_id,
        name=validated_data.get("name"),
        category_id=validated_data.get("category_id"),
        price=validated_data.get("price"),
        cost_price=validated_data.get("cost_price"),
        low_stock_threshold=validated_data.get("low_stock_threshold"),
        description=validated_data.get("description"),
        is_active=validated_data.get("is_active"),
        barcode=validated_data.get("barcode"),
        image_url=validated_data.get("image_url"),
    )

    return success_response(
        data={"product": product.to_dict()},
        message=f"Product '{product.name}' updated successfully.",
        status_code=200,
    )


@inventory_bp.route("/products/<int:product_id>", methods=["DELETE"])
@roles_required(RoleEnum.OWNER, RoleEnum.ADMIN, RoleEnum.SHOP_STAFF)
def delete_product_endpoint(product_id: int):
    """Soft-deactivate product instead of hard deleting."""
    product = deactivate_product(product_id)
    return success_response(
        data={"product": product.to_dict()},
        message=f"Product '{product.name}' (SKU: {product.sku}) deactivated.",
        status_code=200,
    )


# ---------------------------------------------------------
# Inventory Stock Management Endpoints
# ---------------------------------------------------------

@inventory_bp.route("/products/<int:product_id>/stock-in", methods=["POST"])
@roles_required(RoleEnum.OWNER, RoleEnum.ADMIN, RoleEnum.SHOP_STAFF, RoleEnum.FRONT_DESK)
@validate_schema(StockInSchema)
def restock_product_endpoint(product_id: int, validated_data):
    """Restock inventory for a product."""
    actor_id = getattr(current_user, "id", None)
    movement = record_stock_in(
        product_id=product_id,
        quantity=validated_data["quantity"],
        reason=validated_data["reason"],
        actor_id=actor_id,
        notes=validated_data.get("notes"),
        reference_id=validated_data.get("reference_id"),
    )

    return success_response(
        data={
            "movement": movement.to_dict(),
            "product": movement.product.to_dict(),
        },
        message=f"Successfully restocked {movement.quantity_change} units for '{movement.product.name}'.",
        status_code=200,
    )


@inventory_bp.route("/products/<int:product_id>/stock-out", methods=["POST"])
@roles_required(RoleEnum.OWNER, RoleEnum.ADMIN, RoleEnum.SHOP_STAFF, RoleEnum.FRONT_DESK)
@validate_schema(StockOutSchema)
def stock_out_endpoint(product_id: int, validated_data):
    """Deduct stock for sales, usage, damage, or transfer.
    
    Guarantees stock never becomes negative and records the movement.
    """
    actor_id = getattr(current_user, "id", None)
    movement = record_stock_out(
        product_id=product_id,
        quantity=validated_data["quantity"],
        reason=validated_data["reason"],
        actor_id=actor_id,
        notes=validated_data.get("notes"),
        reference_id=validated_data.get("reference_id"),
    )

    return success_response(
        data={
            "movement": movement.to_dict(),
            "product": movement.product.to_dict(),
        },
        message=f"Successfully deducted {abs(movement.quantity_change)} units from '{movement.product.name}'.",
        status_code=200,
    )


@inventory_bp.route("/products/<int:product_id>/adjust", methods=["POST"])
@roles_required(RoleEnum.OWNER, RoleEnum.ADMIN, RoleEnum.SHOP_STAFF)
@validate_schema(StockAdjustSchema)
def stock_adjust_endpoint(product_id: int, validated_data):
    """Adjust product stock quantity to a specific level (audit/reconciliation)."""
    actor_id = getattr(current_user, "id", None)
    movement = record_stock_adjustment(
        product_id=product_id,
        new_quantity=validated_data["new_quantity"],
        reason=validated_data["reason"],
        actor_id=actor_id,
        notes=validated_data.get("notes"),
        reference_id=validated_data.get("reference_id"),
    )

    return success_response(
        data={
            "movement": movement.to_dict(),
            "product": movement.product.to_dict(),
        },
        message=f"Stock adjusted for '{movement.product.name}' to {movement.new_stock} units.",
        status_code=200,
    )


@inventory_bp.route("/low-stock", methods=["GET"])
@roles_required(RoleEnum.OWNER, RoleEnum.ADMIN, RoleEnum.SHOP_STAFF, RoleEnum.FRONT_DESK)
def low_stock_list_endpoint():
    """Retrieve all products that are at or below their low-stock threshold."""
    custom_threshold = request.args.get("threshold", type=int)
    low_stock_products = get_low_stock_products(threshold=custom_threshold)

    return success_response(
        data={"products": [p.to_dict() for p in low_stock_products]},
        meta={"total": len(low_stock_products)},
        status_code=200,
    )


@inventory_bp.route("/products/<int:product_id>/movements", methods=["GET"])
@roles_required(RoleEnum.OWNER, RoleEnum.ADMIN, RoleEnum.SHOP_STAFF, RoleEnum.FRONT_DESK)
def product_movements_endpoint(product_id: int):
    """Retrieve movement history for a specific product."""
    product = get_product(product_id)
    page = max(1, request.args.get("page", 1, type=int))
    per_page = min(100, max(1, request.args.get("per_page", 20, type=int)))

    movements, total = get_movement_history(
        product_id=product.id,
        page=page,
        per_page=per_page,
    )

    return success_response(
        data={"movements": [m.to_dict() for m in movements]},
        meta={
            "total": total,
            "product_id": product.id,
            "sku": product.sku,
            "page": page,
            "per_page": per_page,
            "pages": (total + per_page - 1) // per_page if total > 0 else 1,
        },
        status_code=200,
    )


@inventory_bp.route("/movements", methods=["GET"])
@roles_required(RoleEnum.OWNER, RoleEnum.ADMIN, RoleEnum.SHOP_STAFF, RoleEnum.FRONT_DESK)
def all_movements_endpoint():
    """Retrieve paginated inventory movement history across all products."""
    product_id = request.args.get("product_id", type=int)
    movement_type = request.args.get("movement_type")
    page = max(1, request.args.get("page", 1, type=int))
    per_page = min(100, max(1, request.args.get("per_page", 50, type=int)))

    movements, total = get_movement_history(
        product_id=product_id,
        movement_type=movement_type,
        page=page,
        per_page=per_page,
    )

    return success_response(
        data={"movements": [m.to_dict() for m in movements]},
        meta={
            "total": total,
            "page": page,
            "per_page": per_page,
            "pages": (total + per_page - 1) // per_page if total > 0 else 1,
        },
        status_code=200,
    )


@inventory_bp.route("/validate", methods=["POST"])
@jwt_required(optional=True)
@validate_schema(InventoryValidationSchema)
def validate_cart_endpoint(validated_data):
    """Validate item availability for orders, carts, and counter sales.
    
    Accepts a list of product IDs and quantities, returning availability status for each.
    """
    result = validate_inventory_availability(validated_data["items"])
    status_code = 200 if result["is_valid"] else 409

    return success_response(
        data=result,
        message="Inventory check passed." if result["is_valid"] else "One or more items are unavailable or out of stock.",
        status_code=status_code,
    )
