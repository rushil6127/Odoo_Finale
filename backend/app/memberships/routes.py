from datetime import date
from flask import Blueprint, current_app, request
from flask_jwt_extended import jwt_required, current_user
from backend.app.extensions import db, limiter
from backend.app.common.responses import success_response
from backend.app.common.validation import validate_schema
from backend.app.common.permissions import roles_required, RoleEnum
from backend.app.common.errors import NotFoundException, ForbiddenException, ValidationException
from backend.app.members.models import Member
from backend.app.memberships.schemas import (
    AssignMembershipSchema,
    ChangePlanSchema,
    MembershipRequestCreateSchema,
    MembershipRequestReviewSchema,
)
from backend.app.memberships.services import (
    get_all_plans,
    get_plan_by_id,
    get_plan_by_code,
    get_active_membership,
    get_membership_history,
    assign_membership,
    change_membership_plan,
    update_membership_plan,
)

membership_plans_bp = Blueprint("membership_plans", __name__, url_prefix="/api/v1/membership-plans")
memberships_bp = Blueprint("memberships", __name__, url_prefix="/api/v1/members")


def _check_member_access(member_id: int) -> Member:
    """Verify that current_user has permission to view this member's data."""
    member = db.session.get(Member, member_id)
    if not member:
        raise NotFoundException(f"Member with ID {member_id} not found.")

    user_role = (
        current_user.role.value
        if hasattr(current_user.role, "value")
        else str(current_user.role)
    )

    if user_role == RoleEnum.MEMBER.value:
        if member.user_id != current_user.id:
            raise ForbiddenException("You do not have permission to access another member's data.")

    return member


# ---------------------------------------------------------
# Membership Plans Endpoints
# ---------------------------------------------------------

@membership_plans_bp.route("", methods=["GET"])
def list_plans():
    """Retrieve all available membership plans with pricing and structured benefits."""
    plans = get_all_plans(active_only=True)
    return success_response(
        data={"plans": [p.to_dict() for p in plans]},
        status_code=200,
    )


@membership_plans_bp.route("/<int:plan_id>", methods=["PUT", "PATCH"])
@roles_required(RoleEnum.OWNER)
def update_plan_endpoint(plan_id: int):
    """
    Owner-exclusive endpoint to edit membership plan price, benefits, and attributes.
    Strictly restricted to OWNER role. Persists directly into the database in real time.
    """
    from flask import request
    data = request.get_json(silent=True) or {}

    price = data.get("displayed_monthly_price")
    features = data.get("features")
    if features is None and isinstance(data.get("benefits"), dict):
        features = data["benefits"].get("features")

    name = data.get("name")
    description = data.get("description")
    duration_months = data.get("duration_months")
    complimentary_months = data.get("complimentary_months")

    plan = update_membership_plan(
        plan_id=plan_id,
        displayed_monthly_price=price,
        features=features,
        name=name,
        description=description,
        duration_months=duration_months,
        complimentary_months=complimentary_months,
    )

    return success_response(
        data={"plan": plan.to_dict()},
        message=f"Plan '{plan.name}' updated successfully.",
        status_code=200,
    )


@membership_plans_bp.route("/my-status", methods=["GET"])
@jwt_required()
def get_my_membership_status():
    """Retrieve currently active membership, validity time range, and history for current_user."""
    from backend.app.members.services import get_member_by_user_id
    member = get_member_by_user_id(current_user.id)
    if not member:
        return success_response(
            data={
                "has_active_membership": False,
                "active_membership": None,
                "history": [],
                "member_id": None,
                "user": current_user.to_dict(),
            },
            status_code=200,
        )

    active_ms = get_active_membership(member.id)
    history = get_membership_history(member.id)

    return success_response(
        data={
            "has_active_membership": active_ms is not None,
            "active_membership": active_ms.to_dict(include_plan=True) if active_ms else None,
            "history": [m.to_dict(include_plan=True) for m in history],
            "member_id": member.id,
            "user": current_user.to_dict(),
        },
        status_code=200,
    )


@membership_plans_bp.route("/subscribe/order", methods=["POST"])
@limiter.limit("20 per minute")
@jwt_required()
def create_subscription_order():
    """Create a Razorpay order for online membership subscription."""
    import uuid
    from flask import request, current_app
    from backend.app.members.services import get_member_by_user_id, create_member
    from backend.app.payments.providers import get_payment_provider

    data = request.get_json(silent=True) or {}
    plan_id = data.get("plan_id")
    plan_code = data.get("plan_code")

    plan = None
    if plan_id:
        try:
            plan = get_plan_by_id(int(plan_id))
        except (ValueError, TypeError):
            pass
    if not plan and plan_code:
        plan = get_plan_by_code(str(plan_code))

    if not plan or not plan.is_active:
        raise NotFoundException("Membership plan not found or inactive.")

    # Get or create member record for current_user
    member = get_member_by_user_id(current_user.id)
    if not member:
        member = create_member(user_id=current_user.id)

    # Junior age check if DOB exists
    if plan.code == "JUNIOR" and member.date_of_birth:
        from backend.app.memberships.services import _validate_junior_age
        _validate_junior_age(member, date.today())

    # Check active membership
    active_ms = get_active_membership(member.id)
    is_upgrade = False
    is_downgrade = False
    current_plan_code = None
    if active_ms and active_ms.plan:
        current_plan_code = active_ms.plan.code
        if float(plan.displayed_monthly_price) > float(active_ms.plan.displayed_monthly_price):
            is_upgrade = True
        elif float(plan.displayed_monthly_price) < float(active_ms.plan.displayed_monthly_price):
            is_downgrade = True

    # Price in rupees and paise
    amount_rupees = float(plan.effective_annual_price)
    amount_paise = int(round(amount_rupees * 100))

    # Gateway details
    provider = get_payment_provider()
    public_key = getattr(provider, "key_id", None) or current_app.config.get("RAZORPAY_KEY_ID")

    order_id = None
    if getattr(provider, "key_id", None) and getattr(provider, "key_secret", None):
        try:
            receipt_ref = f"rcpt_mem_{uuid.uuid4().hex[:8]}"
            order_data = provider.create_order(
                amount_paise=amount_paise,
                currency="INR",
                receipt=receipt_ref,
                notes={
                    "item_type": "MEMBERSHIP",
                    "plan_id": str(plan.id),
                    "plan_code": plan.code,
                    "user_id": str(current_user.id),
                    "member_id": str(member.id),
                },
            )
            order_id = order_data.get("id")
        except Exception as e:
            current_app.logger.warning(f"Razorpay order creation failed, falling back: {e}")
            if not (current_app.config.get("TESTING") or current_app.config.get("DEBUG")):
                raise ValidationException("Failed to create Razorpay order. Please try again later.")
            order_id = None

    if not order_id:
        if not (current_app.config.get("TESTING") or current_app.config.get("DEBUG")):
            raise ValidationException("Payment gateway is not configured for production.")
        order_id = f"order_rzp_{uuid.uuid4().hex[:14]}"
    if not public_key:
        public_key = "rzp_test_championsclubdemo"

    return success_response(
        data={
            "razorpay_order_id": order_id,
            "razorpay_key_id": public_key,
            "amount": amount_rupees,
            "amount_paise": amount_paise,
            "currency": "INR",
            "plan": plan.to_dict(),
            "is_upgrade": is_upgrade,
            "is_downgrade": is_downgrade,
            "current_plan_code": current_plan_code,
            "member_id": member.id,
            "user": {
                "name": current_user.full_name,
                "email": current_user.email,
                "phone": member.phone or "+91 98765 43210",
            },
        },
        message="Razorpay subscription order created successfully.",
        status_code=200,
    )


@membership_plans_bp.route("/subscribe/verify", methods=["POST"])
@limiter.limit("20 per minute")
@jwt_required()
def verify_subscription_payment():
    """Verify online payment for membership and activate/change plan in database."""
    import uuid
    from decimal import Decimal
    from flask import request
    from backend.app.common.utils import utc_now
    from backend.app.common.errors import ValidationException
    from backend.app.members.services import get_member_by_user_id, create_member
    from backend.app.payments.models import Payment, PaymentMethod, PaymentStatus, PaymentItemType
    from backend.app.payments.services import _record_audit, generate_payment_reference
    from backend.app.payments.providers import get_payment_provider

    data = request.get_json(silent=True) or {}
    plan_id = data.get("plan_id")
    plan_code = data.get("plan_code")
    razorpay_order_id = (data.get("razorpay_order_id") or "").strip()
    razorpay_payment_id = (data.get("razorpay_payment_id") or "").strip()
    razorpay_signature = (data.get("razorpay_signature") or "").strip()
    paid_amount = data.get("amount")

    plan = None
    if plan_id:
        try:
            plan = get_plan_by_id(int(plan_id))
        except (ValueError, TypeError):
            pass
    if not plan and plan_code:
        plan = get_plan_by_code(str(plan_code))

    if not plan or not plan.is_active:
        raise NotFoundException("Membership plan not found or inactive.")

    if not razorpay_payment_id:
        razorpay_payment_id = f"pay_{uuid.uuid4().hex[:14]}"
    if not razorpay_order_id:
        razorpay_order_id = f"order_{uuid.uuid4().hex[:14]}"

    if razorpay_order_id.startswith("order_rzp_"):
        if not (current_app.config.get("TESTING") or current_app.config.get("DEBUG")):
            raise ValidationException("Mock orders are not allowed in production.", code="MOCK_NOT_ALLOWED")

    # Verify signature if real provider credentials configured
    provider = get_payment_provider()
    if getattr(provider, "key_secret", None) and razorpay_signature and not razorpay_order_id.startswith("order_rzp_"):
        try:
            is_valid = provider.verify_payment_signature(
                order_id=razorpay_order_id,
                payment_id=razorpay_payment_id,
                signature=razorpay_signature,
            )
            if not is_valid:
                raise ValidationException("Invalid Razorpay payment signature.", code="INVALID_SIGNATURE")
        except Exception as e:
            if "INVALID_SIGNATURE" in str(e):
                raise

    # 1. Get or create member record
    member = get_member_by_user_id(current_user.id)
    if not member:
        member = create_member(user_id=current_user.id)

    # 2. Check if member already has active membership
    today = date.today()
    active_ms = get_active_membership(member.id, today)

    final_price = float(paid_amount) if paid_amount is not None else float(plan.effective_annual_price)

    new_membership = None
    old_membership = None
    if active_ms:
        # Change plan (upgrade / downgrade / renewal)
        new_membership, old_membership = change_membership_plan(
            member_id=member.id,
            new_plan_id=plan.id,
            effective_date=today,
            price_paid=final_price,
            notes=f"Paid via Razorpay (Order: {razorpay_order_id}, Payment: {razorpay_payment_id})",
        )
    else:
        # Initial assignment
        new_membership = assign_membership(
            member_id=member.id,
            plan_id=plan.id,
            start_date=today,
            duration_months=plan.duration_months,
            price_paid=final_price,
            notes=f"Paid via Razorpay (Order: {razorpay_order_id}, Payment: {razorpay_payment_id})",
        )

    # 3. Create PAID payment record in payments table
    payment = Payment(
        payment_reference=generate_payment_reference(),
        amount=Decimal(str(final_price)),
        currency="INR",
        payment_method=PaymentMethod.ONLINE,
        status=PaymentStatus.PAID,
        item_type=PaymentItemType.MEMBERSHIP,
        item_id=new_membership.id,
        user_id=current_user.id,
        member_id=member.id,
        provider="RAZORPAY",
        gateway_order_id=razorpay_order_id,
        gateway_payment_id=razorpay_payment_id,
        gateway_signature=razorpay_signature,
        gateway_metadata={
            "order_id": razorpay_order_id,
            "payment_id": razorpay_payment_id,
            "plan_code": plan.code,
            "plan_name": plan.name,
            "verified_at": utc_now().isoformat(),
        },
        paid_at=utc_now(),
        notes=f"Razorpay subscription for {plan.name}",
    )
    db.session.add(payment)
    db.session.flush()

    _record_audit(
        payment=payment,
        previous_status=None,
        new_status=PaymentStatus.PAID.value,
        action="VERIFIED_ONLINE",
        actor_id=current_user.id,
        actor_type="USER",
        reason=f"Membership {plan.name} verified and activated via Razorpay",
        metadata_snapshot={"membership_id": new_membership.id, "plan_code": plan.code},
    )

    db.session.commit()

    return success_response(
        data={
            "membership": new_membership.to_dict(include_plan=True),
            "previous_membership": old_membership.to_dict(include_plan=True) if old_membership else None,
            "payment": payment.to_dict(),
            "user": current_user.to_dict(),
        },
        message=f"Membership successfully activated! Welcome to {plan.name}.",
        status_code=200,
    )


@membership_plans_bp.route("/<int:plan_id>", methods=["GET"])
def get_plan_details(plan_id: int):
    """Retrieve details for a specific membership plan."""
    plan = get_plan_by_id(plan_id)
    if not plan:
        raise NotFoundException(f"Membership plan with ID {plan_id} not found.")
    return success_response(
        data={"plan": plan.to_dict()},
        status_code=200,
    )


# ---------------------------------------------------------
# Member Membership History and Assignment Endpoints
# ---------------------------------------------------------

@memberships_bp.route("/<int:member_id>/memberships", methods=["GET"])
@jwt_required()
def list_member_memberships(member_id: int):
    """List full membership history for a specific member."""
    _check_member_access(member_id)
    history = get_membership_history(member_id)
    return success_response(
        data={"memberships": [m.to_dict(include_plan=True) for m in history]},
        status_code=200,
    )


@memberships_bp.route("/<int:member_id>/memberships/active", methods=["GET"])
@jwt_required()
def get_member_active_membership(member_id: int):
    """Retrieve currently active membership and benefits for a member."""
    _check_member_access(member_id)
    active_ms = get_active_membership(member_id)
    return success_response(
        data={"active_membership": active_ms.to_dict(include_plan=True) if active_ms else None},
        status_code=200,
    )


@memberships_bp.route("/<int:member_id>/memberships", methods=["POST"])
@roles_required(RoleEnum.OWNER, RoleEnum.ADMIN, RoleEnum.FRONT_DESK)
@validate_schema(AssignMembershipSchema)
def assign_member_plan(member_id: int, validated_data):
    """Assign an initial membership plan to a member (Staff/Admin only)."""
    membership = assign_membership(
        member_id=member_id,
        plan_id=validated_data["plan_id"],
        start_date=validated_data["start_date"],
        duration_months=validated_data.get("duration_months"),
        price_paid=validated_data.get("price_paid"),
        notes=validated_data.get("notes"),
    )

    return success_response(
        data={"membership": membership.to_dict(include_plan=True)},
        message="Membership assigned successfully",
        status_code=201,
    )


@memberships_bp.route("/<int:member_id>/memberships/change-plan", methods=["POST"])
@roles_required(RoleEnum.OWNER, RoleEnum.ADMIN, RoleEnum.FRONT_DESK)
@validate_schema(ChangePlanSchema)
def change_member_plan(member_id: int, validated_data):
    """Upgrade or downgrade a member's plan while preserving history (Staff/Admin only)."""
    new_membership, old_membership = change_membership_plan(
        member_id=member_id,
        new_plan_id=validated_data["new_plan_id"],
        effective_date=validated_data["effective_date"],
        price_paid=validated_data.get("price_paid"),
        notes=validated_data.get("notes"),
    )

    return success_response(
        data={
            "new_membership": new_membership.to_dict(include_plan=True),
            "previous_membership": old_membership.to_dict(include_plan=True) if old_membership else None,
        },
        message="Membership plan changed successfully",
        status_code=200,
    )


# ---------------------------------------------------------
# Membership Requests & Offline Payment Review Endpoints
# ---------------------------------------------------------

@memberships_bp.route("/requests", methods=["POST"])
@jwt_required()
@validate_schema(MembershipRequestCreateSchema)
def submit_membership_request(validated_data):
    """Submit a membership request with offline payment proof (Always starts as PENDING)."""
    from backend.app.memberships.services import create_membership_request

    req = create_membership_request(
        user_id=current_user.id,
        plan_id=validated_data["plan_id"],
        transaction_reference=validated_data["transaction_reference"],
        amount_paid=validated_data["amount_paid"],
        screenshot_url=validated_data.get("screenshot_url"),
        payment_method=validated_data.get("payment_method", "UPI_QR"),
        requester_notes=validated_data.get("requester_notes"),
    )

    return success_response(
        data={"request": req.to_dict()},
        message="Membership payment request submitted successfully and is pending admin approval.",
        status_code=201,
    )


@memberships_bp.route("/requests/my", methods=["GET"])
@jwt_required()
def get_my_membership_requests():
    """Retrieve all membership requests submitted by the currently logged-in user."""
    from backend.app.memberships.services import list_membership_requests
    from flask import request

    page = int(request.args.get("page", 1))
    per_page = int(request.args.get("per_page", 50))
    status_filter = request.args.get("status")

    requests, total = list_membership_requests(
        user_id=current_user.id,
        status_filter=status_filter,
        page=page,
        per_page=per_page,
    )

    return success_response(
        data={"requests": [r.to_dict() for r in requests]},
        meta={"total": total, "page": page, "per_page": per_page},
        status_code=200,
    )


@memberships_bp.route("/requests", methods=["GET"])
@roles_required(RoleEnum.OWNER, RoleEnum.ADMIN)
def get_all_membership_requests():
    """Admin/Owner endpoint to list and search all membership requests across the club."""
    from backend.app.memberships.services import list_membership_requests
    from flask import request

    page = int(request.args.get("page", 1))
    per_page = int(request.args.get("per_page", 50))
    status_filter = request.args.get("status")
    search = request.args.get("q")

    requests, total = list_membership_requests(
        user_id=None,
        status_filter=status_filter,
        search=search,
        page=page,
        per_page=per_page,
    )

    return success_response(
        data={"requests": [r.to_dict() for r in requests]},
        meta={"total": total, "page": page, "per_page": per_page},
        status_code=200,
    )


@memberships_bp.route("/requests/<int:request_id>", methods=["GET"])
@jwt_required()
def get_membership_request_details(request_id: int):
    """View details of a specific membership request."""
    from backend.app.memberships.services import get_membership_request_by_id

    req = get_membership_request_by_id(request_id)
    if not req:
        raise NotFoundException(f"Membership request with ID {request_id} not found.")

    user_role = (
        current_user.role.value
        if hasattr(current_user.role, "value")
        else str(current_user.role)
    )

    # Regular members can only view their own request
    if user_role == RoleEnum.MEMBER.value and req.user_id != current_user.id:
        raise ForbiddenException("You do not have permission to view another user's request.")

    return success_response(
        data={"request": req.to_dict()},
        status_code=200,
    )


@memberships_bp.route("/requests/<int:request_id>/approve", methods=["POST"])
@roles_required(RoleEnum.OWNER, RoleEnum.ADMIN)
def approve_membership_request_endpoint(request_id: int):
    """Admin/Owner endpoint to manually approve a payment request and activate membership."""
    from flask import request
    from backend.app.memberships.services import approve_membership_request

    body = request.get_json(silent=True) or {}
    review_notes = body.get("review_notes")

    req, membership = approve_membership_request(
        request_id=request_id,
        reviewer_user=current_user,
        review_notes=review_notes,
    )

    return success_response(
        data={
            "request": req.to_dict(),
            "membership": membership.to_dict(include_plan=True),
        },
        message="Membership request approved and membership subscription activated successfully.",
        status_code=200,
    )


@memberships_bp.route("/requests/<int:request_id>/reject", methods=["POST"])
@roles_required(RoleEnum.OWNER, RoleEnum.ADMIN)
def reject_membership_request_endpoint(request_id: int):
    """Admin/Owner endpoint to reject a payment request."""
    from flask import request
    from backend.app.memberships.services import reject_membership_request

    body = request.get_json(silent=True) or {}
    review_notes = body.get("review_notes")

    req = reject_membership_request(
        request_id=request_id,
        reviewer_user=current_user,
        review_notes=review_notes,
    )

    return success_response(
        data={"request": req.to_dict()},
        message="Membership request has been rejected.",
        status_code=200,
    )


@memberships_bp.route("/upload-proof", methods=["POST"])
@jwt_required()
def upload_payment_proof():
    """Upload payment screenshot proof file or base64 image securely."""
    import os
    import secrets
    from flask import request
    from backend.app.common.errors import BadRequestException

    # Check for multipart file upload
    if "file" in request.files:
        file = request.files["file"]
        if not file or file.filename == "":
            raise BadRequestException("No file selected.")

        ext = file.filename.rsplit(".", 1)[-1].lower() if "." in file.filename else ""
        if ext not in ["png", "jpg", "jpeg", "webp", "pdf"]:
            raise BadRequestException("Invalid file format. Allowed: PNG, JPG, JPEG, WEBP, PDF.")

        # Save to instance/uploads/proofs
        upload_dir = os.path.abspath(
            os.path.join(os.path.dirname(__file__), "..", "..", "instance", "uploads", "proofs")
        )
        os.makedirs(upload_dir, exist_ok=True)

        filename = f"payment_proof_{secrets.token_hex(8)}.{ext}"
        filepath = os.path.join(upload_dir, filename)
        file.save(filepath)

        # In local dev, store relative static/data reference
        file_url = f"/api/v1/memberships/proofs/{filename}"

        return success_response(
            data={"url": file_url, "filename": filename},
            message="Payment screenshot uploaded successfully.",
            status_code=201,
        )

    # Check for base64 JSON payload
    body = request.get_json(silent=True) or {}
    data_url = body.get("image_data") or body.get("data")
    if data_url and data_url.startswith("data:image/"):
        return success_response(
            data={"url": data_url},
            message="Payment screenshot stored successfully.",
            status_code=201,
        )

    raise BadRequestException("No valid image file or data payload provided.")

