import enum
import uuid
from datetime import datetime
from decimal import Decimal
from typing import Optional, Dict, Any, List

from sqlalchemy import (
    CheckConstraint,
    Column,
    DateTime,
    Enum as SQLEnum,
    ForeignKey,
    Index,
    Integer,
    Numeric,
    String,
    Text,
    Boolean,
)
from sqlalchemy.orm import relationship

from backend.app.extensions import db
from backend.app.common.utils import utc_now


class TableStatus(str, enum.Enum):
    """Lifecycle status for cafeteria / bar tables."""
    AVAILABLE = "AVAILABLE"
    OCCUPIED = "OCCUPIED"
    RESERVED = "RESERVED"
    OUT_OF_SERVICE = "OUT_OF_SERVICE"

    @classmethod
    def has_value(cls, value: str) -> bool:
        if not value:
            return False
        return value.upper().strip() in cls._value2member_map_


class ShiftStatus(str, enum.Enum):
    """Status for staff shifts."""
    ACTIVE = "ACTIVE"
    CLOSED = "CLOSED"


class TabStatus(str, enum.Enum):
    """Lifecycle states for a POS tab / order."""
    OPEN = "OPEN"
    PAID = "PAID"
    CLOSED = "CLOSED"
    VOIDED = "VOIDED"


class TabPaymentStatus(str, enum.Enum):
    """Payment states for a POS tab."""
    UNPAID = "UNPAID"
    PARTIALLY_PAID = "PARTIALLY_PAID"
    PAID = "PAID"
    REFUNDED = "REFUNDED"


class KitchenStatus(str, enum.Enum):
    """Strict forward-only order preparation status."""
    PENDING = "PENDING"
    QUEUED = "QUEUED"
    PREPARING = "PREPARING"
    READY = "READY"
    SERVED = "SERVED"
    CANCELLED = "CANCELLED"


ALLOWED_KITCHEN_TRANSITIONS = {
    KitchenStatus.PENDING: {KitchenStatus.QUEUED, KitchenStatus.CANCELLED},
    KitchenStatus.QUEUED: {KitchenStatus.PREPARING, KitchenStatus.CANCELLED},
    KitchenStatus.PREPARING: {KitchenStatus.READY},
    KitchenStatus.READY: {KitchenStatus.SERVED},
    KitchenStatus.SERVED: set(),
    KitchenStatus.CANCELLED: set(),
}


def generate_tab_reference(prefix: str = "TAB") -> str:
    """Generate human-readable unique tab reference: TAB-YYYYMMDD-XXXX."""
    date_str = utc_now().strftime("%Y%m%d")
    random_suffix = uuid.uuid4().hex[:6].upper()
    return f"{prefix}-{date_str}-{random_suffix}"


def generate_shift_reference(prefix: str = "SFT") -> str:
    """Generate human-readable unique shift reference: SFT-YYYYMMDD-XXXX."""
    date_str = utc_now().strftime("%Y%m%d")
    random_suffix = uuid.uuid4().hex[:6].upper()
    return f"{prefix}-{date_str}-{random_suffix}"


class POSTable(db.Model):
    """Physical table or bar seating area in the club cafeteria / lounge."""

    __tablename__ = "pos_tables"

    id = Column(Integer, primary_key=True, autoincrement=True)
    table_number = Column(String(20), unique=True, nullable=False, index=True)
    name = Column(String(100), nullable=True)
    capacity = Column(Integer, nullable=False, default=4)
    status = Column(
        SQLEnum(TableStatus, native_enum=False),
        nullable=False,
        default=TableStatus.AVAILABLE,
        index=True,
    )
    is_active = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime, nullable=False, default=utc_now)
    updated_at = Column(DateTime, nullable=False, default=utc_now, onupdate=utc_now)

    # Relationships
    tabs = relationship("POSTab", back_populates="table", lazy="dynamic")

    __table_args__ = (
        CheckConstraint("capacity > 0", name="check_table_capacity_positive"),
    )

    def to_dict(self, include_current_tab: bool = True) -> Dict[str, Any]:
        data = {
            "id": self.id,
            "table_number": self.table_number,
            "name": self.name,
            "capacity": self.capacity,
            "status": self.status.value if hasattr(self.status, "value") else str(self.status),
            "is_active": self.is_active,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }
        if include_current_tab:
            current_tab = self.tabs.filter(POSTab.status.in_([TabStatus.OPEN, TabStatus.PAID])).first()
            data["current_tab"] = current_tab.to_dict(include_items=False) if current_tab else None
        return data


class POSMenuCategory(db.Model):
    """Categories for cafeteria and bar menu (e.g. Beverages, Snacks, Meals)."""

    __tablename__ = "pos_menu_categories"

    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(50), nullable=False)
    slug = Column(String(50), unique=True, nullable=False, index=True)
    display_order = Column(Integer, nullable=False, default=0)
    is_active = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime, nullable=False, default=utc_now)

    items = relationship("POSMenuItem", back_populates="category", lazy="select", cascade="all, delete-orphan")

    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "name": self.name,
            "slug": self.slug,
            "display_order": self.display_order,
            "is_active": self.is_active,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }


class POSMenuItem(db.Model):
    """Food and beverage catalog item served at the Champions Club bar/cafeteria."""

    __tablename__ = "pos_menu_items"

    id = Column(Integer, primary_key=True, autoincrement=True)
    category_id = Column(Integer, ForeignKey("pos_menu_categories.id"), nullable=False, index=True)
    code = Column(String(30), unique=True, nullable=False, index=True)
    name = Column(String(100), nullable=False, index=True)
    description = Column(Text, nullable=True)
    price = Column(Numeric(10, 2), nullable=False)
    tax_rate = Column(Numeric(5, 4), nullable=False, default=Decimal("0.0500"))  # 5% GST
    is_available = Column(Boolean, nullable=False, default=True)
    is_active = Column(Boolean, nullable=False, default=True)
    preparation_time_minutes = Column(Integer, nullable=False, default=10)
    created_at = Column(DateTime, nullable=False, default=utc_now)
    updated_at = Column(DateTime, nullable=False, default=utc_now, onupdate=utc_now)

    # Relationships
    category = relationship("POSMenuCategory", back_populates="items")

    __table_args__ = (
        CheckConstraint("price >= 0", name="check_pos_menu_item_price_non_negative"),
        CheckConstraint("tax_rate >= 0", name="check_pos_menu_item_tax_non_negative"),
    )

    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "category_id": self.category_id,
            "category_name": self.category.name if self.category else None,
            "category_slug": self.category.slug if self.category else None,
            "code": self.code,
            "name": self.name,
            "description": self.description,
            "price": float(self.price),
            "tax_rate": float(self.tax_rate),
            "is_available": self.is_available,
            "is_active": self.is_active,
            "preparation_time_minutes": self.preparation_time_minutes,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }


class StaffShift(db.Model):
    """Bar and cafeteria staff work shifts for daily accounting and audit tracking."""

    __tablename__ = "pos_shifts"

    id = Column(Integer, primary_key=True, autoincrement=True)
    shift_reference = Column(String(30), unique=True, nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    start_time = Column(DateTime, nullable=False, default=utc_now)
    end_time = Column(DateTime, nullable=True)
    status = Column(
        SQLEnum(ShiftStatus, native_enum=False),
        nullable=False,
        default=ShiftStatus.ACTIVE,
        index=True,
    )
    starting_cash = Column(Numeric(10, 2), nullable=False, default=Decimal("0.00"))
    ending_cash = Column(Numeric(10, 2), nullable=True)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, nullable=False, default=utc_now)
    updated_at = Column(DateTime, nullable=False, default=utc_now, onupdate=utc_now)

    # Relationships
    user = relationship("User", foreign_keys=[user_id])
    tabs = relationship("POSTab", back_populates="shift", lazy="dynamic")

    __table_args__ = (
        CheckConstraint("starting_cash >= 0", name="check_shift_starting_cash_non_negative"),
    )

    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "shift_reference": self.shift_reference,
            "user_id": self.user_id,
            "staff_name": f"{self.user.first_name} {self.user.last_name}" if self.user else None,
            "start_time": self.start_time.isoformat() if self.start_time else None,
            "end_time": self.end_time.isoformat() if self.end_time else None,
            "status": self.status.value if hasattr(self.status, "value") else str(self.status),
            "starting_cash": float(self.starting_cash),
            "ending_cash": float(self.ending_cash) if self.ending_cash is not None else None,
            "notes": self.notes,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }


class POSTab(db.Model):
    """Bar/Cafeteria order tab associated with a table, staff shift, and optional member."""

    __tablename__ = "pos_tabs"

    id = Column(Integer, primary_key=True, autoincrement=True)
    tab_reference = Column(String(30), unique=True, nullable=False, index=True)
    table_id = Column(Integer, ForeignKey("pos_tables.id"), nullable=False, index=True)
    shift_id = Column(Integer, ForeignKey("pos_shifts.id"), nullable=False, index=True)
    opened_by_user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    closed_by_user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    member_id = Column(Integer, ForeignKey("members.id"), nullable=True, index=True)
    customer_name = Column(String(100), nullable=False)
    status = Column(
        SQLEnum(TabStatus, native_enum=False),
        nullable=False,
        default=TabStatus.OPEN,
        index=True,
    )
    subtotal_amount = Column(Numeric(10, 2), nullable=False, default=Decimal("0.00"))
    discount_amount = Column(Numeric(10, 2), nullable=False, default=Decimal("0.00"))
    discount_pct = Column(Numeric(5, 2), nullable=False, default=Decimal("0.00"))
    tax_amount = Column(Numeric(10, 2), nullable=False, default=Decimal("0.00"))  # 5% GST
    total_amount = Column(Numeric(10, 2), nullable=False, default=Decimal("0.00"))
    paid_amount = Column(Numeric(10, 2), nullable=False, default=Decimal("0.00"))
    payment_status = Column(
        SQLEnum(TabPaymentStatus, native_enum=False),
        nullable=False,
        default=TabPaymentStatus.UNPAID,
        index=True,
    )
    payment_method = Column(String(20), nullable=True)  # CASH, CARD, UPI
    notes = Column(Text, nullable=True)
    void_reason = Column(Text, nullable=True)
    opened_at = Column(DateTime, nullable=False, default=utc_now)
    closed_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, nullable=False, default=utc_now)
    updated_at = Column(DateTime, nullable=False, default=utc_now, onupdate=utc_now)

    # Relationships
    table = relationship("POSTable", back_populates="tabs")
    shift = relationship("StaffShift", back_populates="tabs")
    opened_by = relationship("User", foreign_keys=[opened_by_user_id])
    closed_by = relationship("User", foreign_keys=[closed_by_user_id])
    member = relationship("Member", foreign_keys=[member_id])
    items = relationship(
        "POSOrderItem",
        back_populates="tab",
        cascade="all, delete-orphan",
        order_by="POSOrderItem.id",
    )

    __table_args__ = (
        CheckConstraint("subtotal_amount >= 0", name="check_pos_tab_subtotal_non_negative"),
        CheckConstraint("discount_amount >= 0", name="check_pos_tab_discount_non_negative"),
        CheckConstraint("tax_amount >= 0", name="check_pos_tab_tax_non_negative"),
        CheckConstraint("total_amount >= 0", name="check_pos_tab_total_non_negative"),
        CheckConstraint("paid_amount >= 0", name="check_pos_tab_paid_non_negative"),
        # Exactly one OPEN tab per table constraint
        Index(
            "uq_pos_open_tab_table",
            "table_id",
            unique=True,
            sqlite_where=(status == TabStatus.OPEN),
            postgresql_where=(status == TabStatus.OPEN),
        ),
    )

    def to_dict(self, include_items: bool = True) -> Dict[str, Any]:
        data = {
            "id": self.id,
            "tab_reference": self.tab_reference,
            "table_id": self.table_id,
            "table_number": self.table.table_number if self.table else None,
            "shift_id": self.shift_id,
            "shift_reference": self.shift.shift_reference if self.shift else None,
            "opened_by_user_id": self.opened_by_user_id,
            "opened_by_name": f"{self.opened_by.first_name} {self.opened_by.last_name}" if self.opened_by else None,
            "closed_by_user_id": self.closed_by_user_id,
            "closed_by_name": f"{self.closed_by.first_name} {self.closed_by.last_name}" if self.closed_by else None,
            "member_id": self.member_id,
            "customer_name": self.customer_name,
            "status": self.status.value if hasattr(self.status, "value") else str(self.status),
            "subtotal_amount": float(self.subtotal_amount),
            "discount_amount": float(self.discount_amount),
            "discount_pct": float(self.discount_pct),
            "tax_amount": float(self.tax_amount),
            "total_amount": float(self.total_amount),
            "paid_amount": float(self.paid_amount),
            "payment_status": self.payment_status.value if hasattr(self.payment_status, "value") else str(self.payment_status),
            "payment_method": self.payment_method,
            "notes": self.notes,
            "void_reason": self.void_reason,
            "opened_at": self.opened_at.isoformat() if self.opened_at else None,
            "closed_at": self.closed_at.isoformat() if self.closed_at else None,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }
        if include_items:
            data["items"] = [item.to_dict() for item in self.items]
        return data


class POSOrderItem(db.Model):
    """Line item in a cafeteria / bar tab with permanent price snapshot & kitchen workflow."""

    __tablename__ = "pos_order_items"

    id = Column(Integer, primary_key=True, autoincrement=True)
    tab_id = Column(Integer, ForeignKey("pos_tabs.id", ondelete="CASCADE"), nullable=False, index=True)
    menu_item_id = Column(Integer, ForeignKey("pos_menu_items.id"), nullable=False, index=True)
    item_name = Column(String(100), nullable=False)
    unit_price = Column(Numeric(10, 2), nullable=False)
    quantity = Column(Integer, nullable=False, default=1)
    discount_pct = Column(Numeric(5, 2), nullable=False, default=Decimal("0.00"))
    discount_amount = Column(Numeric(10, 2), nullable=False, default=Decimal("0.00"))
    tax_rate = Column(Numeric(5, 4), nullable=False, default=Decimal("0.0500"))  # 5% GST
    tax_amount = Column(Numeric(10, 2), nullable=False, default=Decimal("0.00"))
    subtotal_amount = Column(Numeric(10, 2), nullable=False)
    total_amount = Column(Numeric(10, 2), nullable=False)
    kitchen_status = Column(
        SQLEnum(KitchenStatus, native_enum=False),
        nullable=False,
        default=KitchenStatus.PENDING,
        index=True,
    )
    notes = Column(String(255), nullable=True)
    sent_to_kitchen_at = Column(DateTime, nullable=True)
    prepared_at = Column(DateTime, nullable=True)
    served_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, nullable=False, default=utc_now)
    updated_at = Column(DateTime, nullable=False, default=utc_now, onupdate=utc_now)

    # Relationships
    tab = relationship("POSTab", back_populates="items")
    menu_item = relationship("POSMenuItem")

    __table_args__ = (
        CheckConstraint("quantity > 0", name="check_pos_order_item_quantity_positive"),
        CheckConstraint("unit_price >= 0", name="check_pos_order_item_price_non_negative"),
        CheckConstraint("subtotal_amount >= 0", name="check_pos_order_item_subtotal_non_negative"),
        CheckConstraint("total_amount >= 0", name="check_pos_order_item_total_non_negative"),
    )

    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "tab_id": self.tab_id,
            "menu_item_id": self.menu_item_id,
            "item_name": self.item_name,
            "unit_price": float(self.unit_price),
            "quantity": self.quantity,
            "discount_pct": float(self.discount_pct),
            "discount_amount": float(self.discount_amount),
            "tax_rate": float(self.tax_rate),
            "tax_amount": float(self.tax_amount),
            "subtotal_amount": float(self.subtotal_amount),
            "total_amount": float(self.total_amount),
            "kitchen_status": self.kitchen_status.value if hasattr(self.kitchen_status, "value") else str(self.kitchen_status),
            "notes": self.notes,
            "sent_to_kitchen_at": self.sent_to_kitchen_at.isoformat() if self.sent_to_kitchen_at else None,
            "prepared_at": self.prepared_at.isoformat() if self.prepared_at else None,
            "served_at": self.served_at.isoformat() if self.served_at else None,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }
