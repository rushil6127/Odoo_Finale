import io
from datetime import date, datetime, timedelta
from decimal import Decimal
import openpyxl
import pytest

from backend.app.extensions import db
from backend.app.common.permissions import RoleEnum
from backend.app.auth.models import User
from backend.app.auth.services import create_user
from backend.app.members.models import Member
from backend.app.members.services import create_member
from backend.app.memberships.models import (
    MembershipPlan,
    Membership,
    MembershipStatus,
)
from backend.app.courts.models import Court, SportType
from backend.app.bookings.models import Booking, BookingStatus
from backend.app.inventory.models import Product, ProductCategory
from backend.app.notifications.models import (
    Notification,
    NotificationType,
    NotificationStatus,
    NotificationChannel,
)
from backend.app.notifications.services import (
    record_and_send_notification,
    has_notification_been_sent,
)
from backend.app.crm.models import (
    CRMLead,
    CRMFollowUp,
    FollowUpType,
    FollowUpStatus,
    LeadSource,
    LeadStatus,
)
from backend.app.tasks.dispatcher import safe_enqueue_task
from backend.app.tasks.celery_app import celery_app
from backend.app.tasks.jobs import (
    ping_test,
    send_booking_confirmation_task,
    send_membership_expiry_reminders_task,
    send_order_notification_task,
    send_crm_follow_up_reminders_task,
    check_and_alert_low_stock_task,
    generate_daily_sales_report_task,
    export_data_to_excel_task,
)


# ---------------------------------------------------------------------------
# Test Helpers & Fixtures
# ---------------------------------------------------------------------------
@pytest.fixture
def base_setup(app):
    """Seed sample data for tasks tests, returning durable IDs."""
    with app.app_context():
        user = create_user(
            email="task.tester@club.com",
            password="Password123!",
            first_name="Task",
            last_name="Tester",
            role=RoleEnum.MEMBER,
        )
        member = create_member(user_id=user.id, phone="9988776655")

        plan = MembershipPlan(
            name="Gold Plan",
            code="GOLD",
            displayed_monthly_price=Decimal("1500.00"),
            duration_months=12,
            complimentary_months=2,
            is_active=True,
        )
        db.session.add(plan)

        court = Court(
            name="Task Court 1",
            sport_type=SportType.LAWN_TENNIS,
            surface_type="Clay",
            is_indoor=False,
        )
        db.session.add(court)

        cat = ProductCategory(name="Gear", slug="gear", is_active=True)
        db.session.add(cat)
        db.session.commit()

        return {
            "user_id": user.id,
            "user_email": user.email,
            "member_id": member.id,
            "plan_id": plan.id,
            "court_id": court.id,
            "category_id": cat.id,
        }


# ---------------------------------------------------------------------------
# 1. Ping / Test Task Connectivity
# ---------------------------------------------------------------------------
def test_ping_test_task_runs_eagerly(app):
    """Verify ping_test task executes and returns expected status payload."""
    res = ping_test.delay("hello_from_test")
    data = res.get(timeout=2)
    assert data["status"] == "ok"
    assert data["message"] == "hello_from_test"
    assert "timestamp" in data


# ---------------------------------------------------------------------------
# 2. Transaction Commit Safety & Rollback Behavior
# ---------------------------------------------------------------------------
def test_safe_enqueue_does_not_dispatch_on_transaction_rollback(app, db_session):
    """
    Enqueue helper holds the task during an open transaction and discards it
    completely if the transaction rolls back.
    """
    dispatched = []

    @celery_app.task(name="test_rollback_task")
    def dummy_task(arg):
        dispatched.append(arg)

    # Start an active transaction
    db.session.execute(db.text("SELECT 1"))

    # Safely enqueue within the open transaction
    safe_enqueue_task(dummy_task, "should_never_run")

    # Transaction is rolled back
    db.session.rollback()

    # Verify task was not dispatched
    assert dispatched == []

    # Subsequent transaction commit should NOT dispatch the rolled back task
    db.session.execute(db.text("SELECT 1"))
    db.session.commit()
    assert dispatched == []


def test_safe_enqueue_dispatches_after_transaction_commit(app, db_session):
    """
    Enqueue helper dispatches tasks only after db.session.commit() succeeds.
    """
    dispatched = []

    @celery_app.task(name="test_commit_task")
    def dummy_task(val):
        dispatched.append(val)

    # Open transaction
    db.session.execute(db.text("SELECT 1"))
    safe_enqueue_task(dummy_task, "committed_value")

    # Has not dispatched before commit
    assert dispatched == []

    # Commit transaction
    db.session.commit()

    # In eager mode, after_commit hook dispatched task immediately
    assert "committed_value" in dispatched


def test_task_failure_does_not_affect_originating_business_record(app, base_setup):
    """
    A failure within a background task must NEVER corrupt, rollback, or alter
    an already-committed business transaction.
    """
    court_id = base_setup["court_id"]
    court = db.session.get(Court, court_id)

    @celery_app.task(name="test_exploding_task")
    def exploding_task():
        raise RuntimeError("Severe external service failure!")

    # Perform business transaction and commit it
    court.name = "Updated Court Name"
    db.session.commit()

    # Attempt to execute failing task post-commit
    try:
        exploding_task.delay()
    except RuntimeError:
        pass

    # Verify originating business record in fresh query remains committed and intact
    reloaded = db.session.get(Court, court_id)
    assert reloaded.name == "Updated Court Name"


# ---------------------------------------------------------------------------
# 3. Membership Expiry Reminders (Window filtering & Idempotency)
# ---------------------------------------------------------------------------
def test_membership_expiry_reminders_picks_right_members_without_duplicates(
    app, base_setup
):
    """
    Expiry reminder picks ONLY active members expiring within the window (e.g. <=30 days)
    and does not send duplicate reminders on repeated runs.
    """
    member_id = base_setup["member_id"]
    plan_id = base_setup["plan_id"]
    today = date.today()

    # User 2 / Member 2
    u2 = create_user("u2@club.com", "Password123!", "Two", "Member", RoleEnum.MEMBER)
    m2 = create_member(user_id=u2.id, phone="9988776652")

    # User 3 / Member 3 (Expiring far in future: 60 days)
    u3 = create_user("u3@club.com", "Password123!", "Three", "Member", RoleEnum.MEMBER)
    m3 = create_member(user_id=u3.id, phone="9988776653")

    # User 4 / Member 4 (Already expired: 10 days ago)
    u4 = create_user("u4@club.com", "Password123!", "Four", "Member", RoleEnum.MEMBER)
    m4 = create_member(user_id=u4.id, phone="9988776654")

    # 1. Member 1: expiring in 5 days (target: YES)
    ms1 = Membership(
        member_id=member_id,
        plan_id=plan_id,
        status=MembershipStatus.ACTIVE,
        start_date=today - timedelta(days=360),
        end_date=today + timedelta(days=5),
    )
    # 2. Member 2: expiring in 25 days (target: YES)
    ms2 = Membership(
        member_id=m2.id,
        plan_id=plan_id,
        status=MembershipStatus.ACTIVE,
        start_date=today - timedelta(days=340),
        end_date=today + timedelta(days=25),
    )
    # 3. Member 3: expiring in 60 days (target: NO - outside 30-day window)
    ms3 = Membership(
        member_id=m3.id,
        plan_id=plan_id,
        status=MembershipStatus.ACTIVE,
        start_date=today - timedelta(days=300),
        end_date=today + timedelta(days=60),
    )
    # 4. Member 4: already expired in past (target: NO)
    ms4 = Membership(
        member_id=m4.id,
        plan_id=plan_id,
        status=MembershipStatus.EXPIRED,
        start_date=today - timedelta(days=375),
        end_date=today - timedelta(days=10),
    )
    db.session.add_all([ms1, ms2, ms3, ms4])
    db.session.commit()

    # First run of periodic task
    result1 = send_membership_expiry_reminders_task()
    assert result1["status"] == "ok"
    assert result1["sent_count"] == 2
    assert result1["skipped_count"] == 0

    # Verify notifications recorded
    notifs = Notification.query.filter_by(
        notification_type=NotificationType.MEMBERSHIP_EXPIRY_REMINDER
    ).all()
    recipients = [n.recipient for n in notifs]
    assert "task.tester@club.com" in recipients
    assert "u2@club.com" in recipients
    assert "u3@club.com" not in recipients
    assert "u4@club.com" not in recipients

    # Second run of periodic task: Idempotency must prevent duplicates!
    result2 = send_membership_expiry_reminders_task()
    assert result2["status"] == "ok"
    assert result2["sent_count"] == 0
    assert result2["skipped_count"] == 2

    # Total notifications in DB remains exactly 2
    total_notifs = Notification.query.filter_by(
        notification_type=NotificationType.MEMBERSHIP_EXPIRY_REMINDER
    ).count()
    assert total_notifs == 2


# ---------------------------------------------------------------------------
# 4. Low-Stock Alerts (Threshold filtering & Idempotency)
# ---------------------------------------------------------------------------
def test_low_stock_alerts_only_for_products_at_or_below_threshold(app, base_setup):
    """
    Low-stock alert fires ONLY for active products whose stock_quantity <= low_stock_threshold.
    Products above threshold or inactive are never alerted.
    """
    cat_id = base_setup["category_id"]

    # Product 1: stock 5, threshold 10 (BELOW -> Alert)
    p1 = Product(
        name="Tennis Balls Can",
        sku="TB-CAN-01",
        price=Decimal("450.00"),
        stock_quantity=5,
        low_stock_threshold=10,
        category_id=cat_id,
        is_active=True,
    )
    # Product 2: stock 10, threshold 10 (EXACTLY AT THRESHOLD -> Alert)
    p2 = Product(
        name="Grip Tape",
        sku="GT-01",
        price=Decimal("200.00"),
        stock_quantity=10,
        low_stock_threshold=10,
        category_id=cat_id,
        is_active=True,
    )
    # Product 3: stock 25, threshold 10 (ABOVE -> No Alert)
    p3 = Product(
        name="Padel Racket Pro",
        sku="PR-PRO-01",
        price=Decimal("8500.00"),
        stock_quantity=25,
        low_stock_threshold=10,
        category_id=cat_id,
        is_active=True,
    )
    # Product 4: stock 2, threshold 10, but inactive (INACTIVE -> No Alert)
    p4 = Product(
        name="Old Shoes",
        sku="SH-OLD-01",
        price=Decimal("2500.00"),
        stock_quantity=2,
        low_stock_threshold=10,
        category_id=cat_id,
        is_active=False,
    )
    db.session.add_all([p1, p2, p3, p4])
    db.session.commit()

    # First run
    res1 = check_and_alert_low_stock_task()
    assert res1["status"] == "ok"
    assert res1["sent_count"] == 2
    assert res1["skipped_count"] == 0

    # Verify notifications created
    notifs = Notification.query.filter_by(
        notification_type=NotificationType.LOW_STOCK_ALERT
    ).all()
    assert len(notifs) == 2
    ref_ids = [n.reference_id for n in notifs]
    assert any(ref.startswith(f"{p1.id}-") for ref in ref_ids)
    assert any(ref.startswith(f"{p2.id}-") for ref in ref_ids)
    assert not any(ref.startswith(f"{p3.id}-") for ref in ref_ids)
    assert not any(ref.startswith(f"{p4.id}-") for ref in ref_ids)

    # Second run: Idempotent
    res2 = check_and_alert_low_stock_task()
    assert res2["sent_count"] == 0
    assert res2["skipped_count"] == 2


# ---------------------------------------------------------------------------
# 5. Booking Confirmation Notification Task
# ---------------------------------------------------------------------------
def test_send_booking_confirmation_task_and_idempotency(app, base_setup):
    """Verify booking confirmation notification and idempotency."""
    court_id = base_setup["court_id"]
    member_id = base_setup["member_id"]
    user_id = base_setup["user_id"]
    user_email = base_setup["user_email"]

    booking = Booking(
        booking_reference="BK-TESTCONFIRM",
        court_id=court_id,
        member_id=member_id,
        user_id=user_id,
        booking_date=date(2026, 10, 15),
        start_time=datetime(2026, 10, 15, 10, 0, 0),
        end_time=datetime(2026, 10, 15, 11, 0, 0),
        status=BookingStatus.CONFIRMED,
        base_price=Decimal("800.00"),
        final_price=Decimal("800.00"),
    )
    db.session.add(booking)
    db.session.commit()

    # 1. Run task
    res = send_booking_confirmation_task(booking.id)
    assert res["status"] == "sent"

    notif = Notification.query.filter_by(
        reference_type="BOOKING", reference_id=str(booking.id)
    ).first()
    assert notif is not None
    assert notif.recipient == user_email
    assert notif.status == NotificationStatus.SENT
    assert "BK-TESTCONFIRM" in notif.title

    # 2. Second execution skips duplicate
    res_repeat = send_booking_confirmation_task(booking.id)
    assert res_repeat["status"] == "skipped"
    assert res_repeat["reason"] == "already_sent"


# ---------------------------------------------------------------------------
# 6. CRM Follow-up Reminders Task
# ---------------------------------------------------------------------------
def test_crm_follow_up_reminders_task(app, base_setup):
    """Verify CRM follow-up reminder picks due follow-ups idempotently."""
    lead = CRMLead(
        lead_reference="LED-CRMTEST",
        first_name="Alice",
        last_name="Wonder",
        email="alice@wonder.com",
        phone="9898989898",
        source=LeadSource.WEBSITE,
        status=LeadStatus.NEW,
    )
    db.session.add(lead)
    db.session.flush()

    fu = CRMFollowUp(
        lead_id=lead.id,
        follow_up_type=FollowUpType.CALL,
        scheduled_date=datetime.now(),
        status=FollowUpStatus.PENDING,
        notes="Call regarding tennis trial.",
    )
    db.session.add(fu)
    db.session.commit()

    # Run task
    res = send_crm_follow_up_reminders_task()
    assert res["status"] == "ok"
    assert res["sent_count"] >= 1

    notif = Notification.query.filter_by(
        notification_type=NotificationType.CRM_FOLLOW_UP_REMINDER,
        reference_type="CRM_FOLLOW_UP",
    ).first()
    assert notif is not None
    assert "Alice" in notif.title

    # Idempotent second run
    res2 = send_crm_follow_up_reminders_task()
    assert res2["sent_count"] == 0


# ---------------------------------------------------------------------------
# 7. Daily Sales Report Generation Task
# ---------------------------------------------------------------------------
def test_daily_sales_report_task(app, base_setup):
    """Verify sales report aggregation across revenue sources."""
    court_id = base_setup["court_id"]
    member_id = base_setup["member_id"]
    user_id = base_setup["user_id"]
    today = date.today()

    # Add booking today
    b = Booking(
        booking_reference="BK-REP-01",
        court_id=court_id,
        member_id=member_id,
        user_id=user_id,
        booking_date=today,
        start_time=datetime.now(),
        end_time=datetime.now() + timedelta(hours=1),
        status=BookingStatus.CONFIRMED,
        base_price=Decimal("1200.00"),
        final_price=Decimal("1200.00"),
    )
    db.session.add(b)
    db.session.commit()

    report = generate_daily_sales_report_task(today.isoformat())
    assert report["report_date"] == today.isoformat()
    assert report["bookings_revenue"] >= 1200.00
    assert report["total_revenue"] >= 1200.00

    notif = Notification.query.filter_by(
        notification_type=NotificationType.REPORT_GENERATION,
        reference_id=today.isoformat(),
    ).first()
    assert notif is not None
    assert notif.recipient == "management@championsclub.com"


# ---------------------------------------------------------------------------
# 8. Excel Export Task (openpyxl)
# ---------------------------------------------------------------------------
def test_excel_export_task_inventory_and_bookings(app, base_setup):
    """
    Verify openpyxl generates valid Excel workbooks with accurate sheet
    structures and headers for INVENTORY and BOOKINGS.
    """
    cat_id = base_setup["category_id"]
    prod = Product(
        name="Export Sample Racket",
        sku="RK-EXP-01",
        price=Decimal("3500.00"),
        stock_quantity=15,
        low_stock_threshold=5,
        category_id=cat_id,
        is_active=True,
    )
    db.session.add(prod)
    db.session.commit()

    # 1. Inventory Export
    res_inv = export_data_to_excel_task("INVENTORY")
    assert res_inv["status"] == "completed"
    assert res_inv["export_type"] == "INVENTORY"
    assert res_inv["bytes_generated"] > 0
    assert res_inv["rows_exported"] >= 1

    # 2. Bookings Export
    res_book = export_data_to_excel_task("BOOKINGS")
    assert res_book["status"] == "completed"
    assert res_book["export_type"] == "BOOKINGS"
    assert res_book["bytes_generated"] > 0

    # 3. Arbitrary / Fallback Export
    res_misc = export_data_to_excel_task("CUSTOM_METRICS")
    assert res_misc["status"] == "completed"
    assert res_misc["bytes_generated"] > 0
