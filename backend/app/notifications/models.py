import enum
from datetime import datetime
from typing import Optional, Dict, Any

from sqlalchemy import (
    Column,
    Integer,
    String,
    Text,
    DateTime,
    JSON,
    Index,
    Enum as SQLEnum,
)

from backend.app.extensions import db
from backend.app.common.utils import utc_now


class NotificationStatus(str, enum.Enum):
    PENDING = "PENDING"
    SENT = "SENT"
    FAILED = "FAILED"


class NotificationChannel(str, enum.Enum):
    LOG = "LOG"
    IN_APP = "IN_APP"
    EMAIL = "EMAIL"
    SMS = "SMS"


class NotificationType(str, enum.Enum):
    BOOKING_CONFIRMATION = "BOOKING_CONFIRMATION"
    MEMBERSHIP_EXPIRY_REMINDER = "MEMBERSHIP_EXPIRY_REMINDER"
    ORDER_NOTIFICATION = "ORDER_NOTIFICATION"
    CRM_FOLLOW_UP_REMINDER = "CRM_FOLLOW_UP_REMINDER"
    LOW_STOCK_ALERT = "LOW_STOCK_ALERT"
    REPORT_GENERATION = "REPORT_GENERATION"
    EXCEL_EXPORT = "EXCEL_EXPORT"
    GENERAL = "GENERAL"


class Notification(db.Model):
    """System notification record representing dispatched notifications."""

    __tablename__ = "notifications"

    id = Column(Integer, primary_key=True, autoincrement=True)
    recipient = Column(String(255), nullable=False, index=True)
    recipient_type = Column(String(50), nullable=True)  # MEMBER, USER, STAFF, CUSTOMER
    recipient_id = Column(Integer, nullable=True)
    notification_type = Column(
        SQLEnum(NotificationType, name="notification_type_enum", native_enum=False),
        nullable=False,
        index=True,
    )
    channel = Column(
        SQLEnum(NotificationChannel, name="notification_channel_enum", native_enum=False),
        default=NotificationChannel.LOG,
        nullable=False,
    )
    title = Column(String(255), nullable=False)
    content = Column(Text, nullable=False)
    reference_type = Column(String(50), nullable=True, index=True)
    reference_id = Column(String(100), nullable=True, index=True)
    status = Column(
        SQLEnum(NotificationStatus, name="notification_status_enum", native_enum=False),
        default=NotificationStatus.SENT,
        nullable=False,
        index=True,
    )
    metadata_json = Column(JSON, nullable=True)
    sent_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=utc_now, nullable=False)
    updated_at = Column(DateTime, default=utc_now, onupdate=utc_now, nullable=False)

    __table_args__ = (
        Index("ix_notifications_ref", "reference_type", "reference_id"),
        Index("ix_notifications_type_status", "notification_type", "status"),
    )

    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "recipient": self.recipient,
            "recipient_type": self.recipient_type,
            "recipient_id": self.recipient_id,
            "notification_type": self.notification_type.value if hasattr(self.notification_type, "value") else str(self.notification_type),
            "channel": self.channel.value if hasattr(self.channel, "value") else str(self.channel),
            "title": self.title,
            "content": self.content,
            "reference_type": self.reference_type,
            "reference_id": self.reference_id,
            "status": self.status.value if hasattr(self.status, "value") else str(self.status),
            "metadata_json": self.metadata_json or {},
            "sent_at": self.sent_at.isoformat() if self.sent_at else None,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }
