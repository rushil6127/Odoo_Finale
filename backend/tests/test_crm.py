import pytest
from datetime import date, datetime, timedelta
from decimal import Decimal
from flask_jwt_extended import create_access_token

from backend.app.extensions import db
from backend.app.common.permissions import RoleEnum
from backend.app.auth.services import create_user
from backend.app.members.models import Member
from backend.app.memberships.services import seed_membership_plans, get_plan_by_code
from backend.app.courts.services import create_court
from backend.app.inventory.services import create_product, create_category
from backend.app.common.errors import ValidationException
from backend.app.crm.models import (
    CRMLead,
    CRMFollowUp,
    CRMNote,
    CRMTrialSession,
    CRMQuote,
    LeadStatus,
    LeadSource,
    FollowUpStatus,
    TrialStatus,
    QuoteStatus,
)
from backend.app.crm.services import (
    process_public_enquiry,
    get_lead,
    update_lead,
    add_lead_note,
    create_follow_up,
    update_follow_up,
    list_follow_ups_due_today,
    request_trial_session,
    confirm_trial_session,
    create_quote,
    convert_lead_to_member,
    mark_lead_lost,
)


@pytest.fixture
def seeded_plans(app, db_session):
    return seed_membership_plans()


@pytest.fixture
def front_desk_user(app, db_session):
    return create_user(
        email="desk.staff@championsclub.com",
        password="StaffPassword123!",
        first_name="FrontDesk",
        last_name="Staff",
        role=RoleEnum.FRONT_DESK,
    )


@pytest.fixture
def front_desk_token(front_desk_user):
    token = create_access_token(
        identity=str(front_desk_user.id),
        additional_claims={"role": RoleEnum.FRONT_DESK.value},
    )
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
def member_user(app, db_session):
    user = create_user(
        email="member.user@championsclub.com",
        password="MemberPassword123!",
        first_name="John",
        last_name="Doe",
        role=RoleEnum.MEMBER,
    )
    return user


@pytest.fixture
def member_token(member_user):
    token = create_access_token(
        identity=str(member_user.id),
        additional_claims={"role": RoleEnum.MEMBER.value},
    )
    return {"Authorization": f"Bearer {token}"}


def test_public_enquiry_creates_lead_and_immediate_follow_up(client, db_session):
    """A public unauthenticated enquiry creates a lead and an immediate follow-up task."""
    payload = {
        "name": "Novak Djokovic",
        "email": "novak@djokovic.rs",
        "phone": "+919876543210",
        "message": "Interested in Gold membership and grass court coaching.",
        "preferred_sport": "TENNIS",
        "interested_plan": "GOLD",
        "trial_requested": True,
        "preferred_trial_date": (date.today() + timedelta(days=2)).isoformat(),
        "preferred_trial_time": "18:00 - 19:00",
    }

    resp = client.post("/api/v1/crm/public/enquiries", json=payload)
    assert resp.status_code == 201
    assert resp.json["success"] is True

    # Verify database persistence
    lead = CRMLead.query.filter_by(email="novak@djokovic.rs").first()
    assert lead is not None
    assert lead.first_name == "Novak"
    assert lead.last_name == "Djokovic"
    assert lead.source == LeadSource.WEBSITE
    assert lead.status == LeadStatus.TRIAL_SCHEDULED

    # Verify immediate follow-up task was generated
    assert len(lead.follow_ups) == 1
    follow_up = lead.follow_ups[0]
    assert follow_up.status == FollowUpStatus.PENDING
    assert "Novak Djokovic" in follow_up.notes

    # Verify trial session request
    assert len(lead.trial_sessions) == 1
    trial = lead.trial_sessions[0]
    assert trial.status == TrialStatus.REQUESTED
    assert trial.preferred_time_slot == "18:00 - 19:00"


def test_public_enquiry_validation_oversized_and_honeypot(client, db_session):
    """Strict schema validation: missing contact, oversized message, and honeypot rejection."""
    # 1. Missing both email and phone -> rejected
    resp1 = client.post("/api/v1/crm/public/enquiries", json={"name": "Ghost Visitor"})
    assert resp1.status_code == 422
    assert resp1.json["success"] is False

    # 2. Oversized message (> 1000 characters) -> rejected
    oversized_msg = "A" * 1005
    resp2 = client.post("/api/v1/crm/public/enquiries", json={
        "name": "Chatty Visitor",
        "email": "chatty@example.com",
        "message": oversized_msg,
    })
    assert resp2.status_code == 422

    # 3. Honeypot field filled -> detected as bot / rejected
    resp3 = client.post("/api/v1/crm/public/enquiries", json={
        "name": "Spam Bot",
        "email": "spambot@example.com",
        "honeypot": "I am a hidden bot input",
    })
    assert resp3.status_code == 422
    assert "spam" in str(resp3.json["error"]).lower() or "bot" in str(resp3.json["error"]).lower()


def test_lead_lifecycle_status_transitions(app, db_session, front_desk_user):
    """Enforce strict valid lifecycle transitions and require member for CONVERTED."""
    lead, _ = process_public_enquiry({
        "name": "Carlos Alcaraz",
        "email": "carlos@alcaraz.es",
        "phone": "+919876543211",
    })
    assert lead.status == LeadStatus.NEW

    # 1. Transition NEW -> CONTACTED -> QUALIFIED
    update_lead(lead.id, {"status": "CONTACTED"}, requesting_user=front_desk_user)
    assert lead.status == LeadStatus.CONTACTED

    update_lead(lead.id, {"status": "QUALIFIED"}, requesting_user=front_desk_user)
    assert lead.status == LeadStatus.QUALIFIED

    # 2. Direct transition to CONVERTED without a linked member must be rejected
    with pytest.raises(ValidationException) as exc_info:
        update_lead(lead.id, {"status": "CONVERTED"}, requesting_user=front_desk_user)
    assert "without a linked member" in str(exc_info.value).lower()

    # 3. Mark LOST with reason
    mark_lead_lost(lead.id, reason="Moved to another city", requesting_user=front_desk_user)
    assert lead.status == LeadStatus.LOST
    assert lead.lost_reason == "Moved to another city"
    assert lead.lost_at is not None

    # 4. Reopen from LOST to NEW is allowed
    update_lead(lead.id, {"status": "NEW"}, requesting_user=front_desk_user)
    assert lead.status == LeadStatus.NEW


def test_conversion_creates_member_once_and_never_duplicates(app, db_session, seeded_plans, front_desk_user):
    """Conversion provisions Member once; converting same contact links existing without duplicating."""
    # Lead 1: First enquiry
    lead1, _ = process_public_enquiry({
        "name": "Jannik Sinner",
        "email": "jannik@sinner.it",
        "phone": "+919876543212",
        "interested_plan": "GOLD",
    })
    add_lead_note(lead1.id, "Interested in high performance training", front_desk_user)
    create_quote(lead1.id, plan_name="Gold Champion", amount=Decimal("4799.00"), valid_until=date.today() + timedelta(days=14), created_by_user_id=front_desk_user.id)

    # Convert Lead 1 to Member
    conv_lead1, member1 = convert_lead_to_member(
        lead_id=lead1.id,
        plan_code="GOLD",
        requesting_user=front_desk_user,
    )
    assert conv_lead1.status == LeadStatus.CONVERTED
    assert conv_lead1.converted_member_id == member1.id
    assert member1.user.email == "jannik@sinner.it"
    # Ensure lead history is completely preserved
    assert len(conv_lead1.notes) == 2  # original note + conversion note
    assert len(conv_lead1.quotes) == 1

    # Lead 2: Later enquiry from the same contact (same email & phone)
    lead2, _ = process_public_enquiry({
        "name": "Jannik Sinner",
        "email": "jannik@sinner.it",
        "phone": "+919876543212",
        "message": "Looking into padel lessons now",
    })

    # Convert Lead 2 -> Must link to existing member1 without creating duplicate!
    initial_member_count = Member.query.count()
    conv_lead2, member2 = convert_lead_to_member(
        lead_id=lead2.id,
        requesting_user=front_desk_user,
    )
    assert member2.id == member1.id
    assert conv_lead2.converted_member_id == member1.id
    assert Member.query.count() == initial_member_count  # No duplicate created


def test_trial_session_request_and_staff_confirmation(app, db_session, front_desk_user):
    """Trial session request stores visitor preferred time; staff confirms court/coach."""
    lead, _ = process_public_enquiry({
        "name": "Aryna Sabalenka",
        "email": "aryna@example.com",
    })
    court = create_court(name="Centre Court 1", sport_type="TENNIS")

    # Request trial
    trial = request_trial_session(
        lead_id=lead.id,
        preferred_date=date.today() + timedelta(days=3),
        preferred_time_slot="10:00 - 11:00",
        sport="TENNIS",
    )
    assert trial.status == TrialStatus.REQUESTED

    # Staff confirms trial
    confirmed_dt = datetime.combine(date.today() + timedelta(days=3), datetime.min.time().replace(hour=10))
    confirmed_trial = confirm_trial_session(
        trial_id=trial.id,
        confirmed_datetime=confirmed_dt,
        court_id=court.id,
        staff_notes="Allocated Coach Bob",
    )
    assert confirmed_trial.status == TrialStatus.CONFIRMED
    assert confirmed_trial.court_id == court.id
    assert lead.status == LeadStatus.TRIAL_SCHEDULED


def test_public_endpoints_leak_no_private_fields(client, db_session, seeded_plans):
    """Public read-only endpoints return no member data, staff data, or sensitive internal fields."""
    # 1. Club info
    resp_info = client.get("/api/v1/crm/public/club-info")
    assert resp_info.status_code == 200
    info_data = resp_info.json["data"]
    assert "Champions Club" in info_data["name"]
    assert "operating_hours" in info_data
    assert "password" not in str(info_data).lower()
    assert "secret" not in str(info_data).lower()

    # 2. Plans
    resp_plans = client.get("/api/v1/crm/public/plans")
    assert resp_plans.status_code == 200
    plans_data = resp_plans.json["data"]
    assert len(plans_data) >= 3
    for p in plans_data:
        assert "code" in p
        assert "monthly_price" in p
        assert "password" not in str(p)
        assert "user_id" not in str(p)

    # 3. Availability
    court = create_court(name="Court A1", sport_type="TENNIS")
    resp_avail = client.get(f"/api/v1/crm/public/availability?start_date={date.today().isoformat()}&end_date={date.today().isoformat()}")
    assert resp_avail.status_code == 200
    avail_data = resp_avail.json["data"]
    assert len(avail_data) == 1
    # Ensure no member names or booking ids are leaked
    for day in avail_data:
        for c in day["courts"]:
            assert "court_name" in c
            for slot in c["slots"]:
                assert "start_time" in slot
                assert "member_id" not in slot
                assert "booking_id" not in slot

    # 4. Products
    cat = create_category("Gear", "gear")
    prod = create_product(sku="RAC-PRO-1", name="Pro Racket", category_id=cat.id, price=Decimal("15000.00"), cost_price=Decimal("9000.00"), stock_quantity=10)
    resp_prod = client.get("/api/v1/crm/public/products")
    assert resp_prod.status_code == 200
    prod_data = resp_prod.json["data"]
    assert any(p["sku"] == "RAC-PRO-1" for p in prod_data)
    # Ensure cost price is never leaked publicly
    for p in prod_data:
        assert "cost_price" not in p
        assert "stock_quantity" not in p


def test_crm_api_role_restrictions(client, member_token, front_desk_token, db_session):
    """MEMBER role cannot access CRM staff endpoints; FRONT_DESK can."""
    # Member attempt to view leads -> 403
    resp_member = client.get("/api/v1/crm/leads", headers=member_token)
    assert resp_member.status_code == 403

    # Front desk attempt -> 200
    resp_staff = client.get("/api/v1/crm/leads", headers=front_desk_token)
    assert resp_staff.status_code == 200
    assert resp_staff.json["success"] is True


def test_follow_ups_due_today(app, db_session, front_desk_user):
    """Follow-ups due today returns pending items scheduled on or before today."""
    lead, _ = process_public_enquiry({
        "name": "Daniil Medvedev",
        "email": "daniil@medvedev.ru",
    })

    # Due today follow-up
    f1 = create_follow_up(lead.id, "CALL", scheduled_date=datetime.now())
    # Future follow-up (3 days from now)
    f2 = create_follow_up(lead.id, "CALL", scheduled_date=datetime.now() + timedelta(days=3))

    due_today = list_follow_ups_due_today(target_date=date.today())
    due_ids = [f.id for f in due_today]
    assert f1.id in due_ids
    assert f2.id not in due_ids
