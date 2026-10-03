import abc
import logging
from typing import Optional
from backend.app.notifications.models import Notification

logger = logging.getLogger("notifications")


class BaseNotificationSender(abc.ABC):
    """Abstract pluggable notification sender interface."""

    @abc.abstractmethod
    def send(self, notification: Notification) -> bool:
        """Send or process the given notification."""
        pass


class LoggingNotificationSender(BaseNotificationSender):
    """
    Default pluggable sender: logs notifications without external vendors (no email/SMS vendor).
    """

    def send(self, notification: Notification) -> bool:
        channel_val = (
            notification.channel.value
            if hasattr(notification.channel, "value")
            else str(notification.channel)
        )
        type_val = (
            notification.notification_type.value
            if hasattr(notification.notification_type, "value")
            else str(notification.notification_type)
        )
        logger.info(
            f"[NOTIFICATION DISPATCH] [{channel_val}] To: {notification.recipient} | "
            f"Type: {type_val} | Title: '{notification.title}' | Content: '{notification.content}'"
        )
        return True


# Pluggable sender registry
_active_sender: Optional[BaseNotificationSender] = None


def get_notification_sender() -> BaseNotificationSender:
    """Return the active notification sender instance (defaults to LoggingNotificationSender)."""
    global _active_sender
    if _active_sender is None:
        _active_sender = LoggingNotificationSender()
    return _active_sender


def set_notification_sender(sender: Optional[BaseNotificationSender]) -> None:
    """Allow plugging in a custom notification sender (e.g. for testing or future integration)."""
    global _active_sender
    _active_sender = sender
