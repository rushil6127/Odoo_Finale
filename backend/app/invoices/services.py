"""
Business Invoices and Tax Management Services for Champions Club.
=================================================================
Handles business client directory, configurable tax rates, invoice creation,
issuing with strict immutability, voiding, and integration with the shared payment service.
"""

from datetime import datetime, date, timedelta
from decimal import Decimal, ROUND_HALF_UP
from typing import Optional, Dict, Any, List, Tuple
from flask import current_app

from backend.app.extensions import db
from backend.app.common.utils import utc_now
from backend.app.common.errors import (
    NotFoundException,
    ValidationException,
    ConflictException,
    ForbiddenException,
)
from backend.app.invoices.models import (
    TaxRate,
    BusinessClient,
    Invoice,
    InvoiceItem,
    InvoiceStatus,
    generate_invoice_number,
    generate_client_code,
)
from backend.app.payments.models import (
    Payment,
    PaymentMethod,
    PaymentStatus,
    PaymentItemType,
)
from backend.app.payments.services import (
    create_or_initiate_payment,
    confirm_manual_payment,
    get_payment_for_item,
)


# ---------------------------------------------------------------------------
# 1. TAX RATES MANAGEMENT
# ---------------------------------------------------------------------------

def seed_default_tax_rates() -> List[TaxRate]:
    """Seed standard configurable tax rates if none exist."""
    existing = TaxRate.query.first()
    if existing:
        return TaxRate.query.all()

    defaults = [
        TaxRate(
            name="Standard GST (18%)",
            code="GST_18",
            rate=Decimal("0.1800"),
            description="Standard goods and services tax rate",
            is_active=True,
            is_default=True,
        ),
        TaxRate(
            name="Reduced GST (5%)",
            code="GST_5",
            rate=Decimal("0.0500"),
            description="Reduced tax rate for food, cafeteria and essential services",
            is_active=True,
            is_default=False,
        ),
        TaxRate(
            name="Zero / Exempt (0%)",
            code="ZERO_TAX",
            rate=Decimal("0.0000"),
            description="Zero-rated or exempt supplies and sponsorships",
            is_active=True,
            is_default=False,
        ),
    ]
    db.session.add_all(defaults)
    db.session.commit()
    return defaults


def create_tax_rate(
    name: str,
    code: str,
    rate: Decimal,
    description: Optional[str] = None,
    is_default: bool = False,
    is_active: bool = True,
) -> TaxRate:
    """Create a new configurable tax rate."""
    if not name or not name.strip():
        raise ValidationException("Tax rate name is required.", code="MISSING_NAME")
    if not code or not code.strip():
        raise ValidationException("Tax rate code is required.", code="MISSING_CODE")

    normalized_code = code.upper().strip()
    if TaxRate.query.filter_by(code=normalized_code).first():
        raise ConflictException(f"Tax rate code '{normalized_code}' already exists.", code="CODE_EXISTS")

    if rate < Decimal("0.0000"):
        raise ValidationException("Tax rate must be non-negative.", code="INVALID_RATE")

    if is_default:
        # Clear existing default
        TaxRate.query.filter_by(is_default=True).update({"is_default": False})

    tax_rate = TaxRate(
        name=name.strip(),
        code=normalized_code,
        rate=Decimal(str(rate)),
        description=description.strip() if description else None,
        is_default=is_default,
        is_active=is_active,
    )
    db.session.add(tax_rate)
    db.session.commit()
    return tax_rate


def list_tax_rates(active_only: bool = True) -> List[TaxRate]:
    """Retrieve all configured tax rates."""
    query = TaxRate.query
    if active_only:
        query = query.filter_by(is_active=True)
    return query.order_by(TaxRate.rate.desc()).all()


def get_default_tax_rate() -> Optional[TaxRate]:
    """Retrieve current default tax rate or fallback to first active."""
    default = TaxRate.query.filter_by(is_default=True, is_active=True).first()
    if not default:
        default = TaxRate.query.filter_by(is_active=True).first()
    return default


# ---------------------------------------------------------------------------
# 2. BUSINESS CLIENTS MANAGEMENT
# ---------------------------------------------------------------------------

def create_business_client(
    company_name: str,
    contact_person: str,
    email: str,
    phone: Optional[str] = None,
    tax_id: Optional[str] = None,
    billing_address: Optional[str] = None,
    notes: Optional[str] = None,
) -> BusinessClient:
    """Register a corporate sponsor, partner, or tournament booking entity."""
    if not company_name or not company_name.strip():
        raise ValidationException("Company name is required.", code="MISSING_COMPANY_NAME")
    if not contact_person or not contact_person.strip():
        raise ValidationException("Contact person name is required.", code="MISSING_CONTACT_PERSON")
    if not email or "@" not in email:
        raise ValidationException("A valid email address is required.", code="INVALID_EMAIL")

    client = BusinessClient(
        client_code=generate_client_code(),
        company_name=company_name.strip(),
        contact_person=contact_person.strip(),
        email=email.strip().lower(),
        phone=phone.strip() if phone else None,
        tax_id=tax_id.strip() if tax_id else None,
        billing_address=billing_address.strip() if billing_address else None,
        notes=notes.strip() if notes else None,
        is_active=True,
    )
    db.session.add(client)
    db.session.commit()
    return client


def update_business_client(
    client_id: int,
    company_name: Optional[str] = None,
    contact_person: Optional[str] = None,
    email: Optional[str] = None,
    phone: Optional[str] = None,
    tax_id: Optional[str] = None,
    billing_address: Optional[str] = None,
    is_active: Optional[bool] = None,
    notes: Optional[str] = None,
) -> BusinessClient:
    """Update business client master record."""
    client = db.session.get(BusinessClient, client_id)
    if not client:
        raise NotFoundException(f"Business client with ID {client_id} not found.")

    if company_name is not None:
        client.company_name = company_name.strip()
    if contact_person is not None:
        client.contact_person = contact_person.strip()
    if email is not None:
        if "@" not in email:
            raise ValidationException("Invalid email format.", code="INVALID_EMAIL")
        client.email = email.strip().lower()
    if phone is not None:
        client.phone = phone.strip()
    if tax_id is not None:
        client.tax_id = tax_id.strip()
    if billing_address is not None:
        client.billing_address = billing_address.strip()
    if is_active is not None:
        client.is_active = is_active
    if notes is not None:
        client.notes = notes.strip()

    db.session.commit()
    return client


def get_business_client(client_id: int) -> BusinessClient:
    """Fetch business client by ID."""
    client = db.session.get(BusinessClient, client_id)
    if not client:
        raise NotFoundException(f"Business client with ID {client_id} not found.")
    return client


def list_business_clients(search: Optional[str] = None, active_only: bool = False) -> List[BusinessClient]:
    """Query and filter business clients."""
    query = BusinessClient.query
    if active_only:
        query = query.filter_by(is_active=True)
    if search:
        term = f"%{search.strip()}%"
        query = query.filter(
            db.or_(
                BusinessClient.company_name.ilike(term),
                BusinessClient.contact_person.ilike(term),
                BusinessClient.email.ilike(term),
                BusinessClient.client_code.ilike(term),
            )
        )
    return query.order_by(BusinessClient.company_name.asc()).all()


# ---------------------------------------------------------------------------
# 3. INVOICES LIFECYCLE (Draft -> Issued -> Paid / Voided)
# ---------------------------------------------------------------------------

def calculate_invoice_totals(
    items_data: List[Dict[str, Any]], tax_rate_val: Decimal
) -> Tuple[Decimal, Decimal, Decimal]:
    """Calculate subtotal, tax_amount, and total_amount for given items and tax rate."""
    subtotal = Decimal("0.00")
    for it in items_data:
        qty = int(it.get("quantity", 1))
        if qty <= 0:
            raise ValidationException("Item quantity must be greater than zero.", code="INVALID_QUANTITY")
        price = Decimal(str(it.get("unit_price", 0.0)))
        if price < Decimal("0.00"):
            raise ValidationException("Item unit price cannot be negative.", code="INVALID_PRICE")
        subtotal += price * qty

    tax_amount = (subtotal * tax_rate_val).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
    total_amount = subtotal + tax_amount
    return subtotal, tax_amount, total_amount


def create_invoice(
    client_id: Optional[int] = None,
    member_id: Optional[int] = None,
    client_name: Optional[str] = None,
    client_email: Optional[str] = None,
    client_address: Optional[str] = None,
    tax_id: Optional[str] = None,
    issue_date: Optional[date] = None,
    due_date: Optional[date] = None,
    items: Optional[List[Dict[str, Any]]] = None,
    tax_rate_id: Optional[int] = None,
    notes: Optional[str] = None,
    terms: Optional[str] = None,
    created_by_id: Optional[int] = None,
) -> Invoice:
    """
    Create a new DRAFT invoice.
    Can bill a BusinessClient or an individual Member.
    """
    if not items or len(items) == 0:
        raise ValidationException("Invoice must contain at least one line item.", code="EMPTY_INVOICE_ITEMS")

    # Resolve client details
    final_client_name = client_name
    final_client_email = client_email
    final_client_address = client_address
    final_tax_id = tax_id

    if client_id:
        client = db.session.get(BusinessClient, client_id)
        if not client:
            raise NotFoundException(f"Business client with ID {client_id} not found.")
        final_client_name = final_client_name or client.company_name
        final_client_email = final_client_email or client.email
        final_client_address = final_client_address or client.billing_address
        final_tax_id = final_tax_id or client.tax_id
    elif member_id:
        from backend.app.members.models import Member
        member = db.session.get(Member, member_id)
        if not member:
            raise NotFoundException(f"Member with ID {member_id} not found.")
        final_client_name = final_client_name or (member.user.full_name if member.user else f"Member #{member.id}")
        final_client_email = final_client_email or (member.user.email if member.user else None)

    if not final_client_name or not final_client_name.strip():
        raise ValidationException("Client name or business client ID is required.", code="MISSING_CLIENT_NAME")

    # Resolve tax rate
    tax_rate_val = Decimal("0.0000")
    if tax_rate_id:
        tr = db.session.get(TaxRate, tax_rate_id)
        if not tr:
            raise NotFoundException(f"Tax rate with ID {tax_rate_id} not found.")
        tax_rate_val = tr.rate
    else:
        default_tr = get_default_tax_rate()
        if default_tr:
            tax_rate_id = default_tr.id
            tax_rate_val = default_tr.rate

    # Calculate dates
    iss_date = issue_date or date.today()
    d_date = due_date or (iss_date + timedelta(days=30))
    if d_date < iss_date:
        raise ValidationException("Invoice due_date cannot be earlier than issue_date.", code="INVALID_DUE_DATE")

    # Calculate financial totals
    subtotal, tax_amount, total_amount = calculate_invoice_totals(items, tax_rate_val)

    invoice = Invoice(
        invoice_number=generate_invoice_number(),
        client_id=client_id,
        member_id=member_id,
        client_name=final_client_name.strip(),
        client_email=final_client_email.strip() if final_client_email else None,
        client_address=final_client_address.strip() if final_client_address else None,
        tax_id=final_tax_id.strip() if final_tax_id else None,
        status=InvoiceStatus.DRAFT,
        issue_date=iss_date,
        due_date=d_date,
        subtotal_amount=subtotal,
        tax_rate_id=tax_rate_id,
        tax_rate_value=tax_rate_val,
        tax_amount=tax_amount,
        total_amount=total_amount,
        paid_amount=Decimal("0.00"),
        notes=notes.strip() if notes else None,
        terms=terms.strip() if terms else None,
        created_by_id=created_by_id,
    )
    db.session.add(invoice)
    db.session.flush()

    # Add line items
    for it in items:
        desc = it.get("description", "").strip()
        if not desc:
            raise ValidationException("Line item description is required.", code="MISSING_ITEM_DESCRIPTION")
        qty = int(it.get("quantity", 1))
        unit_price = Decimal(str(it.get("unit_price", 0.0)))
        line_total = (unit_price * qty).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)

        line_item = InvoiceItem(
            invoice_id=invoice.id,
            description=desc,
            quantity=qty,
            unit_price=unit_price,
            total_price=line_total,
        )
        db.session.add(line_item)

    db.session.commit()
    return invoice


def update_invoice(
    invoice_id: int,
    client_name: Optional[str] = None,
    client_email: Optional[str] = None,
    client_address: Optional[str] = None,
    tax_id: Optional[str] = None,
    due_date: Optional[date] = None,
    items: Optional[List[Dict[str, Any]]] = None,
    tax_rate_id: Optional[int] = None,
    notes: Optional[str] = None,
    terms: Optional[str] = None,
) -> Invoice:
    """
    Update a DRAFT invoice.
    RULE: Issued invoices are immutable except for voiding.
    """
    invoice = db.session.get(Invoice, invoice_id)
    if not invoice:
        raise NotFoundException(f"Invoice with ID {invoice_id} not found.")

    # IMMUTABILITY RULE
    if invoice.status != InvoiceStatus.DRAFT:
        raise ValidationException(
            f"Issued or finalized invoices (status: {invoice.status.value}) are immutable and cannot be edited. You may only void the invoice.",
            code="INVOICE_IMMUTABLE",
        )

    if client_name is not None:
        invoice.client_name = client_name.strip()
    if client_email is not None:
        invoice.client_email = client_email.strip()
    if client_address is not None:
        invoice.client_address = client_address.strip()
    if tax_id is not None:
        invoice.tax_id = tax_id.strip()
    if due_date is not None:
        if due_date < invoice.issue_date:
            raise ValidationException("due_date cannot be earlier than issue_date.", code="INVALID_DUE_DATE")
        invoice.due_date = due_date
    if notes is not None:
        invoice.notes = notes.strip()
    if terms is not None:
        invoice.terms = terms.strip()

    tax_rate_val = invoice.tax_rate_value
    if tax_rate_id is not None:
        tr = db.session.get(TaxRate, tax_rate_id)
        if not tr:
            raise NotFoundException(f"Tax rate with ID {tax_rate_id} not found.")
        invoice.tax_rate_id = tr.id
        invoice.tax_rate_value = tr.rate
        tax_rate_val = tr.rate

    if items is not None:
        if len(items) == 0:
            raise ValidationException("Invoice must have at least one line item.", code="EMPTY_INVOICE_ITEMS")

        # Remove old line items
        InvoiceItem.query.filter_by(invoice_id=invoice.id).delete()

        subtotal, tax_amount, total_amount = calculate_invoice_totals(items, tax_rate_val)
        invoice.subtotal_amount = subtotal
        invoice.tax_amount = tax_amount
        invoice.total_amount = total_amount

        for it in items:
            desc = it.get("description", "").strip()
            qty = int(it.get("quantity", 1))
            unit_price = Decimal(str(it.get("unit_price", 0.0)))
            line_total = (unit_price * qty).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)

            db.session.add(
                InvoiceItem(
                    invoice_id=invoice.id,
                    description=desc,
                    quantity=qty,
                    unit_price=unit_price,
                    total_price=line_total,
                )
            )
    else:
        # Recompute with current items if tax rate changed
        current_items = [{"quantity": it.quantity, "unit_price": it.unit_price} for it in invoice.items]
        subtotal, tax_amount, total_amount = calculate_invoice_totals(current_items, tax_rate_val)
        invoice.subtotal_amount = subtotal
        invoice.tax_amount = tax_amount
        invoice.total_amount = total_amount

    db.session.commit()
    return invoice


def issue_invoice(invoice_id: int) -> Invoice:
    """
    Issue a DRAFT invoice.
    Transitions status to ISSUED, freezing it permanently against changes.
    """
    invoice = db.session.get(Invoice, invoice_id)
    if not invoice:
        raise NotFoundException(f"Invoice with ID {invoice_id} not found.")

    if invoice.status != InvoiceStatus.DRAFT:
        raise ValidationException(
            f"Cannot issue invoice with status '{invoice.status.value}'. Must be in DRAFT.",
            code="INVALID_STATUS",
        )

    if len(invoice.items) == 0:
        raise ValidationException("Cannot issue an empty invoice without items.", code="EMPTY_INVOICE_ITEMS")

    if invoice.total_amount <= Decimal("0.00"):
        raise ValidationException("Cannot issue an invoice with zero or negative total amount.", code="INVALID_TOTAL")

    invoice.status = InvoiceStatus.ISSUED
    invoice.issued_at = utc_now()
    db.session.commit()
    return invoice


def void_invoice(invoice_id: int, reason: str) -> Invoice:
    """
    Void an ISSUED or DRAFT invoice.
    PAID invoices cannot be voided; they must be refunded through payments service.
    """
    invoice = db.session.get(Invoice, invoice_id)
    if not invoice:
        raise NotFoundException(f"Invoice with ID {invoice_id} not found.")

    if invoice.status == InvoiceStatus.VOIDED:
        return invoice

    if invoice.status == InvoiceStatus.PAID:
        raise ValidationException(
            "Cannot void a paid invoice. To return funds, initiate a refund through the payments service.",
            code="CANNOT_VOID_PAID",
        )

    if not reason or not reason.strip():
        raise ValidationException("A reason is required to void an invoice.", code="MISSING_VOID_REASON")

    invoice.status = InvoiceStatus.VOIDED
    invoice.void_reason = reason.strip()
    invoice.voided_at = utc_now()
    db.session.commit()
    return invoice


def pay_invoice_via_shared_payment(
    invoice_id: int,
    payment_method: str,
    amount: Optional[Decimal] = None,
    user_id: Optional[int] = None,
    notes: Optional[str] = None,
    staff_user: Optional[Any] = None,
) -> Tuple[Invoice, Payment]:
    """
    Settle an invoice through Developer A's shared payment service.
    Uses reference type PaymentItemType.INVOICE.
    """
    invoice = db.session.get(Invoice, invoice_id)
    if not invoice:
        raise NotFoundException(f"Invoice with ID {invoice_id} not found.")

    if invoice.status != InvoiceStatus.ISSUED:
        raise ValidationException(
            f"Cannot process payment for invoice with status '{invoice.status.value}'. Invoice must be ISSUED.",
            code="INVALID_INVOICE_STATUS",
        )

    pay_amount = amount or invoice.remaining_balance
    if pay_amount <= Decimal("0.00"):
        raise ValidationException("Payment amount must be greater than zero.", code="INVALID_AMOUNT")

    try:
        enum_method = PaymentMethod(payment_method.upper().strip())
    except (ValueError, AttributeError):
        raise ValidationException(
            f"Unsupported payment method '{payment_method}'. Must be CASH, CARD, UPI, or ONLINE.",
            code="INVALID_PAYMENT_METHOD",
        )

    # Create payment through shared payment foundation
    payment = create_or_initiate_payment(
        item_type="INVOICE",
        item_id=invoice.id,
        amount=pay_amount,
        payment_method=enum_method.value,
        user_id=user_id or (staff_user.id if staff_user else None),
        notes=notes or f"Invoice {invoice.invoice_number} settlement",
    )

    # For manual offline payments (CASH, CARD, UPI), confirm payment
    if enum_method != PaymentMethod.ONLINE:
        payment = confirm_manual_payment(
            payment_id=payment.id,
            staff_user=staff_user,
            notes=f"Confirmed payment for invoice {invoice.invoice_number}",
        )

    # Update invoice paid balance
    if payment.status == PaymentStatus.PAID:
        invoice.paid_amount = Decimal(str(invoice.paid_amount)) + Decimal(str(payment.amount))
        if invoice.paid_amount >= invoice.total_amount:
            invoice.status = InvoiceStatus.PAID
            invoice.paid_at = payment.paid_at or utc_now()
        db.session.commit()

    return invoice, payment


def get_invoice(invoice_id: int) -> Invoice:
    """Retrieve invoice by ID."""
    invoice = db.session.get(Invoice, invoice_id)
    if not invoice:
        raise NotFoundException(f"Invoice with ID {invoice_id} not found.")
    return invoice


def list_invoices(
    status: Optional[str] = None,
    client_id: Optional[int] = None,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
) -> List[Invoice]:
    """Query and filter invoices."""
    query = Invoice.query

    if status:
        query = query.filter(Invoice.status == InvoiceStatus(status.upper().strip()))
    if client_id:
        query = query.filter(Invoice.client_id == client_id)
    if start_date:
        query = query.filter(Invoice.issue_date >= start_date)
    if end_date:
        query = query.filter(Invoice.issue_date <= end_date)

    return query.order_by(Invoice.issue_date.desc(), Invoice.id.desc()).all()


def get_tax_summary(start_date: Optional[date] = None, end_date: Optional[date] = None) -> Dict[str, Any]:
    """
    Summary of tax collected on invoices grouped by configurable tax rate.
    """
    query = Invoice.query.filter(Invoice.status.in_([InvoiceStatus.ISSUED, InvoiceStatus.PAID]))
    if start_date:
        query = query.filter(Invoice.issue_date >= start_date)
    if end_date:
        query = query.filter(Invoice.issue_date <= end_date)

    invoices = query.all()

    tax_rates = TaxRate.query.all()
    rates_summary: Dict[str, Dict[str, Any]] = {
        tr.code: {
            "rate_code": tr.code,
            "rate_name": tr.name,
            "percentage": float(tr.rate * 100),
            "invoices_count": 0,
            "taxable_amount": Decimal("0.00"),
            "tax_collected": Decimal("0.00"),
        }
        for tr in tax_rates
    }

    # Default / unclassified bucket
    rates_summary["OTHER"] = {
        "rate_code": "OTHER",
        "rate_name": "Custom / Unclassified Tax",
        "percentage": 0.0,
        "invoices_count": 0,
        "taxable_amount": Decimal("0.00"),
        "tax_collected": Decimal("0.00"),
    }

    total_taxable = Decimal("0.00")
    total_tax = Decimal("0.00")

    for inv in invoices:
        code = inv.tax_rate.code if inv.tax_rate else "OTHER"
        if code not in rates_summary:
            rates_summary[code] = {
                "rate_code": code,
                "rate_name": inv.tax_rate.name if inv.tax_rate else code,
                "percentage": float(inv.tax_rate_value * 100),
                "invoices_count": 0,
                "taxable_amount": Decimal("0.00"),
                "tax_collected": Decimal("0.00"),
            }

        rates_summary[code]["invoices_count"] += 1
        rates_summary[code]["taxable_amount"] += Decimal(str(inv.subtotal_amount))
        rates_summary[code]["tax_collected"] += Decimal(str(inv.tax_amount))
        total_taxable += Decimal(str(inv.subtotal_amount))
        total_tax += Decimal(str(inv.tax_amount))

    # Format output
    active_buckets = [
        {
            "rate_code": d["rate_code"],
            "rate_name": d["rate_name"],
            "percentage": d["percentage"],
            "invoices_count": d["invoices_count"],
            "taxable_amount": float(d["taxable_amount"]),
            "tax_collected": float(d["tax_collected"]),
        }
        for d in rates_summary.values()
        if d["invoices_count"] > 0 or d["rate_code"] != "OTHER"
    ]

    return {
        "total_taxable_subtotal": float(total_taxable),
        "total_tax_collected": float(total_tax),
        "invoices_analyzed_count": len(invoices),
        "by_tax_rate": active_buckets,
    }
