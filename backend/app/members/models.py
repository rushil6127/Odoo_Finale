from datetime import date
from typing import Optional
from sqlalchemy import Date, DateTime
from backend.app.extensions import db
from backend.app.common.utils import utc_now


class Member(db.Model):
    """Member profile entity linked 1-to-1 to a User account."""

    __tablename__ = "members"

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    user_id = db.Column(
        db.Integer,
        db.ForeignKey("users.id", ondelete="CASCADE"),
        unique=True,
        nullable=False,
        index=True,
    )
    phone = db.Column(db.String(20), nullable=True, index=True)
    date_of_birth = db.Column(Date, nullable=True)
    gender = db.Column(db.String(20), nullable=True)
    address = db.Column(db.String(255), nullable=True)
    emergency_contact_name = db.Column(db.String(100), nullable=True)
    emergency_contact_phone = db.Column(db.String(20), nullable=True)
    created_at = db.Column(DateTime(timezone=True), default=utc_now, nullable=False)
    updated_at = db.Column(
        DateTime(timezone=True),
        default=utc_now,
        onupdate=utc_now,
        nullable=False,
    )

    # Relationships
    user = db.relationship("User", backref=db.backref("member_profile", uselist=False))
    memberships = db.relationship(
        "Membership",
        back_populates="member",
        cascade="all, delete-orphan",
        order_by="desc(Membership.start_date)",
        lazy="selectin",
    )

    def calculate_age(self, as_of_date: Optional[date] = None) -> Optional[int]:
        """Calculate member's age as of a given date (defaults to today)."""
        if not self.date_of_birth:
            return None
        target = as_of_date or date.today()
        dob = self.date_of_birth
        return target.year - dob.year - ((target.month, target.day) < (dob.month, dob.day))

    def get_active_membership(self, as_of_date: Optional[date] = None) -> Optional["Membership"]:
        """Retrieve the active membership record for the member on a given date."""
        target = as_of_date or date.today()
        for membership in self.memberships:
            if membership.is_active_on(target):
                return membership
        return None

    @property
    def is_currently_active_member(self) -> bool:
        """Check if the member has any active membership right now."""
        return self.get_active_membership() is not None

    def to_dict(self, include_membership: bool = True, include_user: bool = True) -> dict:
        """Serialize member profile to dictionary."""
        active_ms = self.get_active_membership() if include_membership else None

        res = {
            "id": self.id,
            "user_id": self.user_id,
            "phone": self.phone,
            "date_of_birth": self.date_of_birth.isoformat() if self.date_of_birth else None,
            "age": self.calculate_age(),
            "gender": self.gender,
            "address": self.address,
            "emergency_contact_name": self.emergency_contact_name,
            "emergency_contact_phone": self.emergency_contact_phone,
            "has_active_membership": active_ms is not None,
            "active_membership": active_ms.to_dict(include_plan=True) if active_ms else None,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }

        if include_user and self.user:
            res["user"] = {
                "id": self.user.id,
                "email": self.user.email,
                "first_name": self.user.first_name,
                "last_name": self.user.last_name,
                "full_name": self.user.full_name,
                "role": self.user.role.value if hasattr(self.user.role, "value") else str(self.user.role),
                "is_active": self.user.is_active,
            }
        return res

    def __repr__(self) -> str:
        return f"<Member id={self.id} user_id={self.user_id}>"
