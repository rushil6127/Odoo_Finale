import enum
from datetime import date
from sqlalchemy import Numeric, Date, DateTime, JSON
from backend.app.extensions import db
from backend.app.common.utils import utc_now


class MembershipStatus(str, enum.Enum):
    ACTIVE = "ACTIVE"
    EXPIRED = "EXPIRED"
    CANCELLED = "CANCELLED"
    UPGRADED = "UPGRADED"
    DOWNGRADED = "DOWNGRADED"


class MembershipPlan(db.Model):
    """Membership plan configuration model."""

    __tablename__ = "membership_plans"

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    code = db.Column(db.String(50), unique=True, nullable=False, index=True)
    name = db.Column(db.String(100), nullable=False)
    description = db.Column(db.Text, nullable=True)
    displayed_monthly_price = db.Column(Numeric(10, 2), nullable=False)
    billing_frequency = db.Column(db.String(50), default="ANNUALLY", nullable=False)
    duration_months = db.Column(db.Integer, default=12, nullable=False)
    complimentary_months = db.Column(db.Integer, default=2, nullable=False)
    benefits = db.Column(JSON, nullable=False, default=dict)
    is_active = db.Column(db.Boolean, default=True, nullable=False)
    created_at = db.Column(DateTime(timezone=True), default=utc_now, nullable=False)
    updated_at = db.Column(
        DateTime(timezone=True),
        default=utc_now,
        onupdate=utc_now,
        nullable=False,
    )

    # Relationships
    memberships = db.relationship("Membership", back_populates="plan", lazy="dynamic")

    @property
    def annual_billing_months(self) -> int:
        """Effective months billed in an annual cycle (12 duration - 2 complimentary = 10)."""
        return max(1, self.duration_months - self.complimentary_months)

    @property
    def effective_annual_price(self) -> float:
        """Total annual price billed for the plan."""
        return float(self.displayed_monthly_price) * self.annual_billing_months

    def to_dict(self) -> dict:
        """Serialize plan configuration to dictionary."""
        return {
            "id": self.id,
            "code": self.code,
            "name": self.name,
            "description": self.description,
            "displayed_monthly_price": float(self.displayed_monthly_price),
            "billing_frequency": self.billing_frequency,
            "duration_months": self.duration_months,
            "complimentary_months": self.complimentary_months,
            "effective_annual_price": self.effective_annual_price,
            "benefits": self.benefits or {},
            "is_active": self.is_active,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }

    def __repr__(self) -> str:
        return f"<MembershipPlan id={self.id} code='{self.code}' name='{self.name}'>"


class Membership(db.Model):
    """Member subscription record representing current or historical membership."""

    __tablename__ = "memberships"

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    member_id = db.Column(
        db.Integer,
        db.ForeignKey("members.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    plan_id = db.Column(
        db.Integer,
        db.ForeignKey("membership_plans.id"),
        nullable=False,
        index=True,
    )
    start_date = db.Column(Date, nullable=False, index=True)
    end_date = db.Column(Date, nullable=False, index=True)
    status = db.Column(
        db.Enum(MembershipStatus, name="membership_status_enum"),
        default=MembershipStatus.ACTIVE,
        nullable=False,
        index=True,
    )
    price_paid = db.Column(Numeric(10, 2), nullable=True)
    notes = db.Column(db.Text, nullable=True)
    created_at = db.Column(DateTime(timezone=True), default=utc_now, nullable=False)
    updated_at = db.Column(
        DateTime(timezone=True),
        default=utc_now,
        onupdate=utc_now,
        nullable=False,
    )

    # Relationships
    member = db.relationship("Member", back_populates="memberships")
    plan = db.relationship("MembershipPlan", back_populates="memberships")

    def is_active_on(self, target_date: date) -> bool:
        """Determine if membership is active on a given date."""
        if not target_date:
            return False
        # If explicitly cancelled, it is not active
        if self.status == MembershipStatus.CANCELLED:
            return False
        # Active if start_date <= target_date <= end_date
        return self.start_date <= target_date <= self.end_date

    @property
    def is_currently_active(self) -> bool:
        """Determine if membership is active as of today."""
        today = date.today()
        return self.is_active_on(today)

    @property
    def is_expired(self) -> bool:
        """Determine if membership period has elapsed as of today."""
        return date.today() > self.end_date

    def to_dict(self, include_plan: bool = True) -> dict:
        """Serialize membership record with status and plan details."""
        today = date.today()
        is_active = self.is_active_on(today)

        # Derived display status
        if self.status == MembershipStatus.CANCELLED:
            display_status = "CANCELLED"
        elif self.status in (MembershipStatus.UPGRADED, MembershipStatus.DOWNGRADED):
            display_status = self.status.value
        elif is_active:
            display_status = "ACTIVE"
        elif self.is_expired:
            display_status = "EXPIRED"
        else:
            display_status = "PENDING"

        res = {
            "id": self.id,
            "member_id": self.member_id,
            "plan_id": self.plan_id,
            "start_date": self.start_date.isoformat(),
            "end_date": self.end_date.isoformat(),
            "status": self.status.value if hasattr(self.status, "value") else str(self.status),
            "display_status": display_status,
            "is_active": is_active,
            "price_paid": float(self.price_paid) if self.price_paid is not None else None,
            "notes": self.notes,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }
        if include_plan and self.plan:
            res["plan"] = self.plan.to_dict()
        return res

    def __repr__(self) -> str:
        return f"<Membership id={self.id} member_id={self.member_id} plan_id={self.plan_id} {self.start_date}->{self.end_date}>"


class MembershipRequestStatus(str, enum.Enum):
    PENDING = "PENDING"
    APPROVED = "APPROVED"
    REJECTED = "REJECTED"


class MembershipRequest(db.Model):
    """Membership request and manual offline payment review submission."""

    __tablename__ = "membership_requests"

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    user_id = db.Column(
        db.Integer,
        db.ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    member_id = db.Column(
        db.Integer,
        db.ForeignKey("members.id", ondelete="CASCADE"),
        nullable=True,
        index=True,
    )
    plan_id = db.Column(
        db.Integer,
        db.ForeignKey("membership_plans.id"),
        nullable=False,
        index=True,
    )
    status = db.Column(
        db.Enum(MembershipRequestStatus, name="membership_request_status_enum"),
        default=MembershipRequestStatus.PENDING,
        nullable=False,
        index=True,
    )
    payment_method = db.Column(db.String(50), default="UPI_QR", nullable=False)
    transaction_reference = db.Column(db.String(100), nullable=False, index=True)
    screenshot_url = db.Column(db.String(500), nullable=True)
    amount_paid = db.Column(Numeric(10, 2), nullable=False)
    requester_notes = db.Column(db.Text, nullable=True)

    reviewed_by_id = db.Column(
        db.Integer,
        db.ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    review_notes = db.Column(db.Text, nullable=True)
    reviewed_at = db.Column(DateTime(timezone=True), nullable=True)

    created_at = db.Column(DateTime(timezone=True), default=utc_now, nullable=False)
    updated_at = db.Column(
        DateTime(timezone=True),
        default=utc_now,
        onupdate=utc_now,
        nullable=False,
    )

    # Relationships
    user = db.relationship("User", foreign_keys=[user_id])
    reviewer = db.relationship("User", foreign_keys=[reviewed_by_id])
    member = db.relationship("Member")
    plan = db.relationship("MembershipPlan")

    def to_dict(self) -> dict:
        """Serialize request object with user, plan, and reviewer details."""
        return {
            "id": self.id,
            "user_id": self.user_id,
            "user": {
                "id": self.user.id,
                "email": self.user.email,
                "first_name": self.user.first_name,
                "last_name": self.user.last_name,
                "full_name": self.user.full_name,
            } if self.user else None,
            "member_id": self.member_id,
            "plan_id": self.plan_id,
            "plan": self.plan.to_dict() if self.plan else None,
            "status": self.status.value if hasattr(self.status, "value") else str(self.status),
            "payment_method": self.payment_method,
            "transaction_reference": self.transaction_reference,
            "screenshot_url": self.screenshot_url,
            "amount_paid": float(self.amount_paid) if self.amount_paid is not None else 0.0,
            "requester_notes": self.requester_notes,
            "reviewed_by_id": self.reviewed_by_id,
            "reviewer": {
                "id": self.reviewer.id,
                "full_name": self.reviewer.full_name,
                "email": self.reviewer.email,
            } if self.reviewer else None,
            "review_notes": self.review_notes,
            "reviewed_at": self.reviewed_at.isoformat() if self.reviewed_at else None,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }

    def __repr__(self) -> str:
        return f"<MembershipRequest id={self.id} user_id={self.user_id} plan_id={self.plan_id} status={self.status}>"

