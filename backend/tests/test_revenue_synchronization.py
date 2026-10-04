"""
Comprehensive Revenue Synchronization and Single Source of Truth Test Suite.
=============================================================================
Validates:
1. ONE canonical backend revenue calculation (`calculate_reconciled_revenue`).
2. Revenue sources included:
   - Court / booking payments (PaymentItemType.BOOKING)
   - Membership subscription payments (PaymentItemType.MEMBERSHIP)
   - Pro Shop merchandise orders (PaymentItemType.SHOP_ORDER)
   - POS / Bar / Cafeteria orders (PaymentItemType.POS_ORDER)
   - Corporate Invoices (PaymentItemType.INVOICE)
3. Each valid completed transaction updates the grand total and stream breakdown.
4. Exclusions:
   - PENDING, FAILED, CANCELLED payments are strictly excluded.
   - REFUNDED payments reduce gross revenue.
5. Admin, Owner, Dashboard Overview, and Reports return the exact same synchronized total.
"""

import pytest
from datetime import date, datetime, timedelta, timezone
from decimal import Decimal

from backend.app.extensions import db
from backend.app.common.utils import utc_now
from backend.app.common.permissions import RoleEnum
from backend.app.auth.models import User
from backend.app.members.models import Member
from backend.app.payments.models import (
    Payment,
    PaymentMethod,
    PaymentStatus,
    PaymentItemType,
)
from backend.app.reports.services import (
    calculate_reconciled_revenue,
    get_dashboard_overview,
    get_court_revenue_report,
    get_shop_revenue_report,
    get_bar_revenue_report,
    get_membership_revenue_report,
)


@pytest.fixture
def auth_tokens(client, app, db_session):
    """Create test users for Owner, Admin, Member and return tokens."""
    def _create_user(email, role):
        u = User.query.filter_by(email=email).first()
        if not u:
            u = User(
                email=email,
                first_name=role.value.capitalize(),
                last_name="User",
                role=role,
                is_active=True,
            )
            u.set_password("TestPassword123!")
            db_session.add(u)
            db_session.commit()
        return u

    owner = _create_user("rev_owner@championsclub.in", RoleEnum.OWNER)
    admin = _create_user("rev_admin@championsclub.in", RoleEnum.ADMIN)
    member_user = _create_user("rev_member@championsclub.in", RoleEnum.MEMBER)

    tokens = {}
    for key, user in [
        ("owner", owner),
        ("admin", admin),
        ("member", member_user),
    ]:
        resp = client.post("/api/v1/auth/login", json={"email": user.email, "password": "TestPassword123!"})
        assert resp.status_code == 200, f"Login failed for {user.email}"
        token = resp.get_json()["data"]["access_token"]
        tokens[key] = {"Authorization": f"Bearer {token}"}
        tokens[f"{key}_user"] = user

    return tokens


class TestCanonicalRevenueEngine:
    """Test the single canonical backend revenue aggregator and all revenue streams."""

    def test_empty_revenue_baseline(self, app, db_session):
        """Clean baseline returns 0.0 with balanced financial metrics."""
        with app.app_context():
            # Query with a future date range where no payments exist
            future_start = datetime(2099, 1, 1, tzinfo=timezone.utc)
            future_end = datetime(2099, 1, 31, tzinfo=timezone.utc)

            rev = calculate_reconciled_revenue(start_utc=future_start, end_utc=future_end)
            assert rev["gross_revenue"] == 0.0
            assert rev["net_revenue"] == 0.0
            assert rev["tax_amount"] == 0.0
            assert rev["paid_amount"] == 0.0
            assert rev["refunded_amount"] == 0.0
            assert rev["transactions_count"] == 0

    def test_multi_source_revenue_accumulation(self, app, db_session):
        """Verify adding 1 transaction from each of the 5 revenue sources increases grand total."""
        with app.app_context():
            start_utc = utc_now() - timedelta(minutes=1)
            now = utc_now()

            # 1. Court Booking Payment: ₹1,500 via UPI
            p_court = Payment(
                payment_reference="PAY-REV-COURT-01",
                amount=Decimal("1500.00"),
                currency="INR",
                payment_method=PaymentMethod.UPI,
                status=PaymentStatus.PAID,
                item_type=PaymentItemType.BOOKING,
                item_id=101,
                paid_at=now,
            )

            # 2. Membership Subscription Payment: ₹25,000 via ONLINE
            p_member = Payment(
                payment_reference="PAY-REV-MEM-01",
                amount=Decimal("25000.00"),
                currency="INR",
                payment_method=PaymentMethod.ONLINE,
                status=PaymentStatus.PAID,
                item_type=PaymentItemType.MEMBERSHIP,
                item_id=201,
                paid_at=now,
            )

            # 3. Pro Shop Merchandise Order: ₹3,500 via CARD
            p_shop = Payment(
                payment_reference="PAY-REV-SHOP-01",
                amount=Decimal("3500.00"),
                currency="INR",
                payment_method=PaymentMethod.CARD,
                status=PaymentStatus.PAID,
                item_type=PaymentItemType.SHOP_ORDER,
                item_id=301,
                paid_at=now,
            )

            # 4. POS / Bar Cafeteria Tab: ₹1,200 via CASH
            p_pos = Payment(
                payment_reference="PAY-REV-BAR-01",
                amount=Decimal("1200.00"),
                currency="INR",
                payment_method=PaymentMethod.CASH,
                status=PaymentStatus.PAID,
                item_type=PaymentItemType.POS_ORDER,
                item_id=401,
                paid_at=now,
            )

            # 5. Corporate Invoice Payment: ₹10,000 via UPI
            p_invoice = Payment(
                payment_reference="PAY-REV-INV-01",
                amount=Decimal("10000.00"),
                currency="INR",
                payment_method=PaymentMethod.UPI,
                status=PaymentStatus.PAID,
                item_type=PaymentItemType.INVOICE,
                item_id=501,
                paid_at=now,
            )

            db_session.add_all([p_court, p_member, p_shop, p_pos, p_invoice])
            db_session.commit()

            end_utc = utc_now() + timedelta(minutes=1)

            # Calculate canonical revenue for this batch
            rev = calculate_reconciled_revenue(start_utc=start_utc, end_utc=end_utc)

            expected_total = 1500.0 + 25000.0 + 3500.0 + 1200.0 + 10000.0  # = 41200.0
            assert rev["gross_revenue"] == expected_total
            assert rev["transactions_count"] == 5

            # Verify individual stream breakdown exactly sums to grand total
            by_stream = rev["by_stream"]
            assert by_stream["courts"]["gross_revenue"] == 1500.0
            assert by_stream["memberships"]["gross_revenue"] == 25000.0
            assert by_stream["shop"]["gross_revenue"] == 3500.0
            assert by_stream["bar"]["gross_revenue"] == 1200.0
            assert by_stream["invoices"]["gross_revenue"] == 10000.0

            stream_sum = (
                by_stream["courts"]["gross_revenue"]
                + by_stream["memberships"]["gross_revenue"]
                + by_stream["shop"]["gross_revenue"]
                + by_stream["bar"]["gross_revenue"]
                + by_stream["invoices"]["gross_revenue"]
            )
            assert stream_sum == rev["gross_revenue"]

            # Verify payment method breakdown sums to grand total
            by_method = rev["by_payment_method"]
            assert by_method["UPI"]["gross_revenue"] == 11500.0  # 1500 + 10000
            assert by_method["CARD"]["gross_revenue"] == 3500.0
            assert by_method["ONLINE"]["gross_revenue"] == 25000.0
            assert by_method["CASH"]["gross_revenue"] == 1200.0

            method_sum = sum(m["gross_revenue"] for m in by_method.values())
            assert method_sum == rev["gross_revenue"]

    def test_unpaid_cancelled_failed_payments_strictly_excluded(self, app, db_session):
        """Pending, failed, and cancelled payments must not count towards revenue."""
        with app.app_context():
            start_utc = utc_now() - timedelta(minutes=1)
            now = utc_now()

            # 1. PENDING payment (initiated but not paid)
            p_pending = Payment(
                payment_reference="PAY-REV-PEND-01",
                amount=Decimal("5000.00"),
                currency="INR",
                payment_method=PaymentMethod.UPI,
                status=PaymentStatus.PENDING,
                item_type=PaymentItemType.BOOKING,
                item_id=801,
                paid_at=None,
            )

            # 2. FAILED payment
            p_failed = Payment(
                payment_reference="PAY-REV-FAIL-01",
                amount=Decimal("8000.00"),
                currency="INR",
                payment_method=PaymentMethod.CARD,
                status=PaymentStatus.FAILED,
                item_type=PaymentItemType.SHOP_ORDER,
                item_id=802,
                paid_at=None,
            )

            # 3. CANCELLED payment
            p_cancelled = Payment(
                payment_reference="PAY-REV-CANC-01",
                amount=Decimal("15000.00"),
                currency="INR",
                payment_method=PaymentMethod.CASH,
                status=PaymentStatus.CANCELLED,
                item_type=PaymentItemType.MEMBERSHIP,
                item_id=803,
                paid_at=None,
            )

            db_session.add_all([p_pending, p_failed, p_cancelled])
            db_session.commit()

            end_utc = utc_now() + timedelta(minutes=1)

            rev = calculate_reconciled_revenue(start_utc=start_utc, end_utc=end_utc)
            assert rev["gross_revenue"] == 0.0
            assert rev["transactions_count"] == 0

    def test_refunded_payments_decrease_revenue(self, app, db_session):
        """Refunding a paid transaction reduces gross revenue by the refunded amount."""
        with app.app_context():
            start_utc = utc_now() - timedelta(minutes=1)
            now = utc_now()

            # 1. Paid payment: ₹4,000
            p_paid = Payment(
                payment_reference="PAY-REV-PAID-01",
                amount=Decimal("4000.00"),
                currency="INR",
                payment_method=PaymentMethod.UPI,
                status=PaymentStatus.PAID,
                item_type=PaymentItemType.BOOKING,
                item_id=901,
                paid_at=now,
            )

            # 2. Refunded payment: ₹2,500
            p_refund = Payment(
                payment_reference="PAY-REV-REF-01",
                amount=Decimal("2500.00"),
                currency="INR",
                payment_method=PaymentMethod.CARD,
                status=PaymentStatus.REFUNDED,
                item_type=PaymentItemType.SHOP_ORDER,
                item_id=902,
                paid_at=now,
                refunded_at=now,
            )

            db_session.add_all([p_paid, p_refund])
            db_session.commit()

            end_utc = utc_now() + timedelta(minutes=1)
            rev = calculate_reconciled_revenue(start_utc=start_utc, end_utc=end_utc)

            assert rev["gross_revenue"] == 1500.0  # 4000 - 2500
            assert rev["paid_amount"] == 4000.0
            assert rev["refunded_amount"] == 2500.0
            assert rev["refunds_count"] == 1


class TestEndpointRevenueSynchronization:
    """Validate that Admin, Owner, Overview, and Reports endpoints return identical revenue values."""

    def test_overview_and_revenue_endpoints_return_same_total(self, client, auth_tokens):
        """Verify /reports/overview and /reports/revenue return identical gross_revenue."""
        owner_hdr = auth_tokens["owner"]

        res_overview = client.get("/api/v1/reports/overview?period=today", headers=owner_hdr)
        assert res_overview.status_code == 200
        overview_data = res_overview.get_json()["data"]

        res_revenue = client.get("/api/v1/reports/revenue?period=today", headers=owner_hdr)
        assert res_revenue.status_code == 200
        revenue_data = res_revenue.get_json()["data"]

        overview_gross = overview_data["financial_summary"]["gross_revenue"]
        revenue_gross = revenue_data["gross_revenue"]
        assert overview_gross == revenue_gross

        # Top-level executive KPIs in overview must match
        assert overview_data["executive_kpis"]["total_revenue"] == overview_gross
        assert overview_data["total_revenue"] == overview_gross

    def test_admin_and_owner_receive_identical_revenue_overview(self, client, auth_tokens):
        """Admin and Owner consoles receive the exact same revenue values from canonical reports."""
        owner_hdr = auth_tokens["owner"]
        admin_hdr = auth_tokens["admin"]

        owner_res = client.get("/api/v1/reports/overview?period=today", headers=owner_hdr).get_json()["data"]
        admin_res = client.get("/api/v1/reports/overview?period=today", headers=admin_hdr).get_json()["data"]

        assert admin_res["financial_summary"]["gross_revenue"] == owner_res["financial_summary"]["gross_revenue"]
        assert admin_res["executive_kpis"]["total_revenue"] == owner_res["executive_kpis"]["total_revenue"]
        assert admin_res["stream_breakdown"] == owner_res["stream_breakdown"]

    def test_dedicated_stream_reports_match_overview_breakdown(self, client, auth_tokens):
        """Individual reports (/reports/courts, /reports/shop, /reports/bar, /reports/memberships) match overview breakdown."""
        owner_hdr = auth_tokens["owner"]

        overview_res = client.get("/api/v1/reports/overview?period=month", headers=owner_hdr).get_json()["data"]
        streams = overview_res["stream_breakdown"]

        # Courts
        courts_res = client.get("/api/v1/reports/courts?period=month", headers=owner_hdr).get_json()["data"]
        assert courts_res["financial_summary"]["gross_revenue"] == streams["courts"]["gross_revenue"]

        # Shop
        shop_res = client.get("/api/v1/reports/shop?period=month", headers=owner_hdr).get_json()["data"]
        assert shop_res["financial_summary"]["gross_revenue"] == streams["shop"]["gross_revenue"]

        # Bar
        bar_res = client.get("/api/v1/reports/bar?period=month", headers=owner_hdr).get_json()["data"]
        assert bar_res["financial_summary"]["gross_revenue"] == streams["bar"]["gross_revenue"]

        # Memberships
        mem_res = client.get("/api/v1/reports/memberships?period=month", headers=owner_hdr).get_json()["data"]
        assert mem_res["financial_summary"]["gross_revenue"] == streams["memberships"]["gross_revenue"]
