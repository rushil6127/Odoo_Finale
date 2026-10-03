"""
Excel (.xlsx / .exl) Data Exporter for Champions Club.
======================================================
Generates formatted, multi-sheet or individual section Excel workbooks for:
- Member Directory (complete member profile, tier, spend, bookings)
- Staff & Employees (staff roster, roles, assigned sports departments)
- All Reconciled Revenue (cross-stream financial breakdown with GST & Net)
- Individual Section Revenue:
  * Court Bookings & Reservations
  * Pro Shop & Merchandise Sales
  * Sports Bar, Café & POS Orders
  * Membership Subscriptions & Tier Upgrades
"""

import io
from datetime import datetime, date
from decimal import Decimal
from typing import Optional, Dict, Any, List

import openpyxl
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.utils import get_column_letter
from sqlalchemy import func

from backend.app.extensions import db
from backend.app.common.utils import utc_now
from backend.app.auth.models import User
from backend.app.members.models import Member
from backend.app.memberships.models import Membership, MembershipStatus
from backend.app.bookings.models import Booking, BookingStatus
from backend.app.payments.models import Payment, PaymentStatus, PaymentItemType, PaymentMethod
from backend.app.shop.models import ShopOrder, ShopOrderStatus
from backend.app.pos.models import POSTab, TabStatus
from backend.app.reports.services import get_gst_rate, compute_tax_split, get_dashboard_overview


# Styles
HEADER_FONT = Font(name="Calibri", size=11, bold=True, color="FFFFFF")
HEADER_FILL = PatternFill(start_color="0F172A", end_color="0F172A", fill_type="solid")  # Slate-900
SUBHEADER_FILL = PatternFill(start_color="1E293B", end_color="1E293B", fill_type="solid")  # Slate-800
SECTION_FILL = PatternFill(start_color="065F46", end_color="065F46", fill_type="solid")  # Emerald-800
TITLE_FONT = Font(name="Calibri", size=14, bold=True, color="0F172A")
KPI_FONT = Font(name="Calibri", size=16, bold=True, color="065F46")
MUTED_FONT = Font(name="Calibri", size=9, italic=True, color="64748B")
CELL_FONT = Font(name="Calibri", size=10)
BOLD_CELL_FONT = Font(name="Calibri", size=10, bold=True)

THIN_BORDER_SIDE = Side(border_style="thin", color="E2E8F0")
CELL_BORDER = Border(
    left=THIN_BORDER_SIDE,
    right=THIN_BORDER_SIDE,
    top=THIN_BORDER_SIDE,
    bottom=THIN_BORDER_SIDE,
)


def _autofit_columns(ws, min_width: int = 12, max_width: int = 40):
    """Auto-fit column widths with padding for clean Excel presentation."""
    for col in ws.columns:
        max_len = 0
        col_letter = get_column_letter(col[0].column)
        for cell in col:
            val = str(cell.value or "")
            if "\n" in val:
                val = max(val.split("\n"), key=len)
            max_len = max(max_len, len(val))
        ws.column_dimensions[col_letter].width = min(max(max_len + 3, min_width), max_width)


def _style_header_row(ws, row_idx: int, fill: PatternFill = HEADER_FILL):
    """Style a header row with bold white font and filled background."""
    for cell in ws[row_idx]:
        cell.font = HEADER_FONT
        cell.fill = fill
        cell.alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)
        cell.border = CELL_BORDER


# ---------------------------------------------------------------------------
# 1. Executive Summary Sheet
# ---------------------------------------------------------------------------
def build_executive_summary_sheet(wb: openpyxl.Workbook, start_d: Optional[date] = None, end_d: Optional[date] = None):
    ws = wb.create_sheet(title="Executive Summary", index=0)
    ws.views.sheetView[0].showGridLines = True

    # Title block
    ws.append(["CHAMPIONS CLUB — EXECUTIVE REVENUE & OPERATIONAL REPORT"])
    ws.cell(row=1, column=1).font = TITLE_FONT
    ws.append([f"Report Generated: {utc_now().strftime('%Y-%m-%d %H:%M UTC')} | Scope: {'Custom Date Range' if start_d or end_d else 'Full History'}"])
    ws.cell(row=2, column=1).font = MUTED_FONT
    ws.append([])

    # Total counts
    total_members = Member.query.count()
    total_staff = User.query.filter(User.role.in_([
        "OWNER", "ADMIN", "MANAGER", "COACH", "TRAINER", "STAFF", "FRONT_DESK", "SHOP_STAFF", "BAR_STAFF"
    ])).count()
    total_courts_bookings = Booking.query.filter(Booking.status != BookingStatus.CANCELLED).count()

    # Revenue query
    pay_q = Payment.query.filter(Payment.status.in_([PaymentStatus.PAID, PaymentStatus.REFUNDED]))
    if start_d:
        pay_q = pay_q.filter(Payment.created_at >= datetime.combine(start_d, datetime.min.time()))
    if end_d:
        pay_q = pay_q.filter(Payment.created_at <= datetime.combine(end_d, datetime.max.time()))

    payments = pay_q.all()
    gross_total = Decimal("0.00")
    net_total = Decimal("0.00")
    gst_total = Decimal("0.00")
    stream_totals: Dict[str, Dict[str, Decimal]] = {
        "BOOKING": {"gross": Decimal("0.00"), "net": Decimal("0.00"), "gst": Decimal("0.00"), "count": 0},
        "SHOP_ORDER": {"gross": Decimal("0.00"), "net": Decimal("0.00"), "gst": Decimal("0.00"), "count": 0},
        "POS_ORDER": {"gross": Decimal("0.00"), "net": Decimal("0.00"), "gst": Decimal("0.00"), "count": 0},
        "MEMBERSHIP": {"gross": Decimal("0.00"), "net": Decimal("0.00"), "gst": Decimal("0.00"), "count": 0},
        "INVOICE": {"gross": Decimal("0.00"), "net": Decimal("0.00"), "gst": Decimal("0.00"), "count": 0},
    }

    for p in payments:
        amt = Decimal(str(p.amount)) if p.amount is not None else Decimal("0.00")
        if p.status == PaymentStatus.REFUNDED:
            amt = -amt
        rate = get_gst_rate(p.item_type) if p.item_type else Decimal("0.18")
        net, tax = compute_tax_split(amt, rate)

        gross_total += amt
        net_total += net
        gst_total += tax

        item_key = p.item_type.value if hasattr(p.item_type, "value") else str(p.item_type)
        if item_key in stream_totals:
            stream_totals[item_key]["gross"] += amt
            stream_totals[item_key]["net"] += net
            stream_totals[item_key]["gst"] += tax
            stream_totals[item_key]["count"] += 1

    # High-level KPIs Table
    ws.append(["EXECUTIVE KPI SNAPSHOT", "VALUE"])
    _style_header_row(ws, ws.max_row, fill=SECTION_FILL)
    kpis = [
        ("Gross Revenue Collected", float(gross_total)),
        ("Net Operating Revenue", float(net_total)),
        ("GST Collected (Payable)", float(gst_total)),
        ("Total Registered Club Members", total_members),
        ("Total Staff & Operating Employees", total_staff),
        ("Total Confirmed Court Reservations", total_courts_bookings),
    ]
    for label, val in kpis:
        r = ws.max_row + 1
        ws.append([label, val])
        ws.cell(row=r, column=1).font = BOLD_CELL_FONT
        c2 = ws.cell(row=r, column=2)
        c2.font = BOLD_CELL_FONT
        if isinstance(val, float):
            c2.number_format = "#,##0.00"

    ws.append([])

    # Stream breakdown Table
    ws.append(["REVENUE STREAM (SECTION)", "TRANSACTIONS", "GROSS REVENUE (INR)", "NET REVENUE (INR)", "GST (INR)", "SHARE %"])
    _style_header_row(ws, ws.max_row, fill=HEADER_FILL)

    stream_names = {
        "BOOKING": "Courts & Facility Reservations",
        "SHOP_ORDER": "Pro Shop Merchandise & Stringing",
        "POS_ORDER": "Sports Bar, Café & Lounge POS",
        "MEMBERSHIP": "Membership Subscriptions & Tiers",
        "INVOICE": "Corporate & Tournament Invoices",
    }
    for key, data in stream_totals.items():
        r = ws.max_row + 1
        share = float((data["gross"] / gross_total * 100) if gross_total > 0 else Decimal("0.00"))
        ws.append([
            stream_names.get(key, key),
            data["count"],
            float(data["gross"]),
            float(data["net"]),
            float(data["gst"]),
            f"{share:.1f}%",
        ])
        for c in range(1, 7):
            ws.cell(row=r, column=c).border = CELL_BORDER
            ws.cell(row=r, column=c).font = CELL_FONT
        ws.cell(row=r, column=3).number_format = "#,##0.00"
        ws.cell(row=r, column=4).number_format = "#,##0.00"
        ws.cell(row=r, column=5).number_format = "#,##0.00"

    _autofit_columns(ws)


# ---------------------------------------------------------------------------
# 2. Members Directory Sheet
# ---------------------------------------------------------------------------
def build_members_sheet(wb: openpyxl.Workbook, title: str = "Members Directory"):
    ws = wb.create_sheet(title=title)
    ws.views.sheetView[0].showGridLines = True

    headers = [
        "Member ID",
        "Full Name",
        "Email",
        "Phone",
        "Gender",
        "Age",
        "Address",
        "Active Plan / Tier",
        "Membership Status",
        "Plan Expiry Date",
        "Total Court Bookings",
        "Total Spend (INR)",
        "Member Since",
    ]
    ws.append(headers)
    _style_header_row(ws, 1, fill=HEADER_FILL)

    members = Member.query.order_by(Member.id).all()
    for m in members:
        u = m.user
        name = u.full_name if u else f"Member #{m.id}"
        email = u.email if u else "N/A"
        active_ms = m.get_active_membership()
        tier_label = active_ms.plan.name if (active_ms and active_ms.plan) else "STANDARD"
        status_label = active_ms.status.value if active_ms else ("ACTIVE" if (u and u.is_active) else "PENDING_VERIFICATION")
        expiry_str = active_ms.end_date.strftime("%Y-%m-%d") if (active_ms and active_ms.end_date) else "N/A"

        bookings_count = Booking.query.filter(Booking.user_id == m.user_id).count() if m.user_id else 0
        total_spend = db.session.query(func.coalesce(func.sum(Payment.amount), 0)).filter(
            Payment.user_id == m.user_id,
            Payment.status == PaymentStatus.PAID
        ).scalar() or 0.0

        r = ws.max_row + 1
        ws.append([
            f"CC-MEM-{m.id:04d}",
            name,
            email,
            m.phone or "N/A",
            m.gender or "N/A",
            m.calculate_age() or "N/A",
            m.address or "N/A",
            tier_label,
            status_label,
            expiry_str,
            bookings_count,
            float(total_spend),
            m.created_at.strftime("%Y-%m-%d") if m.created_at else "N/A",
        ])

        for c in range(1, len(headers) + 1):
            cell = ws.cell(row=r, column=c)
            cell.border = CELL_BORDER
            cell.font = CELL_FONT
        ws.cell(row=r, column=12).number_format = "#,##0.00"

    _autofit_columns(ws)


# ---------------------------------------------------------------------------
# 3. Staff & Employees Sheet
# ---------------------------------------------------------------------------
def build_employees_sheet(wb: openpyxl.Workbook, title: str = "Staff & Employees"):
    ws = wb.create_sheet(title=title)
    ws.views.sheetView[0].showGridLines = True

    headers = [
        "Employee ID",
        "Full Name",
        "Email",
        "Role Tier",
        "Assigned Department",
        "Account Status",
        "Created At",
        "Last Login / Update",
    ]
    ws.append(headers)
    _style_header_row(ws, 1, fill=SUBHEADER_FILL)

    users = User.query.order_by(User.role, User.first_name).all()
    for u in users:
        role_str = u.role.value if hasattr(u.role, "value") else str(u.role)
        dept_str = u.department or "General Operations"
        status_str = "Active" if u.is_active else "Disabled"

        r = ws.max_row + 1
        ws.append([
            f"CC-EMP-{u.id:04d}",
            u.full_name,
            u.email,
            role_str,
            dept_str,
            status_str,
            u.created_at.strftime("%Y-%m-%d %H:%M") if u.created_at else "N/A",
            u.updated_at.strftime("%Y-%m-%d %H:%M") if u.updated_at else "N/A",
        ])

        for c in range(1, len(headers) + 1):
            cell = ws.cell(row=r, column=c)
            cell.border = CELL_BORDER
            cell.font = CELL_FONT

    _autofit_columns(ws)


# ---------------------------------------------------------------------------
# 4. All Reconciled Revenue Sheet
# ---------------------------------------------------------------------------
def build_all_revenue_sheet(
    wb: openpyxl.Workbook,
    start_d: Optional[date] = None,
    end_d: Optional[date] = None,
    title: str = "All Revenue Reconciled",
):
    ws = wb.create_sheet(title=title)
    ws.views.sheetView[0].showGridLines = True

    headers = [
        "Payment Ref",
        "Revenue Stream",
        "Customer / Payer",
        "Gross (INR)",
        "Net Revenue (INR)",
        "GST Amount (INR)",
        "GST Rate",
        "Payment Method",
        "Payment Status",
        "Date & Time",
    ]
    ws.append(headers)
    _style_header_row(ws, 1, fill=HEADER_FILL)

    q = Payment.query.filter(Payment.status.in_([PaymentStatus.PAID, PaymentStatus.REFUNDED]))
    if start_d:
        q = q.filter(Payment.created_at >= datetime.combine(start_d, datetime.min.time()))
    if end_d:
        q = q.filter(Payment.created_at <= datetime.combine(end_d, datetime.max.time()))

    payments = q.order_by(Payment.created_at.desc()).all()
    for p in payments:
        amt = Decimal(str(p.amount)) if p.amount is not None else Decimal("0.00")
        if p.status == PaymentStatus.REFUNDED:
            amt = -amt
        rate = get_gst_rate(p.item_type) if p.item_type else Decimal("0.18")
        net, tax = compute_tax_split(amt, rate)

        payer_str = p.user.full_name if p.user else (f"User #{p.user_id}" if p.user_id else "Guest / Member")
        item_type_str = p.item_type.value if hasattr(p.item_type, "value") else str(p.item_type)
        method_str = p.payment_method.value if hasattr(p.payment_method, "value") else str(p.payment_method)
        date_str = p.created_at.strftime("%Y-%m-%d %H:%M") if p.created_at else "N/A"

        r = ws.max_row + 1
        ws.append([
            p.payment_reference,
            item_type_str,
            payer_str,
            float(amt),
            float(net),
            float(tax),
            f"{int(rate * 100)}%",
            method_str,
            p.status.value if hasattr(p.status, "value") else str(p.status),
            date_str,
        ])

        for c in range(1, len(headers) + 1):
            cell = ws.cell(row=r, column=c)
            cell.border = CELL_BORDER
            cell.font = CELL_FONT
        ws.cell(row=r, column=4).number_format = "#,##0.00"
        ws.cell(row=r, column=5).number_format = "#,##0.00"
        ws.cell(row=r, column=6).number_format = "#,##0.00"

    _autofit_columns(ws)


# ---------------------------------------------------------------------------
# 5. Court Bookings Revenue Sheet
# ---------------------------------------------------------------------------
def build_courts_revenue_sheet(
    wb: openpyxl.Workbook,
    start_d: Optional[date] = None,
    end_d: Optional[date] = None,
    title: str = "Court Bookings Revenue",
):
    ws = wb.create_sheet(title=title)
    ws.views.sheetView[0].showGridLines = True

    headers = [
        "Booking Ref",
        "Court Arena",
        "Sport Section",
        "Member / Player",
        "Booking Date",
        "Time Slot",
        "Status",
        "Final Price (INR)",
        "Net (INR)",
        "GST 18% (INR)",
    ]
    ws.append(headers)
    _style_header_row(ws, 1, fill=SECTION_FILL)

    q = Booking.query
    if start_d:
        q = q.filter(Booking.booking_date >= start_d)
    if end_d:
        q = q.filter(Booking.booking_date <= end_d)

    bookings = q.order_by(Booking.booking_date.desc(), Booking.start_time.desc()).all()
    rate = Decimal("0.18")
    for b in bookings:
        court_name = b.court.name if b.court else "N/A"
        sport_name = b.court.sport_type.value if (b.court and hasattr(b.court.sport_type, "value")) else "BADMINTON"
        player_name = b.member.user.full_name if (b.member and b.member.user) else (b.guest_name or "Guest")
        slot_str = f"{b.start_time.strftime('%H:%M')} – {b.end_time.strftime('%H:%M')}"
        amt = Decimal(str(b.final_price)) if b.final_price is not None else Decimal("0.00")
        net, tax = compute_tax_split(amt, rate)

        r = ws.max_row + 1
        ws.append([
            b.booking_reference,
            court_name,
            sport_name,
            player_name,
            b.booking_date.strftime("%Y-%m-%d"),
            slot_str,
            b.status.value if hasattr(b.status, "value") else str(b.status),
            float(amt),
            float(net),
            float(tax),
        ])

        for c in range(1, len(headers) + 1):
            cell = ws.cell(row=r, column=c)
            cell.border = CELL_BORDER
            cell.font = CELL_FONT
        ws.cell(row=r, column=8).number_format = "#,##0.00"
        ws.cell(row=r, column=9).number_format = "#,##0.00"
        ws.cell(row=r, column=10).number_format = "#,##0.00"

    _autofit_columns(ws)


# ---------------------------------------------------------------------------
# 6. Pro Shop Merchandise Revenue Sheet
# ---------------------------------------------------------------------------
def build_shop_revenue_sheet(
    wb: openpyxl.Workbook,
    start_d: Optional[date] = None,
    end_d: Optional[date] = None,
    title: str = "Pro Shop Revenue",
):
    ws = wb.create_sheet(title=title)
    ws.views.sheetView[0].showGridLines = True

    headers = [
        "Order Ref",
        "Customer / Member",
        "Order Type",
        "Items Count",
        "Final Amount (INR)",
        "Net Amount (INR)",
        "GST 18% (INR)",
        "Order Status",
        "Order Date",
    ]
    ws.append(headers)
    _style_header_row(ws, 1, fill=HEADER_FILL)

    q = ShopOrder.query
    if start_d:
        q = q.filter(func.date(ShopOrder.created_at) >= start_d)
    if end_d:
        q = q.filter(func.date(ShopOrder.created_at) <= end_d)

    orders = q.order_by(ShopOrder.created_at.desc()).all()
    rate = Decimal("0.18")
    for o in orders:
        cust = o.user.full_name if o.user else "Walk-in Guest"
        items_cnt = len(o.items) if hasattr(o, "items") else 1
        amt = Decimal(str(o.final_amount)) if o.final_amount is not None else Decimal("0.00")
        net, tax = compute_tax_split(amt, rate)

        r = ws.max_row + 1
        ws.append([
            f"SHOP-ORD-{o.id:05d}",
            cust,
            o.order_type.value if hasattr(o.order_type, "value") else str(o.order_type),
            items_cnt,
            float(amt),
            float(net),
            float(tax),
            o.status.value if hasattr(o.status, "value") else str(o.status),
            o.created_at.strftime("%Y-%m-%d %H:%M") if o.created_at else "N/A",
        ])

        for c in range(1, len(headers) + 1):
            cell = ws.cell(row=r, column=c)
            cell.border = CELL_BORDER
            cell.font = CELL_FONT
        ws.cell(row=r, column=5).number_format = "#,##0.00"
        ws.cell(row=r, column=6).number_format = "#,##0.00"
        ws.cell(row=r, column=7).number_format = "#,##0.00"

    _autofit_columns(ws)


# ---------------------------------------------------------------------------
# 7. Sports Bar & POS Revenue Sheet
# ---------------------------------------------------------------------------
def build_bar_revenue_sheet(
    wb: openpyxl.Workbook,
    start_d: Optional[date] = None,
    end_d: Optional[date] = None,
    title: str = "Sports Bar Revenue",
):
    ws = wb.create_sheet(title=title)
    ws.views.sheetView[0].showGridLines = True

    headers = [
        "Tab Ref",
        "Table / Lounge",
        "Customer / Member",
        "Total Amount (INR)",
        "Net Amount (INR)",
        "GST 5% (INR)",
        "Tab Status",
        "Opened At",
        "Closed At",
    ]
    ws.append(headers)
    _style_header_row(ws, 1, fill=SECTION_FILL)

    q = POSTab.query
    if start_d:
        q = q.filter(func.date(POSTab.created_at) >= start_d)
    if end_d:
        q = q.filter(func.date(POSTab.created_at) <= end_d)

    tabs = q.order_by(POSTab.created_at.desc()).all()
    rate = Decimal("0.05")
    for t in tabs:
        table_str = t.table.name if t.table else (f"Table #{t.table_id}" if t.table_id else "Bar Counter")
        cust_str = t.member.user.full_name if (t.member and t.member.user) else "Walk-in Guest"
        amt = Decimal(str(t.final_amount)) if t.final_amount is not None else Decimal("0.00")
        net, tax = compute_tax_split(amt, rate)

        r = ws.max_row + 1
        ws.append([
            f"POS-TAB-{t.id:04d}",
            table_str,
            cust_str,
            float(amt),
            float(net),
            float(tax),
            t.status.value if hasattr(t.status, "value") else str(t.status),
            t.created_at.strftime("%Y-%m-%d %H:%M") if t.created_at else "N/A",
            t.closed_at.strftime("%Y-%m-%d %H:%M") if t.closed_at else "Open",
        ])

        for c in range(1, len(headers) + 1):
            cell = ws.cell(row=r, column=c)
            cell.border = CELL_BORDER
            cell.font = CELL_FONT
        ws.cell(row=r, column=4).number_format = "#,##0.00"
        ws.cell(row=r, column=5).number_format = "#,##0.00"
        ws.cell(row=r, column=6).number_format = "#,##0.00"

    _autofit_columns(ws)


# ---------------------------------------------------------------------------
# 8. Membership Subscriptions Revenue Sheet
# ---------------------------------------------------------------------------
def build_memberships_revenue_sheet(
    wb: openpyxl.Workbook,
    start_d: Optional[date] = None,
    end_d: Optional[date] = None,
    title: str = "Membership Revenue",
):
    ws = wb.create_sheet(title=title)
    ws.views.sheetView[0].showGridLines = True

    headers = [
        "Subscription ID",
        "Member Name",
        "Email",
        "Plan Name",
        "Plan Code",
        "Start Date",
        "End Date",
        "Fee (INR)",
        "Net (INR)",
        "GST 18% (INR)",
        "Status",
    ]
    ws.append(headers)
    _style_header_row(ws, 1, fill=HEADER_FILL)

    q = Membership.query
    if start_d:
        q = q.filter(Membership.start_date >= start_d)
    if end_d:
        q = q.filter(Membership.start_date <= end_d)

    ms_list = q.order_by(Membership.start_date.desc()).all()
    rate = Decimal("0.18")
    for ms in ms_list:
        mem_name = ms.member.user.full_name if (ms.member and ms.member.user) else f"Member #{ms.member_id}"
        email = ms.member.user.email if (ms.member and ms.member.user) else "N/A"
        plan_name = ms.plan.name if ms.plan else "Club Plan"
        plan_code = ms.plan.code if ms.plan else "GOLD"
        amt = Decimal(str(ms.price_paid)) if ms.price_paid is not None else (Decimal(str(ms.plan.price)) if ms.plan else Decimal("0.00"))
        net, tax = compute_tax_split(amt, rate)

        r = ws.max_row + 1
        ws.append([
            f"MS-SUB-{ms.id:04d}",
            mem_name,
            email,
            plan_name,
            plan_code,
            ms.start_date.strftime("%Y-%m-%d"),
            ms.end_date.strftime("%Y-%m-%d") if ms.end_date else "Lifetime",
            float(amt),
            float(net),
            float(tax),
            ms.status.value if hasattr(ms.status, "value") else str(ms.status),
        ])

        for c in range(1, len(headers) + 1):
            cell = ws.cell(row=r, column=c)
            cell.border = CELL_BORDER
            cell.font = CELL_FONT
        ws.cell(row=r, column=8).number_format = "#,##0.00"
        ws.cell(row=r, column=9).number_format = "#,##0.00"
        ws.cell(row=r, column=10).number_format = "#,##0.00"

    _autofit_columns(ws)


# ---------------------------------------------------------------------------
# Master Workbook Builder
# ---------------------------------------------------------------------------
def generate_excel_workbook(
    section: str = "all",
    start_d: Optional[date] = None,
    end_d: Optional[date] = None,
) -> io.BytesIO:
    """
    Build a rich, beautifully formatted Excel workbook in-memory and return a BytesIO buffer.
    Supports individual sections or 'all' multi-sheet export.
    """
    wb = openpyxl.Workbook()
    # Remove default empty sheet
    default_sheet = wb.active
    wb.remove(default_sheet)

    sec = (section or "all").lower().strip()

    if sec in ("members", "member"):
        build_members_sheet(wb, title="Members Directory")
    elif sec in ("employees", "employee", "staff"):
        build_employees_sheet(wb, title="Staff & Employees")
    elif sec in ("courts", "court", "bookings", "booking"):
        build_courts_revenue_sheet(wb, start_d, end_d, title="Court Bookings Revenue")
    elif sec in ("shop", "merchandise", "store"):
        build_shop_revenue_sheet(wb, start_d, end_d, title="Pro Shop Revenue")
    elif sec in ("bar", "pos", "cafe", "restaurant"):
        build_bar_revenue_sheet(wb, start_d, end_d, title="Sports Bar Revenue")
    elif sec in ("memberships", "membership", "tiers"):
        build_memberships_revenue_sheet(wb, start_d, end_d, title="Membership Revenue")
    elif sec in ("revenue", "all_revenue", "finance"):
        build_executive_summary_sheet(wb, start_d, end_d)
        build_all_revenue_sheet(wb, start_d, end_d, title="All Revenue Reconciled")
        build_courts_revenue_sheet(wb, start_d, end_d, title="Courts Revenue")
        build_shop_revenue_sheet(wb, start_d, end_d, title="Pro Shop Revenue")
        build_bar_revenue_sheet(wb, start_d, end_d, title="Sports Bar Revenue")
        build_memberships_revenue_sheet(wb, start_d, end_d, title="Membership Revenue")
    else:
        # "all" or unrecognized defaults to complete master workbook with all individual sections
        build_executive_summary_sheet(wb, start_d, end_d)
        build_members_sheet(wb, title="Members Directory")
        build_employees_sheet(wb, title="Staff & Employees")
        build_all_revenue_sheet(wb, start_d, end_d, title="All Revenue Reconciled")
        build_courts_revenue_sheet(wb, start_d, end_d, title="Courts Revenue")
        build_shop_revenue_sheet(wb, start_d, end_d, title="Pro Shop Revenue")
        build_bar_revenue_sheet(wb, start_d, end_d, title="Sports Bar Revenue")
        build_memberships_revenue_sheet(wb, start_d, end_d, title="Membership Revenue")

    buf = io.BytesIO()
    wb.save(buf)
    buf.seek(0)
    return buf
