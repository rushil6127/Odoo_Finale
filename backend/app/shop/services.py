from decimal import Decimal
from datetime import datetime, date
from typing import Optional, Dict, Any, List, Tuple
from sqlalchemy import or_, and_, desc
from backend.app.extensions import db
from backend.app.common.utils import utc_now
from backend.app.common.errors import (
    NotFoundException,
    ValidationException,
    ConflictException,
    BusinessRuleException,
    ForbiddenException,
    InsufficientStockException,
)
from backend.app.inventory.models import Product
from backend.app.inventory.services import (
    record_stock_out,
    record_stock_in,
    _inventory_lock,
)
from backend.app.members.models import Member
from backend.app.memberships.services import get_active_membership
from backend.app.payments.models import Payment, PaymentStatus, PaymentMethod
from backend.app.payments.services import (
    create_or_initiate_payment,
    confirm_manual_payment,
    refund_payment,
    cancel_payment,
    get_payment_for_item,
)
from backend.app.shop.models import (
    ShopOrder,
    ShopOrderItem,
    OrderType,
    FulfillmentType,
    ShopOrderStatus,
    generate_order_reference,
)


ALLOWED_ORDER_TRANSITIONS = {
    ShopOrderStatus.PENDING: {
        ShopOrderStatus.CONFIRMED,
        ShopOrderStatus.CANCELLED,
    },
    ShopOrderStatus.CONFIRMED: {
        ShopOrderStatus.PROCESSING,
        ShopOrderStatus.CANCELLED,
    },
    ShopOrderStatus.PROCESSING: {
        ShopOrderStatus.READY_FOR_PICKUP,
        ShopOrderStatus.SHIPPED,
        ShopOrderStatus.COMPLETED,
        ShopOrderStatus.CANCELLED,
    },
    ShopOrderStatus.READY_FOR_PICKUP: {
        ShopOrderStatus.COMPLETED,
        ShopOrderStatus.CANCELLED,
    },
    ShopOrderStatus.SHIPPED: {
        ShopOrderStatus.COMPLETED,
        ShopOrderStatus.CANCELLED,
    },
    ShopOrderStatus.COMPLETED: set(),
    ShopOrderStatus.CANCELLED: set(),
}


def calculate_item_discount_pct(
    plan_code: Optional[str],
    category_slug: Optional[str],
    product_name: str = "",
) -> Decimal:
    """Calculate the applicable shop discount percentage based on active membership tier.
    
    Benefit matrix:
    - Gold: 20% on apparel, strings & gear (apparel, accessories, rackets)
    - Silver: 10% on Pro Shop equipment & apparel (rackets, apparel, accessories)
    - Junior: 15% on junior racket stringing, balls & footwear (balls, shoes, accessories/strings, junior rackets)
    - Products not covered by the plan benefit receive 0% discount.
    - Expired members or non-members receive 0% discount.
    """
    if not plan_code:
        return Decimal("0.00")

    code = plan_code.upper().strip()
    slug = (category_slug or "").lower().strip()
    p_name = (product_name or "").lower()

    if code == "GOLD":
        # 20% on apparel, strings & gear
        if slug in ("apparel", "rackets", "accessories"):
            return Decimal("20.00")
        return Decimal("0.00")

    elif code == "SILVER":
        # 10% on Pro Shop equipment & apparel
        if slug in ("rackets", "apparel", "accessories"):
            return Decimal("10.00")
        return Decimal("0.00")

    elif code == "JUNIOR":
        # 15% on junior racket stringing, balls & footwear
        if slug in ("balls", "shoes") or "string" in p_name or "junior" in p_name or slug == "accessories":
            return Decimal("15.00")
        return Decimal("0.00")

    return Decimal("0.00")


# ---------------------------------------------------------
# Order Creation & Management Workflows
# ---------------------------------------------------------

def create_shop_order(
    order_type: str,
    fulfillment_type: str,
    items_data: List[Dict[str, Any]],
    member_id: Optional[int] = None,
    customer_name: Optional[str] = None,
    customer_phone: Optional[str] = None,
    customer_email: Optional[str] = None,
    delivery_address: Optional[str] = None,
    payment_method: Optional[str] = None,
    notes: Optional[str] = None,
    requesting_user: Optional[Any] = None,
) -> ShopOrder:
    """Create a shop order (Counter sale or Online purchase).
    
    Transactional Guarantees:
    - Order creation, stock deduction, and totals calculation occur in one transaction.
    - If any product has insufficient stock, the entire transaction rolls back cleanly.
    - Prices and discounts are snapshotted permanently on the order items.
    - Counter sales and online orders deduct from the exact same inventory.
    """
    if not items_data:
        raise ValidationException("Order must contain at least one item.", code="EMPTY_ORDER")

    enum_order_type = OrderType(order_type.upper().strip())
    enum_fulfillment = FulfillmentType(fulfillment_type.upper().strip())

    if enum_order_type == OrderType.ONLINE:
        if payment_method and payment_method.upper().strip() not in ("CASH", "ONLINE"):
            raise ValidationException("Invalid payment method for online orders.")

    # 1. Delivery address validation: delivery requires an address, pickup does not.
    if enum_fulfillment == FulfillmentType.DELIVERY:
        if not delivery_address or not delivery_address.strip():
            raise ValidationException(
                "A delivery address is required for delivery orders.",
                code="DELIVERY_ADDRESS_REQUIRED",
            )
        delivery_address = delivery_address.strip()
    else:
        delivery_address = None

    # 2. Online orders require an active member account per project specification.
    member = None
    user_id = None
    created_by_id = None

    if requesting_user:
        if hasattr(requesting_user, "is_staff") and requesting_user.is_staff:
            created_by_id = requesting_user.id
        else:
            user_id = requesting_user.id

    if enum_order_type == OrderType.ONLINE:
        # Online order must be linked to a member
        # SECURITY: Non-staff users MUST only place orders under their own member account.
        is_staff = requesting_user is not None and getattr(requesting_user, "is_staff", False)
        target_member_id = member_id

        if not is_staff and requesting_user:
            member_record = Member.query.filter_by(user_id=requesting_user.id).first()
            if not member_record:
                raise ValidationException(
                    "Online shop orders require an authenticated club member account.",
                    code="MEMBER_ACCOUNT_REQUIRED",
                )
            if member_id and member_id != member_record.id:
                raise ForbiddenException(
                    "Members are not permitted to place orders under another member's account.",
                    code="MEMBER_MISMATCH",
                )
            target_member_id = member_record.id
        elif not target_member_id and requesting_user:
            # Look up member from user account
            member_record = Member.query.filter_by(user_id=requesting_user.id).first()
            if member_record:
                target_member_id = member_record.id

        if not target_member_id:
            raise ValidationException(
                "Online shop orders require an authenticated club member account.",
                code="MEMBER_ACCOUNT_REQUIRED",
            )

        member = db.session.get(Member, target_member_id)
        if not member:
            raise NotFoundException(f"Member with ID {target_member_id} not found.")

        member_id = member.id
        user_id = member.user_id or user_id
        customer_name = customer_name or (member.user.full_name if member.user else f"Member #{member.id}")
        customer_phone = customer_phone or member.phone
        customer_email = customer_email or (member.user.email if member.user else None)

    else:
        # Counter order
        if member_id:
            member = db.session.get(Member, member_id)
            if not member:
                raise NotFoundException(f"Member with ID {member_id} not found.")
            customer_name = customer_name or (member.user.full_name if member.user else f"Member #{member.id}")
            customer_phone = customer_phone or member.phone
            customer_email = customer_email or (member.user.email if member.user else None)
        else:
            if not customer_name or not customer_name.strip():
                customer_name = "Walk-in Customer"

    # 3. Determine active membership plan for discount calculation
    plan_code = None
    if member:
        active_ms = get_active_membership(member.id)
        if active_ms and active_ms.plan:
            plan_code = active_ms.plan.code

    actor_id = requesting_user.id if requesting_user else None
    order_ref = generate_order_reference("ORD")

    with _inventory_lock:
        # 4. Prepare Order and Items with price snapshots
        order = ShopOrder(
            order_reference=order_ref,
            order_type=enum_order_type,
            fulfillment_type=enum_fulfillment,
            status=ShopOrderStatus.PENDING,
            member_id=member_id,
            user_id=user_id,
            created_by_id=created_by_id,
            customer_name=customer_name.strip() if customer_name else "Customer",
            customer_phone=customer_phone.strip() if customer_phone else None,
            customer_email=customer_email.strip() if customer_email else None,
            delivery_address=delivery_address,
            subtotal_amount=Decimal("0.00"),
            discount_amount=Decimal("0.00"),
            delivery_fee=Decimal("0.00"),
            tax_amount=Decimal("0.00"),
            total_amount=Decimal("0.00"),
            payment_status="PENDING",
            payment_method=payment_method,
            notes=notes.strip() if notes else None,
        )
        db.session.add(order)
        db.session.flush()

        order_subtotal = Decimal("0.00")
        order_discount = Decimal("0.00")

        # 5. Process line items & stock deduction atomically
        try:
            for item in items_data:
                pid = item["product_id"]
                qty = item["quantity"]

                product = db.session.get(Product, pid)
                if not product:
                    raise NotFoundException(f"Product with ID {pid} not found.")

                if not product.is_active:
                    raise BusinessRuleException(
                        f"Product '{product.name}' (SKU: {product.sku}) is deactivated and cannot be sold.",
                        code="PRODUCT_DEACTIVATED",
                    )

                category_slug = product.category.slug if product.category else None
                disc_pct = calculate_item_discount_pct(plan_code, category_slug, product.name)

                unit_price = Decimal(str(product.price))
                cost_price = Decimal(str(product.cost_price)) if product.cost_price is not None else None
                item_subtotal = unit_price * Decimal(qty)
                item_discount = (item_subtotal * (disc_pct / Decimal("100.00"))).quantize(Decimal("0.01"))
                item_total = item_subtotal - item_discount

                order_item = ShopOrderItem(
                    order_id=order.id,
                    product_id=product.id,
                    product_sku=product.sku,
                    product_name=product.name,
                    unit_price=unit_price,
                    cost_price=cost_price,
                    quantity=qty,
                    discount_pct=disc_pct,
                    discount_amount=item_discount,
                    total_price=item_total,
                )
                db.session.add(order_item)

                # Deduct stock through inventory service
                record_stock_out(
                    product_id=product.id,
                    quantity=qty,
                    reason=f"SHOP_ORDER:{order.order_reference}",
                    actor_id=actor_id,
                    reference_id=order.order_reference,
                    auto_commit=False,
                )

                order_subtotal += item_subtotal
                order_discount += item_discount

            order.subtotal_amount = order_subtotal
            order.discount_amount = order_discount
            order.total_amount = order_subtotal - order_discount

            # 6. Payment integration through shared payment service
            chosen_method = payment_method or ("CASH" if enum_order_type == OrderType.COUNTER else "ONLINE")
            payment = create_or_initiate_payment(
                item_type="SHOP_ORDER",
                item_id=order.id,
                amount=order.total_amount,
                payment_method=chosen_method,
                user_id=order.user_id,
                member_id=order.member_id,
                notes=f"Payment for Shop Order {order.order_reference}",
            )

            if enum_order_type == OrderType.COUNTER and chosen_method in ("CASH", "CARD", "UPI"):
                # Existing counter manual payment
                confirm_manual_payment(
                    payment_id=payment.id,
                    staff_user=requesting_user,
                    notes=f"Settled counter sale via {chosen_method}",
                )
                order.payment_status = "PAID"
                order.payment_method = chosen_method
                order.status = ShopOrderStatus.CONFIRMED

            else:
                # Online orders (CASH or ONLINE)
                order.payment_status = "PENDING"
                order.payment_method = chosen_method
                
                # For PICKUP + CASH (Pay at Counter) or DELIVERY + CASH (COD)
                # We start as PENDING payment. Order status is CONFIRMED for CASH since it doesn't wait for gateway.
                # For ONLINE, it stays PENDING until Razorpay verifies.
                if chosen_method == "CASH":
                    order.status = ShopOrderStatus.CONFIRMED
                else:
                    order.status = ShopOrderStatus.PENDING

            db.session.commit()

            try:
                from backend.app.tasks.dispatcher import safe_enqueue_task
                from backend.app.tasks.jobs import send_order_notification_task
                safe_enqueue_task(send_order_notification_task, "SHOP", order.id)
            except Exception:
                pass

            return order

        except Exception:
            db.session.rollback()
            raise


def update_order_status(
    order_id: int,
    target_status: str,
    notes: Optional[str] = None,
    requesting_user: Optional[Any] = None,
) -> ShopOrder:
    """Transition shop order to the next valid lifecycle status."""
    order = db.session.get(ShopOrder, order_id)
    if not order:
        raise NotFoundException(f"Shop order with ID {order_id} not found.")

    target_enum = ShopOrderStatus(target_status.upper().strip())
    if order.status == target_enum:
        return order

    allowed = ALLOWED_ORDER_TRANSITIONS.get(order.status, set())
    if target_enum not in allowed:
        raise ValidationException(
            f"Cannot transition order '{order.order_reference}' from '{order.status.value}' to '{target_enum.value}'.",
            code="INVALID_STATUS_TRANSITION",
        )

    order.status = target_enum
    if notes:
        order.notes = f"{order.notes}\n{notes}".strip() if order.notes else notes.strip()

    db.session.commit()
    return order


def cancel_shop_order(
    order_id: int,
    reason: str,
    requesting_user: Optional[Any] = None,
) -> ShopOrder:
    """Cancel a shop order, restoring stock and refunding/cancelling payment."""
    order = db.session.get(ShopOrder, order_id)
    if not order:
        raise NotFoundException(f"Shop order with ID {order_id} not found.")

    if order.status == ShopOrderStatus.CANCELLED:
        return order

    if order.status == ShopOrderStatus.COMPLETED:
        raise BusinessRuleException(
            "Completed orders cannot be cancelled.",
            code="ORDER_ALREADY_COMPLETED",
        )

    with _inventory_lock:
        # 1. Restore stock for each item through inventory service
        actor_id = requesting_user.id if requesting_user else None
        for item in order.items:
            record_stock_in(
                product_id=item.product_id,
                quantity=item.quantity,
                reason=f"ORDER_CANCELLED:{order.order_reference}",
                actor_id=actor_id,
                reference_id=order.order_reference,
                auto_commit=False,
            )

        # 2. Handle payment through shared payment service
        payment = get_payment_for_item("SHOP_ORDER", order.id)
        if payment:
            if payment.status == PaymentStatus.PAID:
                refund_payment(
                    payment_id=payment.id,
                    requesting_user=requesting_user,
                    reason=f"Order {order.order_reference} cancelled: {reason}",
                )
                order.payment_status = "REFUNDED"
            elif payment.status == PaymentStatus.PENDING:
                cancel_payment(
                    payment_id=payment.id,
                    requesting_user=requesting_user,
                    reason=f"Order {order.order_reference} cancelled: {reason}",
                )
                order.payment_status = "CANCELLED"

        # 3. Update order status
        order.status = ShopOrderStatus.CANCELLED
        order.cancellation_reason = reason.strip()
        order.cancelled_at = utc_now()

        db.session.commit()
        return order


# ---------------------------------------------------------
# Order Queries
# ---------------------------------------------------------

def get_shop_order(order_id: int) -> ShopOrder:
    """Fetch order by ID or raise 404."""
    order = db.session.get(ShopOrder, order_id)
    if not order:
        raise NotFoundException(f"Shop order with ID {order_id} not found.")
    return order


def get_shop_order_by_reference(reference: str) -> Optional[ShopOrder]:
    """Fetch order by unique reference code."""
    return ShopOrder.query.filter_by(order_reference=reference.strip().upper()).first()


def list_shop_orders(
    order_type: Optional[str] = None,
    status: Optional[str] = None,
    fulfillment_type: Optional[str] = None,
    member_id: Optional[int] = None,
    user_id: Optional[int] = None,
    page: int = 1,
    per_page: int = 20,
) -> Tuple[List[ShopOrder], int]:
    """Retrieve filtered, paginated shop orders."""
    query = ShopOrder.query

    if order_type:
        query = query.filter(ShopOrder.order_type == order_type)
    if status:
        query = query.filter(ShopOrder.status == status)
    if fulfillment_type:
        query = query.filter(ShopOrder.fulfillment_type == fulfillment_type)
    if member_id:
        query = query.filter(ShopOrder.member_id == member_id)
    if user_id:
        query = query.filter(ShopOrder.user_id == user_id)

    total = query.count()
    orders = (
        query.order_by(desc(ShopOrder.created_at))
        .offset((page - 1) * per_page)
        .limit(per_page)
        .all()
    )
    return orders, total


def calculate_shop_quote(
    items_data: List[Dict[str, Any]],
    requesting_user: Optional[Any] = None,
) -> Dict[str, Any]:
    """Calculate a read-only price quote and member discount breakdown.
    
    Reuses existing calculate_item_discount_pct and pricing logic.
    Does NOT deduct inventory stock and does NOT create database records.
    """
    if not items_data:
        raise ValidationException("Quote request must contain at least one item.", code="EMPTY_QUOTE")

    member = None
    plan_code = None
    if requesting_user and hasattr(requesting_user, "id"):
        member = Member.query.filter_by(user_id=requesting_user.id).first()
        if member:
            active_ms = get_active_membership(member.id)
            if active_ms and active_ms.plan:
                plan_code = active_ms.plan.code

    quote_items = []
    subtotal = Decimal("0.00")
    total_discount = Decimal("0.00")

    for item in items_data:
        pid = item.get("product_id")
        qty = item.get("quantity", 1)

        product = db.session.get(Product, pid)
        if not product or not product.is_active:
            continue

        category_slug = product.category.slug if product.category else None
        disc_pct = calculate_item_discount_pct(plan_code, category_slug, product.name)

        unit_price = Decimal(str(product.price))
        item_subtotal = unit_price * Decimal(qty)
        item_discount = (item_subtotal * (disc_pct / Decimal("100.00"))).quantize(Decimal("0.01"))
        item_total = item_subtotal - item_discount

        quote_items.append({
            "product_id": product.id,
            "product_sku": product.sku,
            "product_name": product.name,
            "unit_price": float(unit_price),
            "quantity": qty,
            "stock_quantity": product.stock_quantity,
            "is_out_of_stock": product.stock_quantity < qty,
            "discount_pct": float(disc_pct),
            "discount_amount": float(item_discount),
            "total_price": float(item_total),
        })

        subtotal += item_subtotal
        total_discount += item_discount

    return {
        "items": quote_items,
        "subtotal_amount": float(subtotal),
        "discount_amount": float(total_discount),
        "delivery_fee": 0.0,
        "tax_amount": 0.0,
        "total_amount": float(subtotal - total_discount),
        "plan_code": plan_code,
        "member_discount_applied": member is not None and plan_code is not None,
    }

