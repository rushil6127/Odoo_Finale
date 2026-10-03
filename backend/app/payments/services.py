from decimal import Decimal
from datetime import datetime, date
from typing import Optional, Dict, Any, List, Tuple
from flask import current_app
from backend.app.extensions import db
from backend.app.common.utils import utc_now
from backend.app.common.errors import (
    NotFoundException,
    ValidationException,
    ConflictException,
    ForbiddenException,
    UnauthorizedException,
)
from backend.app.payments.models import (
    Payment,
    PaymentAudit,
    PaymentWebhookEvent,
    PaymentMethod,
    PaymentStatus,
    PaymentItemType,
    generate_payment_reference,
)
from backend.app.payments.providers import get_payment_provider, PaymentProviderInterface


# Explicit state transition rules
ALLOWED_TRANSITIONS = {
    PaymentStatus.PENDING: {
        PaymentStatus.PAID,
        PaymentStatus.FAILED,
        PaymentStatus.CANCELLED,
    },
    PaymentStatus.PAID: {
        PaymentStatus.REFUND_PENDING,
        PaymentStatus.REFUNDED,
    },
    PaymentStatus.REFUND_PENDING: {
        PaymentStatus.REFUNDED,
        PaymentStatus.PAID,
    },
    PaymentStatus.FAILED: set(),
    PaymentStatus.CANCELLED: set(),
    PaymentStatus.REFUNDED: set(),
}


def validate_transition(current_status: PaymentStatus, target_status: PaymentStatus) -> None:
    """Validate payment lifecycle state transition."""
    if current_status == target_status:
        return
    allowed = ALLOWED_TRANSITIONS.get(current_status, set())
    if target_status not in allowed:
        raise ValidationException(
            f"Invalid payment state transition from '{current_status.value}' to '{target_status.value}'.",
            code="INVALID_PAYMENT_TRANSITION",
        )


def _record_audit(
    payment: Payment,
    previous_status: Optional[str],
    new_status: str,
    action: str,
    actor_id: Optional[int] = None,
    actor_type: str = "SYSTEM",
    reason: Optional[str] = None,
    metadata_snapshot: Optional[Dict[str, Any]] = None,
) -> PaymentAudit:
    """Record an immutable payment audit entry."""
    audit = PaymentAudit(
        payment_id=payment.id,
        previous_status=previous_status,
        new_status=new_status,
        action=action,
        actor_id=actor_id,
        actor_type=actor_type,
        reason=reason,
        metadata_snapshot=metadata_snapshot or {},
    )
    db.session.add(audit)
    return audit


def get_payment_for_item(item_type: str, item_id: int) -> Optional[Payment]:
    """Retrieve the latest or active payment for a business entity."""
    enum_type = PaymentItemType(item_type.upper().strip())
    return (
        Payment.query.filter_by(item_type=enum_type, item_id=item_id)
        .order_by(Payment.created_at.desc())
        .first()
    )


def validate_item_amount(item_type: PaymentItemType, item_id: int, amount: Decimal) -> None:
    """Verify that payment amount matches the expected price of the business entity."""
    from backend.app.bookings.models import Booking
    from backend.app.memberships.models import Membership

    if item_type == PaymentItemType.BOOKING:
        booking = db.session.get(Booking, item_id)
        if not booking:
            raise NotFoundException(f"Booking with ID {item_id} not found.")
        expected_amount = Decimal(str(booking.final_price))
        if amount != expected_amount:
            raise ValidationException(
                f"Payment amount ({amount}) does not match booking final price ({expected_amount}).",
                code="AMOUNT_MISMATCH",
            )
    elif item_type == PaymentItemType.MEMBERSHIP:
        membership = db.session.get(Membership, item_id)
        if not membership:
            raise NotFoundException(f"Membership with ID {item_id} not found.")
        expected_amount = Decimal(str(membership.plan.effective_annual_price))
        if amount != expected_amount:
            raise ValidationException(
                f"Payment amount ({amount}) does not match membership price ({expected_amount}).",
                code="AMOUNT_MISMATCH",
            )
    elif item_type == PaymentItemType.SHOP_ORDER:
        from backend.app.shop.models import ShopOrder
        order = db.session.get(ShopOrder, item_id)
        if not order:
            raise NotFoundException(f"Shop order with ID {item_id} not found.")
        expected_amount = Decimal(str(order.total_amount))
        if amount != expected_amount:
            raise ValidationException(
                f"Payment amount ({amount}) does not match shop order total ({expected_amount}).",
                code="AMOUNT_MISMATCH",
            )


def create_or_initiate_payment(
    item_type: str,
    item_id: int,
    amount: Decimal,
    payment_method: str,
    user_id: Optional[int] = None,
    member_id: Optional[int] = None,
    notes: Optional[str] = None,
    provider: Optional[PaymentProviderInterface] = None,
) -> Payment:
    """Create or initiate a payment record through the shared payment service."""
    enum_item = PaymentItemType(item_type.upper().strip())
    enum_method = PaymentMethod(payment_method.upper().strip())

    validate_item_amount(enum_item, item_id, amount)

    # Check for existing payments for this item
    existing = (
        Payment.query.filter_by(item_type=enum_item, item_id=item_id)
        .order_by(Payment.created_at.desc())
        .first()
    )

    if existing:
        if existing.status == PaymentStatus.PAID:
            raise ConflictException(
                "Payment for this item has already been completed.",
                code="ALREADY_PAID",
            )
        # Reuse existing pending online payment/order
        if (
            existing.status == PaymentStatus.PENDING
            and existing.payment_method == PaymentMethod.ONLINE
            and enum_method == PaymentMethod.ONLINE
            and existing.gateway_order_id
        ):
            return existing

    gateway_order_id = None
    provider_name = "MANUAL"
    gateway_metadata = {}

    if enum_method == PaymentMethod.ONLINE:
        prov = provider or get_payment_provider()
        provider_name = "RAZORPAY"
        amount_paise = int(round(Decimal(amount) * 100))
        receipt_ref = generate_payment_reference()

        order_data = prov.create_order(
            amount_paise=amount_paise,
            currency="INR",
            receipt=receipt_ref,
            notes={"item_type": enum_item.value, "item_id": str(item_id)},
        )
        gateway_order_id = order_data.get("id")
        gateway_metadata = {
            "order_id": gateway_order_id,
            "amount_paise": amount_paise,
            "status": order_data.get("status"),
        }

    payment = Payment(
        payment_reference=generate_payment_reference(),
        amount=amount,
        currency="INR",
        payment_method=enum_method,
        status=PaymentStatus.PENDING,
        item_type=enum_item,
        item_id=item_id,
        user_id=user_id,
        member_id=member_id,
        provider=provider_name,
        gateway_order_id=gateway_order_id,
        gateway_metadata=gateway_metadata,
        notes=notes,
    )

    db.session.add(payment)
    db.session.flush()

    _record_audit(
        payment=payment,
        previous_status=None,
        new_status=PaymentStatus.PENDING.value,
        action="INITIATED",
        actor_id=user_id,
        actor_type="USER" if user_id else "SYSTEM",
        reason=f"Payment initiated via {enum_method.value}",
        metadata_snapshot={"amount": str(amount), "currency": "INR"},
    )

    db.session.commit()
    return payment


def confirm_manual_payment(
    payment_id: int,
    staff_user: Any,
    notes: Optional[str] = None,
) -> Payment:
    """Confirm an offline payment (CASH, CARD, UPI). Strictly rejected for ONLINE payments."""
    payment = db.session.get(Payment, payment_id)
    if not payment:
        raise NotFoundException(f"Payment with ID {payment_id} not found.")

    if payment.payment_method == PaymentMethod.ONLINE:
        raise ValidationException(
            "Generic confirmation is not allowed for ONLINE payments. Online payments must be verified via gateway signature or webhook.",
            code="CONFIRM_NOT_ALLOWED_ONLINE",
        )

    if payment.status == PaymentStatus.PAID:
        return payment

    validate_transition(payment.status, PaymentStatus.PAID)

    prev_status = payment.status.value
    payment.status = PaymentStatus.PAID
    payment.paid_at = utc_now()
    if notes:
        payment.notes = f"{payment.notes or ''} | {notes}".strip(" |")

    _record_audit(
        payment=payment,
        previous_status=prev_status,
        new_status=PaymentStatus.PAID.value,
        action="CONFIRMED_MANUAL",
        actor_id=staff_user.id if staff_user else None,
        actor_type="STAFF",
        reason=notes or f"Staff confirmed {payment.payment_method.value} payment",
    )

    db.session.commit()
    return payment


def verify_online_payment(
    razorpay_order_id: str,
    razorpay_payment_id: str,
    razorpay_signature: str,
    requesting_user: Optional[Any] = None,
    provider: Optional[PaymentProviderInterface] = None,
) -> Payment:
    """Verify an online payment's signature, amount, and currency, transitioning to PAID."""
    payment = Payment.query.filter_by(gateway_order_id=razorpay_order_id.strip()).first()
    if not payment:
        raise NotFoundException(f"Payment with gateway order ID '{razorpay_order_id}' not found.")

    # Idempotent check: if already verified and marked PAID
    if payment.status == PaymentStatus.PAID:
        return payment

    # Authorization check: If MEMBER, must be the owner of the payment
    if requesting_user and hasattr(requesting_user, "is_member") and requesting_user.is_member:
        if payment.user_id and payment.user_id != requesting_user.id:
            raise ForbiddenException("You are not authorized to verify this payment.")

    validate_transition(payment.status, PaymentStatus.PAID)

    prov = provider or get_payment_provider()

    # 1. Verify Razorpay Signature
    is_valid_sig = prov.verify_payment_signature(
        order_id=razorpay_order_id.strip(),
        payment_id=razorpay_payment_id.strip(),
        signature=razorpay_signature.strip(),
    )
    if not is_valid_sig:
        _record_audit(
            payment=payment,
            previous_status=payment.status.value,
            new_status=payment.status.value,
            action="SIGNATURE_VERIFICATION_FAILED",
            actor_id=requesting_user.id if requesting_user else None,
            actor_type="USER",
            reason="Invalid Razorpay signature provided during verification",
        )
        db.session.commit()
        raise ValidationException("Invalid Razorpay payment signature.", code="INVALID_PAYMENT_SIGNATURE")

    # 2. Verify amount & currency
    gateway_data = prov.fetch_payment(razorpay_payment_id.strip())
    expected_paise = int(round(Decimal(payment.amount) * 100))
    reported_amount = gateway_data.get("amount")
    reported_currency = gateway_data.get("currency", "").upper()

    if reported_amount is not None and reported_amount != expected_paise:
        raise ValidationException(
            f"Reported gateway amount ({reported_amount} paise) does not match payment amount ({expected_paise} paise).",
            code="PAYMENT_AMOUNT_MISMATCH",
        )
    if reported_currency and reported_currency != payment.currency.upper():
        raise ValidationException(
            f"Reported gateway currency ({reported_currency}) does not match payment currency ({payment.currency}).",
            code="PAYMENT_CURRENCY_MISMATCH",
        )

    # 3. Transition to PAID
    prev_status = payment.status.value
    payment.status = PaymentStatus.PAID
    payment.gateway_payment_id = razorpay_payment_id.strip()
    payment.gateway_signature = razorpay_signature.strip()
    payment.paid_at = utc_now()
    payment.gateway_metadata = {
        **payment.gateway_metadata,
        "payment_id": razorpay_payment_id.strip(),
        "verified_at": utc_now().isoformat(),
    }

    _record_audit(
        payment=payment,
        previous_status=prev_status,
        new_status=PaymentStatus.PAID.value,
        action="VERIFIED_ONLINE",
        actor_id=requesting_user.id if requesting_user else None,
        actor_type="USER" if requesting_user else "SYSTEM",
        reason="Razorpay payment signature and amount successfully verified",
    )

    db.session.commit()
    return payment


def process_webhook_event(
    raw_body: bytes,
    signature_header: str,
    event_payload: Dict[str, Any],
    provider: Optional[PaymentProviderInterface] = None,
) -> Dict[str, Any]:
    """Process Razorpay webhooks idempotently with raw payload signature authentication."""
    prov = provider or get_payment_provider()

    # 1. Authenticate webhook signature over raw payload
    if not prov.verify_webhook_signature(raw_body, signature_header):
        raise UnauthorizedException("Invalid webhook signature.", code="INVALID_WEBHOOK_SIGNATURE")

    event_id = event_payload.get("event_id") or event_payload.get("id") or str(uuid.uuid4())
    event_type = event_payload.get("event", "unknown")

    # 2. Idempotency check on event_id
    existing_event = PaymentWebhookEvent.query.filter_by(event_id=event_id).first()
    if existing_event:
        return {
            "success": True,
            "message": "Duplicate event acknowledged and skipped.",
            "status": "DUPLICATE",
            "event_id": event_id,
        }

    outcome = "PROCESSED"
    payment_id = None
    error_msg = None

    try:
        payload_data = event_payload.get("payload", {})

        if event_type == "payment.captured":
            payment_entity = payload_data.get("payment", {}).get("entity", {})
            order_id = payment_entity.get("order_id")
            rzp_payment_id = payment_entity.get("id")
            amount_paise = payment_entity.get("amount")
            currency = payment_entity.get("currency", "INR")

            if order_id:
                payment = Payment.query.filter_by(gateway_order_id=order_id).first()
                if payment:
                    payment_id = payment.id
                    expected_paise = int(round(Decimal(payment.amount) * 100))

                    if amount_paise is not None and amount_paise != expected_paise:
                        outcome = "AMOUNT_MISMATCH"
                        error_msg = f"Webhook amount {amount_paise} does not match {expected_paise}"
                    elif payment.status == PaymentStatus.PAID:
                        outcome = "ALREADY_PAID"
                    else:
                        prev_status = payment.status.value
                        payment.status = PaymentStatus.PAID
                        payment.gateway_payment_id = rzp_payment_id
                        payment.paid_at = utc_now()
                        _record_audit(
                            payment=payment,
                            previous_status=prev_status,
                            new_status=PaymentStatus.PAID.value,
                            action="WEBHOOK_CAPTURED",
                            actor_type="WEBHOOK",
                            reason=f"Webhook event '{event_type}' processed",
                            metadata_snapshot={"event_id": event_id},
                        )

        elif event_type == "payment.failed":
            payment_entity = payload_data.get("payment", {}).get("entity", {})
            order_id = payment_entity.get("order_id")
            if order_id:
                payment = Payment.query.filter_by(gateway_order_id=order_id).first()
                if payment and payment.status == PaymentStatus.PENDING:
                    payment_id = payment.id
                    prev_status = payment.status.value
                    payment.status = PaymentStatus.FAILED
                    _record_audit(
                        payment=payment,
                        previous_status=prev_status,
                        new_status=PaymentStatus.FAILED.value,
                        action="WEBHOOK_FAILED",
                        actor_type="WEBHOOK",
                        reason=payment_entity.get("error_description") or "Payment failed at gateway",
                        metadata_snapshot={"event_id": event_id},
                    )

        elif event_type == "refund.processed":
            refund_entity = payload_data.get("refund", {}).get("entity", {})
            rzp_payment_id = refund_entity.get("payment_id")
            if rzp_payment_id:
                payment = Payment.query.filter_by(gateway_payment_id=rzp_payment_id).first()
                if payment and payment.status in (PaymentStatus.PAID, PaymentStatus.REFUND_PENDING):
                    payment_id = payment.id
                    prev_status = payment.status.value
                    payment.status = PaymentStatus.REFUNDED
                    payment.gateway_refund_id = refund_entity.get("id")
                    payment.refunded_at = utc_now()
                    _record_audit(
                        payment=payment,
                        previous_status=prev_status,
                        new_status=PaymentStatus.REFUNDED.value,
                        action="WEBHOOK_REFUND_PROCESSED",
                        actor_type="WEBHOOK",
                        reason="Gateway refund processed successfully",
                        metadata_snapshot={"event_id": event_id},
                    )

        elif event_type == "refund.failed":
            refund_entity = payload_data.get("refund", {}).get("entity", {})
            rzp_payment_id = refund_entity.get("payment_id")
            if rzp_payment_id:
                payment = Payment.query.filter_by(gateway_payment_id=rzp_payment_id).first()
                if payment and payment.status == PaymentStatus.REFUND_PENDING:
                    payment_id = payment.id
                    prev_status = payment.status.value
                    payment.status = PaymentStatus.PAID
                    _record_audit(
                        payment=payment,
                        previous_status=prev_status,
                        new_status=PaymentStatus.PAID.value,
                        action="WEBHOOK_REFUND_FAILED",
                        actor_type="WEBHOOK",
                        reason="Gateway refund failed; reverted payment status to PAID",
                        metadata_snapshot={"event_id": event_id},
                    )
        else:
            # Acknowledge and ignore unknown webhook events
            outcome = "IGNORED"

    except Exception as exc:
        outcome = "FAILED"
        error_msg = str(exc)

    webhook_record = PaymentWebhookEvent(
        event_id=event_id,
        event_type=event_type,
        payment_id=payment_id,
        outcome=outcome,
        error_message=error_msg,
        processed_at=utc_now(),
    )
    db.session.add(webhook_record)
    db.session.commit()

    return {
        "success": True,
        "message": f"Webhook '{event_type}' processed with outcome '{outcome}'.",
        "outcome": outcome,
        "event_id": event_id,
    }


def refund_payment(
    payment_id: int,
    requesting_user: Any,
    reason: Optional[str] = None,
    provider: Optional[PaymentProviderInterface] = None,
) -> Payment:
    """Refund a completed payment."""
    payment = db.session.get(Payment, payment_id)
    if not payment:
        raise NotFoundException(f"Payment with ID {payment_id} not found.")

    if payment.status == PaymentStatus.REFUNDED:
        raise ValidationException("This payment has already been refunded.", code="ALREADY_REFUNDED")

    if payment.status != PaymentStatus.PAID:
        raise ValidationException(
            f"Cannot refund a payment with status '{payment.status.value}'. Must be PAID.",
            code="INVALID_PAYMENT_STATUS",
        )

    prev_status = payment.status.value

    if payment.payment_method == PaymentMethod.ONLINE:
        prov = provider or get_payment_provider()
        amount_paise = int(round(Decimal(payment.amount) * 100))
        refund_data = prov.create_refund(
            gateway_payment_id=payment.gateway_payment_id,
            amount_paise=amount_paise,
            notes={"reason": reason or "Customer refund"},
        )
        refund_status = refund_data.get("status", "processed")
        payment.gateway_refund_id = refund_data.get("id")

        if refund_status == "processed":
            payment.status = PaymentStatus.REFUNDED
            payment.refunded_at = utc_now()
            action = "REFUNDED"
        else:
            # Asynchronous refund path
            payment.status = PaymentStatus.REFUND_PENDING
            action = "REFUND_PENDING"

        _record_audit(
            payment=payment,
            previous_status=prev_status,
            new_status=payment.status.value,
            action=action,
            actor_id=requesting_user.id if requesting_user else None,
            actor_type="STAFF",
            reason=reason or "Online refund initiated via gateway",
            metadata_snapshot=refund_data,
        )
    else:
        # Offline cash / card / upi refund recorded directly
        payment.status = PaymentStatus.REFUNDED
        payment.refunded_at = utc_now()
        _record_audit(
            payment=payment,
            previous_status=prev_status,
            new_status=PaymentStatus.REFUNDED.value,
            action="REFUNDED",
            actor_id=requesting_user.id if requesting_user else None,
            actor_type="STAFF",
            reason=reason or f"Staff refunded {payment.payment_method.value} payment",
        )

    db.session.commit()
    return payment


def cancel_payment(
    payment_id: int,
    requesting_user: Optional[Any] = None,
    reason: Optional[str] = None,
) -> Payment:
    """Cancel a pending payment."""
    payment = db.session.get(Payment, payment_id)
    if not payment:
        raise NotFoundException(f"Payment with ID {payment_id} not found.")

    if payment.status == PaymentStatus.CANCELLED:
        return payment

    validate_transition(payment.status, PaymentStatus.CANCELLED)

    prev_status = payment.status.value
    payment.status = PaymentStatus.CANCELLED

    _record_audit(
        payment=payment,
        previous_status=prev_status,
        new_status=PaymentStatus.CANCELLED.value,
        action="CANCELLED",
        actor_id=requesting_user.id if requesting_user else None,
        actor_type="USER" if requesting_user and requesting_user.is_member else "STAFF",
        reason=reason or "Payment cancelled",
    )

    db.session.commit()
    return payment


def fail_payment(payment_id: int, reason: Optional[str] = None) -> Payment:
    """Mark a pending payment as failed."""
    payment = db.session.get(Payment, payment_id)
    if not payment:
        raise NotFoundException(f"Payment with ID {payment_id} not found.")

    validate_transition(payment.status, PaymentStatus.FAILED)

    prev_status = payment.status.value
    payment.status = PaymentStatus.FAILED

    _record_audit(
        payment=payment,
        previous_status=prev_status,
        new_status=PaymentStatus.FAILED.value,
        action="FAILED",
        actor_type="SYSTEM",
        reason=reason or "Payment failed",
    )

    db.session.commit()
    return payment


def get_payment_by_id(payment_id: int) -> Optional[Payment]:
    """Retrieve payment by ID."""
    return db.session.get(Payment, payment_id)


def get_payment_by_reference(reference: str) -> Optional[Payment]:
    """Retrieve payment by reference code."""
    return Payment.query.filter_by(payment_reference=reference.strip().upper()).first()


def list_payments(
    status: Optional[str] = None,
    payment_method: Optional[str] = None,
    item_type: Optional[str] = None,
    item_id: Optional[int] = None,
    user_id: Optional[int] = None,
    member_id: Optional[int] = None,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
) -> List[Payment]:
    """Query and filter payments."""
    query = Payment.query

    if status:
        query = query.filter(Payment.status == PaymentStatus(status.upper().strip()))
    if payment_method:
        query = query.filter(Payment.payment_method == PaymentMethod(payment_method.upper().strip()))
    if item_type:
        query = query.filter(Payment.item_type == PaymentItemType(item_type.upper().strip()))
    if item_id:
        query = query.filter(Payment.item_id == item_id)
    if user_id:
        query = query.filter(Payment.user_id == user_id)
    if member_id:
        query = query.filter(Payment.member_id == member_id)
    if start_date:
        query = query.filter(Payment.created_at >= datetime.combine(start_date, datetime.min.time()))
    if end_date:
        query = query.filter(Payment.created_at <= datetime.combine(end_date, datetime.max.time()))

    return query.order_by(Payment.created_at.desc()).all()
