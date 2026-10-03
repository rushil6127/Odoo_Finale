from datetime import datetime, date
from typing import Optional, Dict, Any, List
from sqlalchemy import desc

from backend.app.extensions import db
from backend.app.common.utils import utc_now
from backend.app.notifications.models import (
    Notification,
    NotificationStatus,
    NotificationType,
    NotificationChannel,
)
from backend.app.notifications.sender import get_notification_sender


def has_notification_been_sent(
    notification_type: NotificationType,
    reference_type: str,
    reference_id: str,
    recipient: Optional[str] = None,
    since: Optional[datetime] = None,
) -> bool:
    """
    Check idempotency: returns True if a notification matching the reference has already been dispatched.
    """
    query = Notification.query.filter(
        Notification.notification_type == notification_type,
        Notification.reference_type == reference_type,
        Notification.reference_id == str(reference_id),
        Notification.status == NotificationStatus.SENT,
    )
    if recipient:
        query = query.filter(Notification.recipient == recipient)
    if since:
        query = query.filter(Notification.created_at >= since)

    return query.first() is not None


def record_and_send_notification(
    recipient: str,
    title: str,
    content: str,
    notification_type: NotificationType,
    channel: NotificationChannel = NotificationChannel.LOG,
    recipient_type: Optional[str] = None,
    recipient_id: Optional[int] = None,
    reference_type: Optional[str] = None,
    reference_id: Optional[str] = None,
    metadata_json: Optional[Dict[str, Any]] = None,
) -> Notification:
    """
    Create a Notification record, dispatch it through the pluggable sender, and commit.
    """
    notification = Notification(
        recipient=recipient,
        recipient_type=recipient_type,
        recipient_id=recipient_id,
        notification_type=notification_type,
        channel=channel,
        title=title,
        content=content,
        reference_type=reference_type,
        reference_id=str(reference_id) if reference_id is not None else None,
        status=NotificationStatus.PENDING,
        metadata_json=metadata_json or {},
    )
    db.session.add(notification)
    db.session.flush()

    # Dispatch via pluggable sender
    sender = get_notification_sender()
    try:
        success = sender.send(notification)
        if success:
            notification.status = NotificationStatus.SENT
            notification.sent_at = utc_now()
        else:
            notification.status = NotificationStatus.FAILED
    except Exception as e:
        notification.status = NotificationStatus.FAILED
        if notification.metadata_json is None:
            notification.metadata_json = {}
        notification.metadata_json["send_error"] = str(e)

    db.session.commit()
    return notification


def list_notifications(
    recipient: Optional[str] = None,
    notification_type: Optional[str] = None,
    limit: int = 50,
) -> List[Notification]:
    """Retrieve notifications with optional filtering."""
    query = Notification.query.order_by(desc(Notification.created_at))
    if recipient:
        query = query.filter(Notification.recipient == recipient)
    if notification_type:
        query = query.filter(Notification.notification_type == notification_type)
    return query.limit(limit).all()
