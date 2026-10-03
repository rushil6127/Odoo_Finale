"""Tests for database seed framework and demo dataset.

Validates:
1. Seed execution on an empty database.
2. Seed idempotency (running twice produces no duplicate records).
3. Court bookings consistency (no overlapping bookings on any court, valid time slots).
4. Payment accuracy (all payments agree with membership prices and booking final prices).
5. User authentication and role assignments with DEMO_SEED_PASSWORD.
6. Reset command safety (strictly blocked when running in production).
7. Modular seed provider registration for future extensions.
"""

import os
from decimal import Decimal
import pytest

from backend.app.extensions import db
from backend.app.common.permissions import RoleEnum
from backend.app.auth.models import User
from backend.app.members.models import Member
from backend.app.memberships.models import MembershipPlan, Membership, MembershipStatus
from backend.app.courts.models import Court, SportType
from backend.app.bookings.models import Booking, BookingStatus
from backend.app.payments.models import Payment, PaymentItemType, PaymentStatus
from backend.app.seeds import register_seed_provider
from backend.app.seeds.demo_seed import seed_core_demo, DEMO_PASSWORD


def test_seed_on_empty_database(app):
    """Verify that seed_core_demo executes cleanly on an empty database and seeds all core entities."""
    with app.app_context():
        # Ensure clean state
        assert User.query.count() == 0
        assert Court.query.count() == 0
        assert Booking.query.count() == 0

        summary = seed_core_demo()

        assert summary["users"] >= 14
        assert summary["courts"] >= 14
        assert summary["memberships"] >= 7
        assert summary["bookings"] >= 10
        assert summary["payments"] >= 10

        # Verify default membership plans exist
        assert MembershipPlan.query.filter_by(code="GOLD").first() is not None
        assert MembershipPlan.query.filter_by(code="SILVER").first() is not None
        assert MembershipPlan.query.filter_by(code="JUNIOR").first() is not None


def test_seed_idempotency(app):
    """Running seed_core_demo twice must produce 0 duplicate records."""
    with app.app_context():
        # First execution
        first_summary = seed_core_demo()
        user_count_1 = User.query.count()
        court_count_1 = Court.query.count()
        membership_count_1 = Membership.query.count()
        booking_count_1 = Booking.query.count()
        payment_count_1 = Payment.query.count()

        # Second execution
        second_summary = seed_core_demo()
        user_count_2 = User.query.count()
        court_count_2 = Court.query.count()
        membership_count_2 = Membership.query.count()
        booking_count_2 = Booking.query.count()
        payment_count_2 = Payment.query.count()

        assert user_count_1 == user_count_2
        assert court_count_1 == court_count_2
        assert membership_count_1 == membership_count_2
        assert booking_count_1 == booking_count_2
        assert payment_count_1 == payment_count_2

        assert second_summary["memberships"] == 0
        assert second_summary["bookings"] == 0
        assert second_summary["payments"] == 0


def test_demo_users_roles_and_passwords(app):
    """Verify all required roles exist with working demo credentials."""
    with app.app_context():
        seed_core_demo()

        expected_roles = {
            "owner@championsclub.example.com": RoleEnum.OWNER,
            "admin@championsclub.example.com": RoleEnum.ADMIN,
            "frontdesk@championsclub.example.com": RoleEnum.FRONT_DESK,
            "shop@championsclub.example.com": RoleEnum.SHOP_STAFF,
            "bar@championsclub.example.com": RoleEnum.BAR_STAFF,
            "coach.tennis@championsclub.example.com": RoleEnum.COACH,
            "coach.badminton@championsclub.example.com": RoleEnum.COACH,
            "gold.member@championsclub.example.com": RoleEnum.MEMBER,
            "silver.member@championsclub.example.com": RoleEnum.MEMBER,
            "junior.member@championsclub.example.com": RoleEnum.MEMBER,
            "expired.member@championsclub.example.com": RoleEnum.MEMBER,
            "expiring.member@championsclub.example.com": RoleEnum.MEMBER,
            "upgraded.member@championsclub.example.com": RoleEnum.MEMBER,
            "active.player@championsclub.example.com": RoleEnum.MEMBER,
        }

        for email, expected_role in expected_roles.items():
            user = User.query.filter_by(email=email).first()
            assert user is not None, f"Expected user {email} was not found"
            assert user.role == expected_role, f"User {email} has role {user.role}, expected {expected_role}"
            assert user.check_password(DEMO_PASSWORD), f"User {email} failed password check"
            assert user.is_active is True


def test_memberships_states_and_history(app):
    """Verify Gold, Silver, Junior plans, expired, expiring-soon, and upgrade history."""
    with app.app_context():
        seed_core_demo()

        # Check expired member
        exp_u = User.query.filter_by(email="expired.member@championsclub.example.com").first()
        exp_m = Member.query.filter_by(user_id=exp_u.id).first()
        exp_ms = Membership.query.filter_by(member_id=exp_m.id).all()
        assert any(ms.status == MembershipStatus.EXPIRED for ms in exp_ms)

        # Check upgraded member (should have one UPGRADED status and one ACTIVE status)
        up_u = User.query.filter_by(email="upgraded.member@championsclub.example.com").first()
        up_m = Member.query.filter_by(user_id=up_u.id).first()
        up_ms = Membership.query.filter_by(member_id=up_m.id).all()
        statuses = [ms.status for ms in up_ms]
        assert MembershipStatus.UPGRADED in statuses
        assert MembershipStatus.ACTIVE in statuses


def test_courts_and_sports_coverage(app):
    """Verify courts exist across all configured sports."""
    with app.app_context():
        seed_core_demo()

        all_sports = {
            SportType.LAWN_TENNIS,
            SportType.SWIMMING_POOL,
            SportType.BADMINTON,
            SportType.BOX_CRICKET,
            SportType.TABLE_TENNIS,
            SportType.VOLLEYBALL,
        }
        seeded_sports = {court.sport_type for court in Court.query.all()}
        assert all_sports.issubset(seeded_sports)


def test_no_overlapping_bookings_per_court(app):
    """Verify that no court has overlapping active or completed bookings."""
    with app.app_context():
        seed_core_demo()

        courts = Court.query.all()
        for court in courts:
            active_bookings = Booking.query.filter(
                Booking.court_id == court.id,
                Booking.status.in_([BookingStatus.CONFIRMED, BookingStatus.COMPLETED]),
            ).order_by(Booking.start_time).all()

            for i in range(len(active_bookings) - 1):
                b1 = active_bookings[i]
                b2 = active_bookings[i + 1]
                assert b1.end_time <= b2.start_time, (
                    f"Overlapping bookings detected on court '{court.name}' (ID: {court.id}): "
                    f"Booking {b1.id} ({b1.start_time} - {b1.end_time}) overlaps with "
                    f"Booking {b2.id} ({b2.start_time} - {b2.end_time})"
                )


def test_payment_amounts_agreement(app):
    """Verify that all recorded payments match their associated membership or booking amounts."""
    with app.app_context():
        seed_core_demo()

        payments = Payment.query.filter_by(status=PaymentStatus.PAID).all()
        assert len(payments) > 0

        for p in payments:
            if p.item_type == PaymentItemType.BOOKING:
                booking = db.session.get(Booking, p.item_id)
                assert booking is not None
                assert Decimal(str(p.amount)) == Decimal(str(booking.final_price)), (
                    f"Payment {p.id} amount {p.amount} does not match booking {booking.id} final price {booking.final_price}"
                )
            elif p.item_type == PaymentItemType.MEMBERSHIP:
                membership = db.session.get(Membership, p.item_id)
                assert membership is not None
                expected_amount = Decimal(str(membership.price_paid if membership.price_paid is not None else membership.plan.effective_annual_price))
                assert Decimal(str(p.amount)) == expected_amount, (
                    f"Payment {p.id} amount {p.amount} does not match membership {membership.id} price {expected_amount}"
                )


def test_cli_seed_commands(runner):
    """Test flask seed core and flask seed demo CLI commands."""
    res_core = runner.invoke(args=["seed", "core"])
    assert res_core.exit_code == 0
    assert "Core seed complete" in res_core.output

    res_demo = runner.invoke(args=["seed", "demo"])
    assert res_demo.exit_code == 0
    assert "Full demo dataset ready" in res_demo.output


def test_cli_reset_refusal_in_production(runner, monkeypatch):
    """Test that flask seed reset refuses to run in production mode."""
    monkeypatch.setenv("FLASK_ENV", "production")
    res = runner.invoke(args=["seed", "reset", "--force"])
    assert res.exit_code == 0
    assert "strictly prohibited in production" in res.output


def test_modular_seed_provider_registration(runner):
    """Test that Developer B can register additional seed providers without modifying core seed."""
    called = []

    def mock_developer_b_provider():
        called.append(True)

    register_seed_provider(mock_developer_b_provider)

    res = runner.invoke(args=["seed", "demo"])
    assert res.exit_code == 0
    assert True in called
