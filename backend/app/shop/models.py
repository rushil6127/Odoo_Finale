import enum
import uuid
from decimal import Decimal
from datetime import datetime
from typing import Optional, Dict, Any, List
from sqlalchemy import Numeric, DateTime, Text, CheckConstraint, Index
from backend.app.extensions import db
from backend.app.common.utils import utc_now


class OrderType(str, enum.Enum):
    """Channel through which the shop order was placed."""

    COUNTER = "COUNTER"
    ONLINE = "ONLINE"

    @classmethod
    def has_value(cls, value: str) -> bool:
        if not value:
            return False
        return value.upper().strip() in cls._value2member_map_


class FulfillmentType(str, enum.Enum):
    """Method of order fulfillment."""

    PICKUP = "PICKUP"
    DELIVERY = "DELIVERY"

    @classmethod
    def has_value(cls, value: str) -> bool:
        if not value:
            return False
        return value.upper().strip() in cls._value2member_map_


class ShopOrderStatus(str, enum.Enum):
    """Explicit lifecycle statuses for a shop order."""

    PENDING = "PENDING"
    CONFIRMED = "CONFIRMED"
    PROCESSING = "PROCESSING"
    READY_FOR_PICKUP = "READY_FOR_PICKUP"
    SHIPPED = "SHIPPED"
    COMPLETED = "COMPLETED"
    CANCELLED = "CANCELLED"

    @classmethod
    def has_value(cls, value: str) -> bool:
        if not value:
            return False
        return value.upper().strip() in cls._value2member_map_


def generate_order_reference(prefix: str = "ORD") -> str:
    """Generate a clean, unique shop order reference code."""
    unique_suffix = uuid.uuid4().hex[:8].upper()
    return f"{prefix}-{unique_suffix}"


class ShopOrder(db.Model):
    """Shop order entity for counter sales and online member purchases."""

    __tablename__ = "shop_orders"

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    order_reference = db.Column(db.String(30), unique=True, nullable=False, index=True)
    order_type = db.Column(
        db.Enum(OrderType, name="shop_order_type_enum"),
        nullable=False,
        default=OrderType.COUNTER,
        index=True,
    )
    fulfillment_type = db.Column(
        db.Enum(FulfillmentType, name="shop_fulfillment_type_enum"),
        nullable=False,
        default=FulfillmentType.PICKUP,
        index=True,
    )
    status = db.Column(
        db.Enum(ShopOrderStatus, name="shop_order_status_enum"),
        nullable=False,
        default=ShopOrderStatus.PENDING,
        index=True,
    )

    # Customer & Member relationship
    member_id = db.Column(
        db.Integer,
        db.ForeignKey("members.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    user_id = db.Column(
        db.Integer,
        db.ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    created_by_id = db.Column(
        db.Integer,
        db.ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    customer_name = db.Column(db.String(100), nullable=False)
    customer_phone = db.Column(db.String(20), nullable=True)
    customer_email = db.Column(db.String(255), nullable=True)
    delivery_address = db.Column(Text, nullable=True)

    # Financials (snapshotted at checkout)
    subtotal_amount = db.Column(Numeric(10, 2), nullable=False, default=0.0)
    discount_amount = db.Column(Numeric(10, 2), nullable=False, default=0.0)
    delivery_fee = db.Column(Numeric(10, 2), nullable=False, default=0.0)
    tax_amount = db.Column(Numeric(10, 2), nullable=False, default=0.0)
    total_amount = db.Column(Numeric(10, 2), nullable=False, default=0.0)

    # Payment sync state
    payment_status = db.Column(db.String(30), nullable=False, default="PENDING")
    payment_method = db.Column(db.String(30), nullable=True)

    notes = db.Column(Text, nullable=True)
    cancellation_reason = db.Column(Text, nullable=True)
    cancelled_at = db.Column(DateTime(timezone=True), nullable=True)
    created_at = db.Column(DateTime(timezone=True), default=utc_now, nullable=False, index=True)
    updated_at = db.Column(
        DateTime(timezone=True),
        default=utc_now,
        onupdate=utc_now,
        nullable=False,
    )

    __table_args__ = (
        CheckConstraint("subtotal_amount >= 0", name="ck_shop_orders_subtotal_non_negative"),
        CheckConstraint("discount_amount >= 0", name="ck_shop_orders_discount_non_negative"),
        CheckConstraint("total_amount >= 0", name="ck_shop_orders_total_non_negative"),
        Index("ix_shop_orders_member_created", "member_id", "created_at"),
        Index("ix_shop_orders_status_created", "status", "created_at"),
    )

    # Relationships
    items = db.relationship(
        "ShopOrderItem",
        back_populates="order",
        cascade="all, delete-orphan",
        lazy="joined",
    )
    member = db.relationship("Member", backref=db.backref("shop_orders", lazy="dynamic"))
    user = db.relationship("User", foreign_keys=[user_id])
    created_by = db.relationship("User", foreign_keys=[created_by_id])

    def to_dict(self, include_items: bool = True) -> dict:
        """Serialize shop order to dictionary representation."""
        data = {
            "id": self.id,
            "order_reference": self.order_reference,
            "order_type": self.order_type.value if hasattr(self.order_type, "value") else str(self.order_type),
            "fulfillment_type": (
                self.fulfillment_type.value
                if hasattr(self.fulfillment_type, "value")
                else str(self.fulfillment_type)
            ),
            "status": self.status.value if hasattr(self.status, "value") else str(self.status),
            "member_id": self.member_id,
            "user_id": self.user_id,
            "created_by_id": self.created_by_id,
            "customer_name": self.customer_name,
            "customer_phone": self.customer_phone,
            "customer_email": self.customer_email,
            "delivery_address": self.delivery_address,
            "subtotal_amount": float(self.subtotal_amount),
            "discount_amount": float(self.discount_amount),
            "delivery_fee": float(self.delivery_fee),
            "tax_amount": float(self.tax_amount),
            "total_amount": float(self.total_amount),
            "payment_status": self.payment_status,
            "payment_method": self.payment_method,
            "notes": self.notes,
            "cancellation_reason": self.cancellation_reason,
            "cancelled_at": self.cancelled_at.isoformat() if self.cancelled_at else None,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }
        if include_items:
            data["items"] = [item.to_dict() for item in self.items]
            data["total_items_count"] = sum(item.quantity for item in self.items)
        return data

    def __repr__(self) -> str:
        return f"<ShopOrder id={self.id} ref='{self.order_reference}' status='{self.status}' total={self.total_amount}>"


class ShopOrderItem(db.Model):
    """Line item within a shop order with permanent price snapshot."""

    __tablename__ = "shop_order_items"

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    order_id = db.Column(
        db.Integer,
        db.ForeignKey("shop_orders.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    product_id = db.Column(
        db.Integer,
        db.ForeignKey("products.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )

    # Immutable Pricing & Product Snapshot
    product_sku = db.Column(db.String(50), nullable=False)
    product_name = db.Column(db.String(200), nullable=False)
    unit_price = db.Column(Numeric(10, 2), nullable=False)
    cost_price = db.Column(Numeric(10, 2), nullable=True)
    quantity = db.Column(db.Integer, nullable=False, default=1)
    discount_pct = db.Column(Numeric(5, 2), nullable=False, default=0.0)
    discount_amount = db.Column(Numeric(10, 2), nullable=False, default=0.0)
    total_price = db.Column(Numeric(10, 2), nullable=False)

    __table_args__ = (
        CheckConstraint("quantity > 0", name="ck_shop_order_items_quantity_positive"),
        CheckConstraint("unit_price >= 0", name="ck_shop_order_items_unit_price_non_negative"),
        CheckConstraint("discount_pct >= 0", name="ck_shop_order_items_discount_pct_non_negative"),
        CheckConstraint("total_price >= 0", name="ck_shop_order_items_total_price_non_negative"),
    )

    # Relationships
    order = db.relationship("ShopOrder", back_populates="items")
    product = db.relationship("Product")

    def to_dict(self) -> dict:
        """Serialize order line item to dictionary representation."""
        return {
            "id": self.id,
            "order_id": self.order_id,
            "product_id": self.product_id,
            "product_sku": self.product_sku,
            "product_name": self.product_name,
            "unit_price": float(self.unit_price),
            "cost_price": float(self.cost_price) if self.cost_price is not None else None,
            "quantity": self.quantity,
            "discount_pct": float(self.discount_pct),
            "discount_amount": float(self.discount_amount),
            "total_price": float(self.total_price),
        }

    def __repr__(self) -> str:
        return (
            f"<ShopOrderItem id={self.id} order_id={self.order_id} "
            f"sku='{self.product_sku}' qty={self.quantity} total={self.total_price}>"
        )
