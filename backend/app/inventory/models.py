import enum
import uuid
from decimal import Decimal
from datetime import datetime
from typing import Optional, Dict, Any, List
from sqlalchemy import Numeric, DateTime, Text, UniqueConstraint, CheckConstraint, Index, func
from backend.app.extensions import db
from backend.app.common.utils import utc_now


class MovementType(str, enum.Enum):
    """Types of inventory stock transactions."""

    STOCK_IN = "STOCK_IN"
    STOCK_OUT = "STOCK_OUT"
    ADJUSTMENT = "ADJUSTMENT"

    @classmethod
    def has_value(cls, value: str) -> bool:
        if not value:
            return False
        return value.upper().strip() in cls._value2member_map_


def generate_movement_reference(prefix: str = "MOV") -> str:
    """Generate a clean, collision-resistant inventory movement reference code."""
    unique_suffix = uuid.uuid4().hex[:8].upper()
    return f"{prefix}-{unique_suffix}"


class ProductCategory(db.Model):
    """Dynamic product category entity (e.g. Rackets, Balls, Shoes, Apparel, Accessories).
    
    Categories are stored as data and are fully configurable by staff/admin.
    """

    __tablename__ = "product_categories"

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    name = db.Column(db.String(100), unique=True, nullable=False, index=True)
    slug = db.Column(db.String(100), unique=True, nullable=False, index=True)
    description = db.Column(Text, nullable=True)
    is_active = db.Column(db.Boolean, default=True, nullable=False, index=True)
    created_at = db.Column(DateTime(timezone=True), default=utc_now, nullable=False)
    updated_at = db.Column(
        DateTime(timezone=True),
        default=utc_now,
        onupdate=utc_now,
        nullable=False,
    )

    # Relationships
    products = db.relationship("Product", back_populates="category", lazy="dynamic")

    def to_dict(self, include_products_count: bool = False) -> dict:
        """Serialize category to dictionary representation."""
        data = {
            "id": self.id,
            "name": self.name,
            "slug": self.slug,
            "description": self.description,
            "is_active": self.is_active,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }
        if include_products_count:
            data["products_count"] = self.products.filter_by(is_active=True).count()
        return data

    def __repr__(self) -> str:
        return f"<ProductCategory id={self.id} name='{self.name}' slug='{self.slug}'>"


class Product(db.Model):
    """Product model for club shop, equipment, accessories, and online sales.
    
    Both counter sales and online shop orders draw from this single inventory source.
    Stock quantities are strictly managed through inventory movements and cannot become negative.
    """

    __tablename__ = "products"

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    sku = db.Column(db.String(50), unique=True, nullable=False, index=True)
    name = db.Column(db.String(200), nullable=False, index=True)
    description = db.Column(Text, nullable=True)
    category_id = db.Column(
        db.Integer,
        db.ForeignKey("product_categories.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    price = db.Column(Numeric(10, 2), nullable=False)
    cost_price = db.Column(Numeric(10, 2), nullable=True)
    stock_quantity = db.Column(db.Integer, default=0, nullable=False, index=True)
    low_stock_threshold = db.Column(db.Integer, default=5, nullable=False)
    is_active = db.Column(db.Boolean, default=True, nullable=False, index=True)
    barcode = db.Column(db.String(100), unique=True, nullable=True, index=True)
    image_url = db.Column(db.String(500), nullable=True)
    created_at = db.Column(DateTime(timezone=True), default=utc_now, nullable=False)
    updated_at = db.Column(
        DateTime(timezone=True),
        default=utc_now,
        onupdate=utc_now,
        nullable=False,
    )

    __table_args__ = (
        CheckConstraint("stock_quantity >= 0", name="ck_products_stock_quantity_non_negative"),
        CheckConstraint("price >= 0", name="ck_products_price_non_negative"),
        CheckConstraint("low_stock_threshold >= 0", name="ck_products_low_stock_threshold_non_negative"),
        Index("ix_products_category_active", "category_id", "is_active"),
        Index("ix_products_low_stock", "stock_quantity", "low_stock_threshold"),
    )

    # Relationships
    category = db.relationship("ProductCategory", back_populates="products")
    movements = db.relationship(
        "InventoryMovement",
        back_populates="product",
        lazy="dynamic",
        cascade="all, delete-orphan",
        order_by="desc(InventoryMovement.created_at)",
    )

    @property
    def is_low_stock(self) -> bool:
        """Indicates whether product stock is at or below the low-stock threshold."""
        return self.stock_quantity <= self.low_stock_threshold

    @property
    def is_out_of_stock(self) -> bool:
        """Indicates whether product has zero units available."""
        return self.stock_quantity <= 0

    def to_dict(self) -> dict:
        """Serialize product to dictionary representation."""
        return {
            "id": self.id,
            "sku": self.sku,
            "name": self.name,
            "description": self.description,
            "category_id": self.category_id,
            "category_name": self.category.name if self.category else None,
            "category_slug": self.category.slug if self.category else None,
            "price": float(self.price) if self.price is not None else 0.0,
            "cost_price": float(self.cost_price) if self.cost_price is not None else None,
            "stock_quantity": self.stock_quantity,
            "low_stock_threshold": self.low_stock_threshold,
            "is_low_stock": self.is_low_stock,
            "is_out_of_stock": self.is_out_of_stock,
            "is_active": self.is_active,
            "barcode": self.barcode,
            "image_url": self.image_url,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }

    def __repr__(self) -> str:
        return f"<Product id={self.id} sku='{self.sku}' name='{self.name}' stock={self.stock_quantity}>"


class InventoryMovement(db.Model):
    """Immutable audit trail of every stock modification.
    
    Tracks who changed stock, by how much, previous/new stock levels, and the business reason.
    """

    __tablename__ = "inventory_movements"

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    movement_reference = db.Column(db.String(30), unique=True, nullable=False, index=True)
    product_id = db.Column(
        db.Integer,
        db.ForeignKey("products.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    movement_type = db.Column(
        db.Enum(MovementType, name="inventory_movement_type_enum"),
        nullable=False,
        index=True,
    )
    quantity_change = db.Column(db.Integer, nullable=False)
    previous_stock = db.Column(db.Integer, nullable=False)
    new_stock = db.Column(db.Integer, nullable=False)
    reason = db.Column(db.String(255), nullable=False)
    notes = db.Column(Text, nullable=True)
    reference_id = db.Column(db.String(100), nullable=True, index=True)
    actor_id = db.Column(
        db.Integer,
        db.ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    created_at = db.Column(DateTime(timezone=True), default=utc_now, nullable=False, index=True)

    __table_args__ = (
        Index("ix_movements_product_created", "product_id", "created_at"),
    )

    # Relationships
    product = db.relationship("Product", back_populates="movements")
    actor = db.relationship("User", foreign_keys=[actor_id])

    def to_dict(self) -> dict:
        """Serialize inventory movement to dictionary representation."""
        actor_name = None
        if self.actor:
            actor_name = self.actor.full_name or self.actor.email

        return {
            "id": self.id,
            "movement_reference": self.movement_reference,
            "product_id": self.product_id,
            "product_name": self.product.name if self.product else None,
            "product_sku": self.product.sku if self.product else None,
            "movement_type": (
                self.movement_type.value
                if hasattr(self.movement_type, "value")
                else str(self.movement_type)
            ),
            "quantity_change": self.quantity_change,
            "previous_stock": self.previous_stock,
            "new_stock": self.new_stock,
            "reason": self.reason,
            "notes": self.notes,
            "reference_id": self.reference_id,
            "actor_id": self.actor_id,
            "actor_name": actor_name,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }

    def __repr__(self) -> str:
        return (
            f"<InventoryMovement id={self.id} ref='{self.movement_reference}' "
            f"product_id={self.product_id} type='{self.movement_type}' "
            f"delta={self.quantity_change} stock={self.previous_stock}->{self.new_stock}>"
        )
