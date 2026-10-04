"""
Excel (.xlsx / .exl) Data Exporter for Champions Club.
======================================================
Live, sovereign, real-time database synchronizer generating:
1. Executive Summary (KPI snapshot, verified revenue stream split, operational counts)
2. Member Directory (member profiles, tier, spend, bookings, contact information)
3. Staff & Employees (staff roster, role tiers, assigned sports departments, account status)
4. All Revenue Reconciled (complete cross-stream ledger with GST & Net breakdown)
5. Court Bookings Revenue (reservations, courts, sports, players, rates, and timestamps)
6. Pro Shop Merchandise & Inventory (orders ledger, stock quantities, SKU catalog, low-stock alerts)
7. Sports Bar & Café POS (orders ledger, tabs, table settlements, GST breakdown, menu catalog)
8. Membership Subscriptions (active plans, validity windows, fees, and tiers)

Always queries live SQLite database models with zero stale caching.
"""

import io
from datetime import datetime, date, time
from decimal import Decimal
from typing import Optional, Dict, Any, List

import openpyxl
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.utils import get_column_letter
from sqlalchemy import func

from backend.app.extensions import db
from backend.app.common.utils import utc_now
from backend.app.auth.models import User, RoleEnum
from backend.app.members.models import Member
from backend.app.memberships.models import Membership, MembershipStatus, MembershipPlan
from backend.app.bookings.models import Booking, BookingStatus
from backend.app.courts.models import Court
from backend.app.payments.models import Payment, PaymentStatus, PaymentItemType, PaymentMethod
from backend.app.shop.models import ShopOrder, ShopOrderStatus, ShopOrderItem
from backend.app.pos.models import POSTab, TabStatus, POSTable, POSMenuItem, POSMenuCategory
from backend.app.inventory.models import Product, ProductCategory
from backend.app.reports.services import get_gst_rate, compute_tax_split


# Styling Tokens
HEADER_FONT = Font(name="Calibri", size=11, bold=True, color="FFFFFF")
HEADER_FILL = PatternFill(start_color="0F172A", end_color="0F172A", fill_type="solid")     # Slate-900
SUBHEADER_FILL = PatternFill(start_color="1E293B", end_color="1E293B", fill_type="solid")  # Slate-800
SECTION_FILL = PatternFill(start_color="065F46", end_color="065F46", fill_type="solid")    # Emerald-800
TITLE_FONT = Font(name="Calibri", size=14, bold=True, color="0F172A")
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


def _get_reconciled_revenue_records(start_d: Optional[date] = None, end_d: Optional[date] = None) -> List[Dict[str, Any]]:
    """
    Assemble the complete, audit-proof revenue ledger from the live database.
    Integrates:
    - Recorded `Payment` rows (PAID, REFUNDED)
    - Confirmed/Completed `Booking` rows not yet encapsulated in `Payment`
    - Completed/Confirmed `ShopOrder` rows not yet encapsulated in `Payment`
    - Paid/Closed `POSTab` rows not yet encapsulated in `Payment`
    - Active `Membership` subscription fees not yet encapsulated in `Payment`
    Guarantees no double-counting and 100% reflection of any DB modifications.
    """
    records: List[Dict[str, Any]] = []

    # 1. Direct Payments from Payment table
    pay_q = Payment.query.filter(Payment.status.in_([PaymentStatus.PAID, PaymentStatus.REFUNDED]))
    if start_d:
        pay_q = pay_q.filter(Payment.created_at >= datetime.combine(start_d, time.min))
    if end_d:
        pay_q = pay_q.filter(Payment.created_at <= datetime.combine(end_d, time.max))

    payments = pay_q.order_by(Payment.created_at.desc()).all()

    recorded_bookings = set()
    recorded_shop_orders = set()
    recorded_pos_tabs = set()
    recorded_memberships = set()

    for p in payments:
        amt = Decimal(str(p.amount)) if p.amount is not None else Decimal("0.00")
        if p.status == PaymentStatus.REFUNDED:
            amt = -amt

        rate = get_gst_rate(p.item_type) if p.item_type else Decimal("0.18")
        net, tax = compute_tax_split(amt, rate)

        payer_str = (
            p.user.full_name
            if p.user
            else (f"User #{p.user_id}" if p.user_id else "Member / Guest")
        )
        stream_str = p.item_type.value if hasattr(p.item_type, "value") else str(p.item_type)
        method_str = p.payment_method.value if hasattr(p.payment_method, "value") else str(p.payment_method)
        status_str = p.status.value if hasattr(p.status, "value") else str(p.status)

        if p.item_type == PaymentItemType.BOOKING:
            recorded_bookings.add(p.item_id)
        elif p.item_type == PaymentItemType.SHOP_ORDER:
            recorded_shop_orders.add(p.item_id)
        elif p.item_type == PaymentItemType.POS_ORDER:
            recorded_pos_tabs.add(p.item_id)
        elif p.item_type == PaymentItemType.MEMBERSHIP:
            recorded_memberships.add(p.item_id)

        records.append({
            "reference": p.payment_reference,
            "stream": stream_str,
            "payer": payer_str,
            "gross": amt,
            "net": net,
            "tax": tax,
            "rate_str": f"{int(rate * 100)}%",
            "method": method_str,
            "status": status_str,
            "datetime": p.created_at,
        })

    # 2. Reconcile Bookings not in Payment table
    bk_q = Booking.query.filter(Booking.status.in_([BookingStatus.CONFIRMED, BookingStatus.COMPLETED]))
    if start_d:
        bk_q = bk_q.filter(Booking.booking_date >= start_d)
    if end_d:
        bk_q = bk_q.filter(Booking.booking_date <= end_d)

    for b in bk_q.all():
        if b.id in recorded_bookings:
            continue
        amt = Decimal(str(b.final_price)) if b.final_price is not None else Decimal("0.00")
        if amt <= Decimal("0.00"):
            continue
        rate = Decimal("0.18")
        net, tax = compute_tax_split(amt, rate)
        payer = (
            (b.member.user.full_name if (b.member and b.member.user) else None)
            or (b.user.full_name if b.user else None)
            or b.guest_name
            or "Guest Player"
        )
        records.append({
            "reference": b.booking_reference,
            "stream": "BOOKING",
            "payer": payer,
            "gross": amt,
            "net": net,
            "tax": tax,
            "rate_str": "18%",
            "method": "DESK / DIRECT",
            "status": "PAID",
            "datetime": b.created_at or datetime.combine(b.booking_date, time.min),
        })

    # 3. Reconcile Shop Orders not in Payment table
    shop_q = ShopOrder.query.filter(ShopOrder.status != ShopOrderStatus.CANCELLED)
    if start_d:
        shop_q = shop_q.filter(func.date(ShopOrder.created_at) >= start_d)
    if end_d:
        shop_q = shop_q.filter(func.date(ShopOrder.created_at) <= end_d)

    for o in shop_q.all():
        if o.id in recorded_shop_orders:
            continue
        amt = Decimal(str(o.total_amount)) if o.total_amount is not None else Decimal("0.00")
        if amt <= Decimal("0.00"):
            continue
        rate = Decimal("0.18")
        net, tax = compute_tax_split(amt, rate)
        payer = (
            (o.member.user.full_name if (o.member and o.member.user) else None)
            or (o.user.full_name if o.user else None)
            or o.customer_name
            or "Shop Customer"
        )
        records.append({
            "reference": o.order_reference or f"SHOP-ORD-{o.id:05d}",
            "stream": "SHOP_ORDER",
            "payer": payer,
            "gross": amt,
            "net": net,
            "tax": tax,
            "rate_str": "18%",
            "method": o.payment_method or "COUNTER",
            "status": o.payment_status or "PAID",
            "datetime": o.created_at,
        })

    # 4. Reconcile POS Tabs not in Payment table
    pos_q = POSTab.query.filter(POSTab.status.in_([TabStatus.PAID, TabStatus.CLOSED]))
    if start_d:
        pos_q = pos_q.filter(func.date(POSTab.created_at) >= start_d)
    if end_d:
        pos_q = pos_q.filter(func.date(POSTab.created_at) <= end_d)

    for t in pos_q.all():
        if t.id in recorded_pos_tabs:
            continue
        amt = Decimal(str(t.total_amount)) if t.total_amount is not None else Decimal("0.00")
        if amt <= Decimal("0.00"):
            continue
        rate = Decimal("0.05")
        net, tax = compute_tax_split(amt, rate)
        payer = (
            (t.member.user.full_name if (t.member and t.member.user) else None)
            or t.customer_name
            or "Bar Guest"
        )
        records.append({
            "reference": t.tab_reference or f"POS-TAB-{t.id:04d}",
            "stream": "POS_ORDER",
            "payer": payer,
            "gross": amt,
            "net": net,
            "tax": tax,
            "rate_str": "5%",
            "method": t.payment_method or "CASH",
            "status": "PAID",
            "datetime": t.closed_at or t.created_at,
        })

    # 5. Reconcile Memberships not in Payment table
    ms_q = Membership.query.filter(Membership.status == MembershipStatus.ACTIVE)
    if start_d:
        ms_q = ms_q.filter(Membership.start_date >= start_d)
    if end_d:
        ms_q = ms_q.filter(Membership.start_date <= end_d)

    for ms in ms_q.all():
        if ms.id in recorded_memberships:
            continue
        amt = (
            Decimal(str(ms.price_paid))
            if ms.price_paid is not None
            else (
                Decimal(str(ms.plan.effective_annual_price))
                if (ms.plan and hasattr(ms.plan, "effective_annual_price"))
                else Decimal("0.00")
            )
        )
        if amt <= Decimal("0.00"):
            continue
        rate = Decimal("0.18")
        net, tax = compute_tax_split(amt, rate)
        payer = (
            ms.member.user.full_name
            if (ms.member and ms.member.user)
            else f"Member #{ms.member_id}"
        )
        records.append({
            "reference": f"MS-SUB-{ms.id:04d}",
            "stream": "MEMBERSHIP",
            "payer": payer,
            "gross": amt,
            "net": net,
            "tax": tax,
            "rate_str": "18%",
            "method": "SUBSCRIPTION",
            "status": "PAID",
            "datetime": ms.created_at or datetime.combine(ms.start_date, time.min),
        })

    # Sort descending by timestamp
    records.sort(
        key=lambda r: r["datetime"] if r["datetime"] else datetime.min,
        reverse=True,
    )
    return records


# ---------------------------------------------------------------------------
# 1. Executive Summary Sheet
# ---------------------------------------------------------------------------
def build_executive_summary_sheet(
    wb: openpyxl.Workbook,
    start_d: Optional[date] = None,
    end_d: Optional[date] = None,
):
    ws = wb.create_sheet(title="Executive Summary", index=0)
    ws.views.sheetView[0].showGridLines = True

    # Title block
    ws.append(["CHAMPIONS CLUB — EXECUTIVE REVENUE & OPERATIONAL REPORT"])
    ws.cell(row=1, column=1).font = TITLE_FONT
    ws.append([f"Report Generated: {utc_now().strftime('%Y-%m-%d %H:%M UTC')} | Scope: {'Custom Date Range' if start_d or end_d else 'Full Live Database'}"])
    ws.cell(row=2, column=1).font = MUTED_FONT
    ws.append([])

    # Total counts queried directly from live DB
    member_user_ids = {u.id for u in User.query.filter(User.role == RoleEnum.MEMBER).all()}
    member_profile_user_ids = {m.user_id for m in Member.query.all() if m.user_id}
    all_member_user_ids = member_user_ids | member_profile_user_ids
    total_members = len(all_member_user_ids) if all_member_user_ids else Member.query.count()

    total_staff = User.query.filter(User.role != RoleEnum.MEMBER).count()
    total_courts_bookings = Booking.query.filter(Booking.status != BookingStatus.CANCELLED).count()
    total_active_memberships = Membership.query.filter(Membership.status == MembershipStatus.ACTIVE).count()
    total_products = Product.query.count()
    total_tabs = POSTab.query.count()

    # Reconciled revenue from all streams
    reconciled_records = _get_reconciled_revenue_records(start_d, end_d)
    gross_total = Decimal("0.00")
    net_total = Decimal("0.00")
    gst_total = Decimal("0.00")

    stream_totals: Dict[str, Dict[str, Any]] = {
        "BOOKING": {"gross": Decimal("0.00"), "net": Decimal("0.00"), "gst": Decimal("0.00"), "count": 0},
        "SHOP_ORDER": {"gross": Decimal("0.00"), "net": Decimal("0.00"), "gst": Decimal("0.00"), "count": 0},
        "POS_ORDER": {"gross": Decimal("0.00"), "net": Decimal("0.00"), "gst": Decimal("0.00"), "count": 0},
        "MEMBERSHIP": {"gross": Decimal("0.00"), "net": Decimal("0.00"), "gst": Decimal("0.00"), "count": 0},
        "INVOICE": {"gross": Decimal("0.00"), "net": Decimal("0.00"), "gst": Decimal("0.00"), "count": 0},
    }

    for rec in reconciled_records:
        g = rec["gross"]
        n = rec["net"]
        t = rec["tax"]
        s = rec["stream"]

        gross_total += g
        net_total += n
        gst_total += t

        if s in stream_totals:
            stream_totals[s]["gross"] += g
            stream_totals[s]["net"] += n
            stream_totals[s]["gst"] += t
            stream_totals[s]["count"] += 1

    # High-level KPIs Table
    ws.append(["EXECUTIVE KPI SNAPSHOT", "VALUE"])
    _style_header_row(ws, ws.max_row, fill=SECTION_FILL)
    kpis = [
        ("Gross Revenue Reconciled (INR)", float(gross_total)),
        ("Net Operating Revenue (INR)", float(net_total)),
        ("GST Liability Collected (INR)", float(gst_total)),
        ("Total Club Members Registered", total_members),
        ("Total Operating Staff & Coaches", total_staff),
        ("Total Confirmed Court Bookings", total_courts_bookings),
        ("Total Active Membership Subscriptions", total_active_memberships),
        ("Total Pro Shop SKUs in Inventory", total_products),
        ("Total Sports Bar & Café Tabs Served", total_tabs),
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

    # Total row
    r_tot = ws.max_row + 1
    ws.append([
        "TOTAL RECONCILED",
        len(reconciled_records),
        float(gross_total),
        float(net_total),
        float(gst_total),
        "100.0%",
    ])
    for c in range(1, 7):
        ws.cell(row=r_tot, column=c).border = CELL_BORDER
        ws.cell(row=r_tot, column=c).font = BOLD_CELL_FONT
        ws.cell(row=r_tot, column=c).fill = SUBHEADER_FILL
        ws.cell(row=r_tot, column=c).font = Font(name="Calibri", size=10, bold=True, color="FFFFFF")
    ws.cell(row=r_tot, column=3).number_format = "#,##0.00"
    ws.cell(row=r_tot, column=4).number_format = "#,##0.00"
    ws.cell(row=r_tot, column=5).number_format = "#,##0.00"

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

    # Gather all members comprehensively:
    # 1) Rows in Member table
    members_by_user_id = {m.user_id: m for m in Member.query.all() if m.user_id}
    # 2) Users with role MEMBER
    member_users = User.query.filter(User.role == RoleEnum.MEMBER).order_by(User.id).all()
    # 3) Any other users attached to Member rows
    all_users_to_show = list(member_users)
    existing_uids = {u.id for u in all_users_to_show}
    for m in Member.query.order_by(Member.id).all():
        if m.user and m.user.id not in existing_uids:
            all_users_to_show.append(m.user)
            existing_uids.add(m.user.id)

    for u in all_users_to_show:
        m = members_by_user_id.get(u.id)
        name = u.full_name
        email = u.email
        phone = (m.phone if m else None) or getattr(u, "phone", None) or "N/A"
        gender = (m.gender if m else None) or "N/A"
        age = (m.calculate_age() if m else None) or "N/A"
        address = (m.address if m else None) or "N/A"

        active_ms = m.get_active_membership() if m else None
        if not active_ms:
            # Check Membership table directly by member_id or user
            if m:
                active_ms = Membership.query.filter(
                    Membership.member_id == m.id,
                    Membership.status == MembershipStatus.ACTIVE,
                ).first()

        tier_label = active_ms.plan.name if (active_ms and active_ms.plan) else "STANDARD"
        status_label = (
            active_ms.status.value
            if active_ms
            else ("ACTIVE" if u.is_active else "PENDING_VERIFICATION")
        )
        expiry_str = (
            active_ms.end_date.strftime("%Y-%m-%d")
            if (active_ms and active_ms.end_date)
            else "Lifetime"
        )

        # Count all bookings for this user/member
        b_conditions = [Booking.user_id == u.id]
        if m:
            b_conditions.append(Booking.member_id == m.id)
        bookings_count = Booking.query.filter(
            db.or_(*b_conditions),
            Booking.status != BookingStatus.CANCELLED,
        ).count()

        # Calculate actual spend across payments and bookings
        p_conditions = [Payment.user_id == u.id]
        if m:
            p_conditions.append(Payment.member_id == m.id)
        direct_payment_spend = db.session.query(
            func.coalesce(func.sum(Payment.amount), 0)
        ).filter(
            db.or_(*p_conditions),
            Payment.status == PaymentStatus.PAID,
        ).scalar() or Decimal("0.00")

        # Booking spend not in payment table
        booking_spend = db.session.query(
            func.coalesce(func.sum(Booking.final_price), 0)
        ).filter(
            db.or_(*b_conditions),
            Booking.status.in_([BookingStatus.CONFIRMED, BookingStatus.COMPLETED]),
        ).scalar() or Decimal("0.00")

        total_spend = max(Decimal(str(direct_payment_spend)), Decimal(str(booking_spend)))

        created_ts = (m.created_at if m else None) or u.created_at
        created_str = created_ts.strftime("%Y-%m-%d") if created_ts else "N/A"
        member_id_str = f"CC-MEM-{m.id:04d}" if m else f"CC-MEM-U{u.id:04d}"

        r = ws.max_row + 1
        ws.append([
            member_id_str,
            name,
            email,
            phone,
            gender,
            age,
            address,
            tier_label,
            status_label,
            expiry_str,
            bookings_count,
            float(total_spend),
            created_str,
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

    # Strictly select operational staff & employees (excluding basic members)
    users = (
        User.query.filter(User.role != RoleEnum.MEMBER)
        .order_by(User.role, User.first_name)
        .all()
    )
    for u in users:
        role_str = u.role.value if hasattr(u.role, "value") else str(u.role)
        dept_str = u.department or "Club Operations"
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

    records = _get_reconciled_revenue_records(start_d, end_d)
    for rec in records:
        date_str = (
            rec["datetime"].strftime("%Y-%m-%d %H:%M")
            if rec["datetime"]
            else "N/A"
        )
        r = ws.max_row + 1
        ws.append([
            rec["reference"],
            rec["stream"],
            rec["payer"],
            float(rec["gross"]),
            float(rec["net"]),
            float(rec["tax"]),
            rec["rate_str"],
            rec["method"],
            rec["status"],
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
        "Base Price (INR)",
        "Discount (INR)",
        "Booked At",
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
        court_name = b.court.name if b.court else "Court Arena"
        sport_name = (
            b.court.sport_type.value
            if (b.court and hasattr(b.court.sport_type, "value"))
            else "BADMINTON"
        )
        player_name = (
            (b.member.user.full_name if (b.member and b.member.user) else None)
            or (b.user.full_name if b.user else None)
            or b.guest_name
            or "Guest Player"
        )
        slot_str = (
            f"{b.start_time.strftime('%H:%M')} – {b.end_time.strftime('%H:%M')}"
            if (b.start_time and b.end_time)
            else "Slot"
        )
        amt = Decimal(str(b.final_price)) if b.final_price is not None else Decimal("0.00")
        base = Decimal(str(b.base_price)) if b.base_price is not None else Decimal("0.00")
        disc = Decimal(str(b.discount_amount)) if b.discount_amount is not None else Decimal("0.00")
        net, tax = compute_tax_split(amt, rate)

        r = ws.max_row + 1
        ws.append([
            b.booking_reference,
            court_name,
            sport_name,
            player_name,
            b.booking_date.strftime("%Y-%m-%d") if b.booking_date else "N/A",
            slot_str,
            b.status.value if hasattr(b.status, "value") else str(b.status),
            float(amt),
            float(net),
            float(tax),
            float(base),
            float(disc),
            b.created_at.strftime("%Y-%m-%d %H:%M") if b.created_at else "N/A",
        ])

        for c in range(1, len(headers) + 1):
            cell = ws.cell(row=r, column=c)
            cell.border = CELL_BORDER
            cell.font = CELL_FONT
        ws.cell(row=r, column=8).number_format = "#,##0.00"
        ws.cell(row=r, column=9).number_format = "#,##0.00"
        ws.cell(row=r, column=10).number_format = "#,##0.00"
        ws.cell(row=r, column=11).number_format = "#,##0.00"
        ws.cell(row=r, column=12).number_format = "#,##0.00"

    _autofit_columns(ws)


# ---------------------------------------------------------------------------
# 6. Pro Shop Merchandise Revenue & Inventory Sheets
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
        "Subtotal (INR)",
        "Discount (INR)",
        "Total Amount (INR)",
        "Net Amount (INR)",
        "GST 18% (INR)",
        "Payment Status",
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
        cust = (
            (o.member.user.full_name if (o.member and o.member.user) else None)
            or (o.user.full_name if o.user else None)
            or o.customer_name
            or "Walk-in Guest"
        )
        items_cnt = sum(item.quantity for item in o.items) if o.items else 1
        amt = Decimal(str(o.total_amount)) if o.total_amount is not None else Decimal("0.00")
        sub = Decimal(str(o.subtotal_amount)) if o.subtotal_amount is not None else Decimal("0.00")
        disc = Decimal(str(o.discount_amount)) if o.discount_amount is not None else Decimal("0.00")
        net, tax = compute_tax_split(amt, rate)

        r = ws.max_row + 1
        ws.append([
            o.order_reference or f"SHOP-ORD-{o.id:05d}",
            cust,
            o.order_type.value if hasattr(o.order_type, "value") else str(o.order_type),
            items_cnt,
            float(sub),
            float(disc),
            float(amt),
            float(net),
            float(tax),
            o.payment_status or "PAID",
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
        ws.cell(row=r, column=8).number_format = "#,##0.00"
        ws.cell(row=r, column=9).number_format = "#,##0.00"

    _autofit_columns(ws)


def build_shop_inventory_sheet(wb: openpyxl.Workbook, title: str = "Pro Shop Inventory"):
    ws = wb.create_sheet(title=title)
    ws.views.sheetView[0].showGridLines = True

    headers = [
        "SKU",
        "Product Name",
        "Category",
        "Retail Price (INR)",
        "Cost Price (INR)",
        "Stock Quantity",
        "Low Stock Threshold",
        "Stock Status",
        "Barcode",
        "Catalog Status",
    ]
    ws.append(headers)
    _style_header_row(ws, 1, fill=SECTION_FILL)

    products = Product.query.order_by(Product.category_id, Product.name).all()
    for p in products:
        cat_name = p.category.name if p.category else "General Merchandise"
        stock_status = (
            "OUT OF STOCK"
            if p.stock_quantity <= 0
            else ("LOW STOCK" if p.stock_quantity <= p.low_stock_threshold else "IN STOCK")
        )

        r = ws.max_row + 1
        ws.append([
            p.sku,
            p.name,
            cat_name,
            float(p.price) if p.price is not None else 0.0,
            float(p.cost_price) if p.cost_price is not None else 0.0,
            p.stock_quantity,
            p.low_stock_threshold,
            stock_status,
            p.barcode or "N/A",
            "Active" if p.is_active else "Inactive",
        ])

        for c in range(1, len(headers) + 1):
            cell = ws.cell(row=r, column=c)
            cell.border = CELL_BORDER
            cell.font = CELL_FONT
        ws.cell(row=r, column=4).number_format = "#,##0.00"
        ws.cell(row=r, column=5).number_format = "#,##0.00"

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
        "Subtotal (INR)",
        "Discount (INR)",
        "Total Amount (INR)",
        "Net Amount (INR)",
        "GST 5% (INR)",
        "Paid Amount (INR)",
        "Tab Status",
        "Payment Status",
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
        cust_str = (
            (t.member.user.full_name if (t.member and t.member.user) else None)
            or t.customer_name
            or "Walk-in Guest"
        )
        amt = Decimal(str(t.total_amount)) if t.total_amount is not None else Decimal("0.00")
        sub = Decimal(str(t.subtotal_amount)) if t.subtotal_amount is not None else Decimal("0.00")
        disc = Decimal(str(t.discount_amount)) if t.discount_amount is not None else Decimal("0.00")
        paid = Decimal(str(t.paid_amount)) if t.paid_amount is not None else Decimal("0.00")
        net, tax = compute_tax_split(amt, rate)

        r = ws.max_row + 1
        ws.append([
            t.tab_reference or f"POS-TAB-{t.id:04d}",
            table_str,
            cust_str,
            float(sub),
            float(disc),
            float(amt),
            float(net),
            float(tax),
            float(paid),
            t.status.value if hasattr(t.status, "value") else str(t.status),
            getattr(t, "payment_status", "PAID"),
            t.created_at.strftime("%Y-%m-%d %H:%M") if t.created_at else "N/A",
            t.closed_at.strftime("%Y-%m-%d %H:%M") if t.closed_at else ("Open" if t.status == TabStatus.OPEN else "Closed"),
        ])

        for c in range(1, len(headers) + 1):
            cell = ws.cell(row=r, column=c)
            cell.border = CELL_BORDER
            cell.font = CELL_FONT
        ws.cell(row=r, column=4).number_format = "#,##0.00"
        ws.cell(row=r, column=5).number_format = "#,##0.00"
        ws.cell(row=r, column=6).number_format = "#,##0.00"
        ws.cell(row=r, column=7).number_format = "#,##0.00"
        ws.cell(row=r, column=8).number_format = "#,##0.00"
        ws.cell(row=r, column=9).number_format = "#,##0.00"

    _autofit_columns(ws)


def build_bar_menu_sheet(wb: openpyxl.Workbook, title: str = "Bar & Café Menu"):
    ws = wb.create_sheet(title=title)
    ws.views.sheetView[0].showGridLines = True

    headers = [
        "Item Code",
        "Item Name",
        "Category",
        "Price (INR)",
        "GST Rate",
        "Prep Time (min)",
        "Availability",
        "Active Status",
    ]
    ws.append(headers)
    _style_header_row(ws, 1, fill=HEADER_FILL)

    items = POSMenuItem.query.order_by(POSMenuItem.category_id, POSMenuItem.name).all()
    for item in items:
        cat_name = item.category.name if item.category else "Café & Bar"
        r = ws.max_row + 1
        ws.append([
            item.code,
            item.name,
            cat_name,
            float(item.price) if item.price is not None else 0.0,
            f"{int((item.tax_rate or Decimal('0.05')) * 100)}%",
            item.preparation_time_minutes or 10,
            "Available" if item.is_available else "Sold Out",
            "Active" if item.is_active else "Inactive",
        ])

        for c in range(1, len(headers) + 1):
            cell = ws.cell(row=r, column=c)
            cell.border = CELL_BORDER
            cell.font = CELL_FONT
        ws.cell(row=r, column=4).number_format = "#,##0.00"

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
        "Created At",
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
        mem_name = (
            ms.member.user.full_name
            if (ms.member and ms.member.user)
            else f"Member #{ms.member_id}"
        )
        email = ms.member.user.email if (ms.member and ms.member.user) else "N/A"
        plan_name = ms.plan.name if ms.plan else "Club Plan"
        plan_code = ms.plan.code if ms.plan else "GOLD"
        amt = (
            Decimal(str(ms.price_paid))
            if ms.price_paid is not None
            else (
                Decimal(str(ms.plan.effective_annual_price))
                if (ms.plan and hasattr(ms.plan, "effective_annual_price"))
                else Decimal("0.00")
            )
        )
        net, tax = compute_tax_split(amt, rate)

        r = ws.max_row + 1
        ws.append([
            f"MS-SUB-{ms.id:04d}",
            mem_name,
            email,
            plan_name,
            plan_code,
            ms.start_date.strftime("%Y-%m-%d") if ms.start_date else "N/A",
            ms.end_date.strftime("%Y-%m-%d") if ms.end_date else "Lifetime",
            float(amt),
            float(net),
            float(tax),
            ms.status.value if hasattr(ms.status, "value") else str(ms.status),
            ms.created_at.strftime("%Y-%m-%d %H:%M") if ms.created_at else "N/A",
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
    Always expires cached ORM instances before querying to guarantee 100% live reflection of DB changes.
    Supports individual sections or 'all' master multi-sheet export.
    """
    # 1. Force refresh SQLAlchemy identity map so live database modifications reflect immediately
    try:
        db.session.rollback()
    except Exception:
        pass
    db.session.expire_all()

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
        build_shop_inventory_sheet(wb, title="Pro Shop Inventory")
    elif sec in ("bar", "pos", "cafe", "restaurant"):
        build_bar_revenue_sheet(wb, start_d, end_d, title="Sports Bar Revenue")
        build_bar_menu_sheet(wb, title="Bar & Café Menu")
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
        # "all" or master multi-sheet workbook
        build_executive_summary_sheet(wb, start_d, end_d)
        build_members_sheet(wb, title="Members Directory")
        build_employees_sheet(wb, title="Staff & Employees")
        build_all_revenue_sheet(wb, start_d, end_d, title="All Revenue Reconciled")
        build_courts_revenue_sheet(wb, start_d, end_d, title="Courts Revenue")
        build_shop_revenue_sheet(wb, start_d, end_d, title="Pro Shop Revenue")
        build_shop_inventory_sheet(wb, title="Pro Shop Inventory")
        build_bar_revenue_sheet(wb, start_d, end_d, title="Sports Bar Revenue")
        build_bar_menu_sheet(wb, title="Bar & Café Menu")
        build_memberships_revenue_sheet(wb, start_d, end_d, title="Membership Revenue")

    buf = io.BytesIO()
    wb.save(buf)
    buf.seek(0)
    return buf
