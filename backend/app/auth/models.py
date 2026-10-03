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
        return role_val in ("OWNER", "ADMIN", "FRONT_DESK", "SHOP_STAFF", "BAR_STAFF", "COACH")

    def to_dict(self) -> dict:
        """Safe dictionary representation without sensitive password hashes."""
        return {
            "id": self.id,
            "email": self.email,
            "first_name": self.first_name,
            "last_name": self.last_name,
            "full_name": self.full_name,
            "role": self.role.value if hasattr(self.role, "value") else str(self.role),
            "is_active": self.is_active,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }

    def __repr__(self) -> str:
        return f"<User id={self.id} email='{self.email}' role='{self.role}'>"
