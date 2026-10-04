from backend.app.extensions import db, bcrypt
from backend.app.common.utils import utc_now
from backend.app.common.permissions import RoleEnum


class User(db.Model):
    """User account model for authentication and role-based authorization."""

    __tablename__ = "users"

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    email = db.Column(db.String(255), unique=True, nullable=False, index=True)
    password_hash = db.Column(db.String(255), nullable=False)
    first_name = db.Column(db.String(100), nullable=False)
    last_name = db.Column(db.String(100), nullable=False)
    role = db.Column(
        db.Enum(RoleEnum, name="user_roles"),
        nullable=False,
        default=RoleEnum.MEMBER,
        index=True,
    )
    department = db.Column(db.String(100), nullable=True, default=None, index=True)
    avatar_url = db.Column(db.Text, nullable=True, default=None)
    is_active = db.Column(db.Boolean, default=True, nullable=False)
    created_at = db.Column(db.DateTime(timezone=True), default=utc_now, nullable=False)
    updated_at = db.Column(
        db.DateTime(timezone=True),
        default=utc_now,
        onupdate=utc_now,
        nullable=False,
    )

    def set_password(self, password: str) -> None:
        """Hash and set the user password."""
        if not password or len(password) < 6:
            raise ValueError("Password must be at least 6 characters long")
        self.password_hash = bcrypt.generate_password_hash(password).decode("utf-8")

    def check_password(self, password: str) -> bool:
        """Verify the password against the stored bcrypt hash."""
        if not self.password_hash or not password:
            return False
        return bcrypt.check_password_hash(self.password_hash, password)

    @property
    def full_name(self) -> str:
        """Return user's full name."""
        return f"{self.first_name} {self.last_name}".strip()

    @property
    def is_member(self) -> bool:
        """Check if user has MEMBER role."""
        role_val = self.role.value if hasattr(self.role, "value") else str(self.role)
        return role_val == "MEMBER"

    @property
    def is_staff(self) -> bool:
        """Check if user has any staff/admin role."""
        role_val = self.role.value if hasattr(self.role, "value") else str(self.role)
        return role_val in ("OWNER", "ADMIN", "MANAGER", "TRAINER", "STAFF", "FRONT_DESK", "SHOP_STAFF", "BAR_STAFF", "COACH")

    def to_dict(self) -> dict:
        """Safe dictionary representation without sensitive password hashes."""
        data = {
            "id": self.id,
            "email": self.email,
            "first_name": self.first_name,
            "last_name": self.last_name,
            "full_name": self.full_name,
            "role": self.role.value if hasattr(self.role, "value") else str(self.role),
            "department": self.department,
            "avatar_url": self.avatar_url,
            "is_active": self.is_active,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }
        try:
            if hasattr(self, "member_profile") and self.member_profile:
                active_ms = self.member_profile.get_active_membership()
                if active_ms and active_ms.plan:
                    data["membership_plan"] = active_ms.plan.code
                    data["membership_status"] = (
                        active_ms.status.value
                        if hasattr(active_ms.status, "value")
                        else str(active_ms.status)
                    )
                    data["membership_start_date"] = active_ms.start_date.isoformat()
                    data["membership_end_date"] = active_ms.end_date.isoformat()
                    data["active_membership"] = active_ms.to_dict(include_plan=True)
        except Exception:
            pass
        return data

    def __repr__(self) -> str:
        return f"<User id={self.id} email='{self.email}' role='{self.role}'>"
