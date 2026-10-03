import enum
import uuid
from datetime import datetime, date
from typing import Optional, Dict, Any
from sqlalchemy import Numeric, Date, DateTime, JSON, Text, UniqueConstraint, Index
from backend.app.extensions import db
from backend.app.common.utils import utc_now


class BookingStatus(str, enum.Enum):
    """Lifecycle status of a court booking."""

    CONFIRMED = "CONFIRMED"
    CANCELLED = "CANCELLED"
    COMPLETED = "COMPLETED"


def generate_booking_reference(prefix: str = "BK") -> str:
    """Generate a clean, collision-resistant booking reference code."""
    unique_suffix = uuid.uuid4().hex[:8].upper()
    return f"{prefix}-{unique_suffix}"


class Booking(db.Model):
    """Court reservation entity snapshotting rate, time, and party details."""

    __tablename__ = "bookings"

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    booking_reference = db.Column(
        db.String(30),
        unique=True,
        nullable=False,
        index=True,
        default=generate_booking_reference,
    )
    court_id = db.Column(
        db.Integer,
        db.ForeignKey("courts.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    member_id = db.Column(
        db.Integer,
        db.ForeignKey("members.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    user_id = db.Column(
        db.Integer,
        db.ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    booking_date = db.Column(Date, nullable=False, index=True)
    start_time = db.Column(DateTime(timezone=True), nullable=False, index=True)
    end_time = db.Column(DateTime(timezone=True), nullable=False)
    status = db.Column(
        db.Enum(BookingStatus, name="booking_status_enum"),
        default=BookingStatus.CONFIRMED,
        nullable=False,
        index=True,
    )
    is_walk_in = db.Column(db.Boolean, default=False, nullable=False)
    is_social_play = db.Column(db.Boolean, default=False, nullable=False)
    guest_name = db.Column(db.String(100), nullable=True)
    guest_phone = db.Column(db.String(20), nullable=True)
    guest_email = db.Column(db.String(120), nullable=True)
    
    # Financial snapshot (immutable record of price charged at booking time)
    base_price = db.Column(Numeric(10, 2), nullable=False)
    discount_amount = db.Column(Numeric(10, 2), default=0.00, nullable=False)
    final_price = db.Column(Numeric(10, 2), nullable=False)
    pricing_breakdown = db.Column(JSON, nullable=True, default=dict)
    
    notes = db.Column(Text, nullable=True)
    cancelled_at = db.Column(DateTime(timezone=True), nullable=True)
    cancellation_reason = db.Column(Text, nullable=True)
    created_at = db.Column(DateTime(timezone=True), default=utc_now, nullable=False)
    updated_at = db.Column(
        DateTime(timezone=True),
        default=utc_now,
        onupdate=utc_now,
        nullable=False,
    )

    # Relationships
    court = db.relationship("Court", backref=db.backref("bookings", lazy="dynamic"))
    member = db.relationship("Member", backref=db.backref("bookings", lazy="dynamic", order_by="desc(Booking.start_time)"))
    user = db.relationship("User", backref=db.backref("created_bookings", lazy="dynamic"))
    occupancies = db.relationship(
        "CourtOccupancy",
        back_populates="booking",
        cascade="all, delete-orphan",
        lazy="selectin",
    )

    @property
    def is_active(self) -> bool:
        """Booking is active if status is CONFIRMED."""
        return self.status == BookingStatus.CONFIRMED

    @property
    def is_cancelled(self) -> bool:
        """Booking has been cancelled."""
        return self.status == BookingStatus.CANCELLED

    def to_dict(self, include_court: bool = True, include_member: bool = True) -> Dict[str, Any]:
        """Serialize booking record to dictionary."""
        res: Dict[str, Any] = {
            "id": self.id,
            "booking_reference": self.booking_reference,
            "court_id": self.court_id,
            "member_id": self.member_id,
            "user_id": self.user_id,
            "booking_date": self.booking_date.isoformat() if self.booking_date else None,
            "start_time": self.start_time.isoformat() if self.start_time else None,
            "end_time": self.end_time.isoformat() if self.end_time else None,
            "status": self.status.value if hasattr(self.status, "value") else str(self.status),
            "is_walk_in": self.is_walk_in,
            "is_social_play": self.is_social_play,
            "guest_name": self.guest_name,
            "guest_phone": self.guest_phone,
            "guest_email": self.guest_email,
            "base_price": float(self.base_price) if self.base_price is not None else 0.0,
            "discount_amount": float(self.discount_amount) if self.discount_amount is not None else 0.0,
            "final_price": float(self.final_price) if self.final_price is not None else 0.0,
            "pricing_breakdown": self.pricing_breakdown or {},
            "notes": self.notes,
            "cancelled_at": self.cancelled_at.isoformat() if self.cancelled_at else None,
            "cancellation_reason": self.cancellation_reason,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }

        if include_court and self.court:
            res["court"] = {
                "id": self.court.id,
                "name": self.court.name,
                "sport_type": self.court.sport_type.value if hasattr(self.court.sport_type, "value") else str(self.court.sport_type),
                "is_indoor": self.court.is_indoor,
            }

        if include_member and self.member:
            res["member"] = {
                "id": self.member.id,
                "user_id": self.member.user_id,
                "phone": self.member.phone,
                "user": {
                    "id": self.member.user.id,
                    "first_name": self.member.user.first_name,
                    "last_name": self.member.user.last_name,
                    "full_name": self.member.user.full_name,
                    "email": self.member.user.email,
                } if self.member.user else None,
            }

        return res

    def __repr__(self) -> str:
        return f"<Booking id={self.id} ref='{self.booking_reference}' court_id={self.court_id} date={self.booking_date} status='{self.status}'>"


class CourtOccupancy(db.Model):
    """Occupancy record per 30-minute interval on a court.
    
    Guarantees strict DB-level concurrency safety against race conditions
    in both SQLite and PostgreSQL via the unique (court_id, slot_start) constraint.
    """

    __tablename__ = "court_occupancies"

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    court_id = db.Column(
        db.Integer,
        db.ForeignKey("courts.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    booking_id = db.Column(
        db.Integer,
        db.ForeignKey("bookings.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    slot_start = db.Column(DateTime(timezone=True), nullable=False)
    created_at = db.Column(DateTime(timezone=True), default=utc_now, nullable=False)

    __table_args__ = (
        UniqueConstraint("court_id", "slot_start", name="uq_court_slot_occupancy"),
        Index("ix_court_occupancy_court_slot", "court_id", "slot_start"),
    )

    booking = db.relationship("Booking", back_populates="occupancies")

    def __repr__(self) -> str:
        return f"<CourtOccupancy court_id={self.court_id} slot_start={self.slot_start} booking_id={self.booking_id}>"
