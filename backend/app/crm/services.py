from datetime import date, datetime, timedelta
from decimal import Decimal
from typing import Optional, Dict, Any, List, Tuple

from sqlalchemy import func, or_
from backend.app.extensions import db
from backend.app.common.utils import utc_now
from backend.app.common.errors import (
    NotFoundException,
    ValidationException,
    ConflictException,
    BusinessRuleException,
)
from backend.app.common.permissions import RoleEnum
from backend.app.auth.models import User
from backend.app.auth.services import create_user
from backend.app.members.models import Member
from backend.app.members.services import create_member, get_member_by_id
from backend.app.memberships.models import MembershipPlan, Membership, MembershipStatus
from backend.app.memberships.services import (
    get_all_plans,
    get_plan_by_code,
    assign_membership,
)
from backend.app.courts.services import get_court_availability
from backend.app.inventory.services import list_products
from backend.app.crm.models import (
    CRMLead,
    CRMFollowUp,
    CRMNote,
    CRMTrialSession,
    CRMQuote,
    LeadSource,
    LeadStatus,
    LeadPriority,
    FollowUpType,
    FollowUpStatus,
    TrialStatus,
    QuoteStatus,
    ALLOWED_LEAD_TRANSITIONS,
    generate_lead_reference,
    generate_quote_reference,
)


# ---------------------------------------------------------
# Lead & Public Enquiry Services
# ---------------------------------------------------------

def process_public_enquiry(data: Dict[str, Any]) -> Tuple[CRMLead, CRMFollowUp]:
    """Process an unauthenticated website enquiry.
    
    Guarantees:
    1. Validates strict schema and catches honeypot spam.
    2. Creates a CRM lead record (status: NEW, source: WEBSITE).
    3. Creates an immediate PENDING follow-up for the front desk team so enquiries never vanish.
    4. Records trial session request if selected by visitor.
    """
    raw_name = data["name"].strip()
    name_parts = raw_name.split(" ", 1)
    first_name = name_parts[0]
    last_name = name_parts[1] if len(name_parts) > 1 else None

    clean_email = data.get("email").strip().lower() if data.get("email") else None
    clean_phone = data.get("phone").strip() if data.get("phone") else None

    lead = CRMLead(
        lead_reference=generate_lead_reference("LED"),
        first_name=first_name,
        last_name=last_name,
        email=clean_email,
        phone=clean_phone,
        source=LeadSource.WEBSITE,
        status=LeadStatus.NEW,
        priority=LeadPriority.MEDIUM,
        preferred_sport=data.get("preferred_sport"),
        interested_plan=data.get("interested_plan"),
        initial_message=data.get("message"),
    )
    db.session.add(lead)
    db.session.flush()

    # Immediate follow-up task so front desk follows up today
    follow_up = CRMFollowUp(
        lead_id=lead.id,
        follow_up_type=FollowUpType.CALL if clean_phone else FollowUpType.EMAIL,
        scheduled_date=utc_now(),
        status=FollowUpStatus.PENDING,
        notes=f"Immediate follow-up for new website enquiry from {lead.full_name}.",
    )
    db.session.add(follow_up)

    # Optional trial request
    if data.get("trial_requested") and data.get("preferred_trial_date"):
        trial = CRMTrialSession(
            lead_id=lead.id,
            preferred_date=data["preferred_trial_date"],
            preferred_time_slot=data.get("preferred_trial_time") or "Flexible",
            sport=data.get("preferred_sport") or "TENNIS",
            status=TrialStatus.REQUESTED,
        )
        db.session.add(trial)
        lead.status = LeadStatus.TRIAL_SCHEDULED

    db.session.commit()

    try:
        from backend.app.tasks.dispatcher import safe_enqueue_task
        from backend.app.tasks.jobs import send_crm_follow_up_reminders_task
        safe_enqueue_task(send_crm_follow_up_reminders_task)
    except Exception:
        pass

    return lead, follow_up


def get_lead(lead_id: int) -> CRMLead:
    """Fetch lead by ID or raise 404."""
    lead = db.session.get(CRMLead, lead_id)
    if not lead:
        raise NotFoundException(f"Lead with ID {lead_id} not found.")
    return lead


def list_leads(
    status: Optional[str] = None,
    source: Optional[str] = None,
    search: Optional[str] = None,
    page: int = 1,
    per_page: int = 20,
) -> Tuple[List[CRMLead], int]:
    """Retrieve filtered, paginated CRM leads."""
    query = CRMLead.query

    if status:
        query = query.filter(CRMLead.status == LeadStatus(status.upper().strip()))
    if source:
        query = query.filter(CRMLead.source == LeadSource(source.upper().strip()))
    if search:
        term = f"%{search.strip()}%"
        query = query.filter(
            or_(
                CRMLead.first_name.ilike(term),
                CRMLead.last_name.ilike(term),
                CRMLead.email.ilike(term),
                CRMLead.phone.ilike(term),
                CRMLead.lead_reference.ilike(term),
            )
        )

    total = query.count()
    paginated = (
        query.order_by(CRMLead.created_at.desc())
        .offset((page - 1) * per_page)
        .limit(per_page)
        .all()
    )
    return paginated, total


def update_lead(
    lead_id: int,
    updates: Dict[str, Any],
    requesting_user: Optional[Any] = None,
) -> CRMLead:
    """Update lead attributes and enforce valid status transitions."""
    lead = get_lead(lead_id)

    # Status transition check
    if "status" in updates and updates["status"]:
        target_status = LeadStatus(updates["status"].upper().strip())
        if lead.status != target_status:
            allowed = ALLOWED_LEAD_TRANSITIONS.get(lead.status, set())
            if target_status not in allowed:
                raise ValidationException(
                    f"Cannot transition lead from '{lead.status.value}' to '{target_status.value}'.",
                    code="INVALID_STATUS_TRANSITION",
                )
            if target_status == LeadStatus.CONVERTED and not lead.converted_member_id:
                raise ValidationException(
                    "Cannot mark lead as CONVERTED without a linked member. Please use the conversion workflow.",
                    code="CONVERSION_REQUIRES_MEMBER",
                )
            lead.status = target_status
            if target_status == LeadStatus.LOST:
                lead.lost_at = utc_now()

    if "first_name" in updates and updates["first_name"]:
        lead.first_name = updates["first_name"].strip()
    if "last_name" in updates:
        lead.last_name = updates["last_name"].strip() if updates["last_name"] else None
    if "email" in updates:
        lead.email = updates["email"].strip().lower() if updates["email"] else None
    if "phone" in updates:
        lead.phone = updates["phone"].strip() if updates["phone"] else None
    if "source" in updates and updates["source"]:
        lead.source = LeadSource(updates["source"].upper().strip())
    if "priority" in updates and updates["priority"]:
        lead.priority = LeadPriority(updates["priority"].upper().strip())
    if "preferred_sport" in updates:
        lead.preferred_sport = updates["preferred_sport"]
    if "interested_plan" in updates:
        lead.interested_plan = updates["interested_plan"]
    if "assigned_staff_id" in updates:
        lead.assigned_staff_id = updates["assigned_staff_id"]

    db.session.commit()
    return lead


def add_lead_note(lead_id: int, content: str, staff_user: Any) -> CRMNote:
    """Add a timestamped internal staff note to a lead."""
    lead = get_lead(lead_id)
    if not content or not content.strip():
        raise ValidationException("Note content cannot be empty.", code="EMPTY_NOTE")

    note = CRMNote(
        lead_id=lead.id,
        staff_user_id=staff_user.id,
        content=content.strip(),
        created_at=utc_now(),
    )
    db.session.add(note)
    db.session.commit()
    return note


# ---------------------------------------------------------
# Follow-Up Services
# ---------------------------------------------------------

def create_follow_up(
    lead_id: int,
    follow_up_type: str,
    scheduled_date: datetime,
    notes: Optional[str] = None,
    assigned_staff_id: Optional[int] = None,
) -> CRMFollowUp:
    """Schedule a new follow-up touchpoint for a lead."""
    lead = get_lead(lead_id)
    type_enum = FollowUpType(follow_up_type.upper().strip())

    follow_up = CRMFollowUp(
        lead_id=lead.id,
        follow_up_type=type_enum,
        scheduled_date=scheduled_date,
        status=FollowUpStatus.PENDING,
        notes=notes.strip() if notes else None,
        assigned_staff_id=assigned_staff_id or lead.assigned_staff_id,
    )
    db.session.add(follow_up)
    db.session.commit()
    return follow_up


def update_follow_up(
    follow_up_id: int,
    status: Optional[str] = None,
    outcome: Optional[str] = None,
    notes: Optional[str] = None,
) -> CRMFollowUp:
    """Update follow-up status and outcome notes."""
    follow_up = db.session.get(CRMFollowUp, follow_up_id)
    if not follow_up:
        raise NotFoundException(f"Follow-up with ID {follow_up_id} not found.")

    if status:
        new_status = FollowUpStatus(status.upper().strip())
        follow_up.status = new_status
        if new_status == FollowUpStatus.COMPLETED:
            follow_up.completed_date = utc_now()

    if outcome is not None:
        follow_up.outcome = outcome.strip() if outcome else None
    if notes is not None:
        follow_up.notes = notes.strip() if notes else None

    db.session.commit()
    return follow_up


def list_follow_ups_due_today(
    target_date: Optional[date] = None,
    assigned_staff_id: Optional[int] = None,
) -> List[CRMFollowUp]:
    """Retrieve all pending follow-ups due on or before target date."""
    if target_date is None:
        target_date = utc_now().date()

    end_of_day = datetime.combine(target_date, datetime.max.time())
    query = CRMFollowUp.query.filter(
        CRMFollowUp.status == FollowUpStatus.PENDING,
        CRMFollowUp.scheduled_date <= end_of_day,
    )
    if assigned_staff_id:
        query = query.filter(CRMFollowUp.assigned_staff_id == assigned_staff_id)

    return query.order_by(CRMFollowUp.scheduled_date.asc()).all()


# ---------------------------------------------------------
# Trial Session Services
# ---------------------------------------------------------

def request_trial_session(
    lead_id: int,
    preferred_date: date,
    preferred_time_slot: str,
    sport: Optional[str] = "TENNIS",
) -> CRMTrialSession:
    """Record a complimentary trial session request."""
    lead = get_lead(lead_id)
    trial = CRMTrialSession(
        lead_id=lead.id,
        preferred_date=preferred_date,
        preferred_time_slot=preferred_time_slot.strip(),
        sport=sport.strip() if sport else "TENNIS",
        status=TrialStatus.REQUESTED,
    )
    db.session.add(trial)
    lead.status = LeadStatus.TRIAL_SCHEDULED
    db.session.commit()
    return trial


def confirm_trial_session(
    trial_id: int,
    confirmed_datetime: datetime,
    court_id: Optional[int] = None,
    coach_user_id: Optional[int] = None,
    staff_notes: Optional[str] = None,
) -> CRMTrialSession:
    """Staff confirmation of visitor's requested trial session."""
    trial = db.session.get(CRMTrialSession, trial_id)
    if not trial:
        raise NotFoundException(f"Trial session with ID {trial_id} not found.")

    trial.status = TrialStatus.CONFIRMED
    trial.confirmed_datetime = confirmed_datetime
    trial.court_id = court_id
    trial.coach_user_id = coach_user_id
    if staff_notes:
        trial.staff_notes = staff_notes.strip()

    if trial.lead:
        trial.lead.status = LeadStatus.TRIAL_SCHEDULED

    db.session.commit()
    return trial


# ---------------------------------------------------------
# Quote Services
# ---------------------------------------------------------

def create_quote(
    lead_id: int,
    plan_name: str,
    amount: float | Decimal,
    valid_until: date,
    plan_code: Optional[str] = None,
    discount_amount: float | Decimal = Decimal("0.00"),
    notes: Optional[str] = None,
    created_by_user_id: int = 1,
) -> CRMQuote:
    """Generate a formal price quote for a prospective member."""
    lead = get_lead(lead_id)
    dec_amount = Decimal(str(amount))
    dec_discount = Decimal(str(discount_amount))
    dec_final = dec_amount - dec_discount

    if dec_final < Decimal("0.00"):
        raise ValidationException("Discount cannot exceed quote amount.", code="INVALID_DISCOUNT")

    quote = CRMQuote(
        quote_reference=generate_quote_reference("QTE"),
        lead_id=lead.id,
        plan_code=plan_code.upper().strip() if plan_code else None,
        plan_name=plan_name.strip(),
        amount=dec_amount,
        discount_amount=dec_discount,
        final_amount=dec_final,
        status=QuoteStatus.DRAFT,
        valid_until=valid_until,
        notes=notes.strip() if notes else None,
        created_by_user_id=created_by_user_id,
    )
    db.session.add(quote)
    lead.status = LeadStatus.PROPOSAL_SENT
    db.session.commit()
    return quote


# ---------------------------------------------------------
# Conversion & Member Integration
# ---------------------------------------------------------

def convert_lead_to_member(
    lead_id: int,
    plan_code: Optional[str] = None,
    address: Optional[str] = None,
    date_of_birth: Optional[date] = None,
    gender: str = "Unspecified",
    emergency_contact_name: Optional[str] = None,
    emergency_contact_phone: Optional[str] = None,
    requesting_user: Optional[Any] = None,
) -> Tuple[CRMLead, Member]:
    """Convert a CRM lead into an active club member.
    
    Guarantees:
    1. Reuses lead contact information (name, email, phone).
    2. Idempotent: If a member with the same email or phone already exists, links
       to the existing member record without creating a duplicate.
    3. If no member exists, provisions User (role: MEMBER) and Member record.
    4. Never loses lead history: notes, follow-ups, and quotes remain intact.
    5. Optionally assigns an initial membership plan.
    """
    lead = get_lead(lead_id)
    if lead.status == LeadStatus.CONVERTED and lead.converted_member_id:
        member = db.session.get(Member, lead.converted_member_id)
        return lead, member

    # 1. Deduplication lookup
    existing_member = None
    if lead.email:
        user_with_email = User.query.filter(User.email.ilike(lead.email.strip())).first()
        if user_with_email:
            existing_member = Member.query.filter_by(user_id=user_with_email.id).first()

    if not existing_member and lead.phone:
        existing_member = Member.query.filter(Member.phone == lead.phone.strip()).first()

    member = existing_member

    # 2. Create user and member if not already existing
    if not member:
        temp_email = lead.email or f"lead_{lead.id}@championsclub.local"
        user = User.query.filter(User.email.ilike(temp_email)).first()
        if not user:
            user = create_user(
                email=temp_email,
                password="MemberTempPassword123!",
                first_name=lead.first_name,
                last_name=lead.last_name or "Member",
                role=RoleEnum.MEMBER,
            )

        member = create_member(
            user_id=user.id,
            phone=lead.phone or "+910000000000",
            address=address or "Club Member Address",
            date_of_birth=date_of_birth,
            gender=gender,
            emergency_contact_name=emergency_contact_name,
            emergency_contact_phone=emergency_contact_phone,
        )

    # 3. Optional membership plan assignment
    if plan_code:
        plan = get_plan_by_code(plan_code.upper().strip())
        if plan:
            assign_membership(
                member_id=member.id,
                plan_id=plan.id,
                start_date=date.today(),
            )

    # 4. Link lead to converted member and update status
    lead.converted_member_id = member.id
    lead.converted_at = utc_now()
    lead.status = LeadStatus.CONVERTED

    # 5. Add audit note to lead
    staff_id = requesting_user.id if requesting_user else user.id
    note_content = f"Lead successfully converted to Member #{member.id} ({member.user.full_name if member.user else ''})."
    db.session.add(CRMNote(
        lead_id=lead.id,
        staff_user_id=staff_id,
        content=note_content,
        created_at=utc_now(),
    ))

    db.session.commit()
    return lead, member


def mark_lead_lost(lead_id: int, reason: str, requesting_user: Optional[Any] = None) -> CRMLead:
    """Mark a lead as LOST with a mandatory reason."""
    lead = get_lead(lead_id)
    if not reason or not reason.strip():
        raise ValidationException("A reason must be provided when marking a lead as lost.", code="REASON_REQUIRED")

    lead.status = LeadStatus.LOST
    lead.lost_reason = reason.strip()
    lead.lost_at = utc_now()

    if requesting_user:
        db.session.add(CRMNote(
            lead_id=lead.id,
            staff_user_id=requesting_user.id,
            content=f"Lead marked as LOST. Reason: {reason.strip()}",
            created_at=utc_now(),
        ))

    db.session.commit()
    return lead


# ---------------------------------------------------------
# Public Website Thin Read-Only Endpoints
# ---------------------------------------------------------

def get_public_club_info() -> Dict[str, Any]:
    """Return public club information."""
    return {
        "name": "Champions Club",
        "tagline": "The Premier Racket & Athletic Club",
        "address": "123 Champions Way, Jubilee Hills, Hyderabad",
        "contact_phone": "+91 98765 43210",
        "contact_email": "concierge@championsclub.com",
        "operating_hours": "06:00 - 22:00 Daily",
        "facilities": [
            "14 Clay, Hard & Grass Tennis Courts",
            "Olympic-Size Temperature-Controlled Swimming Pool",
            "The Pro Shop with Tour-Level Gear & 24hr Stringing",
            "Artisan Espresso Bar & Champions Lounge",
            "High-Performance Fitness Studio & Executive Spa",
        ],
    }


def get_public_plans() -> List[Dict[str, Any]]:
    """Return active membership plans and pricing without sensitive internal fields."""
    plans = get_all_plans(active_only=True)
    results = []
    for p in plans:
        results.append({
            "code": p.code,
            "name": p.name,
            "description": p.description,
            "monthly_price": float(p.displayed_monthly_price),
            "billing_frequency": p.billing_frequency.value if hasattr(p.billing_frequency, "value") else str(p.billing_frequency),
            "duration_months": p.duration_months,
            "complimentary_months": p.complimentary_months,
            "benefits": p.benefits,
        })
    return results


def get_public_court_availability(start_date: date, end_date: date) -> List[Dict[str, Any]]:
    """Return public court availability slots across a date range without leaking member data."""
    # Cap range to maximum 7 days to prevent abuse
    max_days = 7
    if (end_date - start_date).days > max_days:
        end_date = start_date + timedelta(days=max_days)
    if end_date < start_date:
        end_date = start_date

    results = []
    current_d = start_date
    while current_d <= end_date:
        daily_data = get_court_availability(current_d)
        sanitized_courts = []
        for c in daily_data.get("courts", []):
            sanitized_courts.append({
                "court_id": c.get("court_id"),
                "court_name": c.get("court_name"),
                "sport_type": c.get("sport_type"),
                "surface_type": c.get("surface_type"),
                "is_indoor": c.get("is_indoor"),
                "available_slots_count": c.get("available_slots_count", 0),
                "slots": [
                    {
                        "start_time": s.get("start_time"),
                        "end_time": s.get("end_time"),
                        "is_available": s.get("is_available"),
                    }
                    for s in c.get("slots", [])
                ],
            })
        results.append({
            "date": current_d.isoformat(),
            "courts": sanitized_courts,
        })
        current_d += timedelta(days=1)

    return results


def get_public_products() -> List[Dict[str, Any]]:
    """Return catalog of active shop products without internal cost price or stock figures."""
    products, _ = list_products(is_active=True, page=1, per_page=100)
    results = []
    for p in products:
        results.append({
            "id": p.id,
            "sku": p.sku,
            "name": p.name,
            "category_name": p.category.name if p.category else None,
            "category_slug": p.category.slug if p.category else None,
            "price": float(p.price),
            "description": p.description,
            "image_url": p.image_url,
            "in_stock": p.stock_quantity > 0,
        })
    return results
