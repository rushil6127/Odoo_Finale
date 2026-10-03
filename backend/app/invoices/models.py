"""
Invoices, Business Clients, and Configurable Tax Rates Models for Champions Club.
================================================================================
Implements business invoice management, configurable tax rates, and client records.
Tax rates are data-driven and not hardcoded to any specific jurisdiction.
Issued invoices are immutable except for voiding.
"""

import enum
import uuid
from datetime import datetime, date
from decimal import Decimal
from typing import Optional, Dict, Any, List

from sqlalchemy import (
    Column,
    Integer,
    String,
    Text,
    DateTime,
    Date,
    Numeric,
    Boolean,
    ForeignKey,
    Index,
    CheckConstraint,
    Enum as SQLEnum,
)
from sqlalchemy.orm import relationship

from backend.app.extensions import db
from backend.app.common.utils import utc_now


class InvoiceStatus(str, enum.Enum):
    """Lifecycle states for a business/client invoice."""
    DRAFT = "DRAFT"
    ISSUED = "ISSUED"
    PAID = "PAID"
    VOIDED = "VOIDED"
    CANCELLED = "CANCELLED"

    @classmethod
    def has_value(cls, value: str) -> bool:
        if not value:
            return False
        return value.upper().strip() in cls._value2member_map_


def generate_invoice_number(prefix: str = "INV") -> str:
    """Generate clean, unique invoice number: INV-YYYYMM-XXXX."""
    date_str = utc_now().strftime("%Y%m")
    unique_suffix = uuid.uuid4().hex[:6].upper()
    return f"{prefix}-{date_str}-{unique_suffix}"


def generate_client_code(prefix: str = "CLI") -> str:
    """Generate clean, unique business client code: CLI-YYYYMM-XXXX."""
    date_str = utc_now().strftime("%Y%m")
    unique_suffix = uuid.uuid4().hex[:4].upper()
    return f"{prefix}-{date_str}-{unique_suffix}"


class TaxRate(db.Model):
    """
    Configurable tax rate entity.
    Tax rates are dynamic data rather than hardcoded assumptions.
    """

    __tablename__ = "tax_rates"

    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(50), nullable=False)
    code = Column(String(30), unique=True, nullable=False, index=True)
    rate = Column(Numeric(5, 4), nullable=False, default=Decimal("0.1800"))
    description = Column(Text, nullable=True)
    is_active = Column(Boolean, nullable=False, default=True)
    is_default = Column(Boolean, nullable=False, default=False)
    created_at = Column(DateTime(timezone=True), nullable=False, default=utc_now)
    updated_at = Column(DateTime(timezone=True), nullable=False, default=utc_now, onupdate=utc_now)

    __table_args__ = (
        CheckConstraint("rate >= 0", name="check_tax_rate_non_negative"),
    )

    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "name": self.name,
            "code": self.code,
            "rate": float(self.rate),
            "percentage": float(self.rate * 100),
            "description": self.description,
            "is_active": self.is_active,
            "is_default": self.is_default,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }

    def __repr__(self) -> str:
        return f"<TaxRate id={self.id} code='{self.code}' rate={self.rate}>"


class BusinessClient(db.Model):
    """
    Corporate sponsors, tournament organizers, and business partner profiles.
    """

    __tablename__ = "business_clients"

    id = Column(Integer, primary_key=True, autoincrement=True)
    client_code = Column(String(30), unique=True, nullable=False, index=True, default=generate_client_code)
    company_name = Column(String(150), nullable=False, index=True)
    contact_person = Column(String(100), nullable=False)
    email = Column(String(120), nullable=False, index=True)
    phone = Column(String(20), nullable=True)
    tax_id = Column(String(50), nullable=True)  # GSTIN, VAT, or local tax ID
    billing_address = Column(Text, nullable=True)
    is_active = Column(Boolean, nullable=False, default=True)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), nullable=False, default=utc_now)
    updated_at = Column(DateTime(timezone=True), nullable=False, default=utc_now, onupdate=utc_now)

    # Relationships
    invoices = relationship("Invoice", back_populates="client", lazy="dynamic")

    def to_dict(self, include_invoices_count: bool = False) -> Dict[str, Any]:
        data = {
            "id": self.id,
            "client_code": self.client_code,
            "company_name": self.company_name,
            "contact_person": self.contact_person,
            "email": self.email,
            "phone": self.phone,
            "tax_id": self.tax_id,
            "billing_address": self.billing_address,
            "is_active": self.is_active,
            "notes": self.notes,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }
        if include_invoices_count:
            data["invoices_count"] = self.invoices.count()
        return data

    def __repr__(self) -> str:
        return f"<BusinessClient id={self.id} code='{self.client_code}' company='{self.company_name}'>"


class Invoice(db.Model):
    """
    Business invoice entity.
    Issued invoices are immutable except for voiding.
    Payment is processed through the shared payment service (item_type=INVOICE).
    """

    __tablename__ = "invoices"

    id = Column(Integer, primary_key=True, autoincrement=True)
    invoice_number = Column(String(30), unique=True, nullable=False, index=True, default=generate_invoice_number)
    client_id = Column(Integer, ForeignKey("business_clients.id", ondelete="SET NULL"), nullable=True, index=True)
    member_id = Column(Integer, ForeignKey("members.id", ondelete="SET NULL"), nullable=True, index=True)
    
    # Snapshotted billing details
    client_name = Column(String(150), nullable=False)
    client_email = Column(String(120), nullable=True)
    client_address = Column(Text, nullable=True)
    tax_id = Column(String(50), nullable=True)

    status = Column(
        SQLEnum(InvoiceStatus, native_enum=False),
        nullable=False,
        default=InvoiceStatus.DRAFT,
        index=True,
    )
    issue_date = Column(Date, nullable=False, default=date.today)
    due_date = Column(Date, nullable=False)

    # Financial breakdown
    subtotal_amount = Column(Numeric(10, 2), nullable=False, default=Decimal("0.00"))
    tax_rate_id = Column(Integer, ForeignKey("tax_rates.id", ondelete="RESTRICT"), nullable=True)
    tax_rate_value = Column(Numeric(5, 4), nullable=False, default=Decimal("0.0000"))
    tax_amount = Column(Numeric(10, 2), nullable=False, default=Decimal("0.00"))
    total_amount = Column(Numeric(10, 2), nullable=False, default=Decimal("0.00"))
    paid_amount = Column(Numeric(10, 2), nullable=False, default=Decimal("0.00"))

    notes = Column(Text, nullable=True)
    terms = Column(Text, nullable=True)
    void_reason = Column(Text, nullable=True)
    created_by_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)

    issued_at = Column(DateTime(timezone=True), nullable=True)
    paid_at = Column(DateTime(timezone=True), nullable=True)
    voided_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), nullable=False, default=utc_now)
    updated_at = Column(DateTime(timezone=True), nullable=False, default=utc_now, onupdate=utc_now)

    # Relationships
    client = relationship("BusinessClient", back_populates="invoices")
    member = relationship("Member")
    tax_rate = relationship("TaxRate")
    created_by = relationship("User", foreign_keys=[created_by_id])
    items = relationship(
        "InvoiceItem",
        back_populates="invoice",
        cascade="all, delete-orphan",
        order_by="InvoiceItem.id.asc()",
        lazy="selectin",
    )

    __table_args__ = (
        CheckConstraint("subtotal_amount >= 0", name="check_invoice_subtotal_non_negative"),
        CheckConstraint("tax_amount >= 0", name="check_invoice_tax_non_negative"),
        CheckConstraint("total_amount >= 0", name="check_invoice_total_non_negative"),
        CheckConstraint("paid_amount >= 0", name="check_invoice_paid_non_negative"),
        Index("ix_invoices_status_due", "status", "due_date"),
    )

    @property
    def is_draft(self) -> bool:
        return self.status == InvoiceStatus.DRAFT

    @property
    def is_issued(self) -> bool:
        return self.status == InvoiceStatus.ISSUED

    @property
    def is_paid(self) -> bool:
        return self.status == InvoiceStatus.PAID

    @property
    def is_voided(self) -> bool:
        return self.status == InvoiceStatus.VOIDED

    @property
    def remaining_balance(self) -> Decimal:
        return max(Decimal("0.00"), Decimal(str(self.total_amount)) - Decimal(str(self.paid_amount)))

    def to_dict(self, include_items: bool = True) -> Dict[str, Any]:
        data = {
            "id": self.id,
            "invoice_number": self.invoice_number,
            "client_id": self.client_id,
            "client_code": self.client.client_code if self.client else None,
            "company_name": self.client.company_name if self.client else None,
            "member_id": self.member_id,
            "client_name": self.client_name,
            "client_email": self.client_email,
            "client_address": self.client_address,
            "tax_id": self.tax_id,
            "status": self.status.value if hasattr(self.status, "value") else str(self.status),
            "issue_date": self.issue_date.isoformat() if self.issue_date else None,
            "due_date": self.due_date.isoformat() if self.due_date else None,
            "subtotal_amount": float(self.subtotal_amount),
            "tax_rate_id": self.tax_rate_id,
            "tax_rate_value": float(self.tax_rate_value),
            "tax_rate_percentage": float(self.tax_rate_value * 100),
            "tax_amount": float(self.tax_amount),
            "total_amount": float(self.total_amount),
            "paid_amount": float(self.paid_amount),
            "remaining_balance": float(self.remaining_balance),
            "notes": self.notes,
            "terms": self.terms,
            "void_reason": self.void_reason,
            "created_by_id": self.created_by_id,
            "issued_at": self.issued_at.isoformat() if self.issued_at else None,
            "paid_at": self.paid_at.isoformat() if self.paid_at else None,
            "voided_at": self.voided_at.isoformat() if self.voided_at else None,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }
        if include_items:
            data["items"] = [item.to_dict() for item in self.items]
            data["items_count"] = len(self.items)
        return data

    def __repr__(self) -> str:
        return f"<Invoice id={self.id} num='{self.invoice_number}' status='{self.status}' total={self.total_amount}>"


class InvoiceItem(db.Model):
    """
    Line item belonging to an invoice.
    Can only be modified when the parent invoice is in DRAFT status.
    """

    __tablename__ = "invoice_items"

    id = Column(Integer, primary_key=True, autoincrement=True)
    invoice_id = Column(Integer, ForeignKey("invoices.id", ondelete="CASCADE"), nullable=False, index=True)
    description = Column(String(255), nullable=False)
    quantity = Column(Integer, nullable=False, default=1)
    unit_price = Column(Numeric(10, 2), nullable=False)
    total_price = Column(Numeric(10, 2), nullable=False)

    # Relationships
    invoice = relationship("Invoice", back_populates="items")

    __table_args__ = (
        CheckConstraint("quantity > 0", name="check_invoice_item_quantity_positive"),
        CheckConstraint("unit_price >= 0", name="check_invoice_item_unit_price_non_negative"),
        CheckConstraint("total_price >= 0", name="check_invoice_item_total_price_non_negative"),
    )

    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "invoice_id": self.invoice_id,
            "description": self.description,
            "quantity": self.quantity,
            "unit_price": float(self.unit_price),
            "total_price": float(self.total_price),
        }

    def __repr__(self) -> str:
        return f"<InvoiceItem id={self.id} inv={self.invoice_id} desc='{self.description}' total={self.total_price}>"
