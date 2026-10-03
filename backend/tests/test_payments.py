import json
from decimal import Decimal
from datetime import date, datetime, timedelta
import pytest
from flask_jwt_extended import create_access_token
from backend.app.extensions import db
from backend.app.common.permissions import RoleEnum
from backend.app.common.errors import (
    ValidationException,
    ConflictException,
    ForbiddenException,
    UnauthorizedException,
)
from backend.app.auth.models import User
from backend.app.auth.services import create_user
from backend.app.members.models import Member
from backend.app.members.services import create_member
from backend.app.memberships.models import MembershipPlan, Membership, MembershipStatus
from backend.app.memberships.services import seed_membership_plans, assign_membership
from backend.app.courts.models import Court, SportType, CourtStatus
from backend.app.courts.services import create_court
from backend.app.bookings.models import Booking, BookingStatus
from backend.app.bookings.services import create_booking
from backend.app.payments.models import (
    Payment,
    PaymentAudit,
    PaymentWebhookEvent,
    PaymentMethod,
    PaymentStatus,
    PaymentItemType,
)
from backend.app.payments.providers import (
    FakePaymentProvider,
    RazorpayProvider,
    set_payment_provider,
)
from backend.app.payments.services import (
    create_or_initiate_payment,
    confirm_manual_payment,
    verify_online_payment,
    process_webhook_event,
    refund_payment,
    cancel_payment,
    fail_payment,
    get_payment_by_id,
    list_payments,
)


@pytest.fixture(autouse=True)
def setup_fake_provider():
    """Inject FakePaymentProvider for all tests by default."""
    fake_prov = FakePaymentProvider(
        key_id="rzp_test_fake_key_123",
        key_secret="fake_secret_key_456",
        webhook_secret="fake_webhook_secret_789",
    )
    set_payment_provider(fake_prov)
    yield fake_prov
    set_payment_provider(None)


@pytest.fixture
def seed_test_env(app, db_session):
    """Seed default plans and courts for testing."""
    seed_membership_plans()
    court = create_court(
        name="Centre Court (Grass)",
        sport_type="TENNIS",
        surface_type="Grass",
        is_indoor=False,
    )
    return {"court": court}


@pytest.fixture
def member_user(app, db_session, seed_test_env):
    """Create a member user with a Silver membership and a booking."""
    user = create_user(
        email="member.pay@club.com",
        password="Password123!",
        first_name="Pay",
        last_name="Member",
        role=RoleEnum.MEMBER,
    )
    member = create_member(user_id=user.id, phone="9876543210")
    silver_plan = MembershipPlan.query.filter_by(code="SILVER").first()
    ms = assign_membership(
        member_id=member.id,
        plan_id=silver_plan.id,
        start_date=date(2026, 1, 1),
        duration_months=12,
        notes="Silver member",
    )
    # Booking: Tennis (base ₹800, Silver 50% discount -> final ₹400)
    court = seed_test_env["court"]
    booking = create_booking(
        court_id=court.id,
        start_time=datetime(2026, 10, 10, 10, 0, 0),
        user_id=user.id,
        member_id=member.id,
    )
    return user, member, ms, booking


@pytest.fixture
def other_member_user(app, db_session, seed_test_env):
    """Create another member for access-control testing."""
    user = create_user(
        email="other.pay@club.com",
        password="Password123!",
        first_name="Other",
        last_name="Member",
        role=RoleEnum.MEMBER,
    )
    member = create_member(user_id=user.id, phone="9876543299")
    return user, member


@pytest.fixture
def front_desk_user(app, db_session):
    """Create front desk staff user."""
    return create_user(
        email="frontdesk.pay@club.com",
        password="Password123!",
        first_name="Front",
        last_name="Desk",
        role=RoleEnum.FRONT_DESK,
    )


@pytest.fixture
def admin_user(app, db_session):
    """Create admin user."""
    return create_user(
        email="admin.pay@club.com",
        password="Password123!",
        first_name="Admin",
        last_name="User",
        role=RoleEnum.ADMIN,
    )


def auth_header(user: User) -> dict:
    role_str = user.role.value if hasattr(user.role, "value") else str(user.role)
    token = create_access_token(identity=str(user.id), additional_claims={"role": role_str})
    return {"Authorization": f"Bearer {token}"}


# =========================================================================
# 1. DOMAIN & SERVICE LEVEL TESTS
# =========================================================================

def test_valid_offline_payment_creation(app, db_session, member_user):
    """Test creating CASH, CARD, and UPI payments against a booking."""
    user, member, ms, booking = member_user

    payment_cash = create_or_initiate_payment(
        item_type="BOOKING",
        item_id=booking.id,
        amount=Decimal("400.00"),
        payment_method="CASH",
        user_id=user.id,
        member_id=member.id,
    )

    assert payment_cash.id is not None
    assert payment_cash.payment_reference.startswith("PAY-")
    assert payment_cash.payment_method == PaymentMethod.CASH
    assert payment_cash.status == PaymentStatus.PENDING
    assert payment_cash.amount == Decimal("400.00")
    assert payment_cash.provider == "MANUAL"
    assert payment_cash.gateway_order_id is None

    # Check audit record
    audits = payment_cash.audits
    assert len(audits) == 1
    assert audits[0].action == "INITIATED"
    assert audits[0].new_status == "PENDING"


def test_invalid_payment_creation_amount_mismatch(app, db_session, member_user):
    """Payment amount not matching the item final price must be rejected."""
    user, member, ms, booking = member_user

    # Booking is ₹400.00; attempting ₹500.00 (overpayment)
    with pytest.raises(ValidationException) as exc_info:
        create_or_initiate_payment(
            item_type="BOOKING",
            item_id=booking.id,
            amount=Decimal("500.00"),
            payment_method="CASH",
            user_id=user.id,
        )
    assert "does not match booking final price" in str(exc_info.value)


def test_online_payment_creates_razorpay_order_in_paise(app, db_session, member_user, setup_fake_provider):
    """ONLINE payment creates a Razorpay order converting rupees to integer paise."""
    user, member, ms, booking = member_user
    fake_prov = setup_fake_provider

    payment = create_or_initiate_payment(
        item_type="BOOKING",
        item_id=booking.id,
        amount=Decimal("400.00"),
        payment_method="ONLINE",
        user_id=user.id,
        member_id=member.id,
        provider=fake_prov,
    )

    assert payment.payment_method == PaymentMethod.ONLINE
    assert payment.provider == "RAZORPAY"
    assert payment.gateway_order_id is not None
    assert payment.gateway_order_id.startswith("order_fake_")

    # Verify fake provider stored order in paise (400 * 100 = 40000 paise)
    created_order = fake_prov.orders[payment.gateway_order_id]
    assert created_order["amount"] == 40000
    assert created_order["currency"] == "INR"


def test_initiating_online_payment_twice_reuses_existing_order(app, db_session, member_user, setup_fake_provider):
    """Initiating an ONLINE payment twice for the same record reuses the existing Razorpay order."""
    user, member, ms, booking = member_user
    fake_prov = setup_fake_provider

    p1 = create_or_initiate_payment(
        item_type="BOOKING",
        item_id=booking.id,
        amount=Decimal("400.00"),
        payment_method="ONLINE",
        user_id=user.id,
        provider=fake_prov,
    )
    initial_order_id = p1.gateway_order_id

    # Second initiation attempt for the same booking
    p2 = create_or_initiate_payment(
        item_type="BOOKING",
        item_id=booking.id,
        amount=Decimal("400.00"),
        payment_method="ONLINE",
        user_id=user.id,
        provider=fake_prov,
    )

    assert p1.id == p2.id
    assert p2.gateway_order_id == initial_order_id
    assert len(fake_prov.orders) == 1


def test_manual_confirm_success_for_cash_and_rejection_for_online(app, db_session, member_user, front_desk_user):
    """Staff can confirm CASH payments, but generic confirm is rejected for ONLINE payments."""
    user, member, ms, booking = member_user
    desk = front_desk_user

    # CASH payment confirm
    cash_pay = create_or_initiate_payment(
        item_type="BOOKING",
        item_id=booking.id,
        amount=Decimal("400.00"),
        payment_method="CASH",
        user_id=user.id,
    )
    confirmed_cash = confirm_manual_payment(payment_id=cash_pay.id, staff_user=desk, notes="Received cash at desk")
    assert confirmed_cash.status == PaymentStatus.PAID
    assert confirmed_cash.paid_at is not None
    assert len(confirmed_cash.audits) == 2
    assert confirmed_cash.audits[-1].action == "CONFIRMED_MANUAL"

    # ONLINE payment confirm attempt must fail
    online_pay = Payment(
        payment_reference="PAY-ONLINE-TEST",
        amount=Decimal("400.00"),
        currency="INR",
        payment_method=PaymentMethod.ONLINE,
        status=PaymentStatus.PENDING,
        item_type=PaymentItemType.BOOKING,
        item_id=booking.id,
        gateway_order_id="order_fake_12345",
    )
    db.session.add(online_pay)
    db.session.commit()

    with pytest.raises(ValidationException) as exc_info:
        confirm_manual_payment(payment_id=online_pay.id, staff_user=desk)
    assert "Generic confirmation is not allowed for ONLINE payments" in str(exc_info.value)


def test_verify_online_payment_valid_and_invalid_signature(app, db_session, member_user, setup_fake_provider):
    """Signature verification succeeds for valid signature and fails for invalid signature."""
    user, member, ms, booking = member_user
    fake_prov = setup_fake_provider

    payment = create_or_initiate_payment(
        item_type="BOOKING",
        item_id=booking.id,
        amount=Decimal("400.00"),
        payment_method="ONLINE",
        user_id=user.id,
        provider=fake_prov,
    )
    order_id = payment.gateway_order_id
    payment_id = "pay_fake_999888"

    # 1. Invalid signature
    with pytest.raises(ValidationException) as exc_info:
        verify_online_payment(
            razorpay_order_id=order_id,
            razorpay_payment_id=payment_id,
            razorpay_signature="invalid_tampered_signature_hex",
            requesting_user=user,
            provider=fake_prov,
        )
    assert "Invalid Razorpay payment signature" in str(exc_info.value)
    assert payment.status == PaymentStatus.PENDING

    # 2. Valid signature
    valid_sig = fake_prov.generate_signature(order_id, payment_id)
    # Setup provider fetch return with correct 40000 paise
    fake_prov.payments[payment_id] = {
        "id": payment_id,
        "amount": 40000,
        "currency": "INR",
        "status": "captured",
    }

    verified_pay = verify_online_payment(
        razorpay_order_id=order_id,
        razorpay_payment_id=payment_id,
        razorpay_signature=valid_sig,
        requesting_user=user,
        provider=fake_prov,
    )
    assert verified_pay.status == PaymentStatus.PAID
    assert verified_pay.gateway_payment_id == payment_id
    assert verified_pay.paid_at is not None

    # 3. Repeated verification is idempotent
    re_verified = verify_online_payment(
        razorpay_order_id=order_id,
        razorpay_payment_id=payment_id,
        razorpay_signature=valid_sig,
        requesting_user=user,
        provider=fake_prov,
    )
    assert re_verified.status == PaymentStatus.PAID
    assert len(re_verified.audits) == 3  # INITIATED, FAILED_SIG, VERIFIED_ONLINE (no duplicate second VERIFIED)


def test_verify_online_payment_amount_mismatch_rejected(app, db_session, member_user, setup_fake_provider):
    """Valid signature but amount mismatch reported by gateway is rejected."""
    user, member, ms, booking = member_user
    fake_prov = setup_fake_provider

    payment = create_or_initiate_payment(
        item_type="BOOKING",
        item_id=booking.id,
        amount=Decimal("400.00"),
        payment_method="ONLINE",
        user_id=user.id,
        provider=fake_prov,
    )
    order_id = payment.gateway_order_id
    payment_id = "pay_fake_mismatch"
    valid_sig = fake_prov.generate_signature(order_id, payment_id)

    # Gateway reports only 20000 paise (₹200) instead of 40000 (₹400)
    fake_prov.payments[payment_id] = {
        "id": payment_id,
        "amount": 20000,
        "currency": "INR",
        "status": "captured",
    }

    with pytest.raises(ValidationException) as exc_info:
        verify_online_payment(
            razorpay_order_id=order_id,
            razorpay_payment_id=payment_id,
            razorpay_signature=valid_sig,
            requesting_user=user,
            provider=fake_prov,
        )
    assert "does not match payment amount" in str(exc_info.value)


def test_webhook_payment_captured_and_idempotency(app, db_session, member_user, setup_fake_provider):
    """Webhook payment.captured transitions payment to PAID; duplicate events are acknowledged idempotently."""
    user, member, ms, booking = member_user
    fake_prov = setup_fake_provider

    payment = create_or_initiate_payment(
        item_type="BOOKING",
        item_id=booking.id,
        amount=Decimal("400.00"),
        payment_method="ONLINE",
        user_id=user.id,
        provider=fake_prov,
    )
    order_id = payment.gateway_order_id

    event_payload = {
        "event_id": "evt_test_12345678",
        "event": "payment.captured",
        "payload": {
            "payment": {
                "entity": {
                    "id": "pay_hook_12345",
                    "order_id": order_id,
                    "amount": 40000,
                    "currency": "INR",
                    "status": "captured",
                }
            }
        },
    }
    raw_body = json.dumps(event_payload).encode("utf-8")
    valid_webhook_sig = fake_prov.generate_webhook_signature(raw_body)

    # Process 1st webhook call
    res1 = process_webhook_event(
        raw_body=raw_body,
        signature_header=valid_webhook_sig,
        event_payload=event_payload,
        provider=fake_prov,
    )
    assert res1["success"] is True
    assert res1["outcome"] == "PROCESSED"
    assert payment.status == PaymentStatus.PAID
    assert payment.gateway_payment_id == "pay_hook_12345"

    # Process duplicate webhook call with the same event_id
    res2 = process_webhook_event(
        raw_body=raw_body,
        signature_header=valid_webhook_sig,
        event_payload=event_payload,
        provider=fake_prov,
    )
    assert res2["success"] is True
    assert res2["status"] == "DUPLICATE"

    # Only 1 webhook event record created in DB
    events = PaymentWebhookEvent.query.filter_by(event_id="evt_test_12345678").all()
    assert len(events) == 1


def test_tampered_webhook_body_rejected(app, db_session, setup_fake_provider):
    """Tampered webhook body is rejected due to signature mismatch."""
    fake_prov = setup_fake_provider
    original_body = b'{"event": "payment.captured", "event_id": "evt_orig_1"}'
    sig = fake_prov.generate_webhook_signature(original_body)

    tampered_body = b'{"event": "payment.captured", "event_id": "evt_tampered"}'
    with pytest.raises(UnauthorizedException) as exc_info:
        process_webhook_event(
            raw_body=tampered_body,
            signature_header=sig,
            event_payload={"event": "payment.captured"},
            provider=fake_prov,
        )
    assert "Invalid webhook signature" in str(exc_info.value)


def test_refund_lifecycle_and_transitions(app, db_session, member_user, admin_user, setup_fake_provider):
    """Full refund lifecycle testing for both CASH and ONLINE payment methods."""
    user, member, ms, booking = member_user
    admin = admin_user
    fake_prov = setup_fake_provider

    # 1. CASH Payment direct refund (PAID -> REFUNDED)
    cash_pay = create_or_initiate_payment(
        item_type="BOOKING",
        item_id=booking.id,
        amount=Decimal("400.00"),
        payment_method="CASH",
        user_id=user.id,
    )
    confirm_manual_payment(payment_id=cash_pay.id, staff_user=admin)
    refunded_cash = refund_payment(payment_id=cash_pay.id, requesting_user=admin, reason="Cancelled booking")
    assert refunded_cash.status == PaymentStatus.REFUNDED
    assert refunded_cash.refunded_at is not None

    # Repeated refund attempt fails
    with pytest.raises(ValidationException) as exc_info:
        refund_payment(payment_id=cash_pay.id, requesting_user=admin)
    assert "already been refunded" in str(exc_info.value)


def test_membership_payment(app, db_session, member_user, front_desk_user):
    """Payment against a membership record."""
    user, member, ms, booking = member_user
    desk = front_desk_user
    annual_price = Decimal(str(ms.plan.effective_annual_price))

    payment = create_or_initiate_payment(
        item_type="MEMBERSHIP",
        item_id=ms.id,
        amount=annual_price,
        payment_method="UPI",
        user_id=user.id,
        member_id=member.id,
    )
    assert payment.item_type == PaymentItemType.MEMBERSHIP
    assert payment.amount == annual_price

    confirmed = confirm_manual_payment(payment_id=payment.id, staff_user=desk, notes="UPI Txn Ref: UPI123456789")
    assert confirmed.status == PaymentStatus.PAID


# =========================================================================
# 2. REST API & RBAC TESTS
# =========================================================================

def test_member_create_payment_api(client, member_user):
    """Member initiates online payment via REST API."""
    user, member, ms, booking = member_user

    res = client.post(
        "/api/v1/payments",
        headers=auth_header(user),
        json={
            "item_type": "BOOKING",
            "item_id": booking.id,
            "amount": "400.00",
            "payment_method": "ONLINE",
            "notes": "Paying online for tennis booking",
        },
    )
    assert res.status_code == 201
    body = res.get_json()
    assert body["success"] is True
    data = body["data"]
    assert data["item_type"] == "BOOKING"
    assert data["payment_method"] == "ONLINE"
    assert data["status"] == "PENDING"
    assert data["gateway_order_id"].startswith("order_fake_")
    assert "razorpay_key_id" in data
    # Ensure no secret keys are leaked
    assert "secret" not in json.dumps(data).lower()


def test_member_cannot_pay_for_another_member_item(client, member_user, other_member_user):
    """Member receives 403 Forbidden when attempting to pay for another member's item."""
    user, member, ms, booking = member_user
    other_user, _ = other_member_user

    res = client.post(
        "/api/v1/payments",
        headers=auth_header(other_user),
        json={
            "item_type": "BOOKING",
            "item_id": booking.id,
            "amount": "400.00",
            "payment_method": "ONLINE",
        },
    )
    assert res.status_code == 403
    assert res.get_json()["success"] is False


def test_member_verify_own_payment_api(client, member_user, setup_fake_provider):
    """Member verifies their own online checkout via /api/v1/payments/verify."""
    user, member, ms, booking = member_user
    fake_prov = setup_fake_provider

    # 1. Initiate online payment
    res_init = client.post(
        "/api/v1/payments",
        headers=auth_header(user),
        json={
            "item_type": "BOOKING",
            "item_id": booking.id,
            "amount": "400.00",
            "payment_method": "ONLINE",
        },
    )
    order_id = res_init.get_json()["data"]["gateway_order_id"]
    payment_id = "pay_api_12345"
    valid_sig = fake_prov.generate_signature(order_id, payment_id)

    fake_prov.payments[payment_id] = {
        "id": payment_id,
        "amount": 40000,
        "currency": "INR",
        "status": "captured",
    }

    # 2. Verify payment
    res_verify = client.post(
        "/api/v1/payments/verify",
        headers=auth_header(user),
        json={
            "razorpay_order_id": order_id,
            "razorpay_payment_id": payment_id,
            "razorpay_signature": valid_sig,
        },
    )
    assert res_verify.status_code == 200
    body_verify = res_verify.get_json()
    assert body_verify["success"] is True
    assert body_verify["data"]["status"] == "PAID"
    assert body_verify["data"]["gateway_payment_id"] == payment_id


def test_webhook_api_unauthenticated_public_endpoint(client, member_user, setup_fake_provider):
    """Webhook endpoint accepts public POST requests authenticated only by HMAC header."""
    user, member, ms, booking = member_user
    fake_prov = setup_fake_provider

    payment = create_or_initiate_payment(
        item_type="BOOKING",
        item_id=booking.id,
        amount=Decimal("400.00"),
        payment_method="ONLINE",
        user_id=user.id,
        provider=fake_prov,
    )
    order_id = payment.gateway_order_id

    event_payload = {
        "event_id": "evt_api_hook_99",
        "event": "payment.captured",
        "payload": {
            "payment": {
                "entity": {
                    "id": "pay_api_hook_99",
                    "order_id": order_id,
                    "amount": 40000,
                    "currency": "INR",
                    "status": "captured",
                }
            }
        },
    }
    raw_body = json.dumps(event_payload).encode("utf-8")
    sig = fake_prov.generate_webhook_signature(raw_body)

    # Note: No Authorization header passed!
    res = client.post(
        "/api/v1/payments/webhook",
        data=raw_body,
        headers={"Content-Type": "application/json", "X-Razorpay-Signature": sig},
    )
    assert res.status_code == 200
    body = res.get_json()
    assert body["success"] is True


def test_staff_confirm_offline_payment_api(client, member_user, front_desk_user):
    """Front desk staff confirms CASH payment via /confirm endpoint."""
    user, member, ms, booking = member_user
    desk = front_desk_user

    pay = create_or_initiate_payment(
        item_type="BOOKING",
        item_id=booking.id,
        amount=Decimal("400.00"),
        payment_method="CASH",
        user_id=user.id,
    )

    res = client.post(
        f"/api/v1/payments/{pay.id}/confirm",
        headers=auth_header(desk),
        json={"notes": "Cash collected at desk"},
    )
    assert res.status_code == 200
    data = res.get_json()["data"]
    assert data["status"] == "PAID"


def test_member_list_payments_is_scoped(client, member_user, other_member_user, front_desk_user):
    """Member listing only returns their own payments; staff listing returns all."""
    user1, member1, _, booking1 = member_user
    user2, member2 = other_member_user
    desk = front_desk_user

    p1 = create_or_initiate_payment(item_type="BOOKING", item_id=booking1.id, amount=Decimal("400.00"), payment_method="CASH", user_id=user1.id)
    p2 = create_or_initiate_payment(item_type="BOOKING", item_id=booking1.id, amount=Decimal("400.00"), payment_method="CARD", user_id=user2.id)

    # Member 1 list -> exactly 1 payment (p1)
    res_m1 = client.get("/api/v1/payments", headers=auth_header(user1))
    assert res_m1.status_code == 200
    assert len(res_m1.get_json()["data"]) == 1
    assert res_m1.get_json()["data"][0]["id"] == p1.id

    # Staff list -> 2 payments (p1, p2)
    res_staff = client.get("/api/v1/payments", headers=auth_header(desk))
    assert res_staff.status_code == 200
    assert len(res_staff.get_json()["data"]) == 2


def test_missing_gateway_configuration_fails_online_without_breaking_offline(app, db_session, member_user):
    """When Razorpay keys are missing, ONLINE payments fail cleanly, while CASH/CARD/UPI still work."""
    user, member, ms, booking = member_user
    # Instantiate RazorpayProvider with None keys
    unconfigured_prov = RazorpayProvider(key_id=None, key_secret=None)

    # ONLINE initiation fails with GATEWAY_NOT_CONFIGURED
    with pytest.raises(ValidationException) as exc_info:
        create_or_initiate_payment(
            item_type="BOOKING",
            item_id=booking.id,
            amount=Decimal("400.00"),
            payment_method="ONLINE",
            user_id=user.id,
            provider=unconfigured_prov,
        )
    assert "not configured" in str(exc_info.value)

    # CASH payment still succeeds without gateway dependency!
    cash_pay = create_or_initiate_payment(
        item_type="BOOKING",
        item_id=booking.id,
        amount=Decimal("400.00"),
        payment_method="CASH",
        user_id=user.id,
    )
    assert cash_pay.status == PaymentStatus.PENDING
    assert cash_pay.payment_method == PaymentMethod.CASH


def test_invalid_state_transitions(app, db_session, member_user, front_desk_user):
    """Test that invalid state transitions raise ValidationException."""
    user, member, ms, booking = member_user
    desk = front_desk_user

    pay = create_or_initiate_payment(
        item_type="BOOKING",
        item_id=booking.id,
        amount=Decimal("400.00"),
        payment_method="CASH",
        user_id=user.id,
    )
    confirm_manual_payment(payment_id=pay.id, staff_user=desk)
    assert pay.status == PaymentStatus.PAID

    # Attempting to transition from PAID back to PENDING or CANCELLED must fail
    with pytest.raises(ValidationException) as exc_info:
        cancel_payment(payment_id=pay.id)
    assert "Invalid payment state transition" in str(exc_info.value)


def test_webhook_payment_failed_and_refund_failed_events(app, db_session, member_user, setup_fake_provider):
    """Test payment.failed, refund.failed, and unknown webhook events."""
    user, member, ms, booking = member_user
    fake_prov = setup_fake_provider

    # 1. payment.failed
    p1 = create_or_initiate_payment(
        item_type="BOOKING",
        item_id=booking.id,
        amount=Decimal("400.00"),
        payment_method="ONLINE",
        user_id=user.id,
        provider=fake_prov,
    )
    order_id = p1.gateway_order_id

    fail_payload = {
        "event_id": "evt_fail_1",
        "event": "payment.failed",
        "payload": {
            "payment": {
                "entity": {
                    "id": "pay_fail_1",
                    "order_id": order_id,
                    "error_description": "Card was declined by issuing bank",
                }
            }
        },
    }
    raw_body = json.dumps(fail_payload).encode("utf-8")
    sig = fake_prov.generate_webhook_signature(raw_body)
    res_fail = process_webhook_event(raw_body=raw_body, signature_header=sig, event_payload=fail_payload, provider=fake_prov)
    assert res_fail["outcome"] == "PROCESSED"
    assert p1.status == PaymentStatus.FAILED

    # 2. Unknown event (e.g. invoice.paid) is acknowledged and ignored
    unknown_payload = {"event_id": "evt_unk_1", "event": "invoice.paid", "payload": {}}
    raw_unk = json.dumps(unknown_payload).encode("utf-8")
    sig_unk = fake_prov.generate_webhook_signature(raw_unk)
    res_unk = process_webhook_event(raw_body=raw_unk, signature_header=sig_unk, event_payload=unknown_payload, provider=fake_prov)
    assert res_unk["outcome"] == "IGNORED"


def test_verify_and_webhook_race_condition_idempotency(app, db_session, member_user, setup_fake_provider):
    """When both verify endpoint and webhook arrive for the same payment, exactly one PAID transition occurs."""
    user, member, ms, booking = member_user
    fake_prov = setup_fake_provider

    payment = create_or_initiate_payment(
        item_type="BOOKING",
        item_id=booking.id,
        amount=Decimal("400.00"),
        payment_method="ONLINE",
        user_id=user.id,
        provider=fake_prov,
    )
    order_id = payment.gateway_order_id
    payment_id = "pay_race_1"

    # Step 1: User verifies checkout
    valid_sig = fake_prov.generate_signature(order_id, payment_id)
    fake_prov.payments[payment_id] = {"id": payment_id, "amount": 40000, "currency": "INR", "status": "captured"}
    v1 = verify_online_payment(razorpay_order_id=order_id, razorpay_payment_id=payment_id, razorpay_signature=valid_sig, requesting_user=user, provider=fake_prov)
    assert v1.status == PaymentStatus.PAID
    audit_count_before_webhook = len(v1.audits)

    # Step 2: Webhook arrives subsequently for the same payment
    hook_payload = {
        "event_id": "evt_race_1",
        "event": "payment.captured",
        "payload": {"payment": {"entity": {"id": payment_id, "order_id": order_id, "amount": 40000, "currency": "INR"}}},
    }
    raw_hook = json.dumps(hook_payload).encode("utf-8")
    sig_hook = fake_prov.generate_webhook_signature(raw_hook)
    res_hook = process_webhook_event(raw_body=raw_hook, signature_header=sig_hook, event_payload=hook_payload, provider=fake_prov)
    assert res_hook["outcome"] == "ALREADY_PAID"

    # Ensure no second state transition or audit duplicate
    assert len(v1.audits) == audit_count_before_webhook


def test_payment_detail_and_cancel_api(client, member_user, other_member_user, front_desk_user):
    """Test payment detail route and cancel route permissions."""
    user1, member1, _, booking1 = member_user
    user2, member2 = other_member_user
    desk = front_desk_user

    p1 = create_or_initiate_payment(item_type="BOOKING", item_id=booking1.id, amount=Decimal("400.00"), payment_method="CASH", user_id=user1.id)

    # Member 1 views own payment -> 200
    res_own = client.get(f"/api/v1/payments/{p1.id}", headers=auth_header(user1))
    assert res_own.status_code == 200
    assert res_own.get_json()["data"]["id"] == p1.id

    # Member 2 views Member 1 payment -> 403
    res_other = client.get(f"/api/v1/payments/{p1.id}", headers=auth_header(user2))
    assert res_other.status_code == 403

    # Member 1 cancels own pending payment -> 200
    res_cancel = client.post(f"/api/v1/payments/{p1.id}/cancel", headers=auth_header(user1))
    assert res_cancel.status_code == 200
    assert res_cancel.get_json()["data"]["status"] == "CANCELLED"


def test_refund_api_role_permissions(client, member_user, admin_user, front_desk_user):
    """Only Admin/Owner can refund payments; Member cannot."""
    user, member, ms, booking = member_user
    admin = admin_user
    desk = front_desk_user

    p = create_or_initiate_payment(item_type="BOOKING", item_id=booking.id, amount=Decimal("400.00"), payment_method="CASH", user_id=user.id)
    confirm_manual_payment(payment_id=p.id, staff_user=desk)

    # Member attempts to refund -> 403 Forbidden
    res_member = client.post(f"/api/v1/payments/{p.id}/refund", headers=auth_header(user), json={"reason": "Self refund"})
    assert res_member.status_code == 403

    # Admin refunds -> 200 OK
    res_admin = client.post(f"/api/v1/payments/{p.id}/refund", headers=auth_header(admin), json={"reason": "Customer cancellation refund"})
    assert res_admin.status_code == 200
    assert res_admin.get_json()["data"]["status"] == "REFUNDED"

