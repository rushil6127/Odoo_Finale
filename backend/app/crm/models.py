import enum
import uuid
from datetime import datetime
from decimal import Decimal
from typing import Optional, Dict, Any, List

from sqlalchemy import (
    Column,
    Integer,
    String,
    Text,
    DateTime,
    Date,
    Numeric,
    Boolean,
    ForeignKey,
    Index,
    CheckConstraint,
    Enum as SQLEnum,
)
from sqlalchemy.orm import relationship

from backend.app.extensions import db
from backend.app.common.utils import utc_now


class LeadSource(str, enum.Enum):
    """Origin source of a CRM lead / enquiry."""
    WEBSITE = "WEBSITE"
    WALK_IN = "WALK_IN"
    PHONE = "PHONE"
    REFERRAL = "REFERRAL"
    SOCIAL_MEDIA = "SOCIAL_MEDIA"
    EVENT = "EVENT"
    OTHER = "OTHER"

    @classmethod
    def has_value(cls, value: str) -> bool:
        if not value:
            return False
        return value.upper().strip() in cls._value2member_map_


class LeadStatus(str, enum.Enum):
    """Lifecycle states of a lead."""
    NEW = "NEW"
    CONTACTED = "CONTACTED"
    QUALIFIED = "QUALIFIED"
    TRIAL_SCHEDULED = "TRIAL_SCHEDULED"
    TRIAL_COMPLETED = "TRIAL_COMPLETED"
    PROPOSAL_SENT = "PROPOSAL_SENT"
    CONVERTED = "CONVERTED"
    LOST = "LOST"

    @classmethod
    def has_value(cls, value: str) -> bool:
        if not value:
            return False
        return value.upper().strip() in cls._value2member_map_


class LeadPriority(str, enum.Enum):
    """Priority level for lead response."""
    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"
    URGENT = "URGENT"


class FollowUpType(str, enum.Enum):
    """Type of follow-up touchpoint."""
    CALL = "CALL"
    EMAIL = "EMAIL"
    MEETING = "MEETING"
    MESSAGE = "MESSAGE"
    TOUR = "TOUR"
    OTHER = "OTHER"


class FollowUpStatus(str, enum.Enum):
    """Execution status of follow-up."""
    PENDING = "PENDING"
    COMPLETED = "COMPLETED"
    CANCELLED = "CANCELLED"


class TrialStatus(str, enum.Enum):
    """Status of a requested trial session."""
    REQUESTED = "REQUESTED"
    CONFIRMED = "CONFIRMED"
    COMPLETED = "COMPLETED"
    CANCELLED = "CANCELLED"
    NO_SHOW = "NO_SHOW"


class QuoteStatus(str, enum.Enum):
    """Status of a membership/training quote."""
    DRAFT = "DRAFT"
    SENT = "SENT"
    ACCEPTED = "ACCEPTED"
    REJECTED = "REJECTED"
    EXPIRED = "EXPIRED"


# Strict lifecycle transitions for leads
ALLOWED_LEAD_TRANSITIONS = {
    LeadStatus.NEW: {LeadStatus.CONTACTED, LeadStatus.QUALIFIED, LeadStatus.TRIAL_SCHEDULED, LeadStatus.LOST},
    LeadStatus.CONTACTED: {LeadStatus.QUALIFIED, LeadStatus.TRIAL_SCHEDULED, LeadStatus.PROPOSAL_SENT, LeadStatus.CONVERTED, LeadStatus.LOST},
    LeadStatus.QUALIFIED: {LeadStatus.TRIAL_SCHEDULED, LeadStatus.PROPOSAL_SENT, LeadStatus.CONVERTED, LeadStatus.LOST},
    LeadStatus.TRIAL_SCHEDULED: {LeadStatus.TRIAL_COMPLETED, LeadStatus.PROPOSAL_SENT, LeadStatus.CONVERTED, LeadStatus.LOST},
    LeadStatus.TRIAL_COMPLETED: {LeadStatus.PROPOSAL_SENT, LeadStatus.CONVERTED, LeadStatus.LOST},
    LeadStatus.PROPOSAL_SENT: {LeadStatus.CONVERTED, LeadStatus.LOST},
    LeadStatus.CONVERTED: set(),  # Terminal state
    LeadStatus.LOST: {LeadStatus.NEW, LeadStatus.CONTACTED},  # Can be reopened
}


def generate_lead_reference(prefix: str = "LED") -> str:
    """Generate reference code: LED-YYYYMMDD-XXXX."""
    date_str = utc_now().strftime("%Y%m%d")
    random_suffix = uuid.uuid4().hex[:6].upper()
    return f"{prefix}-{date_str}-{random_suffix}"


def generate_quote_reference(prefix: str = "QTE") -> str:
    """Generate reference code: QTE-YYYYMMDD-XXXX."""
    date_str = utc_now().strftime("%Y%m%d")
    random_suffix = uuid.uuid4().hex[:6].upper()
    return f"{prefix}-{date_str}-{random_suffix}"


class CRMLead(db.Model):
    """Prospective member or club customer enquiry."""

    __tablename__ = "crm_leads"

    id = Column(Integer, primary_key=True, autoincrement=True)
    lead_reference = Column(String(30), unique=True, nullable=False, index=True)
    first_name = Column(String(100), nullable=False)
    last_name = Column(String(100), nullable=True)
    email = Column(String(120), nullable=True, index=True)
    phone = Column(String(20), nullable=True, index=True)
    source = Column(
        SQLEnum(LeadSource, native_enum=False),
        nullable=False,
        default=LeadSource.WEBSITE,
    )
    status = Column(
        SQLEnum(LeadStatus, native_enum=False),
        nullable=False,
        default=LeadStatus.NEW,
        index=True,
    )
    priority = Column(
        SQLEnum(LeadPriority, native_enum=False),
        nullable=False,
        default=LeadPriority.MEDIUM,
    )
    preferred_sport = Column(String(50), nullable=True)
    interested_plan = Column(String(50), nullable=True)
    initial_message = Column(Text, nullable=True)
    assigned_staff_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    converted_member_id = Column(Integer, ForeignKey("members.id"), nullable=True, index=True)
    converted_at = Column(DateTime, nullable=True)
    lost_reason = Column(Text, nullable=True)
    lost_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, nullable=False, default=utc_now)
    updated_at = Column(DateTime, nullable=False, default=utc_now, onupdate=utc_now)

    # Relationships
    assigned_staff = relationship("User", foreign_keys=[assigned_staff_id])
    converted_member = relationship("Member", foreign_keys=[converted_member_id])
    follow_ups = relationship(
        "CRMFollowUp",
        back_populates="lead",
        cascade="all, delete-orphan",
        order_by="CRMFollowUp.scheduled_date.asc()",
    )
    notes = relationship(
        "CRMNote",
        back_populates="lead",
        cascade="all, delete-orphan",
        order_by="CRMNote.created_at.desc()",
    )
    trial_sessions = relationship(
        "CRMTrialSession",
        back_populates="lead",
        cascade="all, delete-orphan",
        order_by="CRMTrialSession.preferred_date.desc()",
    )
    quotes = relationship(
        "CRMQuote",
        back_populates="lead",
        cascade="all, delete-orphan",
        order_by="CRMQuote.created_at.desc()",
    )

    @property
    def full_name(self) -> str:
        if self.last_name:
            return f"{self.first_name} {self.last_name}".strip()
        return self.first_name.strip()

    def to_dict(self, include_relations: bool = True) -> Dict[str, Any]:
        data = {
            "id": self.id,
            "lead_reference": self.lead_reference,
            "first_name": self.first_name,
            "last_name": self.last_name,
            "full_name": self.full_name,
            "email": self.email,
            "phone": self.phone,
            "source": self.source.value if hasattr(self.source, "value") else str(self.source),
            "status": self.status.value if hasattr(self.status, "value") else str(self.status),
            "priority": self.priority.value if hasattr(self.priority, "value") else str(self.priority),
            "preferred_sport": self.preferred_sport,
            "interested_plan": self.interested_plan,
            "initial_message": self.initial_message,
            "assigned_staff_id": self.assigned_staff_id,
            "assigned_staff_name": (
                f"{self.assigned_staff.first_name} {self.assigned_staff.last_name}"
                if self.assigned_staff else None
            ),
            "converted_member_id": self.converted_member_id,
            "converted_at": self.converted_at.isoformat() if self.converted_at else None,
            "lost_reason": self.lost_reason,
            "lost_at": self.lost_at.isoformat() if self.lost_at else None,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }
        if include_relations:
            data["follow_ups"] = [f.to_dict() for f in self.follow_ups]
            data["notes"] = [n.to_dict() for n in self.notes]
            data["trial_sessions"] = [t.to_dict() for t in self.trial_sessions]
            data["quotes"] = [q.to_dict() for q in self.quotes]
        return data


class CRMFollowUp(db.Model):
    """Scheduled touchpoint or task for a front-desk staff member."""

    __tablename__ = "crm_follow_ups"

    id = Column(Integer, primary_key=True, autoincrement=True)
    lead_id = Column(Integer, ForeignKey("crm_leads.id", ondelete="CASCADE"), nullable=False, index=True)
    assigned_staff_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    follow_up_type = Column(
        SQLEnum(FollowUpType, native_enum=False),
        nullable=False,
        default=FollowUpType.CALL,
    )
    scheduled_date = Column(DateTime, nullable=False, index=True)
    completed_date = Column(DateTime, nullable=True)
    status = Column(
        SQLEnum(FollowUpStatus, native_enum=False),
        nullable=False,
        default=FollowUpStatus.PENDING,
        index=True,
    )
    notes = Column(Text, nullable=True)
    outcome = Column(Text, nullable=True)
    created_at = Column(DateTime, nullable=False, default=utc_now)
    updated_at = Column(DateTime, nullable=False, default=utc_now, onupdate=utc_now)

    lead = relationship("CRMLead", back_populates="follow_ups")
    assigned_staff = relationship("User", foreign_keys=[assigned_staff_id])

    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "lead_id": self.lead_id,
            "lead_reference": self.lead.lead_reference if self.lead else None,
            "lead_name": self.lead.full_name if self.lead else None,
            "lead_phone": self.lead.phone if self.lead else None,
            "lead_email": self.lead.email if self.lead else None,
            "assigned_staff_id": self.assigned_staff_id,
            "assigned_staff_name": (
                f"{self.assigned_staff.first_name} {self.assigned_staff.last_name}"
                if self.assigned_staff else None
            ),
            "follow_up_type": self.follow_up_type.value if hasattr(self.follow_up_type, "value") else str(self.follow_up_type),
            "scheduled_date": self.scheduled_date.isoformat() if self.scheduled_date else None,
            "completed_date": self.completed_date.isoformat() if self.completed_date else None,
            "status": self.status.value if hasattr(self.status, "value") else str(self.status),
            "notes": self.notes,
            "outcome": self.outcome,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }


class CRMNote(db.Model):
    """Historical timestamped notes logged by club staff against a lead."""

    __tablename__ = "crm_notes"

    id = Column(Integer, primary_key=True, autoincrement=True)
    lead_id = Column(Integer, ForeignKey("crm_leads.id", ondelete="CASCADE"), nullable=False, index=True)
    staff_user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    content = Column(Text, nullable=False)
    created_at = Column(DateTime, nullable=False, default=utc_now)

    lead = relationship("CRMLead", back_populates="notes")
    staff_user = relationship("User")

    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "lead_id": self.lead_id,
            "staff_user_id": self.staff_user_id,
            "staff_name": f"{self.staff_user.first_name} {self.staff_user.last_name}" if self.staff_user else None,
            "content": self.content,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }


class CRMTrialSession(db.Model):
    """Complimentary trial session request and confirmation for prospective members."""

    __tablename__ = "crm_trial_sessions"

    id = Column(Integer, primary_key=True, autoincrement=True)
    lead_id = Column(Integer, ForeignKey("crm_leads.id", ondelete="CASCADE"), nullable=False, index=True)
    preferred_date = Column(Date, nullable=False)
    preferred_time_slot = Column(String(50), nullable=False)
    sport = Column(String(50), nullable=True)
    status = Column(
        SQLEnum(TrialStatus, native_enum=False),
        nullable=False,
        default=TrialStatus.REQUESTED,
        index=True,
    )
    confirmed_datetime = Column(DateTime, nullable=True)
    court_id = Column(Integer, ForeignKey("courts.id"), nullable=True)
    coach_user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    staff_notes = Column(Text, nullable=True)
    created_at = Column(DateTime, nullable=False, default=utc_now)
    updated_at = Column(DateTime, nullable=False, default=utc_now, onupdate=utc_now)

    lead = relationship("CRMLead", back_populates="trial_sessions")
    court = relationship("Court")
    coach = relationship("User", foreign_keys=[coach_user_id])

    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "lead_id": self.lead_id,
            "preferred_date": self.preferred_date.isoformat() if self.preferred_date else None,
            "preferred_time_slot": self.preferred_time_slot,
            "sport": self.sport,
            "status": self.status.value if hasattr(self.status, "value") else str(self.status),
            "confirmed_datetime": self.confirmed_datetime.isoformat() if self.confirmed_datetime else None,
            "court_id": self.court_id,
            "court_name": self.court.name if self.court else None,
            "coach_user_id": self.coach_user_id,
            "coach_name": f"{self.coach.first_name} {self.coach.last_name}" if self.coach else None,
            "staff_notes": self.staff_notes,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }


class CRMQuote(db.Model):
    """Membership plan or private coaching price quote sent to a prospective lead."""

    __tablename__ = "crm_quotes"

    id = Column(Integer, primary_key=True, autoincrement=True)
    quote_reference = Column(String(30), unique=True, nullable=False, index=True)
    lead_id = Column(Integer, ForeignKey("crm_leads.id", ondelete="CASCADE"), nullable=False, index=True)
    plan_code = Column(String(30), nullable=True)
    plan_name = Column(String(100), nullable=False)
    amount = Column(Numeric(10, 2), nullable=False)
    discount_amount = Column(Numeric(10, 2), nullable=False, default=Decimal("0.00"))
    final_amount = Column(Numeric(10, 2), nullable=False)
    status = Column(
        SQLEnum(QuoteStatus, native_enum=False),
        nullable=False,
        default=QuoteStatus.DRAFT,
        index=True,
    )
    valid_until = Column(Date, nullable=False)
    notes = Column(Text, nullable=True)
    created_by_user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime, nullable=False, default=utc_now)
    updated_at = Column(DateTime, nullable=False, default=utc_now, onupdate=utc_now)

    lead = relationship("CRMLead", back_populates="quotes")
    created_by = relationship("User")

    __table_args__ = (
        CheckConstraint("amount >= 0", name="check_crm_quote_amount_non_negative"),
        CheckConstraint("discount_amount >= 0", name="check_crm_quote_discount_non_negative"),
        CheckConstraint("final_amount >= 0", name="check_crm_quote_final_amount_non_negative"),
    )

    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "quote_reference": self.quote_reference,
            "lead_id": self.lead_id,
            "plan_code": self.plan_code,
            "plan_name": self.plan_name,
            "amount": float(self.amount),
            "discount_amount": float(self.discount_amount),
            "final_amount": float(self.final_amount),
            "status": self.status.value if hasattr(self.status, "value") else str(self.status),
            "valid_until": self.valid_until.isoformat() if self.valid_until else None,
            "notes": self.notes,
            "created_by_name": f"{self.created_by.first_name} {self.created_by.last_name}" if self.created_by else None,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }
