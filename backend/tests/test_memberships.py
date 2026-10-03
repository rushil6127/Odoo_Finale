import pytest
from datetime import date, timedelta
from flask_jwt_extended import create_access_token
from backend.app.auth.models import User
from backend.app.auth.services import create_user
from backend.app.common.permissions import RoleEnum
from backend.app.members.models import Member
from backend.app.members.services import create_member, get_member_by_id, update_member, search_members
from backend.app.memberships.models import MembershipPlan, Membership, MembershipStatus
from backend.app.memberships.services import (
    seed_membership_plans,
    get_all_plans,
    get_plan_by_code,
    get_active_membership,
    is_membership_active,
    get_member_benefits,
    get_membership_history,
    assign_membership,
    change_membership_plan,
)
from backend.app.common.errors import ValidationException, ConflictException, ForbiddenException, NotFoundException


@pytest.fixture
def seeded_plans(app, db_session):
    """Seed the standard membership plans in the test database."""
    return seed_membership_plans()


@pytest.fixture
def front_desk_token(app, db_session):
    """Create a FRONT_DESK user and return auth header."""
    user = create_user(
        email="desk.staff@championsclub.com",
        password="StaffPassword123!",
        first_name="Staff",
        last_name="Member",
        role=RoleEnum.FRONT_DESK,
    )
    token = create_access_token(
        identity=str(user.id),
        additional_claims={"role": "FRONT_DESK"},
    )
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
def admin_token(app, db_session):
    """Create an ADMIN user and return auth header."""
    user = create_user(
        email="club.admin@championsclub.com",
        password="AdminPassword123!",
        first_name="Admin",
        last_name="User",
        role=RoleEnum.ADMIN,
    )
    token = create_access_token(
        identity=str(user.id),
        additional_claims={"role": "ADMIN"},
    )
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
def adult_member_user(app, db_session):
    """Create an adult member with DOB making them 25 years old."""
    user = create_user(
        email="adult.member@example.com",
        password="MemberPassword123!",
        first_name="Roger",
        last_name="Federer",
        role=RoleEnum.MEMBER,
    )
    member = create_member(
        user_id=user.id,
        phone="+919876543210",
        date_of_birth=date(2000, 1, 15),
        gender="Male",
        address="123 Baseline Rd",
    )
    return user, member


@pytest.fixture
def adult_member_token(adult_member_user):
    user, _ = adult_member_user
    token = create_access_token(
        identity=str(user.id),
        additional_claims={"role": "MEMBER"},
    )
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
def second_member_user(app, db_session):
    """Create a second distinct member user."""
    user = create_user(
        email="second.member@example.com",
        password="MemberPassword123!",
        first_name="Rafael",
        last_name="Nadal",
        role=RoleEnum.MEMBER,
    )
    member = create_member(
        user_id=user.id,
        phone="+919876543211",
        date_of_birth=date(1998, 6, 3),
        gender="Male",
    )
    return user, member


@pytest.fixture
def second_member_token(second_member_user):
    user, _ = second_member_user
    token = create_access_token(
        identity=str(user.id),
        additional_claims={"role": "MEMBER"},
    )
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
def junior_member_user(app, db_session):
    """Create a junior member aged 14."""
    user = create_user(
        email="junior.player@example.com",
        password="JuniorPassword123!",
        first_name="Carlos",
        last_name="Alcaraz",
        role=RoleEnum.MEMBER,
    )
    # 14 years old
    dob = date.today() - timedelta(days=14 * 365 + 100)
    member = create_member(
        user_id=user.id,
        phone="+919876543299",
        date_of_birth=dob,
        gender="Male",
    )
    return user, member


# ---------------------------------------------------------
# Plan Seeding & Pricing Verification Tests
# ---------------------------------------------------------

def test_seed_membership_plans(seeded_plans):
    """Verify all 3 membership plans are seeded with exact prices and benefits."""
    assert len(seeded_plans) == 3

    plans_by_code = {p.code: p for p in seeded_plans}
    assert "SILVER" in plans_by_code
    assert "GOLD" in plans_by_code
    assert "JUNIOR" in plans_by_code

    silver = plans_by_code["SILVER"]
    assert silver.name == "Silver Tier"
    assert float(silver.displayed_monthly_price) == 2799.00
    assert silver.billing_frequency == "ANNUALLY"
    assert silver.duration_months == 12
    assert silver.complimentary_months == 2
    assert silver.effective_annual_price == 2799.00 * 10
    assert silver.benefits["reservation_window_days"] == 3
    assert silver.benefits["shop_discount_pct"] == 10
    assert "Digital member card & unified charging tab" in silver.benefits["features"]

    gold = plans_by_code["GOLD"]
    assert gold.name == "Gold Champion"
    assert float(gold.displayed_monthly_price) == 4799.00
    assert gold.billing_frequency == "ANNUALLY"
    assert gold.duration_months == 12
    assert gold.complimentary_months == 2
    assert gold.effective_annual_price == 4799.00 * 10
    assert gold.benefits["reservation_window_days"] == 7
    assert gold.benefits["shop_discount_pct"] == 20
    assert gold.benefits["monthly_coaching_sessions"] == 2
    assert gold.benefits["monthly_guest_passes"] == 4
    assert gold.benefits["locker_steam_spa_access"] is True
    assert gold.benefits["vip_lounge_bar_priority"] is True

    junior = plans_by_code["JUNIOR"]
    assert junior.name == "Junior Academy"
    assert float(junior.displayed_monthly_price) == 1999.00
    assert junior.billing_frequency == "ANNUALLY"
    assert junior.duration_months == 12
    assert junior.complimentary_months == 2
    assert junior.effective_annual_price == 1999.00 * 10
    assert junior.benefits["shop_discount_pct"] == 15
    assert junior.benefits["monthly_academy_clinics"] == 4


def test_list_plans_api(client, seeded_plans):
    """Test GET /api/v1/membership-plans returns all seeded plans."""
    response = client.get("/api/v1/membership-plans")
    assert response.status_code == 200
    data = response.get_json()
    assert data["success"] is True
    assert len(data["data"]["plans"]) == 3


def test_get_plan_details_api(client, seeded_plans):
    """Test GET /api/v1/membership-plans/<id> returns plan details."""
    gold_plan = get_plan_by_code("GOLD")
    response = client.get(f"/api/v1/membership-plans/{gold_plan.id}")
    assert response.status_code == 200
    data = response.get_json()
    assert data["success"] is True
    assert data["data"]["plan"]["code"] == "GOLD"
    assert data["data"]["plan"]["displayed_monthly_price"] == 4799.00


# ---------------------------------------------------------
# Member Profile & CRUD Tests
# ---------------------------------------------------------

def test_register_member(client, admin_token, db_session):
    """Test registering a new member profile."""
    user = create_user(
        email="novak@example.com",
        password="PassWord123!",
        first_name="Novak",
        last_name="Djokovic",
    )
    payload = {
        "user_id": user.id,
        "phone": "+919123456789",
        "date_of_birth": "1987-05-22",
        "gender": "Male",
        "address": "456 Champion Way",
        "emergency_contact_name": "Jelena Djokovic",
        "emergency_contact_phone": "+919123456780",
    }
    response = client.post("/api/v1/members", json=payload, headers=admin_token)
    assert response.status_code == 201
    data = response.get_json()
    assert data["success"] is True
    assert data["data"]["member"]["phone"] == "+919123456789"
    assert data["data"]["member"]["user"]["email"] == "novak@example.com"


def test_member_get_own_profile(client, adult_member_token, adult_member_user):
    """Test member can retrieve their own profile."""
    _, member = adult_member_user
    response = client.get("/api/v1/members/me", headers=adult_member_token)
    assert response.status_code == 200
    data = response.get_json()
    assert data["success"] is True
    assert data["data"]["member"]["id"] == member.id
    assert data["data"]["member"]["user"]["email"] == "adult.member@example.com"


def test_member_cannot_read_another_member_data(
    client, adult_member_token, second_member_user
):
    """Test MEMBER role is forbidden from viewing another member's profile."""
    _, second_member = second_member_user
    response = client.get(
        f"/api/v1/members/{second_member.id}", headers=adult_member_token
    )
    assert response.status_code == 403
    data = response.get_json()
    assert data["success"] is False
    assert data["error"]["code"] == "FORBIDDEN"


def test_staff_can_read_any_member_data(
    client, front_desk_token, adult_member_user
):
    """Test staff role can view any member's profile."""
    _, member = adult_member_user
    response = client.get(
        f"/api/v1/members/{member.id}", headers=front_desk_token
    )
    assert response.status_code == 200
    data = response.get_json()
    assert data["success"] is True
    assert data["data"]["member"]["id"] == member.id


def test_search_members(client, front_desk_token, adult_member_user, second_member_user):
    """Test staff member search endpoint with query term."""
    response = client.get("/api/v1/members?q=Roger", headers=front_desk_token)
    assert response.status_code == 200
    data = response.get_json()
    assert data["success"] is True
    assert len(data["data"]["members"]) == 1
    assert data["data"]["members"][0]["user"]["first_name"] == "Roger"


# ---------------------------------------------------------
# Membership Assignment & Active/Expired Date Semantics Tests
# ---------------------------------------------------------

def test_assign_silver_membership(
    client, front_desk_token, adult_member_user, seeded_plans
):
    """Test staff assigning Silver Tier membership to an adult member."""
    _, member = adult_member_user
    silver_plan = get_plan_by_code("SILVER")
    today = date.today()

    payload = {
        "plan_id": silver_plan.id,
        "start_date": today.isoformat(),
        "notes": "Annual Silver Membership",
    }
    response = client.post(
        f"/api/v1/members/{member.id}/memberships",
        json=payload,
        headers=front_desk_token,
    )
    assert response.status_code == 201
    data = response.get_json()
    assert data["success"] is True
    ms_data = data["data"]["membership"]
    assert ms_data["plan"]["code"] == "SILVER"
    assert ms_data["start_date"] == today.isoformat()
    assert ms_data["is_active"] is True


def test_membership_active_date_boundaries(adult_member_user, seeded_plans):
    """Test membership is active on start_date and end_date, but expired after end_date."""
    _, member = adult_member_user
    gold_plan = get_plan_by_code("GOLD")

    start_date = date(2026, 1, 1)
    membership = assign_membership(
        member_id=member.id,
        plan_id=gold_plan.id,
        start_date=start_date,
        duration_months=12,
    )

    expected_end_date = date(2026, 12, 31)
    assert membership.end_date == expected_end_date

    # Before start date -> not active
    assert membership.is_active_on(date(2025, 12, 31)) is False

    # On start date -> active
    assert membership.is_active_on(date(2026, 1, 1)) is True

    # Mid-year -> active
    assert membership.is_active_on(date(2026, 6, 15)) is True

    # On exact final active date -> active
    assert membership.is_active_on(date(2026, 12, 31)) is True

    # Day after end date -> expired / not active
    assert membership.is_active_on(date(2027, 1, 1)) is False


def test_expired_membership_does_not_qualify_as_active(
    adult_member_user, seeded_plans
):
    """Test expired membership is not returned by get_active_membership for current date."""
    _, member = adult_member_user
    silver_plan = get_plan_by_code("SILVER")

    # Expired in past year
    past_start = date.today() - timedelta(days=500)
    assign_membership(
        member_id=member.id,
        plan_id=silver_plan.id,
        start_date=past_start,
        duration_months=12,
    )

    # Check active membership as of today
    active_ms = get_active_membership(member.id, as_of_date=date.today())
    assert active_ms is None

    # Benefits must be None for expired member
    benefits = get_member_benefits(member.id, as_of_date=date.today())
    assert benefits is None


def test_overlapping_active_memberships_rejected(
    adult_member_user, seeded_plans
):
    """Test attempting to assign overlapping active memberships raises ConflictException."""
    _, member = adult_member_user
    gold_plan = get_plan_by_code("GOLD")
    silver_plan = get_plan_by_code("SILVER")

    start_date = date.today()
    assign_membership(
        member_id=member.id,
        plan_id=gold_plan.id,
        start_date=start_date,
        duration_months=12,
    )

    # Attempt to assign another membership with overlapping dates
    with pytest.raises(ConflictException, match="already has an active membership"):
        assign_membership(
            member_id=member.id,
            plan_id=silver_plan.id,
            start_date=start_date + timedelta(days=30),
            duration_months=12,
        )


# ---------------------------------------------------------
# Junior Age Validation Tests & Boundary Cases
# ---------------------------------------------------------

def test_junior_membership_accepted_for_minor(junior_member_user, seeded_plans):
    """Test Junior Academy membership is accepted for eligible player under 18."""
    _, member = junior_member_user
    junior_plan = get_plan_by_code("JUNIOR")

    membership = assign_membership(
        member_id=member.id,
        plan_id=junior_plan.id,
        start_date=date.today(),
    )
    assert membership is not None
    assert membership.plan.code == "JUNIOR"


def test_junior_membership_rejected_for_adult(adult_member_user, seeded_plans):
    """Test Junior Academy membership is rejected for an adult (age 25)."""
    _, member = adult_member_user
    junior_plan = get_plan_by_code("JUNIOR")

    with pytest.raises(ValidationException, match="under 18 years old"):
        assign_membership(
            member_id=member.id,
            plan_id=junior_plan.id,
            start_date=date.today(),
        )


def test_junior_membership_exact_18th_birthday_boundary(
    app, db_session, seeded_plans
):
    """Test Junior membership on exact 18th birthday is rejected, but accepted 1 day prior."""
    start_date = date(2026, 6, 1)

    # Member turns exactly 18 on 2026-06-01 (DOB: 2008-06-01)
    user18 = create_user(
        email="exact18@club.com",
        password="PassWord123!",
        first_name="Exact",
        last_name="Eighteen",
    )
    member18 = create_member(
        user_id=user18.id,
        date_of_birth=date(2008, 6, 1),
    )

    junior_plan = get_plan_by_code("JUNIOR")

    # On exact 18th birthday -> Age 18 -> Rejected!
    with pytest.raises(ValidationException, match="under 18 years old"):
        assign_membership(
            member_id=member18.id,
            plan_id=junior_plan.id,
            start_date=start_date,
        )

    # Member is 17 years 364 days on 2026-05-31 (1 day before 18th birthday)
    ms_day_before = assign_membership(
        member_id=member18.id,
        plan_id=junior_plan.id,
        start_date=date(2026, 5, 31),
    )
    assert ms_day_before is not None
    assert ms_day_before.plan.code == "JUNIOR"


# ---------------------------------------------------------
# Plan Change & History Preservation Tests
# ---------------------------------------------------------

def test_plan_change_preserves_history(
    adult_member_user, seeded_plans
):
    """Test changing plan closes previous membership and creates new one without overwriting history."""
    _, member = adult_member_user
    silver_plan = get_plan_by_code("SILVER")
    gold_plan = get_plan_by_code("GOLD")

    # Initial Silver membership starting Jan 1, 2026
    start_date = date(2026, 1, 1)
    initial_ms = assign_membership(
        member_id=member.id,
        plan_id=silver_plan.id,
        start_date=start_date,
        duration_months=12,
    )

    # Upgrade to Gold Champion on July 1, 2026
    upgrade_date = date(2026, 7, 1)
    new_ms, old_ms = change_membership_plan(
        member_id=member.id,
        new_plan_id=gold_plan.id,
        effective_date=upgrade_date,
        notes="Upgraded to Gold for grass court priority",
    )

    # Verify old record is preserved with its original Silver plan
    assert old_ms.id == initial_ms.id
    assert old_ms.plan_id == silver_plan.id
    assert old_ms.start_date == date(2026, 1, 1)
    assert old_ms.end_date == date(2026, 6, 30)  # closed day before upgrade
    assert old_ms.status == MembershipStatus.UPGRADED

    # Verify new record is Gold starting on July 1, 2026
    assert new_ms.plan_id == gold_plan.id
    assert new_ms.start_date == date(2026, 7, 1)
    assert new_ms.status == MembershipStatus.ACTIVE

    # Full history has both records
    history = get_membership_history(member.id)
    assert len(history) == 2
    assert history[0].id == new_ms.id
    assert history[1].id == old_ms.id

    # Active plan on May 1, 2026 was Silver
    may_benefits = get_member_benefits(member.id, as_of_date=date(2026, 5, 1))
    assert may_benefits["reservation_window_days"] == 3

    # Active plan on August 1, 2026 is Gold
    aug_benefits = get_member_benefits(member.id, as_of_date=date(2026, 8, 1))
    assert aug_benefits["reservation_window_days"] == 7
    assert aug_benefits["locker_steam_spa_access"] is True


def test_member_cannot_view_another_member_membership_history(
    client, adult_member_token, second_member_user, seeded_plans
):
    """Test MEMBER cannot view another member's membership history."""
    _, second_member = second_member_user
    silver_plan = get_plan_by_code("SILVER")
    assign_membership(
        member_id=second_member.id,
        plan_id=silver_plan.id,
        start_date=date.today(),
    )

    response = client.get(
        f"/api/v1/members/{second_member.id}/memberships",
        headers=adult_member_token,
    )
    assert response.status_code == 403
    data = response.get_json()
    assert data["success"] is False
    assert data["error"]["code"] == "FORBIDDEN"
