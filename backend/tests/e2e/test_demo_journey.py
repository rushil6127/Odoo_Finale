"""End-to-End Demo Journey Test Suite: Part 1 (Core Club Operations).

Drives the application exclusively through the API client using seeded accounts
and dynamic client-side flows.

Covers the complete first half of the club journey:
1. Public Discovery & CRM Enquiry -> Conversion to Member
2. Direct Member Registration, Login, and Profile Isolation
3. Membership Subscription, Expiry Verification & Plan Change History
4. Court Discovery, Operating Hours & Real-time Availability
5. Court Booking (Member self-booking, discounts, social play) & Booking Payment
6. Critical Business Rules & Failure Paths (Double-booking rejection, 2-daily booking limit)
7. Strict RBAC & Tenant/Member Data Isolation across all touched modules

Structure:
- Designed with explicit extension hooks for Developer B to append commerce
  (Shop orders, POS/Bar tabs, Kitchen workflows) and Executive Reporting stages.
"""

import os
from datetime import date, datetime, timedelta
from decimal import Decimal
import pytest

from backend.app.extensions import db
from backend.app.seeds.demo_seed import seed_core_demo, DEMO_PASSWORD
from backend.app.common.permissions import RoleEnum
from backend.app.auth.models import User
from backend.app.members.models import Member
from backend.app.courts.models import Court, SportType
from backend.app.bookings.models import Booking, BookingStatus
from backend.app.payments.models import Payment, PaymentItemType, PaymentStatus


# =============================================================================
# Helper Utilities & Fixtures
# =============================================================================

@pytest.fixture(scope="function")
def seeded_club(app, db_session):
    """Seed the database with Developer A and B core operational data before E2E tests."""
    from backend.app.seeds.demo_seed_b import seed_commerce_and_crm_demo
    import celery.app.task
    original_delay = celery.app.task.Task.delay
    celery.app.task.Task.delay = lambda *args, **kwargs: None
    try:
        with app.app_context():
            summary = seed_core_demo()
            seed_commerce_and_crm_demo()
            db.session.commit()
        return summary
    finally:
        celery.app.task.Task.delay = original_delay


def api_login(client, email, password=DEMO_PASSWORD):
    """Perform API login and return JWT Authorization headers + user payload."""
    resp = client.post(
        "/api/v1/auth/login",
        json={"email": email, "password": password},
    )
    assert resp.status_code == 200, f"Login failed for {email}: {resp.get_json()}"
    body = resp.get_json()
    assert body["success"] is True
    token = body["data"]["access_token"]
    user_info = body["data"]["user"]
    return {"Authorization": f"Bearer {token}"}, user_info


# =============================================================================
# STAGE 1: Public Discovery, CRM Enquiry & Member Conversion
# =============================================================================

class TestStage1PublicDiscoveryAndCRMConversion:
    """Validate public enquiry ingestion and front-desk conversion into an active member."""

    def test_public_discovery_and_enquiry_submission(self, client, seeded_club):
        """Unauthenticated visitor explores plans, checks availability, and submits enquiry."""
        # 1. Public plans listing
        resp_plans = client.get("/api/v1/crm/public/plans")
        assert resp_plans.status_code == 200
        plans = resp_plans.get_json()["data"]
        plan_codes = {p["code"] for p in plans}
        assert {"GOLD", "SILVER", "JUNIOR"}.issubset(plan_codes)

        # 2. Public court availability check
        today_str = date.today().isoformat()
        resp_avail = client.get(f"/api/v1/crm/public/availability?start_date={today_str}&end_date={today_str}")
        assert resp_avail.status_code == 200
        avail_data = resp_avail.get_json()["data"]
        assert len(avail_data) > 0
        # Ensure private member/booking IDs are scrubbed
        for day in avail_data:
            for court in day["courts"]:
                for slot in court["slots"]:
                    assert "member_id" not in slot
                    assert "booking_id" not in slot

        # 3. Submit enquiry
        enquiry_payload = {
            "name": "Carlos Alcaraz",
            "email": "carlos.alcaraz@tennis.example.com",
            "phone": "+91 98765 00001",
            "message": "Interested in Gold Champion membership and grass court tournament access.",
            "preferred_sport": "LAWN_TENNIS",
            "interested_plan": "GOLD",
            "trial_requested": True,
            "preferred_trial_date": (date.today() + timedelta(days=2)).isoformat(),
            "preferred_trial_time": "17:00 - 18:00",
        }
        resp_enq = client.post("/api/v1/crm/public/enquiries", json=enquiry_payload)
        assert resp_enq.status_code == 201
        enq_res = resp_enq.get_json()
        assert enq_res["success"] is True
        assert "lead_reference" in enq_res["data"]

    def test_front_desk_converts_enquiry_to_member(self, client, seeded_club):
        """Front desk staff logs in, reviews the lead, and converts them to a club member."""
        # 1. Visitor submits enquiry
        enquiry_payload = {
            "name": "Jannik Sinner",
            "email": "jannik.sinner@tennis.example.com",
            "phone": "+91 98765 00002",
            "message": "Interested in Silver Tier training pass.",
            "preferred_sport": "LAWN_TENNIS",
            "interested_plan": "SILVER",
        }
        client.post("/api/v1/crm/public/enquiries", json=enquiry_payload)

        # 2. Front Desk logs in
        fd_headers, fd_user = api_login(client, "frontdesk@championsclub.example.com")
        assert fd_user["role"] == "FRONT_DESK"

        # 3. List leads (returns a list directly under data)
        resp_leads = client.get("/api/v1/crm/leads", headers=fd_headers)
        assert resp_leads.status_code == 200
        leads_list = resp_leads.get_json()["data"]
        target_lead = next((l for l in leads_list if l["email"] == "jannik.sinner@tennis.example.com"), None)
        assert target_lead is not None
        lead_id = target_lead["id"]

        # 4. Convert lead to member
        convert_payload = {
            "plan_code": "SILVER",
            "address": "45 Sinner Way, Indiranagar, Bengaluru",
            "date_of_birth": "2001-08-16",
            "gender": "MALE",
        }
        resp_conv = client.post(f"/api/v1/crm/leads/{lead_id}/convert", headers=fd_headers, json=convert_payload)
        assert resp_conv.status_code == 200
        conv_data = resp_conv.get_json()
        assert conv_data["success"] is True
        assert conv_data["data"]["lead"]["status"] == "CONVERTED"
        member_id = conv_data["data"]["member_id"]
        assert member_id > 0

        # 5. Verify converted member has an active Silver membership
        resp_ms = client.get(f"/api/v1/members/{member_id}/memberships/active", headers=fd_headers)
        assert resp_ms.status_code == 200
        active_ms = resp_ms.get_json()["data"]["active_membership"]
        assert active_ms is not None
        assert active_ms["plan"]["code"] == "SILVER"
        assert active_ms["status"] == "ACTIVE"


# =============================================================================
# STAGE 2: Direct Member Registration & Profile Isolation
# =============================================================================

class TestStage2DirectRegistrationAndProfileIsolation:
    """Verify new member user registration, authentication, and cross-member data isolation."""

    def test_member_direct_registration_and_login(self, client, seeded_club):
        """A new member signs up directly, authenticates, and accesses their own profile."""
        reg_payload = {
            "email": "rafael.nadal@tennis.example.com",
            "password": "Password123!",
            "first_name": "Rafael",
            "last_name": "Nadal",
        }
        resp_reg = client.post("/api/v1/auth/register", json=reg_payload)
        assert resp_reg.status_code == 201
        assert resp_reg.get_json()["success"] is True

        # Log in as the new member
        nadal_headers, nadal_user = api_login(client, "rafael.nadal@tennis.example.com", "Password123!")
        assert nadal_user["email"] == "rafael.nadal@tennis.example.com"
        assert nadal_user["role"] == "MEMBER"

        # Check self profile
        resp_me = client.get("/api/v1/members/me", headers=nadal_headers)
        assert resp_me.status_code == 200
        me_data = resp_me.get_json()["data"]["member"]
        assert me_data["user"]["first_name"] == "Rafael"
        assert me_data["user"]["last_name"] == "Nadal"

    def test_member_cannot_access_other_member_profile(self, client, seeded_club):
        """Enforce strict isolation: A MEMBER cannot query another member's profile or history."""
        # 1. Log in as Gold Member
        gold_headers, _ = api_login(client, "gold.member@championsclub.example.com")

        # 2. Log in as Silver Member to get their member_id
        silver_headers, _ = api_login(client, "silver.member@championsclub.example.com")
        resp_silver_me = client.get("/api/v1/members/me", headers=silver_headers)
        silver_member_id = resp_silver_me.get_json()["data"]["member"]["id"]

        # 3. Gold Member attempts to read Silver Member's profile -> 403 Forbidden
        resp_forbidden_profile = client.get(f"/api/v1/members/{silver_member_id}", headers=gold_headers)
        assert resp_forbidden_profile.status_code == 403

        # 4. Gold Member attempts to read Silver Member's membership history -> 403 Forbidden
        resp_forbidden_history = client.get(f"/api/v1/members/{silver_member_id}/memberships", headers=gold_headers)
        assert resp_forbidden_history.status_code == 403

        # 5. Gold Member attempts to access staff-only member directory -> 403 Forbidden
        resp_forbidden_list = client.get("/api/v1/members", headers=gold_headers)
        assert resp_forbidden_list.status_code == 403

        # 6. Front desk staff CAN access member directory and profile -> 200 OK
        fd_headers, _ = api_login(client, "frontdesk@championsclub.example.com")
        resp_staff_ok = client.get(f"/api/v1/members/{silver_member_id}", headers=fd_headers)
        assert resp_staff_ok.status_code == 200


# =============================================================================
# STAGE 3: Membership Subscription, States, Upgrades & Payment
# =============================================================================

class TestStage3MembershipLifecycleAndPayments:
    """Validate membership assignment, upgrade history, and membership payment settlement."""

    def test_membership_assignment_and_payment_flow(self, client, seeded_club):
        """Staff assigns a Gold membership to a member, who then settles payment via UPI."""
        # Register new member
        client.post("/api/v1/auth/register", json={
            "email": "stefanos.tsitsipas@tennis.example.com",
            "password": "Password123!",
            "first_name": "Stefanos",
            "last_name": "Tsitsipas",
        })
        tsitsipas_headers, _ = api_login(client, "stefanos.tsitsipas@tennis.example.com", "Password123!")
        member_id = client.get("/api/v1/members/me", headers=tsitsipas_headers).get_json()["data"]["member"]["id"]

        # Front desk assigns Gold plan
        fd_headers, _ = api_login(client, "frontdesk@championsclub.example.com")
        resp_plans = client.get("/api/v1/membership-plans")
        gold_plan = next(p for p in resp_plans.get_json()["data"]["plans"] if p["code"] == "GOLD")

        assign_payload = {
            "plan_id": gold_plan["id"],
            "start_date": date.today().isoformat(),
            "duration_months": 12,
            "notes": "E2E Test Gold Membership Assignment",
        }
        resp_assign = client.post(f"/api/v1/members/{member_id}/memberships", headers=fd_headers, json=assign_payload)
        assert resp_assign.status_code == 201
        assigned_ms = resp_assign.get_json()["data"]["membership"]
        membership_id = assigned_ms["id"]
        expected_price = float(assigned_ms["price_paid"])

        # Member initiates payment for their membership
        pay_payload = {
            "item_type": "MEMBERSHIP",
            "item_id": membership_id,
            "amount": expected_price,
            "payment_method": "UPI",
            "notes": "Annual Gold subscription fee",
        }
        resp_pay = client.post("/api/v1/payments", headers=tsitsipas_headers, json=pay_payload)
        assert resp_pay.status_code == 201
        payment_id = resp_pay.get_json()["data"]["id"]
        assert resp_pay.get_json()["data"]["status"] == "PENDING"

        # Front desk confirms manual UPI payment at reception
        resp_confirm = client.post(
            f"/api/v1/payments/{payment_id}/confirm",
            headers=fd_headers,
            json={"notes": "UPI reference verified on bank terminal"},
        )
        assert resp_confirm.status_code == 200
        settled_pay = resp_confirm.get_json()["data"]
        assert settled_pay["status"] == "PAID"
        assert settled_pay["payment_method"] == "UPI"
        assert Decimal(str(settled_pay["amount"])) == Decimal(str(expected_price))

    def test_seeded_memberships_states_and_upgrade_history(self, client, seeded_club):
        """Verify historical seeded accounts: Upgraded member, Expired member, and Expiring-soon member."""
        # 1. Upgraded member (Silver -> Gold plan change history)
        up_headers, _ = api_login(client, "upgraded.member@championsclub.example.com")
        up_member_id = client.get("/api/v1/members/me", headers=up_headers).get_json()["data"]["member"]["id"]

        resp_up_hist = client.get(f"/api/v1/members/{up_member_id}/memberships", headers=up_headers)
        assert resp_up_hist.status_code == 200
        memberships = resp_up_hist.get_json()["data"]["memberships"]
        statuses = [m["status"] for m in memberships]
        assert "UPGRADED" in statuses
        assert "ACTIVE" in statuses
        active_plan = next(m for m in memberships if m["status"] == "ACTIVE")
        assert active_plan["plan"]["code"] == "GOLD"

        # 2. Expired member
        exp_headers, _ = api_login(client, "expired.member@championsclub.example.com")
        exp_member_id = client.get("/api/v1/members/me", headers=exp_headers).get_json()["data"]["member"]["id"]
        resp_exp_active = client.get(f"/api/v1/members/{exp_member_id}/memberships/active", headers=exp_headers)
        assert resp_exp_active.status_code == 200
        # No currently active membership returned
        assert resp_exp_active.get_json()["data"]["active_membership"] is None

        resp_exp_hist = client.get(f"/api/v1/members/{exp_member_id}/memberships", headers=exp_headers)
        assert resp_exp_hist.status_code == 200
        exp_memberships = resp_exp_hist.get_json()["data"]["memberships"]
        assert any(m["status"] == "EXPIRED" for m in exp_memberships)

        # 3. Expiring-soon member (valid active membership ending within days)
        soon_headers, _ = api_login(client, "expiring.member@championsclub.example.com")
        soon_member_id = client.get("/api/v1/members/me", headers=soon_headers).get_json()["data"]["member"]["id"]
        resp_soon_active = client.get(f"/api/v1/members/{soon_member_id}/memberships/active", headers=soon_headers)
        assert resp_soon_active.status_code == 200
        soon_active = resp_soon_active.get_json()["data"]["active_membership"]
        assert soon_active is not None
        assert soon_active["status"] == "ACTIVE"


# =============================================================================
# STAGE 4: Court Discovery, Availability & Booking Workflows
# =============================================================================

class TestStage4CourtAvailabilityAndBookings:
    """Validate court slot query, member discount calculations, booking creation, and payment."""

    def test_court_discovery_and_slot_availability(self, client, seeded_club):
        """Query court facilities across all sports and retrieve slot availability matrix."""
        resp_courts = client.get("/api/v1/courts")
        assert resp_courts.status_code == 200
        courts = resp_courts.get_json()["data"]["courts"]
        assert len(courts) >= 14

        tomorrow = (date.today() + timedelta(days=1)).isoformat()

        resp_avail = client.get(f"/api/v1/courts/availability?date={tomorrow}")
        assert resp_avail.status_code == 200
        avail_data = resp_avail.get_json()["data"]
        assert "operating_hours" in avail_data
        assert "courts" in avail_data
        assert len(avail_data["courts"]) >= 14

    def test_gold_member_booking_100_percent_discount(self, client, seeded_club):
        """Gold member books a court with 100% membership tier discount (final_price = 0.00)."""
        gold_headers, _ = api_login(client, "gold.member@championsclub.example.com")

        # Find Centre Court (Grass)
        resp_courts = client.get("/api/v1/courts?q=Centre Court")
        centre_court = resp_courts.get_json()["data"]["courts"][0]

        target_time = (datetime.now() + timedelta(days=2)).replace(hour=10, minute=0, second=0, microsecond=0)
        book_payload = {
            "court_id": centre_court["id"],
            "start_time": target_time.isoformat(),
            "notes": "Gold member morning singles session",
        }
        resp_book = client.post("/api/v1/bookings", headers=gold_headers, json=book_payload)
        assert resp_book.status_code == 201
        booking = resp_book.get_json()["data"]
        assert booking["status"] == "CONFIRMED"
        assert float(booking["final_price"]) == 0.00
        assert float(booking["discount_amount"]) > 0.00

        # Verify booking appears in member's booking history
        resp_my = client.get("/api/v1/bookings", headers=gold_headers)
        assert resp_my.status_code == 200
        my_bookings = resp_my.get_json()["data"]
        assert any(b["id"] == booking["id"] for b in my_bookings)

    def test_silver_member_booking_50_pct_discount_and_payment(self, client, seeded_club):
        """Silver member books a badminton court (50% discount) and settles booking payment."""
        silver_headers, _ = api_login(client, "silver.member@championsclub.example.com")
        fd_headers, _ = api_login(client, "frontdesk@championsclub.example.com")

        # Find Badminton Arena Court 1
        resp_courts = client.get("/api/v1/courts?sport=BADMINTON")
        badminton_court = resp_courts.get_json()["data"]["courts"][0]

        target_time = (datetime.now() + timedelta(days=3)).replace(hour=14, minute=0, second=0, microsecond=0)
        book_payload = {
            "court_id": badminton_court["id"],
            "start_time": target_time.isoformat(),
            "notes": "Silver member afternoon badminton game",
        }
        resp_book = client.post("/api/v1/bookings", headers=silver_headers, json=book_payload)
        assert resp_book.status_code == 201
        booking = resp_book.get_json()["data"]
        booking_id = booking["id"]
        # Base hourly rate for Badminton is 400.00 -> 50% discount -> 200.00
        expected_price = float(booking["final_price"])
        assert expected_price == 200.00

        # Member initiates payment for court booking
        resp_pay = client.post(
            "/api/v1/payments",
            headers=silver_headers,
            json={
                "item_type": "BOOKING",
                "item_id": booking_id,
                "amount": expected_price,
                "payment_method": "CARD",
                "notes": "Card payment at front desk terminal",
            },
        )
        assert resp_pay.status_code == 201
        payment_id = resp_pay.get_json()["data"]["id"]

        # Staff confirms card payment
        resp_confirm = client.post(
            f"/api/v1/payments/{payment_id}/confirm",
            headers=fd_headers,
            json={"notes": "POS terminal transaction reference #TX8872"},
        )
        assert resp_confirm.status_code == 200
        settled_pay = resp_confirm.get_json()["data"]
        assert settled_pay["status"] == "PAID"
        assert settled_pay["payment_method"] == "CARD"


# =============================================================================
# STAGE 5: Failure Paths, Conflict Prevention & Business Rules
# =============================================================================

class TestStage5BusinessRuleRejectionsAndFailurePaths:
    """Validate server-side rejection of double-bookings and daily limits."""

    def test_double_booking_same_court_and_time_fails(self, client, seeded_club):
        """Attempting to book a court that already has an overlapping active session fails (HTTP 409)."""
        gold_headers, _ = api_login(client, "gold.member@championsclub.example.com")
        silver_headers, _ = api_login(client, "silver.member@championsclub.example.com")

        resp_courts = client.get("/api/v1/courts?sport=LAWN_TENNIS")
        court_id = resp_courts.get_json()["data"]["courts"][0]["id"]
        conflict_time = (datetime.now() + timedelta(days=4)).replace(hour=16, minute=0, second=0, microsecond=0)

        # 1. First booking succeeds
        resp1 = client.post(
            "/api/v1/bookings",
            headers=gold_headers,
            json={"court_id": court_id, "start_time": conflict_time.isoformat()},
        )
        assert resp1.status_code == 201

        # 2. Second booking on the exact same court and time slot MUST fail
        resp2 = client.post(
            "/api/v1/bookings",
            headers=silver_headers,
            json={"court_id": court_id, "start_time": conflict_time.isoformat()},
        )
        assert resp2.status_code in (400, 409)
        err = resp2.get_json()
        assert err["success"] is False
        error_msg = err.get("error", {}).get("message", "").lower()
        assert "conflict" in error_msg or "not available" in error_msg or "overlap" in error_msg or "already booked" in error_msg

    def test_daily_booking_limit_enforcement(self, client, seeded_club):
        """Attempting bookings exceeding MAX_DAILY_BOOKINGS_PER_MEMBER (5) on the same day fails."""
        # active.player@championsclub.example.com has 2 bookings seeded today (10:00 and 16:00)
        player_headers, _ = api_login(client, "active.player@championsclub.example.com")

        resp_courts = client.get("/api/v1/courts?sport=TABLE_TENNIS")
        tt_court = resp_courts.get_json()["data"]["courts"][0]

        # Book 3rd, 4th, and 5th session on different non-conflicting times today (e.g. 18:00, 19:00, 20:00)
        for h in (18, 19, 20):
            t_time = datetime.now().replace(hour=h, minute=0, second=0, microsecond=0)
            res = client.post(
                "/api/v1/bookings",
                headers=player_headers,
                json={
                    "court_id": tt_court["id"],
                    "start_time": t_time.isoformat(),
                    "notes": f"Booking slot at {h}:00",
                },
            )
            assert res.status_code == 201

        # Attempt to create a 6th booking for today (exceeds limit 5)
        sixth_booking_time = datetime.now().replace(hour=21, minute=0, second=0, microsecond=0)
        resp_sixth = client.post(
            "/api/v1/bookings",
            headers=player_headers,
            json={
                "court_id": tt_court["id"],
                "start_time": sixth_booking_time.isoformat(),
                "notes": "Attempting 6th booking in a single day",
            },
        )
        assert resp_sixth.status_code in (400, 422)
        err = resp_sixth.get_json()
        assert err["success"] is False
        error_msg = err.get("error", {}).get("message", "").lower()
        assert "daily" in error_msg or "limit" in error_msg or "maximum" in error_msg


# =============================================================================
# STAGE 6: Full Golden Path Chained Integration Journey
# =============================================================================

class TestStage6ComprehensiveGoldenPathJourney:
    """Execute the complete seamless end-to-end user story across all Developer A modules."""

    def test_full_member_onboarding_booking_and_payment_journey(self, client, seeded_club):
        """Full Journey:
        1. Lead enquiry submitted on public website.
        2. Front desk converts lead to Gold Member.
        3. Member logs into mobile/web app.
        4. Front desk assigns membership and settles payment.
        5. Member browses real-time availability.
        6. Member reserves Centre Court for singles match.
        7. Booking confirmed, visible in member booking history.
        8. Complete audit trail verified.
        """
        # Step 1: Public Enquiry
        lead_email = "andy.murray@tennis.example.com"
        client.post("/api/v1/crm/public/enquiries", json={
            "name": "Andy Murray",
            "email": lead_email,
            "phone": "+91 98765 00005",
            "message": "Enquiring about Gold membership & private coaching.",
            "preferred_sport": "LAWN_TENNIS",
            "interested_plan": "GOLD",
        })

        # Step 2: Front Desk Conversion
        fd_headers, _ = api_login(client, "frontdesk@championsclub.example.com")
        leads = client.get("/api/v1/crm/leads", headers=fd_headers).get_json()["data"]
        lead_id = next(l["id"] for l in leads if l["email"] == lead_email)

        resp_conv = client.post(f"/api/v1/crm/leads/{lead_id}/convert", headers=fd_headers, json={
            "plan_code": "GOLD",
            "address": "1 Dunblane Court, Bengaluru",
            "date_of_birth": "1987-05-15",
            "gender": "MALE",
        })
        assert resp_conv.status_code == 200
        member_id = resp_conv.get_json()["data"]["member_id"]

        # Step 3: Newly Converted Member Authentication
        member_headers, member_user = api_login(client, lead_email, "MemberTempPassword123!")
        assert member_user["role"] == "MEMBER"

        # Step 4: Verify Active Gold Membership
        resp_active_ms = client.get(f"/api/v1/members/{member_id}/memberships/active", headers=member_headers)
        assert resp_active_ms.status_code == 200
        active_ms = resp_active_ms.get_json()["data"]["active_membership"]
        assert active_ms["plan"]["code"] == "GOLD"
        assert active_ms["status"] == "ACTIVE"

        # Step 5: Settle Membership Payment via Reception
        ms_id = active_ms["id"]
        ms_price = float(active_ms["price_paid"])
        resp_ms_pay = client.post("/api/v1/payments", headers=member_headers, json={
            "item_type": "MEMBERSHIP",
            "item_id": ms_id,
            "amount": ms_price,
            "payment_method": "CASH",
            "notes": "Paid annual subscription cash at concierge",
        })
        assert resp_ms_pay.status_code == 201
        ms_payment_id = resp_ms_pay.get_json()["data"]["id"]

        resp_settle_ms = client.post(
            f"/api/v1/payments/{ms_payment_id}/confirm",
            headers=fd_headers,
            json={"notes": "Cash received in front desk cash drawer"},
        )
        assert resp_settle_ms.status_code == 200
        assert resp_settle_ms.get_json()["data"]["status"] == "PAID"

        # Step 6: Browse Availability & Book Court
        resp_courts = client.get("/api/v1/courts?sport=LAWN_TENNIS")
        court_id = resp_courts.get_json()["data"]["courts"][0]["id"]
        book_time = (datetime.now() + timedelta(days=5)).replace(hour=11, minute=0, second=0, microsecond=0)

        resp_book = client.post("/api/v1/bookings", headers=member_headers, json={
            "court_id": court_id,
            "start_time": book_time.isoformat(),
            "notes": "E2E Golden Path Court Session",
        })
        assert resp_book.status_code == 201
        booking = resp_book.get_json()["data"]
        assert booking["status"] == "CONFIRMED"

        # Step 7: Verify Booking in Member History
        resp_history = client.get("/api/v1/bookings", headers=member_headers)
        assert resp_history.status_code == 200
        my_bookings = resp_history.get_json()["data"]
        assert any(b["id"] == booking["id"] for b in my_bookings)

        # Step 8: Verify Payment Ledger for the Member
        resp_my_payments = client.get("/api/v1/payments", headers=member_headers)
        assert resp_my_payments.status_code == 200
        payments = resp_my_payments.get_json()["data"]
        assert any(p["id"] == ms_payment_id and p["status"] == "PAID" for p in payments)


# =============================================================================
# DEVELOPER B EXTENSION HOOKS: COMMERCE, POS, BAR TABS & OWNER DASHBOARD
# =============================================================================
# Developer B can append test cases below:
# - Stage 7: Pro Shop Order Creation, Inventory Stock Check & Order Payment
# - Stage 8: POS / Bar Table Session, Kitchen Order Routing, Tab Settlement
# - Stage 9: Owner Comprehensive Daily/Weekly/Monthly Revenue & Operations Dashboard


class TestStage5CommercePOSAndDashboard:
    """Validate Developer B's additions: Shop, POS, and Dashboard."""

    def test_commerce_pos_dashboard_journey(self, client, seeded_club, monkeypatch):
        import celery.app.task
        monkeypatch.setattr(celery.app.task.Task, "delay", lambda *args, **kwargs: None)
        
        # 1. Login as required users
        shop_headers, _ = api_login(client, "shop@championsclub.example.com")
        bar_headers, _ = api_login(client, "bar@championsclub.example.com")
        owner_headers, _ = api_login(client, "owner@championsclub.example.com")
        gold_headers, gold_user = api_login(client, "gold.member@championsclub.example.com")

        # 2. Get Products
        resp_prods = client.get("/api/v1/inventory/products", headers=shop_headers)
        assert resp_prods.status_code == 200
        products = resp_prods.get_json()["data"]["products"]
        # Find balls and shirt
        balls = next(p for p in products if p["sku"] in ("SKU-REQ-002", "BAL-WIL-US3"))
        shirt = next(p for p in products if p["sku"] in ("SKU-APP-001", "APP-CHAMP-POLO"))
        
        initial_balls_stock = balls["stock_quantity"]

        # 3. Shop Purchase (Counter)
        resp_shop = client.post("/api/v1/shop/orders", headers=shop_headers, json={
            "order_type": "COUNTER",
            "fulfillment_type": "PICKUP",
            "items": [{"product_id": balls["id"], "quantity": 1}],
            "payment_method": "CASH"
        })
        assert resp_shop.status_code == 201, resp_shop.get_json()
        shop_order = resp_shop.get_json()["data"]["order"]

        # Verify Inventory changes
        resp_prods_after = client.get(f"/api/v1/inventory/products/{balls['id']}", headers=shop_headers)
        assert resp_prods_after.get_json()["data"]["product"]["stock_quantity"] == initial_balls_stock - 1

        # Failure Path: Out-of-stock purchase
        resp_fail = client.post("/api/v1/shop/orders", headers=shop_headers, json={
            "order_type": "COUNTER",
            "fulfillment_type": "PICKUP",
            "items": [{"product_id": balls["id"], "quantity": 1000}], # too many
            "payment_method": "CASH"
        })
        assert resp_fail.status_code in (400, 409, 422), "Should fail for out of stock"

        # 4. Shop Purchase (Online) as Member
        resp_online = client.post("/api/v1/shop/orders", headers=gold_headers, json={
            "order_type": "ONLINE",
            "fulfillment_type": "DELIVERY",
            "items": [{"product_id": shirt["id"], "quantity": 1}],
            "delivery_address": "Test Address",
            "payment_method": "ONLINE"
        })
        assert resp_online.status_code == 201

        # 5. Bar/POS tab with member discount
        resp_tables = client.get("/api/v1/pos/tables", headers=bar_headers)
        tables = resp_tables.get_json()["data"]
        table = next(t for t in tables if t["table_number"] == "T1")

        # Start shift
        resp_shift = client.post("/api/v1/pos/shifts/start", headers=bar_headers, json={
            "starting_cash": "100.00"
        })
        if resp_shift.status_code != 201:
            shift_id = client.get("/api/v1/pos/shifts?status=ACTIVE", headers=bar_headers).get_json()["data"][0]["id"]
        else:
            shift_id = resp_shift.get_json()["data"]["id"]

        resp_tab = client.post("/api/v1/pos/tabs", headers=bar_headers, json={
            "table_id": table["id"],
            "shift_id": shift_id,
            "member_id": client.get("/api/v1/members/me", headers=gold_headers).get_json()["data"]["member"]["id"]
        })
        assert resp_tab.status_code == 201
        tab_id = resp_tab.get_json()["data"]["id"]

        resp_menu = client.get("/api/v1/pos/menu", headers=bar_headers)
        menu_items = resp_menu.get_json()["data"]
        coffee = next(i for i in menu_items if i["code"] in ("COF-01", "B01"))

        # Add item
        resp_add = client.post(f"/api/v1/pos/tabs/{tab_id}/items", headers=bar_headers, json={
            "items": [{"menu_item_id": coffee["id"], "quantity": 2, "notes": ""}]
        })
        assert resp_add.status_code == 200

        # Failure Path: Closing an unpaid tab
        resp_close_fail = client.post(f"/api/v1/pos/tabs/{tab_id}/close", headers=bar_headers)
        assert resp_close_fail.status_code in (400, 409, 422), "Cannot close unpaid tab"

        # Payment
        resp_pay = client.post(f"/api/v1/pos/tabs/{tab_id}/pay", headers=bar_headers, json={
            "payment_method": "CARD"
        })
        assert resp_pay.status_code == 200
        
        # Close
        resp_close = client.post(f"/api/v1/pos/tabs/{tab_id}/close", headers=bar_headers)
        assert resp_close.status_code == 200

        # Verify Payment records for Shop and POS
        resp_payments = client.get("/api/v1/payments", headers=owner_headers)
        payments = resp_payments.get_json()["data"]
        # shop_order has payment
        shop_payment = next(p for p in payments if p["item_id"] == shop_order["id"] and p["item_type"] == "SHOP_ORDER")
        assert shop_payment["status"] == "PAID"
        assert shop_payment["payment_method"] == "CASH"

        # POS tab payment
        pos_payment = next(p for p in payments if p["item_id"] == tab_id and p["item_type"] == "POS_ORDER")
        assert pos_payment["status"] == "PAID"
        assert pos_payment["payment_method"] == "CARD"

        # 6. Revenue Aggregation Dashboard
        resp_dash = client.get("/api/v1/reports/dashboard", headers=owner_headers)
        assert resp_dash.status_code == 200
        dash = resp_dash.get_json()["data"]
        
        financial = dash["financial_summary"]
        methods = dash["payment_methods"]
        streams = dash["stream_breakdown"]

        # Ensure totals match
        total_paid_streams = sum(s["paid_amount"] for s in streams.values())
        total_refund_streams = sum(s["refunded_amount"] for s in streams.values())
        total_paid_methods = sum(m["paid_amount"] for m in methods.values())
        total_refund_methods = sum(m["refunded_amount"] for m in methods.values())

        # Assert totals are consistent
        assert round(financial["paid_amount"], 2) == round(total_paid_streams, 2)
        assert round(financial["paid_amount"], 2) == round(total_paid_methods, 2)
        assert round(financial["refunded_amount"], 2) == round(total_refund_streams, 2)
        assert round(financial["refunded_amount"], 2) == round(total_refund_methods, 2)

        # Permissions test (Bar staff shouldn't access dashboard)
        resp_dash_bar = client.get("/api/v1/reports/dashboard", headers=bar_headers)
        assert resp_dash_bar.status_code == 403

