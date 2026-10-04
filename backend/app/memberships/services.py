import calendar
from datetime import date, timedelta
from typing import List, Optional, Tuple, Dict, Any
from dateutil.relativedelta import relativedelta
from backend.app.memberships.models import (
    MembershipPlan,
    Membership,
    MembershipStatus,
    MembershipRequest,
    MembershipRequestStatus,
)
from backend.app.members.models import Member
from backend.app.auth.models import User
from backend.app.common.utils import utc_now
from backend.app.common.errors import (
    NotFoundException,
    ValidationException,
    ConflictException,
    ForbiddenException,
)
from backend.app.extensions import db


def add_months(d: date, months: int) -> date:
    """Add a specified number of months to a date."""
    return d + relativedelta(months=months)


# ---------------------------------------------------------
# Seed Membership Plans
# ---------------------------------------------------------

SEED_PLANS = [
    {
        "code": "SILVER",
        "name": "Silver Tier",
        "description": "Standard club membership with court access, swimming pool, and shop discounts.",
        "displayed_monthly_price": 2799.00,
        "billing_frequency": "ANNUALLY",
        "duration_months": 12,
        "complimentary_months": 2,
        "benefits": {
            "tier_level": 1,
            "courts_count": 14,
            "court_types": ["Hard", "Clay"],
            "courts_access": "Access to all 14 Hard & Clay Tennis courts (Off-Peak & Standard)",
            "reservation_window_days": 3,
            "shop_discount_pct": 10,
            "social_play_included": True,
            "pool_clubhouse_access": True,
            "digital_card_charging_tab": True,
            "features": [
                "Access to all 14 Hard & Clay Tennis courts (Off-Peak & Standard)",
                "Standard 3-day advance court reservation window",
                "10% member discount across Pro Shop equipment & apparel",
                "Friday Social-Play mixer pass & round-robin ladder entry",
                "Access to Olympic swimming pool & clubhouse lounge",
                "Digital member card & unified charging tab",
            ],
        },
    },
    {
        "code": "GOLD",
        "name": "Gold Champion",
        "description": "Premium all-access club membership with grass courts, VIP perks, coaching, and guest passes.",
        "displayed_monthly_price": 4799.00,
        "billing_frequency": "ANNUALLY",
        "duration_months": 12,
        "complimentary_months": 2,
        "benefits": {
            "tier_level": 2,
            "courts_count": 22,
            "court_types": ["Hard", "Clay", "Grass"],
            "courts_access": "Unlimited priority access to all 22+ courts including Grass Lawns",
            "reservation_window_days": 7,
            "shop_discount_pct": 20,
            "monthly_coaching_sessions": 2,
            "monthly_guest_passes": 4,
            "locker_steam_spa_access": True,
            "vip_lounge_bar_priority": True,
            "features": [
                "Unlimited priority access to all 22+ courts including Grass Lawns",
                "7-day advance peak-hour slot reservation window",
                "20% member discount on Pro Shop apparel, strings & gear",
                "2x monthly complimentary private coaching sessions with pro coaches",
                "4 free monthly guest passes with full clubhouse & pool privileges",
                "Executive locker suite, steam, sauna, and hot jacuzzi access",
                "VIP priority table reservations at the Champions Lounge & Bar",
            ],
        },
    },
    {
        "code": "JUNIOR",
        "name": "Junior Academy",
        "description": "Youth membership for players under 18 with dedicated training clinics, coaching, and tournaments.",
        "displayed_monthly_price": 1999.00,
        "billing_frequency": "ANNUALLY",
        "duration_months": 12,
        "complimentary_months": 2,
        "benefits": {
            "tier_level": 1,
            "min_age": 6,
            "max_age": 17,
            "age_bracket": "Ages 6–18 / under 18",
            "youth_training_allocation": True,
            "monthly_academy_clinics": 4,
            "shop_discount_pct": 15,
            "junior_tournaments": True,
            "swim_safety_training": True,
            "fitness_tracking": True,
            "features": [
                "Ages 6–18 / under 18",
                "Dedicated afternoon and weekend youth training court allocation",
                "4x monthly structured group academy clinics with certified coaches",
                "15% discount on junior racket stringing, balls & footwear",
                "Junior tournament & ranking ladder participation",
                "Olympic pool swim safety & stroke training sessions",
                "Comprehensive athletic progress and fitness tracking",
            ],
        },
    },
]


def seed_membership_plans() -> List[MembershipPlan]:
    """Idempotently seed the three standard membership plans."""
    seeded = []
    for data in SEED_PLANS:
        plan = MembershipPlan.query.filter_by(code=data["code"]).first()
        if plan is None:
            plan = MembershipPlan(
                code=data["code"],
                name=data["name"],
                description=data["description"],
                displayed_monthly_price=data["displayed_monthly_price"],
                billing_frequency=data["billing_frequency"],
                duration_months=data["duration_months"],
                complimentary_months=data["complimentary_months"],
                benefits=data["benefits"],
                is_active=True,
            )
            db.session.add(plan)
        else:
            plan.name = data["name"]
            plan.description = data["description"]
            plan.displayed_monthly_price = data["displayed_monthly_price"]
            plan.billing_frequency = data["billing_frequency"]
            plan.duration_months = data["duration_months"]
            plan.complimentary_months = data["complimentary_months"]
            plan.benefits = data["benefits"]
            plan.is_active = True
        seeded.append(plan)

    db.session.commit()
    return seeded


# ---------------------------------------------------------
# Membership Plan Queries
# ---------------------------------------------------------

def get_all_plans(active_only: bool = True) -> List[MembershipPlan]:
    """Retrieve list of membership plans."""
    query = MembershipPlan.query
    if active_only:
        query = query.filter_by(is_active=True)
    return query.order_by(MembershipPlan.displayed_monthly_price.asc()).all()


def get_plan_by_id(plan_id: int) -> Optional[MembershipPlan]:
    """Retrieve membership plan by ID."""
    return db.session.get(MembershipPlan, plan_id)


def get_plan_by_code(code: str) -> Optional[MembershipPlan]:
    """Retrieve membership plan by uppercase unique code."""
    if not code:
        return None
    return MembershipPlan.query.filter_by(code=code.upper().strip()).first()


# ---------------------------------------------------------
# Reusable Service Functions for Memberships
# ---------------------------------------------------------

def get_active_membership(
    member_id: int, as_of_date: Optional[date] = None
) -> Optional[Membership]:
    """Retrieve active membership for a member at a given date."""
    target_date = as_of_date or date.today()
    return (
        Membership.query.filter(
            Membership.member_id == member_id,
            Membership.start_date <= target_date,
            Membership.end_date >= target_date,
            Membership.status.in_([
                MembershipStatus.ACTIVE,
                MembershipStatus.UPGRADED,
                MembershipStatus.DOWNGRADED,
            ]),
        )
        .order_by(Membership.start_date.desc())
        .first()
    )


def is_membership_active(
    membership_id: int, as_of_date: Optional[date] = None
) -> bool:
    """Determine whether a specific membership is active at a given date."""
    membership = db.session.get(Membership, membership_id)
    if not membership:
        return False
    return membership.is_active_on(as_of_date or date.today())


def get_member_benefits(
    member_id: int, as_of_date: Optional[date] = None
) -> Optional[Dict[str, Any]]:
    """Retrieve the plan benefits applicable to a member at a given date.

    Returns None if the member does not have an active membership on that date.
    """
    active_ms = get_active_membership(member_id, as_of_date)
    if not active_ms or not active_ms.plan:
        return None
    return active_ms.plan.benefits


def get_membership_history(member_id: int) -> List[Membership]:
    """Retrieve full chronological membership history for a member."""
    return (
        Membership.query.filter_by(member_id=member_id)
        .order_by(Membership.start_date.desc())
        .all()
    )


# ---------------------------------------------------------
# Membership Assignment and Plan Change Workflows
# ---------------------------------------------------------

def _validate_junior_age(member: Member, start_date: date) -> None:
    """Enforce server-side Junior membership age restriction (< 18)."""
    if not member.date_of_birth:
        raise ValidationException(
            message="Date of birth is required on member profile to assign Junior Academy membership.",
            details={"date_of_birth": ["Missing date of birth"]},
        )

    age = member.calculate_age(start_date)
    if age is None or age >= 18:
        raise ValidationException(
            message=f"Junior Academy membership is only available to members under 18 years old (member age is {age}).",
            details={"date_of_birth": [f"Member is {age} years old on start date {start_date}. Must be under 18."]},
        )
    if age < 6:
        raise ValidationException(
            message=f"Junior Academy membership requires a minimum age of 6 years (member age is {age}).",
            details={"date_of_birth": [f"Member is {age} years old on start date {start_date}. Must be at least 6."]},
        )


def assign_membership(
    member_id: int,
    plan_id: int,
    start_date: date,
    duration_months: Optional[int] = None,
    price_paid: Optional[float] = None,
    notes: Optional[str] = None,
) -> Membership:
    """Assign a membership plan to a member."""
    member = db.session.get(Member, member_id)
    if not member:
        raise NotFoundException(f"Member with ID {member_id} not found.")

    plan = db.session.get(MembershipPlan, plan_id)
    if not plan or not plan.is_active:
        raise NotFoundException(f"Membership plan with ID {plan_id} not found or inactive.")

    # Junior age validation
    if plan.code == "JUNIOR":
        _validate_junior_age(member, start_date)

    # Compute end date (inclusive)
    dur = duration_months or plan.duration_months
    if dur < 1:
        raise ValidationException("Membership duration must be at least 1 month.")

    end_date = add_months(start_date, dur) - timedelta(days=1)

    # Check for overlapping active memberships
    overlapping = (
        Membership.query.filter(
            Membership.member_id == member_id,
            Membership.status.in_([MembershipStatus.ACTIVE]),
            Membership.start_date <= end_date,
            Membership.end_date >= start_date,
        )
        .first()
    )
    if overlapping:
        raise ConflictException(
            message=f"Member already has an active membership ({overlapping.plan.name}: {overlapping.start_date} to {overlapping.end_date}) overlapping with this period.",
            details={"overlapping_membership_id": overlapping.id},
        )

    membership = Membership(
        member_id=member_id,
        plan_id=plan_id,
        start_date=start_date,
        end_date=end_date,
        status=MembershipStatus.ACTIVE,
        price_paid=price_paid if price_paid is not None else plan.effective_annual_price,
        notes=notes,
    )

    db.session.add(membership)
    db.session.commit()
    return membership


def change_membership_plan(
    member_id: int,
    new_plan_id: int,
    effective_date: date,
    price_paid: Optional[float] = None,
    notes: Optional[str] = None,
) -> Tuple[Membership, Optional[Membership]]:
    """Change a member's plan while preserving historical records."""
    member = db.session.get(Member, member_id)
    if not member:
        raise NotFoundException(f"Member with ID {member_id} not found.")

    new_plan = db.session.get(MembershipPlan, new_plan_id)
    if not new_plan or not new_plan.is_active:
        raise NotFoundException(f"Membership plan with ID {new_plan_id} not found or inactive.")

    # Junior age validation
    if new_plan.code == "JUNIOR":
        _validate_junior_age(member, effective_date)

    # Find currently active membership (if any)
    current_ms = get_active_membership(member_id, effective_date)

    if current_ms:
        if effective_date < current_ms.start_date:
            raise ValidationException(
                f"Effective date ({effective_date}) cannot be prior to start of current membership ({current_ms.start_date})."
            )

        # Close current membership on the day before effective_date
        closed_end_date = effective_date - timedelta(days=1)
        if closed_end_date < current_ms.start_date:
            # If changing on the very first day, align end_date to start_date
            current_ms.end_date = current_ms.start_date
        else:
            current_ms.end_date = closed_end_date

        # Determine upgrade vs downgrade
        old_price = float(current_ms.plan.displayed_monthly_price)
        new_price = float(new_plan.displayed_monthly_price)
        if new_price > old_price:
            current_ms.status = MembershipStatus.UPGRADED
        elif new_price < old_price:
            current_ms.status = MembershipStatus.DOWNGRADED
        else:
            current_ms.status = MembershipStatus.ACTIVE

    # Create new membership starting on effective_date
    new_end_date = add_months(effective_date, new_plan.duration_months) - timedelta(days=1)

    new_membership = Membership(
        member_id=member_id,
        plan_id=new_plan_id,
        start_date=effective_date,
        end_date=new_end_date,
        status=MembershipStatus.ACTIVE,
        price_paid=price_paid if price_paid is not None else new_plan.effective_annual_price,
        notes=f"Plan changed to {new_plan.name}. " + (notes or ""),
    )

    db.session.add(new_membership)
    db.session.commit()
    return new_membership, current_ms


# ---------------------------------------------------------
# Membership Requests & Offline Payment Review Services
# ---------------------------------------------------------

def create_membership_request(
    user_id: int,
    plan_id: int,
    transaction_reference: str,
    amount_paid: float,
    screenshot_url: Optional[str] = None,
    payment_method: str = "UPI_QR",
    requester_notes: Optional[str] = None,
) -> MembershipRequest:
    """Create a new manual membership request with proof in PENDING status."""
    plan = get_plan_by_id(plan_id)
    if not plan:
        raise NotFoundException(f"Membership plan with ID {plan_id} not found.")

    member = Member.query.filter_by(user_id=user_id).first()
    member_id = member.id if member else None

    # Check for existing pending request with exact same transaction reference
    existing_ref = MembershipRequest.query.filter_by(
        transaction_reference=transaction_reference.strip()
    ).first()
    if existing_ref:
        raise ConflictException(
            f"A membership request with transaction reference '{transaction_reference}' already exists."
        )

    req = MembershipRequest(
        user_id=user_id,
        member_id=member_id,
        plan_id=plan_id,
        status=MembershipRequestStatus.PENDING,
        payment_method=payment_method,
        transaction_reference=transaction_reference.strip(),
        screenshot_url=screenshot_url,
        amount_paid=amount_paid,
        requester_notes=requester_notes,
    )
    db.session.add(req)
    db.session.commit()
    return req


def list_membership_requests(
    user_id: Optional[int] = None,
    status_filter: Optional[str] = None,
    search: Optional[str] = None,
    page: int = 1,
    per_page: int = 50,
) -> Tuple[List[MembershipRequest], int]:
    """List membership requests. If user_id is provided, filters to that user's own requests."""
    query = MembershipRequest.query

    if user_id is not None:
        query = query.filter(MembershipRequest.user_id == user_id)

    if status_filter:
        try:
            status_enum = MembershipRequestStatus(status_filter.upper())
            query = query.filter(MembershipRequest.status == status_enum)
        except ValueError:
            pass

    if search:
        s = f"%{search.strip().lower()}%"
        query = query.join(MembershipRequest.user).filter(
            db.or_(
                db.func.lower(MembershipRequest.transaction_reference).like(s),
                db.func.lower(User.email).like(s),
                db.func.lower(User.first_name).like(s),
                db.func.lower(User.last_name).like(s),
            )
        )

    query = query.order_by(MembershipRequest.created_at.desc())
    pagination = query.paginate(page=page, per_page=per_page, error_out=False)
    return pagination.items, pagination.total


def get_membership_request_by_id(request_id: int) -> Optional[MembershipRequest]:
    """Retrieve membership request by ID."""
    return db.session.get(MembershipRequest, request_id)


def approve_membership_request(
    request_id: int,
    reviewer_user: User,
    review_notes: Optional[str] = None,
) -> Tuple[MembershipRequest, Membership]:
    """Approve a membership request, provision Member record if needed, and activate membership subscription."""
    req = get_membership_request_by_id(request_id)
    if not req:
        raise NotFoundException(f"Membership request with ID {request_id} not found.")

    if req.status != MembershipRequestStatus.PENDING:
        raise ConflictException(f"Cannot approve a request that is already {req.status.value}.")

    # Ensure member record exists for this user
    from backend.app.members.services import create_member, get_member_by_user_id
    member = get_member_by_user_id(req.user_id)
    if not member:
        member = create_member(user_id=req.user_id)

    req.member_id = member.id

    # Create active membership starting today
    today = date.today()
    plan = req.plan
    duration = plan.duration_months if plan else 12
    end_date = add_months(today, duration) - timedelta(days=1)

    membership = Membership(
        member_id=member.id,
        plan_id=req.plan_id,
        start_date=today,
        end_date=end_date,
        status=MembershipStatus.ACTIVE,
        price_paid=float(req.amount_paid),
        notes=f"Approved via offline payment review. Ref: {req.transaction_reference}. " + (review_notes or ""),
    )
    db.session.add(membership)

    # Update request status
    req.status = MembershipRequestStatus.APPROVED
    req.reviewed_by_id = reviewer_user.id
    req.review_notes = review_notes
    req.reviewed_at = utc_now()

    db.session.commit()
    return req, membership


def reject_membership_request(
    request_id: int,
    reviewer_user: User,
    review_notes: Optional[str] = None,
) -> MembershipRequest:
    """Reject a membership request with a reason without activating membership."""
    req = get_membership_request_by_id(request_id)
    if not req:
        raise NotFoundException(f"Membership request with ID {request_id} not found.")

    if req.status != MembershipRequestStatus.PENDING:
        raise ConflictException(f"Cannot reject a request that is already {req.status.value}.")

    req.status = MembershipRequestStatus.REJECTED
    req.reviewed_by_id = reviewer_user.id
    req.review_notes = review_notes
    req.reviewed_at = utc_now()

    db.session.commit()
    return req


def update_membership_plan(
    plan_id: int,
    displayed_monthly_price: Optional[float] = None,
    features: Optional[List[str]] = None,
    name: Optional[str] = None,
    description: Optional[str] = None,
    duration_months: Optional[int] = None,
    complimentary_months: Optional[int] = None,
) -> MembershipPlan:
    """
    Update a membership plan's monthly pricing, benefits features, and configuration.
    Strictly persists to the database and flags JSON attributes as modified.
    """
    from sqlalchemy.orm.attributes import flag_modified

    plan = db.session.get(MembershipPlan, plan_id)
    if not plan:
        raise NotFoundException(f"Membership plan with ID {plan_id} not found.")

    if displayed_monthly_price is not None:
        try:
            val = float(displayed_monthly_price)
            if val < 0:
                raise ValidationException("Membership price cannot be negative.")
            plan.displayed_monthly_price = round(val, 2)
        except (ValueError, TypeError):
            raise ValidationException("Invalid price value provided.")

    if features is not None:
        current_benefits = dict(plan.benefits or {})
        cleaned_features = [str(f).strip() for f in features if str(f).strip()]
        current_benefits["features"] = cleaned_features
        plan.benefits = current_benefits
        flag_modified(plan, "benefits")

    if name is not None and name.strip():
        plan.name = name.strip()

    if description is not None:
        plan.description = description.strip()

    if duration_months is not None and duration_months > 0:
        plan.duration_months = int(duration_months)

    if complimentary_months is not None and complimentary_months >= 0:
        plan.complimentary_months = int(complimentary_months)

    plan.updated_at = utc_now()
    db.session.commit()
    return plan

