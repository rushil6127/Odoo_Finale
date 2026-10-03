import enum
import uuid
from decimal import Decimal
from datetime import datetime
from typing import Optional, Dict, Any, List
from sqlalchemy import Numeric, DateTime, JSON, Text, UniqueConstraint, Index
from backend.app.extensions import db
from backend.app.common.utils import utc_now


class PaymentMethod(str, enum.Enum):
    """Exactly the four supported payment methods."""

    CASH = "CASH"
    CARD = "CARD"
    UPI = "UPI"
    ONLINE = "ONLINE"

    @classmethod
    def has_value(cls, value: str) -> bool:
        if not value:
            return False
        return value.upper().strip() in cls._value2member_map_


class PaymentStatus(str, enum.Enum):
    """Explicit payment lifecycle states."""

    PENDING = "PENDING"
    PAID = "PAID"
    FAILED = "FAILED"
    CANCELLED = "CANCELLED"
    REFUND_PENDING = "REFUND_PENDING"
    REFUNDED = "REFUNDED"


class PaymentItemType(str, enum.Enum):
    """Business entity types payable through the shared payment service."""

    BOOKING = "BOOKING"
    MEMBERSHIP = "MEMBERSHIP"
    SHOP_ORDER = "SHOP_ORDER"
    POS_ORDER = "POS_ORDER"
    INVOICE = "INVOICE"


def generate_payment_reference(prefix: str = "PAY") -> str:
    """Generate a clean, collision-resistant payment reference code."""
    unique_suffix = uuid.uuid4().hex[:8].upper()
    return f"{prefix}-{unique_suffix}"


class Payment(db.Model):
    """Shared payment entity for all club transactions."""

    __tablename__ = "payments"

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    payment_reference = db.Column(
        db.String(30),
        unique=True,
        nullable=False,
        index=True,
        default=generate_payment_reference,
    )
    amount = db.Column(Numeric(10, 2), nullable=False)
    currency = db.Column(db.String(10), default="INR", nullable=False)
    payment_method = db.Column(
        db.Enum(PaymentMethod, name="payment_method_enum"),
        nullable=False,
        index=True,
    )
    status = db.Column(
        db.Enum(PaymentStatus, name="payment_status_enum"),
        default=PaymentStatus.PENDING,
        nullable=False,
        index=True,
    )
    item_type = db.Column(
        db.Enum(PaymentItemType, name="payment_item_type_enum"),
        nullable=False,
        index=True,
    )
    item_id = db.Column(db.Integer, nullable=False, index=True)
    user_id = db.Column(
        db.Integer,
        db.ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    member_id = db.Column(
        db.Integer,
        db.ForeignKey("members.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    provider = db.Column(db.String(50), default="MANUAL", nullable=False)
    
    # Gateway / Razorpay specific tracking identifiers
    gateway_order_id = db.Column(db.String(100), unique=True, nullable=True, index=True)
    gateway_payment_id = db.Column(db.String(100), unique=True, nullable=True, index=True)
    gateway_refund_id = db.Column(db.String(100), unique=True, nullable=True, index=True)
    gateway_signature = db.Column(db.String(255), nullable=True)
    gateway_metadata = db.Column(JSON, default=dict, nullable=False)
    
    notes = db.Column(Text, nullable=True)
    paid_at = db.Column(DateTime(timezone=True), nullable=True)
    refunded_at = db.Column(DateTime(timezone=True), nullable=True)
    created_at = db.Column(DateTime(timezone=True), default=utc_now, nullable=False)
    updated_at = db.Column(
        DateTime(timezone=True),
        default=utc_now,
        onupdate=utc_now,
        nullable=False,
    )

    # Relationships
    user = db.relationship("User", backref=db.backref("payments", lazy="dynamic"))
    member = db.relationship("Member", backref=db.backref("payments", lazy="dynamic"))
    audits = db.relationship(
        "PaymentAudit",
        back_populates="payment",
        cascade="all, delete-orphan",
        order_by="PaymentAudit.created_at.asc()",
        lazy="selectin",
    )

    __table_args__ = (
        Index("ix_payments_item_lookup", "item_type", "item_id"),
    )

    @property
    def is_paid(self) -> bool:
        return self.status == PaymentStatus.PAID

    @property
    def is_refunded(self) -> bool:
        return self.status == PaymentStatus.REFUNDED

    @property
    def is_online(self) -> bool:
        return self.payment_method == PaymentMethod.ONLINE

    def to_dict(self, include_audits: bool = False, public_key_id: Optional[str] = None) -> Dict[str, Any]:
        """Serialize payment to dictionary without exposing sensitive secrets."""
        res: Dict[str, Any] = {
            "id": self.id,
            "payment_reference": self.payment_reference,
            "amount": float(self.amount),
            "currency": self.currency,
            "payment_method": self.payment_method.value if hasattr(self.payment_method, "value") else str(self.payment_method),
            "status": self.status.value if hasattr(self.status, "value") else str(self.status),
            "item_type": self.item_type.value if hasattr(self.item_type, "value") else str(self.item_type),
            "item_id": self.item_id,
            "user_id": self.user_id,
            "member_id": self.member_id,
            "provider": self.provider,
            "gateway_order_id": self.gateway_order_id,
            "gateway_payment_id": self.gateway_payment_id,
            "gateway_refund_id": self.gateway_refund_id,
            "notes": self.notes,
            "paid_at": self.paid_at.isoformat() if self.paid_at else None,
            "refunded_at": self.refunded_at.isoformat() if self.refunded_at else None,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }

        # Include checkout public key id if pending online payment
        if self.is_online and self.status == PaymentStatus.PENDING and public_key_id:
            res["razorpay_key_id"] = public_key_id

        if include_audits:
            res["audit_trail"] = [audit.to_dict() for audit in self.audits]

        return res

    def __repr__(self) -> str:
        return f"<Payment id={self.id} ref='{self.payment_reference}' amount={self.amount} status='{self.status}'>"


class PaymentAudit(db.Model):
    """Immutable audit trail for all payment state transitions."""

    __tablename__ = "payment_audits"

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    payment_id = db.Column(
        db.Integer,
        db.ForeignKey("payments.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    previous_status = db.Column(db.String(30), nullable=True)
    new_status = db.Column(db.String(30), nullable=False)
    action = db.Column(db.String(50), nullable=False)
    actor_id = db.Column(
        db.Integer,
        db.ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    actor_type = db.Column(db.String(50), default="SYSTEM", nullable=False)
    reason = db.Column(Text, nullable=True)
    metadata_snapshot = db.Column(JSON, default=dict, nullable=False)
    created_at = db.Column(DateTime(timezone=True), default=utc_now, nullable=False)

    payment = db.relationship("Payment", back_populates="audits")
    actor = db.relationship("User")

    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "payment_id": self.payment_id,
            "previous_status": self.previous_status,
            "new_status": self.new_status,
            "action": self.action,
            "actor_id": self.actor_id,
            "actor_type": self.actor_type,
            "reason": self.reason,
            "metadata_snapshot": self.metadata_snapshot or {},
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }

    def __repr__(self) -> str:
        return f"<PaymentAudit payment_id={self.payment_id} {self.previous_status}->{self.new_status}>"


class PaymentWebhookEvent(db.Model):
    """Deduplication and audit record for gateway webhook events."""

    __tablename__ = "payment_webhook_events"

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    event_id = db.Column(db.String(100), unique=True, nullable=False, index=True)
    event_type = db.Column(db.String(100), nullable=False, index=True)
    payment_id = db.Column(
        db.Integer,
        db.ForeignKey("payments.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    outcome = db.Column(db.String(50), nullable=False)
    processed_at = db.Column(DateTime(timezone=True), default=utc_now, nullable=False)
    error_message = db.Column(Text, nullable=True)
    created_at = db.Column(DateTime(timezone=True), default=utc_now, nullable=False)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "event_id": self.event_id,
            "event_type": self.event_type,
            "payment_id": self.payment_id,
            "outcome": self.outcome,
            "processed_at": self.processed_at.isoformat() if self.processed_at else None,
            "error_message": self.error_message,
        }

    def __repr__(self) -> str:
        return f"<PaymentWebhookEvent event_id='{self.event_id}' event_type='{self.event_type}' outcome='{self.outcome}'>"
