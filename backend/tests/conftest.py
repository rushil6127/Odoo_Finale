import os
import sys
from datetime import date, timedelta
from decimal import Decimal
import pytest
from flask_jwt_extended import create_access_token

# Ensure repository root is in python path
repo_root = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
if repo_root not in sys.path:
    sys.path.insert(0, repo_root)

from backend.app import create_app
from backend.app.extensions import db as _db
from backend.app.common.permissions import RoleEnum
from backend.app.auth.models import User
from backend.app.members.models import Member
from backend.app.memberships.models import MembershipPlan
from backend.app.courts.models import Court, SportType, CourtStatus
from backend.app.inventory.models import ProductCategory, Product
from backend.app.pos.models import POSTable, TableStatus
from backend.tests.factories import (
    UserFactory,
    MemberFactory,
    CourtFactory,
    ProductFactory,
    TableFactory,
)


@pytest.fixture(scope="function")
def app():
    """Create application for testing with fresh in-memory database per test."""
    app_instance = create_app("testing")
    with app_instance.app_context():
        _db.create_all()
        yield app_instance
        _db.session.remove()
        _db.drop_all()


@pytest.fixture(scope="function")
def client(app):
    """Test client fixture."""
    return app.test_client()


@pytest.fixture(scope="function")
def runner(app):
    """CLI test runner fixture."""
    return app.test_cli_runner()


@pytest.fixture(scope="function")
def db_session(app):
    """Database session fixture for tests."""
    with app.app_context():
        yield _db.session
        _db.session.rollback()


# -------------------------------------------------------------------
# Auth Token Helper
# -------------------------------------------------------------------

def make_auth_headers(user: User) -> dict:
    """Generate valid JWT Authorization header dictionary for a given user."""
    role_val = user.role.value if hasattr(user.role, "value") else str(user.role)
    token = create_access_token(
        identity=str(user.id),
        additional_claims={"role": role_val, "email": user.email},
    )
    return {"Authorization": f"Bearer {token}"}


# -------------------------------------------------------------------
# User Fixtures per Role
# -------------------------------------------------------------------

@pytest.fixture
def owner_user(app, db_session):
    return UserFactory.create(
        email="owner@championsclub.com",
        first_name="Club",
        last_name="Owner",
        role=RoleEnum.OWNER,
    )


@pytest.fixture
def admin_user(app, db_session):
    return UserFactory.create(
        email="admin@championsclub.com",
        first_name="Club",
        last_name="Admin",
        role=RoleEnum.ADMIN,
    )


@pytest.fixture
def front_desk_user(app, db_session):
    return UserFactory.create(
        email="frontdesk@championsclub.com",
        first_name="Front",
        last_name="Desk",
        role=RoleEnum.FRONT_DESK,
    )


@pytest.fixture
def shop_staff_user(app, db_session):
    return UserFactory.create(
        email="shopstaff@championsclub.com",
        first_name="Shop",
        last_name="Staff",
        role=RoleEnum.SHOP_STAFF,
    )


@pytest.fixture
def bar_staff_user(app, db_session):
    return UserFactory.create(
        email="barstaff@championsclub.com",
        first_name="Bar",
        last_name="Staff",
        role=RoleEnum.BAR_STAFF,
    )


@pytest.fixture
def coach_user(app, db_session):
    return UserFactory.create(
        email="coach@championsclub.com",
        first_name="Head",
        last_name="Coach",
        role=RoleEnum.COACH,
    )


@pytest.fixture
def member_user(app, db_session):
    user = UserFactory.create(
        email="member@championsclub.com",
        first_name="Standard",
        last_name="Member",
        role=RoleEnum.MEMBER,
    )
    MemberFactory.create(user=user)
    return user


@pytest.fixture
def inactive_user(app, db_session):
    return UserFactory.create(
        email="inactive@championsclub.com",
        first_name="Deactivated",
        last_name="User",
        role=RoleEnum.MEMBER,
        is_active=False,
    )


# -------------------------------------------------------------------
# Header Fixtures per Role
# -------------------------------------------------------------------

@pytest.fixture
def owner_headers(owner_user):
    return make_auth_headers(owner_user)


@pytest.fixture
def admin_headers(admin_user):
    return make_auth_headers(admin_user)


@pytest.fixture
def front_desk_headers(front_desk_user):
    return make_auth_headers(front_desk_user)


@pytest.fixture
def shop_staff_headers(shop_staff_user):
    return make_auth_headers(shop_staff_user)


@pytest.fixture
def bar_staff_headers(bar_staff_user):
    return make_auth_headers(bar_staff_user)


@pytest.fixture
def coach_headers(coach_user):
    return make_auth_headers(coach_user)


@pytest.fixture
def member_headers(member_user):
    return make_auth_headers(member_user)


# -------------------------------------------------------------------
# Membership Plans & Members
# -------------------------------------------------------------------

@pytest.fixture
def gold_plan(app, db_session):
    plan = MembershipPlan.query.filter_by(code="GOLD").first()
    if not plan:
        plan = MembershipPlan(
            name="Gold Champion",
            code="GOLD",
            displayed_monthly_price=Decimal("5000.00"),
            benefits={"court_discount_percent": 100.0},
            is_active=True,
        )
        db_session.add(plan)
        db_session.commit()
    return plan


@pytest.fixture
def silver_plan(app, db_session):
    plan = MembershipPlan.query.filter_by(code="SILVER").first()
    if not plan:
        plan = MembershipPlan(
            name="Silver Tier",
            code="SILVER",
            displayed_monthly_price=Decimal("2500.00"),
            benefits={"court_discount_percent": 50.0},
            is_active=True,
        )
        db_session.add(plan)
        db_session.commit()
    return plan


@pytest.fixture
def junior_plan(app, db_session):
    plan = MembershipPlan.query.filter_by(code="JUNIOR").first()
    if not plan:
        plan = MembershipPlan(
            name="Junior Academy",
            code="JUNIOR",
            displayed_monthly_price=Decimal("1500.00"),
            benefits={"court_discount_percent": 50.0},
            is_active=True,
        )
        db_session.add(plan)
        db_session.commit()
    return plan


@pytest.fixture
def gold_member(app, db_session, gold_plan):
    user = UserFactory.create(email="gold.member@championsclub.com", role=RoleEnum.MEMBER)
    return MemberFactory.create(user=user, plan_code="GOLD")


@pytest.fixture
def silver_member(app, db_session, silver_plan):
    user = UserFactory.create(email="silver.member@championsclub.com", role=RoleEnum.MEMBER)
    return MemberFactory.create(user=user, plan_code="SILVER")


@pytest.fixture
def junior_member(app, db_session, junior_plan):
    user = UserFactory.create(email="junior.member@championsclub.com", role=RoleEnum.MEMBER)
    return MemberFactory.create(
        user=user,
        plan_code="JUNIOR",
        date_of_birth=date.today() - timedelta(days=365 * 14),
    )


@pytest.fixture
def expired_member(app, db_session, silver_plan):
    user = UserFactory.create(email="expired.member@championsclub.com", role=RoleEnum.MEMBER)
    return MemberFactory.create(
        user=user,
        plan_code="SILVER",
        start_date=date.today() - timedelta(days=400),
        duration_months=12,
    )


# -------------------------------------------------------------------
# Courts Fixtures
# -------------------------------------------------------------------

@pytest.fixture
def tennis_court(app, db_session):
    return CourtFactory.create(name="Center Court", sport_type=SportType.LAWN_TENNIS)


@pytest.fixture
def badminton_court(app, db_session):
    return CourtFactory.create(name="Badminton Arena 1", sport_type=SportType.BADMINTON)


@pytest.fixture
def cricket_court(app, db_session):
    return CourtFactory.create(name="Box Cricket Pitch 1", sport_type=SportType.BOX_CRICKET)


@pytest.fixture
def pool_court(app, db_session):
    return CourtFactory.create(name="Olympic Swimming Pool", sport_type=SportType.SWIMMING_POOL)


@pytest.fixture
def table_tennis_court(app, db_session):
    return CourtFactory.create(name="TT Table 1", sport_type=SportType.TABLE_TENNIS)


@pytest.fixture
def volleyball_court(app, db_session):
    return CourtFactory.create(name="Volleyball Court 1", sport_type=SportType.VOLLEYBALL)


# -------------------------------------------------------------------
# Commerce Fixtures (for Developer B reuse)
# -------------------------------------------------------------------

@pytest.fixture
def gear_category(app, db_session):
    cat = ProductCategory(name="Sports Gear", slug="gear", is_active=True)
    db_session.add(cat)
    db_session.commit()
    return cat


@pytest.fixture
def racket_product(app, db_session, gear_category):
    return ProductFactory.create(
        name="Pro Tennis Racket",
        sku="RACKET-PRO",
        price=3500.0,
        stock=15,
        category=gear_category,
    )


@pytest.fixture
def pos_table(app, db_session):
    return TableFactory.create(table_number="T-01", capacity=4)
