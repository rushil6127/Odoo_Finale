from flask import Blueprint, request, current_app
from flask_jwt_extended import jwt_required, current_user
from backend.app.extensions import db
from backend.app.common.responses import success_response
from backend.app.common.validation import validate_schema
from backend.app.common.permissions import roles_required, RoleEnum
from backend.app.common.errors import (
    NotFoundException,
    ForbiddenException,
    ValidationException,
    UnauthorizedException,
)
from backend.app.payments.models import (
    PaymentMethod,
    PaymentItemType,
)
from backend.app.payments.schemas import (
    PaymentCreateSchema,
    PaymentVerifySchema,
    PaymentConfirmSchema,
    PaymentRefundSchema,
    PaymentFilterSchema,
)
from backend.app.payments.services import (
    create_or_initiate_payment,
    confirm_manual_payment,
    verify_online_payment,
    process_webhook_event,
    refund_payment,
    cancel_payment,
    get_payment_by_id,
    list_payments,
)

payments_bp = Blueprint("payments", __name__, url_prefix="/api/v1/payments")


@payments_bp.route("", methods=["POST"])
@jwt_required()
@roles_required(
    RoleEnum.OWNER,
    RoleEnum.ADMIN,
    RoleEnum.FRONT_DESK,
    RoleEnum.SHOP_STAFF,
    RoleEnum.BAR_STAFF,
    RoleEnum.MEMBER,
)
@validate_schema(PaymentCreateSchema)
def create_payment_route(validated_data):
    """Create or initiate a payment.
    
    Members can only pay for their own items.
    Returns the Razorpay public key ID for checkout if ONLINE.
    """
    item_type = validated_data["item_type"]
    item_id = validated_data["item_id"]
    amount = validated_data["amount"]
    payment_method = validated_data["payment_method"]
    notes = validated_data.get("notes")

    # If MEMBER, verify ownership of the underlying business entity
    if current_user.is_member:
        enum_item = PaymentItemType(item_type.upper().strip())
        if enum_item == PaymentItemType.BOOKING:
            from backend.app.bookings.models import Booking
            booking = db.session.get(Booking, item_id)
            if not booking:
                raise NotFoundException(f"Booking with ID {item_id} not found.")
            if booking.user_id != current_user.id and (not booking.member or booking.member.user_id != current_user.id):
                raise ForbiddenException("You are not authorized to initiate payment for this booking.")
        elif enum_item == PaymentItemType.MEMBERSHIP:
            from backend.app.memberships.models import Membership
            membership = db.session.get(Membership, item_id)
            if not membership:
                raise NotFoundException(f"Membership with ID {item_id} not found.")
            if not membership.member or membership.member.user_id != current_user.id:
                raise ForbiddenException("You are not authorized to initiate payment for this membership.")

        user_id = current_user.id
        member_id = current_user.member_profile.id if current_user.member_profile else None
    else:
        user_id = current_user.id
        member_id = None

    payment = create_or_initiate_payment(
        item_type=item_type,
        item_id=item_id,
        amount=amount,
        payment_method=payment_method,
        user_id=user_id,
        member_id=member_id,
        notes=notes,
    )

    from backend.app.payments.providers import get_payment_provider
    provider = get_payment_provider()
    public_key = getattr(provider, "key_id", None) or current_app.config.get("RAZORPAY_KEY_ID")

    return success_response(
        data=payment.to_dict(include_audits=True, public_key_id=public_key),
        message="Payment initiated successfully.",
        status_code=201,
    )


@payments_bp.route("", methods=["GET"])
@jwt_required()
@roles_required(
    RoleEnum.OWNER,
    RoleEnum.ADMIN,
    RoleEnum.FRONT_DESK,
    RoleEnum.SHOP_STAFF,
    RoleEnum.BAR_STAFF,
    RoleEnum.MEMBER,
)
def list_payments_route():
    """List and filter payments.
    
    Members can only see their own payments.
    Staff can query across all transactions.
    """
    args = request.args.to_dict()
    filter_schema = PaymentFilterSchema()
    filter_params = filter_schema.load(args)

    if current_user.is_member:
        user_id = current_user.id
        member_id = None
    else:
        user_id = filter_params.get("user_id")
        member_id = filter_params.get("member_id")

    payments = list_payments(
        status=filter_params.get("status"),
        payment_method=filter_params.get("payment_method"),
        item_type=filter_params.get("item_type"),
        item_id=filter_params.get("item_id"),
        user_id=user_id,
        member_id=member_id,
        start_date=filter_params.get("start_date"),
        end_date=filter_params.get("end_date"),
    )

    return success_response(data=[p.to_dict() for p in payments])


@payments_bp.route("/<int:payment_id>", methods=["GET"])
@jwt_required()
@roles_required(
    RoleEnum.OWNER,
    RoleEnum.ADMIN,
    RoleEnum.FRONT_DESK,
    RoleEnum.SHOP_STAFF,
    RoleEnum.BAR_STAFF,
    RoleEnum.MEMBER,
)
def get_payment_route(payment_id: int):
    """Retrieve detailed payment record with audit history."""
    payment = get_payment_by_id(payment_id)
    if not payment:
        raise NotFoundException(f"Payment with ID {payment_id} not found.")

    if current_user.is_member:
        if payment.user_id != current_user.id and (not payment.member or payment.member.user_id != current_user.id):
            raise ForbiddenException("You are not authorized to view this payment.")

    from backend.app.payments.providers import get_payment_provider
    provider = get_payment_provider()
    public_key = getattr(provider, "key_id", None) or current_app.config.get("RAZORPAY_KEY_ID")
    return success_response(data=payment.to_dict(include_audits=True, public_key_id=public_key))


@payments_bp.route("/<int:payment_id>/confirm", methods=["POST"])
@jwt_required()
@roles_required(
    RoleEnum.OWNER,
    RoleEnum.ADMIN,
    RoleEnum.FRONT_DESK,
    RoleEnum.SHOP_STAFF,
    RoleEnum.BAR_STAFF,
)
def confirm_payment_route(payment_id: int):
    """Staff confirmation for CASH, CARD, and UPI payments. Rejected for ONLINE."""
    json_data = request.get_json(silent=True) or {}
    schema = PaymentConfirmSchema()
    validated = schema.load(json_data)

    payment = confirm_manual_payment(
        payment_id=payment_id,
        staff_user=current_user,
        notes=validated.get("notes"),
    )

    return success_response(
        data=payment.to_dict(include_audits=True),
        message="Payment confirmed successfully.",
    )


@payments_bp.route("/verify", methods=["POST"])
@jwt_required()
@roles_required(
    RoleEnum.OWNER,
    RoleEnum.ADMIN,
    RoleEnum.FRONT_DESK,
    RoleEnum.MEMBER,
)
@validate_schema(PaymentVerifySchema)
def verify_payment_route(validated_data):
    """Verify an online Razorpay payment after client checkout."""
    order_id = validated_data["razorpay_order_id"]
    payment_id = validated_data["razorpay_payment_id"]
    signature = validated_data["razorpay_signature"]

    payment = verify_online_payment(
        razorpay_order_id=order_id,
        razorpay_payment_id=payment_id,
        razorpay_signature=signature,
        requesting_user=current_user,
    )

    return success_response(
        data=payment.to_dict(include_audits=True),
        message="Online payment verified and marked as PAID.",
    )


@payments_bp.route("/webhook", methods=["POST"])
def webhook_receiver_route():
    """Unauthenticated gateway webhook receiver verified by HMAC-SHA256 over raw payload."""
    raw_body = request.get_data()
    signature = request.headers.get("X-Razorpay-Signature", "")

    if not signature:
        raise UnauthorizedException("Missing X-Razorpay-Signature header.", code="MISSING_SIGNATURE")

    event_payload = request.get_json(silent=True) or {}

    result = process_webhook_event(
        raw_body=raw_body,
        signature_header=signature,
        event_payload=event_payload,
    )

    return success_response(data=result, message="Webhook processed.")


@payments_bp.route("/<int:payment_id>/refund", methods=["POST"])
@jwt_required()
@roles_required(
    RoleEnum.OWNER,
    RoleEnum.ADMIN,
)
def refund_payment_route(payment_id: int):
    """Refund a payment."""
    json_data = request.get_json(silent=True) or {}
    schema = PaymentRefundSchema()
    validated = schema.load(json_data)

    payment = refund_payment(
        payment_id=payment_id,
        requesting_user=current_user,
        reason=validated.get("reason"),
    )

    return success_response(
        data=payment.to_dict(include_audits=True),
        message="Payment refund processed successfully.",
    )


@payments_bp.route("/<int:payment_id>/cancel", methods=["POST"])
@jwt_required()
@roles_required(
    RoleEnum.OWNER,
    RoleEnum.ADMIN,
    RoleEnum.FRONT_DESK,
    RoleEnum.MEMBER,
)
def cancel_payment_route(payment_id: int):
    """Cancel a pending payment."""
    payment = get_payment_by_id(payment_id)
    if not payment:
        raise NotFoundException(f"Payment with ID {payment_id} not found.")

    if current_user.is_member and payment.user_id != current_user.id:
        raise ForbiddenException("You are not authorized to cancel this payment.")

    cancelled = cancel_payment(
        payment_id=payment_id,
        requesting_user=current_user,
        reason="User requested cancellation",
    )

    return success_response(
        data=cancelled.to_dict(include_audits=True),
        message="Payment cancelled successfully.",
    )
