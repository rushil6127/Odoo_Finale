from datetime import date
from typing import List, Optional, Tuple, Dict, Any
from sqlalchemy import or_, and_, func
from backend.app.extensions import db
from backend.app.auth.models import User
from backend.app.members.models import Member
from backend.app.memberships.models import Membership, MembershipPlan, MembershipStatus
from backend.app.common.errors import NotFoundException, ConflictException, ValidationException


def create_member(
    user_id: int,
    phone: Optional[str] = None,
    date_of_birth: Optional[date] = None,
    gender: Optional[str] = None,
    address: Optional[str] = None,
    emergency_contact_name: Optional[str] = None,
    emergency_contact_phone: Optional[str] = None,
) -> Member:
    """Create a member profile linked to a user account."""
    user = db.session.get(User, user_id)
    if not user:
        raise NotFoundException(f"User with ID {user_id} not found.")

    existing_member = Member.query.filter_by(user_id=user_id).first()
    if existing_member:
        raise ConflictException("A member profile already exists for this user account.")

    member = Member(
        user_id=user_id,
        phone=phone.strip() if phone else None,
        date_of_birth=date_of_birth,
        gender=gender.strip() if gender else None,
        address=address.strip() if address else None,
        emergency_contact_name=emergency_contact_name.strip() if emergency_contact_name else None,
        emergency_contact_phone=emergency_contact_phone.strip() if emergency_contact_phone else None,
    )

    db.session.add(member)
    db.session.commit()
    return member


def get_member_by_id(member_id: int) -> Optional[Member]:
    """Retrieve member by primary key ID."""
    return db.session.get(Member, member_id)


def get_member_by_user_id(user_id: int) -> Optional[Member]:
    """Retrieve member profile by linked user ID."""
    return Member.query.filter_by(user_id=user_id).first()


def update_member(member_id: int, **kwargs) -> Member:
    """Update member profile attributes."""
    member = db.session.get(Member, member_id)
    if not member:
        raise NotFoundException(f"Member with ID {member_id} not found.")

    allowed_fields = {
        "phone",
        "date_of_birth",
        "gender",
        "address",
        "emergency_contact_name",
        "emergency_contact_phone",
    }

    for key, value in kwargs.items():
        if key in allowed_fields:
            setattr(member, key, value)

    db.session.commit()
    return member


def search_members(
    query_str: Optional[str] = None,
    plan_code: Optional[str] = None,
    is_active: Optional[bool] = None,
    page: int = 1,
    per_page: int = 20,
) -> Tuple[List[Member], int]:
    """Search and filter members by keyword, plan tier, or active status."""
    query = Member.query.join(User, Member.user_id == User.id)

    if query_str and query_str.strip():
        term = f"%{query_str.strip()}%"
        filters = [
            User.first_name.ilike(term),
            User.last_name.ilike(term),
            User.email.ilike(term),
            Member.phone.ilike(term),
        ]
        # If search term is numeric, allow direct member ID matching
        if query_str.strip().isdigit():
            filters.append(Member.id == int(query_str.strip()))

        query = query.filter(or_(*filters))

    # Optional plan code filter
    if plan_code:
        today = date.today()
        query = query.join(Membership, Member.id == Membership.member_id).join(
            MembershipPlan, Membership.plan_id == MembershipPlan.id
        ).filter(
            MembershipPlan.code == plan_code.upper().strip(),
            Membership.start_date <= today,
            Membership.end_date >= today,
            Membership.status.in_([MembershipStatus.ACTIVE]),
        )

    # Total count before pagination
    total_count = query.count()

    # Pagination
    offset = max(0, (page - 1) * per_page)
    members = query.order_by(Member.id.desc()).offset(offset).limit(per_page).all()

    # Filter is_active in python if specified and not filtered via plan
    if is_active is not None and not plan_code:
        filtered = [m for m in members if m.is_currently_active_member == is_active]
        return filtered, len(filtered)

    return members, total_count
