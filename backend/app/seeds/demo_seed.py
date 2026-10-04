"""Demo seed data generator for Champions Club (Developer A Scope).

Covers:
- Users for all 7 system roles
- Member profiles
- Membership plans and assignments (Gold, Silver, Junior, expired, expiring soon, upgraded history)
- Courts across all 6 finalized sports
- Bookings (past 30 days, today at daily limit, Friday social play, cancellations, upcoming week)
- Payments (CASH, UPI, ONLINE verified, and Refunds)
"""

import os
from datetime import date, datetime, timedelta
from typing import Dict, Any, List
from decimal import Decimal

from flask import current_app
from backend.app.extensions import db
from backend.app.common.permissions import RoleEnum
from backend.app.auth.models import User
from backend.app.auth.services import create_user, get_user_by_email
from backend.app.members.models import Member
from backend.app.members.services import create_member, get_member_by_user_id
from backend.app.memberships.models import MembershipPlan, Membership, MembershipStatus
from backend.app.memberships.services import (
    seed_membership_plans,
    assign_membership,
    change_membership_plan,
)
from backend.app.courts.models import Court, SportType, CourtStatus
from backend.app.courts.services import create_court, get_court_by_id, get_all_courts
from backend.app.bookings.models import Booking, BookingStatus, CourtOccupancy
from backend.app.bookings.services import create_booking, cancel_booking
from backend.app.payments.models import (
    Payment,
    PaymentStatus,
    PaymentMethod,
    PaymentItemType,
)
from backend.app.payments.services import (
    create_or_initiate_payment,
    confirm_manual_payment,
    verify_online_payment,
    refund_payment,
)
from backend.app.payments.providers import FakePaymentProvider, set_payment_provider


DEMO_PASSWORD = os.getenv("DEMO_SEED_PASSWORD", "ChampionsDemo2026!")


def seed_core_demo() -> Dict[str, Any]:
    """Execute idempotent seed for core operations and platform demo data."""
    summary = {
        "plans": 0,
        "courts": 0,
        "users": 0,
        "members": 0,
        "memberships": 0,
        "bookings": 0,
        "payments": 0,
    }

    # Ensure fake payment provider is configured during seeding for offline/demo operation
    fake_prov = FakePaymentProvider(
        key_id="rzp_test_demo_seed_key",
        key_secret="demo_seed_secret_key_12345",
        webhook_secret="demo_seed_webhook_secret_12345",
    )
    set_payment_provider(fake_prov)

    # -----------------------------------------------------------------
    # 1. Membership Plans
    # -----------------------------------------------------------------
    plans = seed_membership_plans()
    summary["plans"] = len(plans)
    gold_plan = next((p for p in plans if p.code == "GOLD"), None)
    silver_plan = next((p for p in plans if p.code == "SILVER"), None)
    junior_plan = next((p for p in plans if p.code == "JUNIOR"), None)

    # -----------------------------------------------------------------
    # 2. Courts (All 6 finalized sports)
    # -----------------------------------------------------------------
    courts_data = [
        # Lawn Tennis
        {
            "name": "Centre Court (Grass)",
            "sport_type": SportType.LAWN_TENNIS,
            "surface_type": "Natural Grass",
            "is_indoor": False,
            "features": {"floodlights": True, "scoreboard": True, "stands_capacity": 500},
            "description": "Championship grass court for tournament and exhibition matches.",
        },
        {
            "name": "Grandstand Court 1 (Hard)",
            "sport_type": SportType.LAWN_TENNIS,
            "surface_type": "Acrylic Hardcourt",
            "is_indoor": True,
            "features": {"air_conditioned": True, "floodlights": True},
            "description": "Indoor plexicushion hardcourt with climate control.",
        },
        {
            "name": "Clay Court 1 (Red Clay)",
            "sport_type": SportType.LAWN_TENNIS,
            "surface_type": "European Red Clay",
            "is_indoor": False,
            "features": {"floodlights": True, "sprinklers": True},
            "description": "Authentic Roland-Garros style red clay court.",
        },
        # Swimming Pool
        {
            "name": "Olympic Swimming Pool",
            "sport_type": SportType.SWIMMING_POOL,
            "surface_type": "Ceramic Mosaic Tile",
            "is_indoor": True,
            "features": {"lane_count": 8, "heated": True, "depth_meters": 2.2, "timing_touchpads": True},
            "description": "50m FINA-standard heated 8-lane racing pool.",
        },
        {
            "name": "Aquatics Warm-up Pool",
            "sport_type": SportType.SWIMMING_POOL,
            "surface_type": "Non-slip Quartz",
            "is_indoor": False,
            "features": {"depth_meters": 1.2, "jacuzzi_jets": True},
            "description": "25m recovery and warm-up pool.",
        },
        # Badminton
        {
            "name": "Badminton Arena Court 1",
            "sport_type": SportType.BADMINTON,
            "surface_type": "BWF Teak Wood & Mat",
            "is_indoor": True,
            "features": {"mat_brand": "Yonex Pro", "led_lighting": True},
            "description": "BWF Grade-1 tournament badminton court with cushioned shock absorption.",
        },
        {
            "name": "Badminton Arena Court 2",
            "sport_type": SportType.BADMINTON,
            "surface_type": "BWF Synthetic Vinyl",
            "is_indoor": True,
            "features": {"mat_brand": "Li-Ning", "led_lighting": True},
            "description": "High-grip synthetic vinyl court.",
        },
        {
            "name": "Badminton Arena Court 3",
            "sport_type": SportType.BADMINTON,
            "surface_type": "BWF Synthetic Vinyl",
            "is_indoor": True,
            "features": {"mat_brand": "Victor", "led_lighting": True},
            "description": "Training and practice badminton court.",
        },
        # Box Cricket
        {
            "name": "Box Cricket Arena 1 (Turf Pitch)",
            "sport_type": SportType.BOX_CRICKET,
            "surface_type": "AstroTurf Pro",
            "is_indoor": True,
            "features": {"netting": "Heavy-duty nylon", "floodlights": True, "bowling_machine": True},
            "description": "Full-size enclosed box cricket turf with electronic bowling machine.",
        },
        {
            "name": "Box Cricket Pitch 2 (Practice Net)",
            "sport_type": SportType.BOX_CRICKET,
            "surface_type": "Synthetic Turf",
            "is_indoor": False,
            "features": {"floodlights": True},
            "description": "Outdoor floodlit practice nets for evening squad training.",
        },
        # Table Tennis
        {
            "name": "Table Tennis Studio 1",
            "sport_type": SportType.TABLE_TENNIS,
            "surface_type": "ITTF Taraflex Floor",
            "is_indoor": True,
            "features": {"table_brand": "Stiga Premium 30mm", "robot_feeder": True},
            "description": "Professional ITTF competition room with automated multi-ball feeder.",
        },
        {
            "name": "Table Tennis Studio 2",
            "sport_type": SportType.TABLE_TENNIS,
            "surface_type": "ITTF Taraflex Floor",
            "is_indoor": True,
            "features": {"table_brand": "Butterfly Centrefold 25"},
            "description": "Dedicated match arena for club singles ladder.",
        },
        # Volleyball
        {
            "name": "Volleyball Arena 1 (Indoor Taraflex)",
            "sport_type": SportType.VOLLEYBALL,
            "surface_type": "FIVB Taraflex Polyurethane",
            "is_indoor": True,
            "features": {"fivb_net": True, "electronic_scoreboard": True},
            "description": "FIVB certified indoor volleyball stadium.",
        },
        {
            "name": "Beach Volleyball Pit 1",
            "sport_type": SportType.VOLLEYBALL,
            "surface_type": "Fine Silica Sand",
            "is_indoor": False,
            "features": {"floodlights": True, "shower_station": True},
            "description": "Outdoor regulation beach volleyball court with fine white sand.",
        },
    ]

    seeded_courts = {}
    for c_info in courts_data:
        existing = Court.query.filter_by(name=c_info["name"]).first()
        if not existing:
            created = create_court(
                name=c_info["name"],
                sport_type=c_info["sport_type"],
                surface_type=c_info["surface_type"],
                is_indoor=c_info["is_indoor"],
                features=c_info["features"],
                description=c_info["description"],
                status=CourtStatus.ACTIVE,
            )
            seeded_courts[c_info["name"]] = created
        else:
            seeded_courts[c_info["name"]] = existing

    summary["courts"] = len(seeded_courts)
    centre_court = seeded_courts.get("Centre Court (Grass)")
    pool_court = seeded_courts.get("Olympic Swimming Pool")
    badminton_1 = seeded_courts.get("Badminton Arena Court 1")
    cricket_1 = seeded_courts.get("Box Cricket Arena 1 (Turf Pitch)")
    tt_1 = seeded_courts.get("Table Tennis Studio 1")
    vb_1 = seeded_courts.get("Volleyball Arena 1 (Indoor Taraflex)")

    # -----------------------------------------------------------------
    # 3. Staff & Role Users (Idempotent)
    # -----------------------------------------------------------------
    staff_definitions = [
        {
            "email": "owner@championsclub.example.com",
            "first_name": "Viktor",
            "last_name": "Vance",
            "role": RoleEnum.OWNER,
            "department": "Executive",
        },
        {
            "email": "admin@championsclub.example.com",
            "first_name": "Diana",
            "last_name": "Prince",
            "role": RoleEnum.ADMIN,
            "department": "Operations",
        },
        {
            "email": "frontdesk@championsclub.example.com",
            "first_name": "Felix",
            "last_name": "Ramos",
            "role": RoleEnum.FRONT_DESK,
            "department": "Reception",
        },
        {
            "email": "shop@championsclub.example.com",
            "first_name": "Serena",
            "last_name": "Watts",
            "role": RoleEnum.SHOP_STAFF,
            "department": "Pro Shop",
        },
        {
            "email": "bar@championsclub.example.com",
            "first_name": "Barry",
            "last_name": "Allen",
            "role": RoleEnum.BAR_STAFF,
            "department": "Champions Lounge",
        },
        {
            "email": "coach.tennis@championsclub.example.com",
            "first_name": "Carlos",
            "last_name": "Moya",
            "role": RoleEnum.COACH,
            "department": "LAWN_TENNIS",
        },
        {
            "email": "coach.badminton@championsclub.example.com",
            "first_name": "Lin",
            "last_name": "Dan",
            "role": RoleEnum.COACH,
            "department": "BADMINTON",
        },
        {
            "email": "pushplamba104@gmail.com",
            "first_name": "Pushp",
            "last_name": "Lamba",
            "role": RoleEnum.OWNER,
            "department": "Executive",
            "password": "Owner@12345",
        },
        {
            "email": "admin@championsclub.in",
            "first_name": "Priya",
            "last_name": "Admin",
            "role": RoleEnum.ADMIN,
            "department": "Operations",
            "password": "Admin@12345",
        },
        {
            "email": "coach@championsclub.in",
            "first_name": "David",
            "last_name": "Warner",
            "role": RoleEnum.COACH,
            "department": "LAWN_TENNIS",
            "password": "Coach@12345",
        },
    ]

    staff_users = {}
    for s in staff_definitions:
        u = get_user_by_email(s["email"])
        if not u:
            u = create_user(
                email=s["email"],
                password=s.get("password", DEMO_PASSWORD),
                first_name=s["first_name"],
                last_name=s["last_name"],
                role=s["role"],
                department=s["department"],
            )
        staff_users[s["role"].value] = u
        summary["users"] += 1

    admin_user = staff_users["ADMIN"]
    front_desk_user = staff_users["FRONT_DESK"]

    # -----------------------------------------------------------------
    # 4. Member Accounts & Profiles (Idempotent)
    # -----------------------------------------------------------------
    today = date.today()

    member_definitions = [
        # Gold Champion Member
        {
            "email": "gold.member@championsclub.example.com",
            "first_name": "Rohan",
            "last_name": "Bopanna",
            "phone": "+91 98765 43210",
            "dob": today - timedelta(days=365 * 34),
            "gender": "MALE",
            "address": "101 Palm Grove, Indiranagar, Bengaluru",
            "plan_code": "GOLD",
            "start_date": today - timedelta(days=90),
            "duration_months": 12,
            "price_paid": 50000.00,
        },
        # Silver Tier Member
        {
            "email": "silver.member@championsclub.example.com",
            "first_name": "Priya",
            "last_name": "Sharma",
            "phone": "+91 98765 43211",
            "dob": today - timedelta(days=365 * 28),
            "gender": "FEMALE",
            "address": "402 Lavelle Road, Bengaluru",
            "plan_code": "SILVER",
            "start_date": today - timedelta(days=60),
            "duration_months": 12,
            "price_paid": 25000.00,
        },
        # Junior Academy Member (under 18)
        {
            "email": "junior.member@championsclub.example.com",
            "first_name": "Aryan",
            "last_name": "Verma",
            "phone": "+91 98765 43212",
            "dob": today - timedelta(days=365 * 14 + 40), # 14 years old
            "gender": "MALE",
            "address": "12 Richmond Town, Bengaluru",
            "plan_code": "JUNIOR",
            "start_date": today - timedelta(days=30),
            "duration_months": 12,
            "price_paid": 15000.00,
        },
        # Expiring Soon Member (Ends in 5 days)
        {
            "email": "expiring.member@championsclub.example.com",
            "first_name": "Neha",
            "last_name": "Kapoor",
            "phone": "+91 98765 43213",
            "dob": today - timedelta(days=365 * 31),
            "gender": "FEMALE",
            "address": "77 Koramangala 4th Block, Bengaluru",
            "plan_code": "SILVER",
            "start_date": today - timedelta(days=360),
            "duration_months": 12,
            "price_paid": 25000.00,
        },
        # Expired Member (Ended 30 days ago)
        {
            "email": "expired.member@championsclub.example.com",
            "first_name": "Rajesh",
            "last_name": "Khanna",
            "phone": "+91 98765 43214",
            "dob": today - timedelta(days=365 * 45),
            "gender": "MALE",
            "address": "88 Cunningham Road, Bengaluru",
            "plan_code": "GOLD",
            "start_date": today - timedelta(days=395),
            "duration_months": 12,
            "price_paid": 50000.00,
        },
        # Upgraded Member (Silver -> Gold History)
        {
            "email": "upgraded.member@championsclub.example.com",
            "first_name": "Siddharth",
            "last_name": "Roy",
            "phone": "+91 98765 43215",
            "dob": today - timedelta(days=365 * 30),
            "gender": "MALE",
            "address": "15 Sadashivanagar, Bengaluru",
            "plan_code": "SILVER",
            "start_date": today - timedelta(days=120),
            "duration_months": 12,
            "price_paid": 25000.00,
            "upgrade_to_gold": True,
        },
        # Active Player (At Daily Limit 2/2 today)
        {
            "email": "active.player@championsclub.example.com",
            "first_name": "Sania",
            "last_name": "Mirza",
            "phone": "+91 98765 43216",
            "dob": today - timedelta(days=365 * 32),
            "gender": "FEMALE",
            "address": "20 Jubilee Hills, Bengaluru Branch",
            "plan_code": "GOLD",
            "start_date": today - timedelta(days=45),
            "duration_months": 12,
            "price_paid": 50000.00,
        },
    ]

    seeded_members = {}
    for m_def in member_definitions:
        u = get_user_by_email(m_def["email"])
        if not u:
            u = create_user(
                email=m_def["email"],
                password=m_def.get("password", DEMO_PASSWORD),
                first_name=m_def["first_name"],
                last_name=m_def["last_name"],
                role=RoleEnum.MEMBER,
            )
        summary["users"] += 1

        m_profile = get_member_by_user_id(u.id)
        if not m_profile:
            m_profile = create_member(
                user_id=u.id,
                phone=m_def["phone"],
                date_of_birth=m_def["dob"],
                gender=m_def["gender"],
                address=m_def["address"],
                emergency_contact_name=f"Contact for {m_def['first_name']}",
                emergency_contact_phone="+91 98765 00000",
            )
        summary["members"] += 1
        seeded_members[m_def["email"]] = (u, m_profile)

        # Assign Membership Plan
        plan_target = gold_plan if m_def["plan_code"] == "GOLD" else (junior_plan if m_def["plan_code"] == "JUNIOR" else silver_plan)
        active_ms = m_profile.get_active_membership(m_def["start_date"] + timedelta(days=1))
        if not active_ms:
            assigned_price = float(plan_target.effective_annual_price)
            ms = assign_membership(
                member_id=m_profile.id,
                plan_id=plan_target.id,
                start_date=m_def["start_date"],
                duration_months=m_def["duration_months"],
                price_paid=assigned_price,
                notes=f"Initial subscription to {plan_target.name}",
            )
            if ms.end_date < today:
                ms.status = MembershipStatus.EXPIRED
                db.session.commit()
            summary["memberships"] += 1

            # Create payment record for membership
            existing_pay = Payment.query.filter_by(
                item_type=PaymentItemType.MEMBERSHIP,
                item_id=ms.id,
            ).first()
            if not existing_pay:
                p = create_or_initiate_payment(
                    item_type="MEMBERSHIP",
                    item_id=ms.id,
                    amount=float(ms.price_paid),
                    payment_method="ONLINE",
                    user_id=u.id,
                    member_id=m_profile.id,
                    notes=f"Annual membership fee for {plan_target.name}",
                )
                ord_id = p.gateway_order_id or f"order_seed_ms_{ms.id}"
                p_id = f"pay_seed_ms_{ms.id}"
                fake_prov.payments[p_id] = {
                    "id": p_id,
                    "order_id": ord_id,
                    "amount": int(round(float(p.amount) * 100)),
                    "currency": "INR",
                    "status": "captured",
                }
                sig = fake_prov.generate_signature(ord_id, p_id)
                verify_online_payment(
                    razorpay_order_id=ord_id,
                    razorpay_payment_id=p_id,
                    razorpay_signature=sig,
                    requesting_user=u,
                )
                summary["payments"] += 1

            # Handle plan upgrade if requested
            if m_def.get("upgrade_to_gold") and gold_plan:
                upgrade_date = today - timedelta(days=30)
                upgrade_price = round(float(gold_plan.effective_annual_price) - float(silver_plan.effective_annual_price), 2)
                new_ms, old_ms = change_membership_plan(
                    member_id=m_profile.id,
                    new_plan_id=gold_plan.id,
                    effective_date=upgrade_date,
                    price_paid=upgrade_price,
                    notes="Upgraded to Gold Champion for unrestricted court access",
                )
                summary["memberships"] += 1

                # Payment for upgrade differential
                up_pay = Payment.query.filter_by(
                    item_type=PaymentItemType.MEMBERSHIP,
                    item_id=new_ms.id,
                ).first()
                if not up_pay:
                    p2 = create_or_initiate_payment(
                        item_type="MEMBERSHIP",
                        item_id=new_ms.id,
                        amount=float(new_ms.price_paid),
                        payment_method="UPI",
                        user_id=u.id,
                        member_id=m_profile.id,
                        notes="Upgrade difference fee to Gold Champion",
                    )
                    confirm_manual_payment(
                        payment_id=p2.id,
                        staff_user=admin_user,
                        notes="UPI payment confirmed at front desk",
                    )
                    summary["payments"] += 1

    gold_user, gold_member = seeded_members["gold.member@championsclub.example.com"]
    silver_user, silver_member = seeded_members["silver.member@championsclub.example.com"]
    junior_user, junior_member = seeded_members["junior.member@championsclub.example.com"]
    active_player_user, active_player_member = seeded_members["active.player@championsclub.example.com"]

    # -----------------------------------------------------------------
    # 5. Bookings & Payments Seed
    # -----------------------------------------------------------------

    def seed_safe_booking(
        court: Court,
        booking_dt: datetime,
        user: User,
        member: Optional[Member] = None,
        is_walk_in: bool = False,
        is_social_play: bool = False,
        guest_name: Optional[str] = None,
        pay_method: str = "ONLINE",
        cancel: bool = False,
        cancel_reason: Optional[str] = None,
        refund: bool = False,
    ):
        """Helper to create booking, payment, and optional cancellation idempotently."""
        # Check if booking exists on this court at this exact start_time
        existing_b = Booking.query.filter_by(
            court_id=court.id,
            start_time=booking_dt,
        ).first()

        if existing_b:
            return existing_b

        b = create_booking(
            court_id=court.id,
            start_time=booking_dt,
            user_id=user.id,
            member_id=member.id if member else None,
            is_walk_in=is_walk_in,
            is_social_play=is_social_play,
            guest_name=guest_name,
            guest_phone="+91 98765 00000" if is_walk_in else None,
            guest_email="guest@example.com" if is_walk_in else None,
            notes="Seeded demo reservation",
        )
        summary["bookings"] += 1

        # Process payment if price > 0
        if b.final_price > 0:
            pay = create_or_initiate_payment(
                item_type="BOOKING",
                item_id=b.id,
                amount=b.final_price,
                payment_method=pay_method,
                user_id=user.id,
                member_id=member.id if member else None,
                notes=f"Payment for {court.name} reservation",
            )
            if pay_method == "ONLINE":
                bk_ord_id = pay.gateway_order_id or f"order_seed_bk_{b.id}"
                bk_pay_id = f"pay_seed_bk_{b.id}"
                fake_prov.payments[bk_pay_id] = {
                    "id": bk_pay_id,
                    "order_id": bk_ord_id,
                    "amount": int(round(float(pay.amount) * 100)),
                    "currency": "INR",
                    "status": "captured",
                }
                bk_sig = fake_prov.generate_signature(bk_ord_id, bk_pay_id)
                verify_online_payment(
                    razorpay_order_id=bk_ord_id,
                    razorpay_payment_id=bk_pay_id,
                    razorpay_signature=bk_sig,
                    requesting_user=user,
                )
            else:
                confirm_manual_payment(
                    payment_id=pay.id,
                    staff_user=front_desk_user,
                    notes="Counter collection confirmed",
                )
            summary["payments"] += 1

            if refund:
                refund_payment(
                    payment_id=pay.id,
                    requesting_user=admin_user,
                    reason="Customer requested court switch / rainout",
                )

        if cancel:
            cancel_booking(
                booking_id=b.id,
                reason=cancel_reason or "Personal scheduling conflict",
                requesting_user=user,
            )

        return b

    # A. Past Bookings (30 days ago to yesterday)
    # Week 1 past: Lawn Tennis & Pool
    past_10d = today - timedelta(days=10)
    seed_safe_booking(
        court=centre_court,
        booking_dt=datetime.combine(past_10d, datetime.min.time()).replace(hour=8, minute=0),
        user=gold_user,
        member=gold_member,
        pay_method="ONLINE",
    )
    seed_safe_booking(
        court=pool_court,
        booking_dt=datetime.combine(past_10d, datetime.min.time()).replace(hour=9, minute=30),
        user=silver_user,
        member=silver_member,
        pay_method="UPI",
    )

    # Past Badminton & Box Cricket
    past_5d = today - timedelta(days=5)
    seed_safe_booking(
        court=badminton_1,
        booking_dt=datetime.combine(past_5d, datetime.min.time()).replace(hour=17, minute=0),
        user=junior_user,
        member=junior_member,
        pay_method="CASH",
    )
    seed_safe_booking(
        court=cricket_1,
        booking_dt=datetime.combine(past_5d, datetime.min.time()).replace(hour=19, minute=0),
        user=front_desk_user,
        is_walk_in=True,
        guest_name="Vikram Seth",
        pay_method="CARD",
    )

    # Past Cancelled & Refunded booking
    past_3d = today - timedelta(days=3)
    seed_safe_booking(
        court=tt_1,
        booking_dt=datetime.combine(past_3d, datetime.min.time()).replace(hour=11, minute=0),
        user=silver_user,
        member=silver_member,
        pay_method="ONLINE",
        cancel=True,
        cancel_reason="Sudden work meeting conflict",
        refund=True,
    )

    # B. Past Friday Social Play Session
    # Find last Friday
    days_since_friday = (today.weekday() - 4) % 7
    if days_since_friday == 0:
        days_since_friday = 7
    last_friday = today - timedelta(days=days_since_friday)

    seed_safe_booking(
        court=centre_court,
        booking_dt=datetime.combine(last_friday, datetime.min.time()).replace(hour=19, minute=0),
        user=silver_user,
        member=silver_member,
        is_social_play=True,
        pay_method="ONLINE",
    )
    seed_safe_booking(
        court=centre_court,
        booking_dt=datetime.combine(last_friday, datetime.min.time()).replace(hour=20, minute=0),
        user=junior_user,
        member=junior_member,
        is_social_play=True,
        pay_method="UPI",
    )

    # C. Today's Bookings (Including member at Daily Limit 2/2)
    # Sania Mirza books 2 sessions on Tennis (10:00 and 16:00)
    seed_safe_booking(
        court=centre_court,
        booking_dt=datetime.combine(today, datetime.min.time()).replace(hour=10, minute=0),
        user=active_player_user,
        member=active_player_member,
        pay_method="ONLINE",
    )
    seed_safe_booking(
        court=centre_court,
        booking_dt=datetime.combine(today, datetime.min.time()).replace(hour=16, minute=0),
        user=active_player_user,
        member=active_player_member,
        pay_method="ONLINE",
    )

    # Other players today across sports
    seed_safe_booking(
        court=badminton_1,
        booking_dt=datetime.combine(today, datetime.min.time()).replace(hour=14, minute=30),
        user=silver_user,
        member=silver_member,
        pay_method="ONLINE",
    )
    seed_safe_booking(
        court=cricket_1,
        booking_dt=datetime.combine(today, datetime.min.time()).replace(hour=18, minute=0),
        user=front_desk_user,
        is_walk_in=True,
        guest_name="Corporate Tigers XI",
        pay_method="CASH",
    )
    seed_safe_booking(
        court=vb_1,
        booking_dt=datetime.combine(today, datetime.min.time()).replace(hour=19, minute=30),
        user=gold_user,
        member=gold_member,
        pay_method="ONLINE",
    )

    # D. Upcoming Bookings (Next 3 to 6 days)
    upcoming_2d = today + timedelta(days=2)
    seed_safe_booking(
        court=centre_court,
        booking_dt=datetime.combine(upcoming_2d, datetime.min.time()).replace(hour=7, minute=0),
        user=gold_user,
        member=gold_member,
        pay_method="ONLINE",
    )
    seed_safe_booking(
        court=pool_court,
        booking_dt=datetime.combine(upcoming_2d, datetime.min.time()).replace(hour=8, minute=30),
        user=junior_user,
        member=junior_member,
        pay_method="ONLINE",
    )

    upcoming_5d = today + timedelta(days=5)
    seed_safe_booking(
        court=badminton_1,
        booking_dt=datetime.combine(upcoming_5d, datetime.min.time()).replace(hour=15, minute=0),
        user=silver_user,
        member=silver_member,
        pay_method="UPI",
    )

    db.session.commit()
    return summary
