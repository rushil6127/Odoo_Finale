"""
API Routes for Business Invoices, Clients, and Configurable Tax Rates.
=====================================================================
"""

from datetime import date
from decimal import Decimal
from flask import Blueprint, request
from flask_jwt_extended import current_user

from backend.app.common.responses import success_response
from backend.app.common.permissions import roles_required, RoleEnum
from backend.app.common.errors import ValidationException
from backend.app.invoices.services import (
    create_tax_rate,
    list_tax_rates,
    seed_default_tax_rates,
    create_business_client,
    update_business_client,
    get_business_client,
    list_business_clients,
    create_invoice,
    update_invoice,
    issue_invoice,
    void_invoice,
    pay_invoice_via_shared_payment,
    get_invoice,
    list_invoices,
    get_tax_summary,
)

invoices_bp = Blueprint("invoices", __name__, url_prefix="/api/v1/invoices")


# ---------------------------------------------------------------------------
# TAX RATES ENDPOINTS
# ---------------------------------------------------------------------------

@invoices_bp.route("/tax-rates", methods=["GET"])
@roles_required(RoleEnum.OWNER, RoleEnum.ADMIN, RoleEnum.FRONT_DESK)
def get_tax_rates():
    """List all configurable tax rates."""
    seed_default_tax_rates()
    rates = list_tax_rates(active_only=False)
    return success_response(
        data={"tax_rates": [r.to_dict() for r in rates]},
        meta={"total": len(rates)},
    )


@invoices_bp.route("/tax-rates", methods=["POST"])
@roles_required(RoleEnum.OWNER, RoleEnum.ADMIN)
def post_tax_rate():
    """Create a new configurable tax rate."""
    payload = request.get_json(silent=True) or {}
    name = payload.get("name")
    code = payload.get("code")
    rate_val = payload.get("rate")
    description = payload.get("description")
    is_default = payload.get("is_default", False)

    if rate_val is None:
        raise ValidationException("Field 'rate' is required (e.g. 0.18 for 18%).", code="MISSING_RATE")

    tax_rate = create_tax_rate(
        name=name,
        code=code,
        rate=Decimal(str(rate_val)),
        description=description,
        is_default=bool(is_default),
    )
    return success_response(
        data=tax_rate.to_dict(),
        message="Tax rate created successfully",
        status_code=201,
    )


@invoices_bp.route("/tax-summary", methods=["GET"])
@roles_required(RoleEnum.OWNER, RoleEnum.ADMIN)
def get_tax_report():
    """Tax liability summary on business invoices grouped by tax rate."""
    start_str = request.args.get("start_date")
    end_str = request.args.get("end_date")

    start_d = date.fromisoformat(start_str.strip()) if start_str else None
    end_d = date.fromisoformat(end_str.strip()) if end_str else None

    summary = get_tax_summary(start_date=start_d, end_date=end_d)
    return success_response(data=summary)


# ---------------------------------------------------------------------------
# BUSINESS CLIENTS ENDPOINTS
# ---------------------------------------------------------------------------

@invoices_bp.route("/clients", methods=["GET"])
@roles_required(RoleEnum.OWNER, RoleEnum.ADMIN, RoleEnum.FRONT_DESK)
def get_clients():
    """List and search business clients."""
    search = request.args.get("q")
    active_param = request.args.get("active_only")
    active_only = active_param.lower() in ("true", "1", "yes") if active_param else False

    clients = list_business_clients(search=search, active_only=active_only)
    return success_response(
        data={"clients": [c.to_dict(include_invoices_count=True) for c in clients]},
        meta={"total": len(clients)},
    )


@invoices_bp.route("/clients", methods=["POST"])
@roles_required(RoleEnum.OWNER, RoleEnum.ADMIN, RoleEnum.FRONT_DESK)
def post_client():
    """Register a new business client."""
    payload = request.get_json(silent=True) or {}
    client = create_business_client(
        company_name=payload.get("company_name"),
        contact_person=payload.get("contact_person"),
        email=payload.get("email"),
        phone=payload.get("phone"),
        tax_id=payload.get("tax_id"),
        billing_address=payload.get("billing_address"),
        notes=payload.get("notes"),
    )
    return success_response(
        data=client.to_dict(),
        message="Business client created successfully",
        status_code=201,
    )


@invoices_bp.route("/clients/<int:client_id>", methods=["GET"])
@roles_required(RoleEnum.OWNER, RoleEnum.ADMIN, RoleEnum.FRONT_DESK)
def get_single_client(client_id: int):
    """Retrieve client details."""
    client = get_business_client(client_id)
    return success_response(data=client.to_dict(include_invoices_count=True))


@invoices_bp.route("/clients/<int:client_id>", methods=["PUT"])
@roles_required(RoleEnum.OWNER, RoleEnum.ADMIN)
def put_client(client_id: int):
    """Update business client details."""
    payload = request.get_json(silent=True) or {}
    client = update_business_client(
        client_id=client_id,
        company_name=payload.get("company_name"),
        contact_person=payload.get("contact_person"),
        email=payload.get("email"),
        phone=payload.get("phone"),
        tax_id=payload.get("tax_id"),
        billing_address=payload.get("billing_address"),
        is_active=payload.get("is_active"),
        notes=payload.get("notes"),
    )
    return success_response(
        data=client.to_dict(),
        message="Business client updated successfully",
    )


# ---------------------------------------------------------------------------
# INVOICES ENDPOINTS
# ---------------------------------------------------------------------------

@invoices_bp.route("", methods=["GET"])
@roles_required(RoleEnum.OWNER, RoleEnum.ADMIN, RoleEnum.FRONT_DESK)
def get_invoices():
    """List and filter invoices."""
    status = request.args.get("status")
    client_id_raw = request.args.get("client_id")
    client_id = int(client_id_raw) if client_id_raw and client_id_raw.isdigit() else None
    start_str = request.args.get("start_date")
    end_str = request.args.get("end_date")

    start_d = date.fromisoformat(start_str.strip()) if start_str else None
    end_d = date.fromisoformat(end_str.strip()) if end_str else None

    invoices = list_invoices(status=status, client_id=client_id, start_date=start_d, end_date=end_d)
    return success_response(
        data={"invoices": [inv.to_dict(include_items=False) for inv in invoices]},
        meta={"total": len(invoices)},
    )


@invoices_bp.route("", methods=["POST"])
@roles_required(RoleEnum.OWNER, RoleEnum.ADMIN, RoleEnum.FRONT_DESK)
def post_invoice():
    """Create a new draft invoice."""
    payload = request.get_json(silent=True) or {}
    issue_date = date.fromisoformat(payload["issue_date"]) if payload.get("issue_date") else None
    due_date = date.fromisoformat(payload["due_date"]) if payload.get("due_date") else None

    invoice = create_invoice(
        client_id=payload.get("client_id"),
        member_id=payload.get("member_id"),
        client_name=payload.get("client_name"),
        client_email=payload.get("client_email"),
        client_address=payload.get("client_address"),
        tax_id=payload.get("tax_id"),
        issue_date=issue_date,
        due_date=due_date,
        items=payload.get("items"),
        tax_rate_id=payload.get("tax_rate_id"),
        notes=payload.get("notes"),
        terms=payload.get("terms"),
        created_by_id=current_user.id if current_user else None,
    )
    return success_response(
        data=invoice.to_dict(include_items=True),
        message="Draft invoice created successfully",
        status_code=201,
    )


@invoices_bp.route("/<int:invoice_id>", methods=["GET"])
@roles_required(RoleEnum.OWNER, RoleEnum.ADMIN, RoleEnum.FRONT_DESK)
def get_single_invoice(invoice_id: int):
    """Retrieve full invoice details with line items."""
    invoice = get_invoice(invoice_id)
    return success_response(data=invoice.to_dict(include_items=True))


@invoices_bp.route("/<int:invoice_id>", methods=["PUT"])
@roles_required(RoleEnum.OWNER, RoleEnum.ADMIN, RoleEnum.FRONT_DESK)
def put_invoice(invoice_id: int):
    """
    Update a DRAFT invoice.
    RULE: Issued invoices are immutable and will be rejected.
    """
    payload = request.get_json(silent=True) or {}
    due_date = date.fromisoformat(payload["due_date"]) if payload.get("due_date") else None

    invoice = update_invoice(
        invoice_id=invoice_id,
        client_name=payload.get("client_name"),
        client_email=payload.get("client_email"),
        client_address=payload.get("client_address"),
        tax_id=payload.get("tax_id"),
        due_date=due_date,
        items=payload.get("items"),
        tax_rate_id=payload.get("tax_rate_id"),
        notes=payload.get("notes"),
        terms=payload.get("terms"),
    )
    return success_response(
        data=invoice.to_dict(include_items=True),
        message="Draft invoice updated successfully",
    )


@invoices_bp.route("/<int:invoice_id>/issue", methods=["POST"])
@roles_required(RoleEnum.OWNER, RoleEnum.ADMIN, RoleEnum.FRONT_DESK)
def post_issue_invoice(invoice_id: int):
    """
    Issue an invoice, freezing it permanently against edits.
    """
    invoice = issue_invoice(invoice_id)
    return success_response(
        data=invoice.to_dict(include_items=True),
        message=f"Invoice {invoice.invoice_number} issued successfully. It is now finalized and immutable.",
    )


@invoices_bp.route("/<int:invoice_id>/void", methods=["POST"])
@roles_required(RoleEnum.OWNER, RoleEnum.ADMIN)
def post_void_invoice(invoice_id: int):
    """Void an issued or draft invoice."""
    payload = request.get_json(silent=True) or {}
    reason = payload.get("reason")
    if not reason:
        raise ValidationException("Field 'reason' is required to void an invoice.", code="MISSING_REASON")

    invoice = void_invoice(invoice_id, reason=reason)
    return success_response(
        data=invoice.to_dict(include_items=True),
        message=f"Invoice {invoice.invoice_number} has been voided.",
    )


@invoices_bp.route("/<int:invoice_id>/pay", methods=["POST"])
@roles_required(RoleEnum.OWNER, RoleEnum.ADMIN, RoleEnum.FRONT_DESK)
def post_pay_invoice(invoice_id: int):
    """
    Settle an invoice through the shared payment service (item_type=INVOICE).
    Supports CASH, CARD, UPI, ONLINE.
    """
    payload = request.get_json(silent=True) or {}
    payment_method = payload.get("payment_method")
    if not payment_method:
        raise ValidationException("Field 'payment_method' is required (CASH, CARD, UPI, ONLINE).", code="MISSING_PAYMENT_METHOD")

    amount = Decimal(str(payload["amount"])) if payload.get("amount") is not None else None
    notes = payload.get("notes")

    invoice, payment = pay_invoice_via_shared_payment(
        invoice_id=invoice_id,
        payment_method=payment_method,
        amount=amount,
        notes=notes,
        staff_user=current_user,
    )

    return success_response(
        data={
            "invoice": invoice.to_dict(include_items=True),
            "payment": payment.to_dict(),
        },
        message=f"Payment for invoice {invoice.invoice_number} recorded successfully via {payment_method}.",
    )
