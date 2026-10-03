import io
import logging
from datetime import datetime, date, timedelta
from typing import Optional, Dict, Any, List
from sqlalchemy import func

from backend.app.extensions import db
from backend.app.common.utils import utc_now
from backend.app.tasks.celery_app import celery_app
from backend.app.notifications.models import (
    NotificationType,
    NotificationChannel,
    NotificationStatus,
)
from backend.app.notifications.services import (
    record_and_send_notification,
    has_notification_been_sent,
)

logger = logging.getLogger("celery.tasks")


# ---------------------------------------------------------------------------
# 0. Test & Diagnostic Task
# ---------------------------------------------------------------------------
@celery_app.task(name="backend.app.tasks.jobs.ping_test")
def ping_test(message: str = "pong") -> dict:
    """
    Diagnostic task that proves Redis broker, Celery worker, and result backend
    are successfully connected and responding.
    """
    logger.info(f"ping_test task executing with message: {message}")
    return {
        "status": "ok",
        "message": message,
        "timestamp": utc_now().isoformat(),
    }


# ---------------------------------------------------------------------------
# 1. Booking Confirmation Notification Task
# ---------------------------------------------------------------------------
@celery_app.task(name="backend.app.tasks.jobs.send_booking_confirmation_task")
def send_booking_confirmation_task(booking_id: int) -> dict:
    """
    Dispatch booking confirmation notification asynchronously post-commit.
    Idempotent: will not send duplicate notifications for the same booking.
    """
    from backend.app.bookings.models import Booking

    booking = db.session.get(Booking, booking_id)
    if not booking:
        logger.warning(f"Booking {booking_id} not found for confirmation task.")
        return {"status": "skipped", "reason": "booking_not_found"}

    ref_id = str(booking.id)
    if has_notification_been_sent(
        NotificationType.BOOKING_CONFIRMATION,
        reference_type="BOOKING",
        reference_id=ref_id,
    ):
        logger.info(f"Booking confirmation already sent for booking {booking_id}. Skipping.")
        return {"status": "skipped", "reason": "already_sent"}

    # Recipient resolution
    recipient = "guest@championsclub.com"
    recipient_type = "GUEST"
    recipient_id = None

    if booking.member and booking.member.user:
        recipient = booking.member.user.email
        recipient_type = "MEMBER"
        recipient_id = booking.member.id
    elif booking.guest_email:
        recipient = booking.guest_email
        recipient_type = "GUEST"
    elif booking.guest_phone:
        recipient = booking.guest_phone
        recipient_type = "GUEST"

    court_name = booking.court.name if booking.court else "Court"
    start_str = booking.start_time.strftime("%H:%M")
    end_str = booking.end_time.strftime("%H:%M")
    title = f"Booking Confirmed: {booking.booking_reference}"
    content = (
        f"Your reservation for {court_name} on {booking.booking_date} "
        f"from {start_str} to {end_str} has been confirmed. "
        f"Reference: {booking.booking_reference}. Total: INR {float(booking.final_price):.2f}."
    )

    notif = record_and_send_notification(
        recipient=recipient,
        title=title,
        content=content,
        notification_type=NotificationType.BOOKING_CONFIRMATION,
        channel=NotificationChannel.LOG,
        recipient_type=recipient_type,
        recipient_id=recipient_id,
        reference_type="BOOKING",
        reference_id=ref_id,
        metadata_json={
            "booking_reference": booking.booking_reference,
            "court_id": booking.court_id,
            "final_price": float(booking.final_price),
        },
    )
    return {"status": "sent", "notification_id": notif.id}


# ---------------------------------------------------------------------------
# 2. Membership Expiry Reminder Task (Periodic / Celery Beat)
# ---------------------------------------------------------------------------
@celery_app.task(name="backend.app.tasks.jobs.send_membership_expiry_reminders_task")
def send_membership_expiry_reminders_task() -> dict:
    """
    Scan for active memberships expiring within the reminder window (e.g. 7 or 30 days)
    and dispatch reminders idempotently.
    """
    from backend.app.memberships.models import Membership, MembershipStatus

    today = utc_now().date()
    window_end = today + timedelta(days=30)

    expiring_memberships = Membership.query.filter(
        Membership.status == MembershipStatus.ACTIVE,
        Membership.end_date >= today,
        Membership.end_date <= window_end,
    ).all()

    sent_count = 0
    skipped_count = 0

    for membership in expiring_memberships:
        member = membership.member
        if not member:
            continue

        days_remaining = (membership.end_date - today).days
        milestone = "7_DAYS" if days_remaining <= 7 else "30_DAYS"
        ref_id = f"{membership.id}-{milestone}-{membership.end_date.isoformat()}"

        if has_notification_been_sent(
            NotificationType.MEMBERSHIP_EXPIRY_REMINDER,
            reference_type="MEMBERSHIP",
            reference_id=ref_id,
        ):
            skipped_count += 1
            continue

        recipient = (
            member.user.email
            if member.user
            else (member.phone or f"member_{member.id}@club.com")
        )
        member_name = (
            member.user.first_name
            if (member.user and member.user.first_name)
            else "Member"
        )
        plan_name = membership.plan.name if membership.plan else "Club"
        title = f"Membership Expiry Reminder: {plan_name}"
        content = (
            f"Dear {member_name}, your {plan_name} membership expires in "
            f"{days_remaining} day(s) on {membership.end_date}. "
            f"Please renew to keep your club booking and discount privileges."
        )

        record_and_send_notification(
            recipient=recipient,
            title=title,
            content=content,
            notification_type=NotificationType.MEMBERSHIP_EXPIRY_REMINDER,
            channel=NotificationChannel.LOG,
            recipient_type="MEMBER",
            recipient_id=member.id,
            reference_type="MEMBERSHIP",
            reference_id=ref_id,
            metadata_json={
                "membership_id": membership.id,
                "end_date": membership.end_date.isoformat(),
                "days_remaining": days_remaining,
            },
        )
        sent_count += 1

    return {"status": "ok", "sent_count": sent_count, "skipped_count": skipped_count}


# ---------------------------------------------------------------------------
# 3. Order Notifications Task (Shop & POS)
# ---------------------------------------------------------------------------
@celery_app.task(name="backend.app.tasks.jobs.send_order_notification_task")
def send_order_notification_task(order_type: str, order_id: int) -> dict:
    """
    Dispatch order updates for Counter/Online shop orders or POS tab settlements.
    """
    order_type_upper = (order_type or "").upper()

    if order_type_upper in ("SHOP", "COUNTER", "ONLINE"):
        from backend.app.shop.models import ShopOrder

        order = db.session.get(ShopOrder, order_id)
        if not order:
            return {"status": "skipped", "reason": "shop_order_not_found"}

        ref_id = f"SHOP-{order.id}-{order.status.value}"
        if has_notification_been_sent(
            NotificationType.ORDER_NOTIFICATION,
            reference_type="SHOP_ORDER",
            reference_id=ref_id,
        ):
            return {"status": "skipped", "reason": "already_sent"}

        recipient = (
            order.customer_email
            or order.customer_phone
            or "orders@championsclub.com"
        )
        title = f"Shop Order Update: {order.order_number}"
        content = (
            f"Order {order.order_number} ({order.order_type.value}) is now {order.status.value}. "
            f"Total: INR {float(order.final_amount):.2f}."
        )
        notif = record_and_send_notification(
            recipient=recipient,
            title=title,
            content=content,
            notification_type=NotificationType.ORDER_NOTIFICATION,
            channel=NotificationChannel.LOG,
            recipient_type="CUSTOMER",
            recipient_id=order.member_id,
            reference_type="SHOP_ORDER",
            reference_id=ref_id,
            metadata_json={
                "order_id": order.id,
                "order_number": order.order_number,
                "status": order.status.value,
            },
        )
        return {"status": "sent", "notification_id": notif.id}

    elif order_type_upper == "POS":
        from backend.app.pos.models import POSTab

        tab = db.session.get(POSTab, order_id)
        if not tab:
            return {"status": "skipped", "reason": "pos_tab_not_found"}

        ref_id = f"POS-{tab.id}-{tab.status.value}"
        if has_notification_been_sent(
            NotificationType.ORDER_NOTIFICATION,
            reference_type="POS_TAB",
            reference_id=ref_id,
        ):
            return {"status": "skipped", "reason": "already_sent"}

        recipient = "cafeteria@championsclub.com"
        if tab.member and tab.member.user:
            recipient = tab.member.user.email

        table_num = tab.table.table_number if tab.table else "N/A"
        title = f"Cafeteria Tab Receipt: {tab.tab_number}"
        content = (
            f"Tab {tab.tab_number} (Table {table_num}) status: {tab.status.value}. "
            f"Total settled: INR {float(tab.final_amount):.2f}."
        )
        notif = record_and_send_notification(
            recipient=recipient,
            title=title,
            content=content,
            notification_type=NotificationType.ORDER_NOTIFICATION,
            channel=NotificationChannel.LOG,
            recipient_type="MEMBER" if tab.member_id else "GUEST",
            recipient_id=tab.member_id,
            reference_type="POS_TAB",
            reference_id=ref_id,
            metadata_json={"tab_id": tab.id, "tab_number": tab.tab_number},
        )
        return {"status": "sent", "notification_id": notif.id}

    return {"status": "error", "reason": f"unsupported_order_type_{order_type}"}


# ---------------------------------------------------------------------------
# 4. CRM Follow-up Reminders Task (Periodic / Celery Beat)
# ---------------------------------------------------------------------------
@celery_app.task(name="backend.app.tasks.jobs.send_crm_follow_up_reminders_task")
def send_crm_follow_up_reminders_task() -> dict:
    """
    Scan for pending CRM follow-ups scheduled for today or earlier and dispatch reminders.
    """
    from backend.app.crm.models import CRMFollowUp, FollowUpStatus

    today = utc_now().date()
    pending_follow_ups = CRMFollowUp.query.filter(
        CRMFollowUp.status == FollowUpStatus.PENDING,
        CRMFollowUp.scheduled_date <= (utc_now() + timedelta(days=1)),
    ).all()

    sent_count = 0
    skipped_count = 0

    for fu in pending_follow_ups:
        ref_id = f"{fu.id}-{today.isoformat()}"
        if has_notification_been_sent(
            NotificationType.CRM_FOLLOW_UP_REMINDER,
            reference_type="CRM_FOLLOW_UP",
            reference_id=ref_id,
        ):
            skipped_count += 1
            continue

        lead = fu.lead
        recipient = (
            fu.assigned_staff.email
            if fu.assigned_staff
            else "frontdesk@championsclub.com"
        )
        lead_name = lead.full_name if lead else "Lead"
        lead_phone = lead.phone if lead else "N/A"
        activity = (
            fu.follow_up_type.value
            if hasattr(fu.follow_up_type, "value")
            else str(fu.follow_up_type)
        )
        title = f"CRM Follow-up Due: {lead_name}"
        content = (
            f"Scheduled follow-up '{activity}' for {lead_name} (Phone: {lead_phone}) "
            f"is due today ({fu.scheduled_date}). Notes: {fu.notes or 'None'}"
        )

        record_and_send_notification(
            recipient=recipient,
            title=title,
            content=content,
            notification_type=NotificationType.CRM_FOLLOW_UP_REMINDER,
            channel=NotificationChannel.LOG,
            recipient_type="STAFF",
            recipient_id=fu.assigned_staff_id,
            reference_type="CRM_FOLLOW_UP",
            reference_id=ref_id,
            metadata_json={"follow_up_id": fu.id, "lead_id": fu.lead_id},
        )
        sent_count += 1

    return {"status": "ok", "sent_count": sent_count, "skipped_count": skipped_count}


# ---------------------------------------------------------------------------
# 5. Low-Stock Alerts Task (Periodic / Celery Beat)
# ---------------------------------------------------------------------------
@celery_app.task(name="backend.app.tasks.jobs.check_and_alert_low_stock_task")
def check_and_alert_low_stock_task() -> dict:
    """
    Scan active products and alert ONLY for items at or below their low-stock threshold.
    """
    from backend.app.inventory.models import Product

    low_stock_items = Product.query.filter(
        Product.is_active == True,
        Product.stock_quantity <= Product.low_stock_threshold,
    ).all()

    today = utc_now().date()
    sent_count = 0
    skipped_count = 0

    for product in low_stock_items:
        ref_id = f"{product.id}-{product.stock_quantity}-{today.isoformat()}"
        if has_notification_been_sent(
            NotificationType.LOW_STOCK_ALERT,
            reference_type="PRODUCT",
            reference_id=ref_id,
        ):
            skipped_count += 1
            continue

        title = f"Low Stock Alert: {product.name} (SKU: {product.sku})"
        content = (
            f"Product '{product.name}' (SKU: {product.sku}) stock is low. "
            f"Current stock: {product.stock_quantity}, threshold: {product.low_stock_threshold}."
        )

        record_and_send_notification(
            recipient="inventory@championsclub.com",
            title=title,
            content=content,
            notification_type=NotificationType.LOW_STOCK_ALERT,
            channel=NotificationChannel.LOG,
            recipient_type="STAFF",
            reference_type="PRODUCT",
            reference_id=ref_id,
            metadata_json={
                "product_id": product.id,
                "sku": product.sku,
                "stock_quantity": product.stock_quantity,
                "low_stock_threshold": product.low_stock_threshold,
            },
        )
        sent_count += 1

    return {"status": "ok", "sent_count": sent_count, "skipped_count": skipped_count}


# ---------------------------------------------------------------------------
# 6. Report Generation Task
# ---------------------------------------------------------------------------
@celery_app.task(name="backend.app.tasks.jobs.generate_daily_sales_report_task")
def generate_daily_sales_report_task(report_date: Optional[str] = None) -> dict:
    """
    Aggregate daily sales across bookings, shop, and POS cafeteria.
    """
    from backend.app.bookings.models import Booking, BookingStatus
    from backend.app.shop.models import ShopOrder, ShopOrderStatus
    from backend.app.pos.models import POSTab, TabStatus

    if not report_date:
        target_date = utc_now().date()
    else:
        target_date = datetime.strptime(report_date, "%Y-%m-%d").date()

    # Court bookings
    bookings = Booking.query.filter(
        Booking.booking_date == target_date,
        Booking.status != BookingStatus.CANCELLED,
    ).all()
    bookings_revenue = sum(float(b.final_price) for b in bookings)

    # Shop orders
    shop_orders = ShopOrder.query.filter(
        func.date(ShopOrder.created_at) == target_date,
        ShopOrder.status != ShopOrderStatus.CANCELLED,
    ).all()
    shop_revenue = sum(float(o.final_amount) for o in shop_orders)

    # POS cafeteria tabs
    pos_tabs = POSTab.query.filter(
        func.date(POSTab.created_at) == target_date,
        POSTab.status == TabStatus.CLOSED,
    ).all()
    pos_revenue = sum(float(t.final_amount) for t in pos_tabs)

    total_revenue = bookings_revenue + shop_revenue + pos_revenue

    report_payload = {
        "report_date": target_date.isoformat(),
        "bookings_count": len(bookings),
        "bookings_revenue": bookings_revenue,
        "shop_orders_count": len(shop_orders),
        "shop_revenue": shop_revenue,
        "pos_tabs_count": len(pos_tabs),
        "pos_revenue": pos_revenue,
        "total_revenue": total_revenue,
    }

    record_and_send_notification(
        recipient="management@championsclub.com",
        title=f"Daily Revenue Report: {target_date.isoformat()}",
        content=(
            f"Daily summary for {target_date.isoformat()}: Total INR {total_revenue:.2f} "
            f"(Bookings: INR {bookings_revenue:.2f}, Shop: INR {shop_revenue:.2f}, POS: INR {pos_revenue:.2f})."
        ),
        notification_type=NotificationType.REPORT_GENERATION,
        channel=NotificationChannel.LOG,
        recipient_type="STAFF",
        reference_type="DAILY_REPORT",
        reference_id=target_date.isoformat(),
        metadata_json=report_payload,
    )

    return report_payload


# ---------------------------------------------------------------------------
# 7. Excel Export Task (openpyxl)
# ---------------------------------------------------------------------------
@celery_app.task(name="backend.app.tasks.jobs.export_data_to_excel_task")
def export_data_to_excel_task(
    export_type: str = "INVENTORY", filters: Optional[Dict[str, Any]] = None
) -> dict:
    """
    Generate an Excel (.xlsx) file in-memory using openpyxl.
    Supports INVENTORY and BOOKINGS export schemas.
    """
    import openpyxl
    from openpyxl.styles import Font, PatternFill, Alignment

    wb = openpyxl.Workbook()
    ws = wb.active
    export_type_upper = (export_type or "INVENTORY").upper()

    header_font = Font(bold=True, color="FFFFFF")
    header_fill = PatternFill(
        start_color="1F497D", end_color="1F497D", fill_type="solid"
    )

    if export_type_upper == "INVENTORY":
        from backend.app.inventory.models import Product

        ws.title = "Inventory"
        headers = [
            "ID",
            "SKU",
            "Name",
            "Stock Quantity",
            "Low Stock Threshold",
            "Retail Price",
            "Status",
        ]
        ws.append(headers)

        products = Product.query.order_by(Product.name).all()
        for p in products:
            ws.append([
                p.id,
                p.sku,
                p.name,
                p.stock_quantity,
                p.low_stock_threshold,
                float(p.price),
                "ACTIVE" if p.is_active else "INACTIVE",
            ])

    elif export_type_upper == "BOOKINGS":
        from backend.app.bookings.models import Booking

        ws.title = "Bookings"
        headers = [
            "Reference",
            "Court",
            "Date",
            "Start Time",
            "End Time",
            "Status",
            "Amount (INR)",
        ]
        ws.append(headers)

        bookings = Booking.query.order_by(Booking.booking_date.desc()).limit(1000).all()
        for b in bookings:
            ws.append([
                b.booking_reference,
                b.court.name if b.court else "N/A",
                b.booking_date.isoformat(),
                b.start_time.strftime("%H:%M"),
                b.end_time.strftime("%H:%M"),
                b.status.value,
                float(b.final_price),
            ])
    else:
        ws.title = "Export"
        headers = ["Key", "Value"]
        ws.append(headers)
        ws.append(["Export Type", export_type_upper])
        ws.append(["Timestamp", utc_now().isoformat()])

    # Apply styling to header row
    for col_idx in range(1, len(headers) + 1):
        cell = ws.cell(row=1, column=col_idx)
        cell.font = header_font
        cell.fill = header_fill
        cell.alignment = Alignment(horizontal="center")

    output_stream = io.BytesIO()
    wb.save(output_stream)
    byte_count = output_stream.tell()

    return {
        "status": "completed",
        "export_type": export_type_upper,
        "rows_exported": ws.max_row - 1,
        "bytes_generated": byte_count,
    }
