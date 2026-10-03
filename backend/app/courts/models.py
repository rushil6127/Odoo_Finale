import enum
from sqlalchemy import DateTime, JSON, Text
from backend.app.extensions import db
from backend.app.common.utils import utc_now


class SportType(str, enum.Enum):
    """Exactly the four supported club sports."""

    TENNIS = "TENNIS"
    PADEL = "PADEL"
    BADMINTON = "BADMINTON"
    BOX_CRICKET = "BOX_CRICKET"

    @classmethod
    def has_value(cls, value: str) -> bool:
        if not value:
            return False
        normalized = value.upper().strip().replace(" ", "_")
        return normalized in cls._value2member_map_

    @classmethod
    def from_string(cls, value: str) -> "SportType":
        normalized = value.upper().strip().replace(" ", "_")
        return cls[normalized]


class CourtStatus(str, enum.Enum):
    """Operational status of a court."""

    ACTIVE = "ACTIVE"
    MAINTENANCE = "MAINTENANCE"
    INACTIVE = "INACTIVE"


class Court(db.Model):
    """Sports court / arena entity."""

    __tablename__ = "courts"

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    name = db.Column(db.String(100), nullable=False, index=True)
    sport_type = db.Column(
        db.Enum(SportType, name="sport_types_enum"),
        nullable=False,
        index=True,
    )
    surface_type = db.Column(db.String(50), nullable=True)
    is_indoor = db.Column(db.Boolean, default=False, nullable=False)
    status = db.Column(
        db.Enum(CourtStatus, name="court_status_enum"),
        default=CourtStatus.ACTIVE,
        nullable=False,
        index=True,
    )
    custom_open_time = db.Column(db.String(5), nullable=True)
    custom_close_time = db.Column(db.String(5), nullable=True)
    features = db.Column(JSON, default=dict, nullable=False)
    description = db.Column(Text, nullable=True)
    created_at = db.Column(DateTime(timezone=True), default=utc_now, nullable=False)
    updated_at = db.Column(
        DateTime(timezone=True),
        default=utc_now,
        onupdate=utc_now,
        nullable=False,
    )

    @property
    def is_bookable(self) -> bool:
        """Only active courts are available for booking."""
        return self.status == CourtStatus.ACTIVE

    def to_dict(self) -> dict:
        """Serialize court entity to dictionary."""
        return {
            "id": self.id,
            "name": self.name,
            "sport_type": self.sport_type.value if hasattr(self.sport_type, "value") else str(self.sport_type),
            "surface_type": self.surface_type,
            "is_indoor": self.is_indoor,
            "status": self.status.value if hasattr(self.status, "value") else str(self.status),
            "is_bookable": self.is_bookable,
            "custom_open_time": self.custom_open_time,
            "custom_close_time": self.custom_close_time,
            "features": self.features or {},
            "description": self.description,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }

    def __repr__(self) -> str:
        return f"<Court id={self.id} name='{self.name}' sport='{self.sport_type}' status='{self.status}'>"
