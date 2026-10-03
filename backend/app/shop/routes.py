from flask import Blueprint, request
from flask_jwt_extended import jwt_required, current_user
from backend.app.common.responses import success_response
from backend.app.common.validation import validate_schema
from backend.app.common.permissions import roles_required, RoleEnum
from backend.app.common.errors import (
    NotFoundException,
    ForbiddenException,
    ValidationException,
    BusinessRuleException,
)
from backend.app.members.models import Member
from backend.app.shop.schemas import (
    ShopOrderCreateSchema,
    ShopOrderStatusUpdateSchema,
    ShopOrderCancelSchema,
)
from backend.app.shop.services import (
    create_shop_order,
    update_order_status,
    cancel_shop_order,
    get_shop_order,
    list_shop_orders,
)

shop_bp = Blueprint("shop", __name__, url_prefix="/api/v1/shop")


@shop_bp.route("/orders", methods=["POST"])
@jwt_required()
@validate_schema(ShopOrderCreateSchema)
def create_order_endpoint(validated_data):
    """Create a shop order.
    
    Roles:
    - COUNTER orders: Staff only (OWNER, ADMIN, SHOP_STAFF, FRONT_DESK).
    - ONLINE orders: Any authenticated user / member.
    """
    order_type = validated_data["order_type"].upper().strip()
    is_staff = getattr(current_user, "is_staff", False)

    if order_type == "COUNTER" and not is_staff:
        raise ForbiddenException("Only club staff can process counter sales.")

    order = create_shop_order(
        order_type=validated_data["order_type"],
        fulfillment_type=validated_data["fulfillment_type"],
        items_data=validated_data["items"],
        member_id=validated_data.get("member_id"),
        customer_name=validated_data.get("customer_name"),
        customer_phone=validated_data.get("customer_phone"),
        customer_email=validated_data.get("customer_email"),
        delivery_address=validated_data.get("delivery_address"),
        payment_method=validated_data.get("payment_method"),
        notes=validated_data.get("notes"),
        requesting_user=current_user,
    )

    return success_response(
        data={"order": order.to_dict(include_items=True)},
        message=f"Shop order '{order.order_reference}' created successfully.",
        status_code=201,
    )


@shop_bp.route("/orders", methods=["GET"])
@roles_required(RoleEnum.OWNER, RoleEnum.ADMIN, RoleEnum.SHOP_STAFF, RoleEnum.FRONT_DESK)
def list_orders_endpoint():
    """List and filter shop orders across the club (Staff only)."""
    order_type = request.args.get("order_type")
    status = request.args.get("status")
    fulfillment_type = request.args.get("fulfillment_type")
    member_id = request.args.get("member_id", type=int)
    page = max(1, request.args.get("page", 1, type=int))
    per_page = min(100, max(1, request.args.get("per_page", 20, type=int)))

    orders, total = list_shop_orders(
        order_type=order_type,
        status=status,
        fulfillment_type=fulfillment_type,
        member_id=member_id,
        page=page,
        per_page=per_page,
    )

    return success_response(
        data={"orders": [o.to_dict(include_items=False) for o in orders]},
        meta={
            "total": total,
            "page": page,
            "per_page": per_page,
            "pages": (total + per_page - 1) // per_page if total > 0 else 1,
        },
        status_code=200,
    )


@shop_bp.route("/orders/my-orders", methods=["GET"])
@jwt_required()
def my_orders_endpoint():
    """Retrieve orders placed by or associated with the currently authenticated user."""
    member_id = None
    member = Member.query.filter_by(user_id=current_user.id).first()
    if member:
        member_id = member.id

    page = max(1, request.args.get("page", 1, type=int))
    per_page = min(100, max(1, request.args.get("per_page", 20, type=int)))

    orders, total = list_shop_orders(
        user_id=current_user.id,
        member_id=member_id,
        page=page,
        per_page=per_page,
    )

    return success_response(
        data={"orders": [o.to_dict(include_items=True) for o in orders]},
        meta={
            "total": total,
            "page": page,
            "per_page": per_page,
            "pages": (total + per_page - 1) // per_page if total > 0 else 1,
        },
        status_code=200,
    )


@shop_bp.route("/orders/<int:order_id>", methods=["GET"])
@jwt_required()
def get_order_endpoint(order_id: int):
    """Retrieve details for a specific shop order.
    
    Members can only access their own orders; staff can access any order.
    """
    order = get_shop_order(order_id)
    is_staff = getattr(current_user, "is_staff", False)

    if not is_staff:
        # Check ownership
        user_matches = order.user_id == current_user.id
        member_matches = False
        if order.member_id:
            member = Member.query.filter_by(user_id=current_user.id).first()
            if member and member.id == order.member_id:
                member_matches = True

        if not (user_matches or member_matches):
            raise ForbiddenException("You do not have permission to view this order.")

    return success_response(
        data={"order": order.to_dict(include_items=True)},
        status_code=200,
    )


@shop_bp.route("/orders/<int:order_id>/status", methods=["POST"])
@roles_required(RoleEnum.OWNER, RoleEnum.ADMIN, RoleEnum.SHOP_STAFF, RoleEnum.FRONT_DESK)
@validate_schema(ShopOrderStatusUpdateSchema)
def update_status_endpoint(order_id: int, validated_data):
    """Update shop order status (Staff only)."""
    order = update_order_status(
        order_id=order_id,
        target_status=validated_data["status"],
        notes=validated_data.get("notes"),
        requesting_user=current_user,
    )

    return success_response(
        data={"order": order.to_dict(include_items=True)},
        message=f"Order '{order.order_reference}' updated to '{order.status.value}'.",
        status_code=200,
    )


@shop_bp.route("/orders/<int:order_id>/cancel", methods=["POST"])
@jwt_required()
@validate_schema(ShopOrderCancelSchema)
def cancel_order_endpoint(order_id: int, validated_data):
    """Cancel a shop order, restoring inventory and processing payment refund/cancellation."""
    order = get_shop_order(order_id)
    is_staff = getattr(current_user, "is_staff", False)

    if not is_staff:
        user_matches = order.user_id == current_user.id
        member_matches = False
        if order.member_id:
            member = Member.query.filter_by(user_id=current_user.id).first()
            if member and member.id == order.member_id:
                member_matches = True

        if not (user_matches or member_matches):
            raise ForbiddenException("You do not have permission to cancel this order.")

    cancelled = cancel_shop_order(
        order_id=order.id,
        reason=validated_data["reason"],
        requesting_user=current_user,
    )

    return success_response(
        data={"order": cancelled.to_dict(include_items=True)},
        message=f"Order '{cancelled.order_reference}' has been cancelled and stock restored.",
        status_code=200,
    )
