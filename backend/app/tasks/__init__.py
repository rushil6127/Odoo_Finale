"""Celery background tasks package."""

from backend.app.tasks.celery_app import make_celery, celery_app
from backend.app.tasks.dispatcher import safe_enqueue_task
from backend.app.tasks.jobs import (
    ping_test,
    send_booking_confirmation_task,
    send_membership_expiry_reminders_task,
    send_order_notification_task,
    send_crm_follow_up_reminders_task,
    check_and_alert_low_stock_task,
    generate_daily_sales_report_task,
    export_data_to_excel_task,
)

__all__ = [
    "make_celery",
    "celery_app",
    "safe_enqueue_task",
    "ping_test",
    "send_booking_confirmation_task",
    "send_membership_expiry_reminders_task",
    "send_order_notification_task",
    "send_crm_follow_up_reminders_task",
    "check_and_alert_low_stock_task",
    "generate_daily_sales_report_task",
    "export_data_to_excel_task",
]
