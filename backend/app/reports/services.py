"""
Centralized Revenue and Owner Dashboard Reporting Services for Champions Club.
==============================================================================

FINANCIAL & REVENUE ARCHITECTURE:
---------------------------------
1. Centralized Revenue Definition:
   Revenue is strictly defined in this single module and reconciled with the `payments` table.
   - Gross Revenue = (Sum of PAID payments) - (Sum of REFUNDED payments).
   - Only payments with status == PaymentStatus.PAID are counted as collected revenue.
   - Payments with status == PaymentStatus.REFUNDED are accounted for as refunds.
   - PENDING, FAILED, CANCELLED, and REFUND_PENDING are strictly excluded from revenue.

2. Goods & Services Tax (GST) Representation:
   In accordance with Indian tax rules and club policy, all published member and guest prices
   are inclusive of GST.
   - Court Bookings: 18% GST (Sports facility service)
   - Club Memberships: 18% GST (Club subscription service)
   - Shop Merchandise: 18% GST (Standard sports gear & equipment)
   - Bar & Cafeteria (POS): 5% GST (Food & non-alcoholic beverage service)
   - Corporate Invoices: 18% GST (Corporate services)

   Tax Calculation Formula (Tax-Inclusive):
   - divisor = 1.0 + gst_rate
   - net_revenue = gross_revenue / divisor
   - gst_amount = gross_revenue - net_revenue

   Reconciliation: For any report, `gross_revenue == net_revenue + gst_amount` within 1 cent rounding.

3. Timezone Boundaries:
   The club operates in the Asia/Kolkata timezone (UTC+05:30).
   Day, week, and month boundaries are strictly computed in the club's local timezone
   before querying or bucketing database timestamps.
"""

import calendar
from datetime import datetime, date, time, timedelta, timezone
from decimal import Decimal, ROUND_HALF_UP
from typing import Optional, Dict, Any, List, Tuple
from zoneinfo import ZoneInfo

from flask import current_app
from sqlalchemy import func, and_, or_, distinct

from backend.app.extensions import db
from backend.app.common.utils import utc_now
from backend.app.payments.models import (
    Payment,
    PaymentMethod,
    PaymentStatus,
    PaymentItemType,
)
from backend.app.bookings.models import Booking, BookingStatus, CourtOccupancy
from backend.app.courts.models import Court, SportType, CourtStatus
from backend.app.memberships.models import (
    Membership,
    MembershipPlan,
    MembershipStatus,
    MembershipRequest,
    MembershipRequestStatus,
)
from backend.app.members.models import Member
from backend.app.shop.models import ShopOrder, ShopOrderItem, ShopOrderStatus, OrderType
from backend.app.pos.models import (
    POSTab,
    POSOrderItem,
    POSTable,
    TabStatus,
    TabPaymentStatus,
    POSMenuItem,
    POSMenuCategory,
)
from backend.app.crm.models import CRMLead, CRMFollowUp, LeadStatus, FollowUpStatus
from backend.app.inventory.models import Product


# Standard GST rates by business stream
DEFAULT_GST_RATES: Dict[PaymentItemType, Decimal] = {
    PaymentItemType.BOOKING: Decimal("0.18"),
    PaymentItemType.MEMBERSHIP: Decimal("0.18"),
    PaymentItemType.SHOP_ORDER: Decimal("0.18"),
    PaymentItemType.POS_ORDER: Decimal("0.05"),
    PaymentItemType.INVOICE: Decimal("0.18"),
}


def get_club_timezone() -> ZoneInfo:
    """Retrieve club operating timezone from configuration (default 'Asia/Kolkata')."""
    if current_app:
        tz_name = current_app.config.get("CLUB_TIMEZONE", "Asia/Kolkata")
    else:
        tz_name = "Asia/Kolkata"
    try:
        return ZoneInfo(tz_name)
    except Exception:
        return ZoneInfo("Asia/Kolkata")


def get_gst_rate(item_type: PaymentItemType) -> Decimal:
    """Get statutory GST rate for a given payment item type."""
    if current_app:
        if item_type == PaymentItemType.POS_ORDER:
            rate = current_app.config.get("GST_RATE_POS", 0.05)
            return Decimal(str(rate))
        elif item_type == PaymentItemType.SHOP_ORDER:
            rate = current_app.config.get("GST_RATE_SHOP", 0.18)
            return Decimal(str(rate))
        elif item_type == PaymentItemType.INVOICE:
            rate = current_app.config.get("GST_RATE_INVOICE", 0.18)
            return Decimal(str(rate))
        else:
            rate = current_app.config.get("GST_RATE_SERVICES", 0.18)
            return Decimal(str(rate))
    return DEFAULT_GST_RATES.get(item_type, Decimal("0.18"))


def compute_tax_split(gross_amount: Decimal, gst_rate: Decimal) -> Tuple[Decimal, Decimal]:
    """
    Split a tax-inclusive gross amount into (net_revenue, gst_amount).
    Formula: net = gross / (1 + gst_rate), gst = gross - net.
    """
    if gross_amount <= Decimal("0.00"):
        return Decimal("0.00"), Decimal("0.00")

    divisor = Decimal("1.0") + gst_rate
    net = (gross_amount / divisor).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
    gst = gross_amount - net
    return net, gst


def get_period_boundaries(
    period: str = "today",
    custom_start: Optional[date] = None,
    custom_end: Optional[date] = None,
) -> Tuple[datetime, datetime, date, date, str]:
    """
    Compute start and end boundaries in UTC corresponding to the club local calendar.
    Returns: (start_utc, end_utc, local_start_date, local_end_date, normalized_period_name)
    """
    club_tz = get_club_timezone()
    now_local = datetime.now(club_tz)

    normalized_period = (period or "today").lower().strip()

    if custom_start and custom_end:
        start_date = custom_start
        end_date = custom_end
        normalized_period = "custom"
    elif normalized_period == "today":
        start_date = now_local.date()
        end_date = now_local.date()
    elif normalized_period in ("week", "this_week"):
        # Monday to Sunday of the current week
        start_date = now_local.date() - timedelta(days=now_local.weekday())
        end_date = start_date + timedelta(days=6)
    elif normalized_period in ("month", "this_month"):
        # 1st of month to last day of month
        start_date = now_local.date().replace(day=1)
        _, last_day = calendar.monthrange(now_local.year, now_local.month)
        end_date = now_local.date().replace(day=last_day)
    elif normalized_period in ("year", "this_year"):
        start_date = now_local.date().replace(month=1, day=1)
        end_date = now_local.date().replace(month=12, day=31)
    else:
        # Default fallback to today
        start_date = now_local.date()
        end_date = now_local.date()
        normalized_period = "today"

    # Construct timezone-aware local boundary moments
    start_local = datetime.combine(start_date, time.min, tzinfo=club_tz)
    end_local = datetime.combine(end_date, time.max, tzinfo=club_tz)

    # Convert to UTC for database queries
    start_utc = start_local.astimezone(timezone.utc)
    end_utc = end_local.astimezone(timezone.utc)

    return start_utc, end_utc, start_date, end_date, normalized_period


# ---------------------------------------------------------------------------
# CORE REVENUE AGGREGATION ENGINE
# ---------------------------------------------------------------------------

def calculate_reconciled_revenue(
    item_type: Optional[PaymentItemType] = None,
    start_utc: Optional[datetime] = None,
    end_utc: Optional[datetime] = None,
    payment_method: Optional[PaymentMethod] = None,
) -> Dict[str, Any]:
    """
    Centralized, audit-proof revenue aggregator.
    Reconciles directly with the `payments` table.
    
    Returns structured financial metrics:
    - gross_paid: Total paid payments
    - gross_refunded: Total refunded payments
    - gross_revenue: gross_paid - gross_refunded
    - net_revenue: gross_revenue excluding GST liability
    - tax_amount: GST liability
    - transactions_count: Count of paid payments
    - refunds_count: Count of refunded payments
    - breakdown_by_stream: Breakdown across the 5 streams
    - breakdown_by_method: Breakdown across CASH, CARD, UPI, ONLINE
    - daily_time_series: Day-by-day sequence in local club timezone
    """
    club_tz = get_club_timezone()

    # Query all eligible payments
    base_query = Payment.query.filter(
        Payment.status.in_([PaymentStatus.PAID, PaymentStatus.REFUNDED])
    )

    if item_type is not None:
        base_query = base_query.filter(Payment.item_type == item_type)

    if payment_method is not None:
        base_query = base_query.filter(Payment.payment_method == payment_method)

    # Timestamp expression: prioritize paid_at, then created_at
    effective_ts = func.coalesce(Payment.paid_at, Payment.created_at)

    if start_utc is not None:
        base_query = base_query.filter(effective_ts >= start_utc)
    if end_utc is not None:
        base_query = base_query.filter(effective_ts <= end_utc)

    payments: List[Payment] = base_query.all()

    # Accumulators
    gross_paid = Decimal("0.00")
    gross_refunded = Decimal("0.00")
    paid_count = 0
    refunded_count = 0

    # Stream accumulators: {stream: {gross_paid, gross_refunded, count, net_paid, tax_paid, gst_rate}}
    streams_map: Dict[PaymentItemType, Dict[str, Any]] = {
        it: {
            "gross_paid": Decimal("0.00"),
            "gross_refunded": Decimal("0.00"),
            "count": 0,
            "refund_count": 0,
            "net_paid": Decimal("0.00"),
            "tax_paid": Decimal("0.00"),
            "gst_rate": get_gst_rate(it),
        }
        for it in PaymentItemType
    }

    # Payment method accumulators: {method: {gross_paid, gross_refunded, count}}
    methods_map: Dict[str, Dict[str, Any]] = {
        m.value: {
            "gross_paid": Decimal("0.00"),
            "gross_refunded": Decimal("0.00"),
            "count": 0,
        }
        for m in PaymentMethod
    }

    # Daily buckets mapped by local date string "YYYY-MM-DD"
    daily_map: Dict[str, Dict[str, Any]] = {}

    for p in payments:
        amt = Decimal(str(p.amount)) if p.amount is not None else Decimal("0.00")
        p_item_type = p.item_type
        method_str = p.payment_method.value if hasattr(p.payment_method, "value") else str(p.payment_method)

        # Determine payment timestamp in club local timezone
        ts = p.paid_at or p.created_at
        if ts:
            if ts.tzinfo is None:
                local_dt = ts.replace(tzinfo=timezone.utc).astimezone(club_tz)
            else:
                local_dt = ts.astimezone(club_tz)
            date_key = local_dt.strftime("%Y-%m-%d")
        else:
            date_key = datetime.now(club_tz).strftime("%Y-%m-%d")

        if date_key not in daily_map:
            daily_map[date_key] = {
                "date": date_key,
                "gross_paid": Decimal("0.00"),
                "gross_refunded": Decimal("0.00"),
                "transactions_count": 0,
                "net_revenue": Decimal("0.00"),
                "tax_amount": Decimal("0.00"),
            }

        # Resolve tax rate: check dynamic invoice rate if this is an invoice payment
        rate = get_gst_rate(p_item_type) if p_item_type else Decimal("0.18")
        if p_item_type == PaymentItemType.INVOICE and p.item_id:
            from backend.app.invoices.models import Invoice
            inv = db.session.get(Invoice, p.item_id)
            if inv and inv.tax_rate_value is not None:
                rate = Decimal(str(inv.tax_rate_value))

        if p.status == PaymentStatus.PAID:
            gross_paid += amt
            paid_count += 1
            if p_item_type in streams_map:
                streams_map[p_item_type]["gross_paid"] += amt
                streams_map[p_item_type]["count"] += 1
            if method_str in methods_map:
                methods_map[method_str]["gross_paid"] += amt
                methods_map[method_str]["count"] += 1

            daily_map[date_key]["gross_paid"] += amt
            daily_map[date_key]["transactions_count"] += 1

            # Compute tax contribution for this transaction
            item_net, item_tax = compute_tax_split(amt, rate)
            daily_map[date_key]["net_revenue"] += item_net
            daily_map[date_key]["tax_amount"] += item_tax
            if p_item_type in streams_map:
                streams_map[p_item_type]["net_paid"] += item_net
                streams_map[p_item_type]["tax_paid"] += item_tax

        elif p.status == PaymentStatus.REFUNDED:
            gross_refunded += amt
            refunded_count += 1
            if p_item_type in streams_map:
                streams_map[p_item_type]["gross_refunded"] += amt
                streams_map[p_item_type]["refund_count"] += 1
            if method_str in methods_map:
                methods_map[method_str]["gross_refunded"] += amt

            daily_map[date_key]["gross_refunded"] += amt

            # Deduct tax for refund
            ref_net, ref_tax = compute_tax_split(amt, rate)
            daily_map[date_key]["net_revenue"] = max(
                Decimal("0.00"), daily_map[date_key]["net_revenue"] - ref_net
            )
            daily_map[date_key]["tax_amount"] = max(
                Decimal("0.00"), daily_map[date_key]["tax_amount"] - ref_tax
            )
            if p_item_type in streams_map:
                streams_map[p_item_type]["net_paid"] = max(
                    Decimal("0.00"), streams_map[p_item_type]["net_paid"] - ref_net
                )
                streams_map[p_item_type]["tax_paid"] = max(
                    Decimal("0.00"), streams_map[p_item_type]["tax_paid"] - ref_tax
                )

    # Net gross revenue for the whole selection
    gross_revenue = max(Decimal("0.00"), gross_paid - gross_refunded)

    # Process stream breakdown and GST
    total_net = Decimal("0.00")
    total_tax = Decimal("0.00")
    stream_results: Dict[str, Any] = {}

    for s_type, s_data in streams_map.items():
        s_gross = max(Decimal("0.00"), s_data["gross_paid"] - s_data["gross_refunded"])
        s_net = s_data["net_paid"]
        s_tax = s_data["tax_paid"]
        s_rate = s_data["gst_rate"]

        # Fallback if no transactions recorded
        if s_gross > Decimal("0.00") and s_net == Decimal("0.00") and s_tax == Decimal("0.00"):
            s_net, s_tax = compute_tax_split(s_gross, s_rate)

        total_net += s_net
        total_tax += s_tax

        key_name = s_type.value.lower()
        if key_name == "pos_order":
            key_name = "bar"
        elif key_name == "shop_order":
            key_name = "shop"
        elif key_name == "booking":
            key_name = "courts"
        elif key_name == "membership":
            key_name = "memberships"
        elif key_name == "invoice":
            key_name = "invoices"

        stream_results[key_name] = {
            "gross_revenue": float(s_gross),
            "net_revenue": float(s_net),
            "tax_amount": float(s_tax),
            "paid_amount": float(s_data["gross_paid"]),
            "refunded_amount": float(s_data["gross_refunded"]),
            "transactions_count": s_data["count"],
            "refunds_count": s_data["refund_count"],
            "gst_rate": float(s_rate),
        }

    # Process payment methods breakdown
    methods_results: Dict[str, Any] = {}
    for m_key, m_data in methods_map.items():
        m_gross = max(Decimal("0.00"), m_data["gross_paid"] - m_data["gross_refunded"])
        pct = (
            float(m_gross / gross_revenue * 100)
            if gross_revenue > Decimal("0.00")
            else 0.0
        )
        methods_results[m_key] = {
            "payment_method": m_key,
            "gross_revenue": float(m_gross),
            "paid_amount": float(m_data["gross_paid"]),
            "refunded_amount": float(m_data["gross_refunded"]),
            "transactions_count": m_data["count"],
            "share_percentage": round(pct, 2),
        }

    # Format sorted time series
    sorted_dates = sorted(daily_map.keys())
    time_series = [
        {
            "date": d,
            "gross_revenue": float(
                max(
                    Decimal("0.00"),
                    daily_map[d]["gross_paid"] - daily_map[d]["gross_refunded"],
                )
            ),
            "paid_amount": float(daily_map[d]["gross_paid"]),
            "refunded_amount": float(daily_map[d]["gross_refunded"]),
            "net_revenue": float(daily_map[d]["net_revenue"]),
            "tax_amount": float(daily_map[d]["tax_amount"]),
            "transactions_count": daily_map[d]["transactions_count"],
        }
        for d in sorted_dates
    ]

    return {
        "gross_revenue": float(gross_revenue),
        "net_revenue": float(total_net),
        "tax_amount": float(total_tax),
        "paid_amount": float(gross_paid),
        "refunded_amount": float(gross_refunded),
        "transactions_count": paid_count,
        "refunds_count": refunded_count,
        "by_stream": stream_results,
        "by_payment_method": methods_results,
        "time_series": time_series,
    }


# ---------------------------------------------------------------------------
# 1. OWNER DASHBOARD OVERVIEW (Today, Weekly, Monthly Performance)
# ---------------------------------------------------------------------------

def get_dashboard_overview(
    period: str = "today",
    custom_start: Optional[date] = None,
    custom_end: Optional[date] = None,
) -> Dict[str, Any]:
    """
    Generate master dashboard summary for club owner/admin.
    Includes performance metrics, streams breakdown, payment methods,
    comparison against prior period, and operational summary.
    """
    start_utc, end_utc, start_date, end_date, normalized_period = get_period_boundaries(
        period, custom_start, custom_end
    )
    club_tz = get_club_timezone()

    # Reconciled revenue for active period
    revenue_data = calculate_reconciled_revenue(
        item_type=None, start_utc=start_utc, end_utc=end_utc
    )

    # Fill daily time series with all calendar days in range if weekly or monthly
    filled_series = _fill_time_series_gaps(
        revenue_data["time_series"], start_date, end_date
    )

    # Compute prior comparison period
    delta_days = (end_date - start_date).days + 1
    prior_end_date = start_date - timedelta(days=1)
    prior_start_date = prior_end_date - timedelta(days=delta_days - 1)

    prior_start_utc = datetime.combine(
        prior_start_date, time.min, tzinfo=club_tz
    ).astimezone(timezone.utc)
    prior_end_utc = datetime.combine(
        prior_end_date, time.max, tzinfo=club_tz
    ).astimezone(timezone.utc)

    prior_revenue_data = calculate_reconciled_revenue(
        item_type=None, start_utc=prior_start_utc, end_utc=prior_end_utc
    )

    current_gross = revenue_data["gross_revenue"]
    prior_gross = prior_revenue_data["gross_revenue"]
    if prior_gross > 0:
        growth_pct = round(((current_gross - prior_gross) / prior_gross) * 100, 2)
    elif current_gross > 0:
        growth_pct = 100.0
    else:
        growth_pct = 0.0

    # Operational KPI fast snapshot
    ops_summary = get_operational_summary()

    return {
        "period": normalized_period,
        "timezone": "Asia/Kolkata",
        "date_range": {
            "start_date": start_date.isoformat(),
            "end_date": end_date.isoformat(),
        },
        "financial_summary": {
            "gross_revenue": revenue_data["gross_revenue"],
            "net_revenue": revenue_data["net_revenue"],
            "tax_amount": revenue_data["tax_amount"],
            "paid_amount": revenue_data["paid_amount"],
            "refunded_amount": revenue_data["refunded_amount"],
            "transactions_count": revenue_data["transactions_count"],
            "refunds_count": revenue_data["refunds_count"],
        },
        "total_revenue": revenue_data["gross_revenue"],
        "gross_revenue": revenue_data["gross_revenue"],
        "net_revenue": revenue_data["net_revenue"],
        "tax_amount": revenue_data["tax_amount"],
        "executive_kpis": {
            "total_revenue": revenue_data["gross_revenue"],
            "gross_revenue": revenue_data["gross_revenue"],
            "net_revenue": revenue_data["net_revenue"],
            "tax_amount": revenue_data["tax_amount"],
            "paid_amount": revenue_data["paid_amount"],
            "refunded_amount": revenue_data["refunded_amount"],
            "active_bookings_today": ops_summary["bookings_today"]["count"],
            "active_members": ops_summary["active_memberships"]["total_active"],
            "court_occupancy_pct": round((ops_summary["bookings_today"]["count"] / 18.0) * 100, 1) if ops_summary["bookings_today"]["count"] else 0.0,
            "transactions_count": revenue_data["transactions_count"],
        },
        "period_comparison": {
            "current_period_gross": current_gross,
            "prior_period_gross": prior_gross,
            "growth_percentage": growth_pct,
            "prior_date_range": {
                "start_date": prior_start_date.isoformat(),
                "end_date": prior_end_date.isoformat(),
            },
        },
        "stream_breakdown": revenue_data["by_stream"],
        "payment_methods": revenue_data["by_payment_method"],
        "chart_time_series": filled_series,
        "operational_snapshot": {
            "bookings_today": ops_summary["bookings_today"]["count"],
            "active_members": ops_summary["active_memberships"]["total_active"],
            "open_bar_tabs": ops_summary["open_bar_tabs"]["count"],
            "pending_shop_orders": ops_summary["pending_shop_orders"]["count"],
            "low_stock_products": ops_summary["low_stock"]["count"],
            "new_leads": ops_summary["new_leads"]["count"],
            "pending_follow_ups": ops_summary["pending_follow_ups"]["count"],
        },
    }


def _fill_time_series_gaps(
    time_series: List[Dict[str, Any]], start_date: date, end_date: date
) -> List[Dict[str, Any]]:
    """Fill gap days in time series with 0.0 entries for smooth UI chart rendering."""
    data_by_date = {item["date"]: item for item in time_series}
    full_series: List[Dict[str, Any]] = []

    curr = start_date
    while curr <= end_date:
        d_str = curr.strftime("%Y-%m-%d")
        if d_str in data_by_date:
            full_series.append(data_by_date[d_str])
        else:
            full_series.append({
                "date": d_str,
                "gross_revenue": 0.0,
                "paid_amount": 0.0,
                "refunded_amount": 0.0,
                "net_revenue": 0.0,
                "tax_amount": 0.0,
                "transactions_count": 0,
            })
        curr += timedelta(days=1)

    return full_series


# ---------------------------------------------------------------------------
# 2. COURT REVENUE & UTILIZATION REPORT
# ---------------------------------------------------------------------------

def get_court_revenue_report(
    period: str = "month",
    custom_start: Optional[date] = None,
    custom_end: Optional[date] = None,
) -> Dict[str, Any]:
    """
    Detailed Court Revenue & Utilization Report.
    Reconciles with PaymentItemType.BOOKING.
    """
    start_utc, end_utc, start_date, end_date, normalized_period = get_period_boundaries(
        period, custom_start, custom_end
    )
    club_tz = get_club_timezone()

    # Financial revenue from payments table
    revenue_data = calculate_reconciled_revenue(
        item_type=PaymentItemType.BOOKING,
        start_utc=start_utc,
        end_utc=end_utc,
    )

    # Bookings analytics within the period
    bookings = Booking.query.filter(
        Booking.booking_date >= start_date,
        Booking.booking_date <= end_date,
    ).all()

    total_bookings = len(bookings)
    confirmed_bookings = sum(1 for b in bookings if b.status == BookingStatus.CONFIRMED)
    completed_bookings = sum(1 for b in bookings if b.status == BookingStatus.COMPLETED)
    cancelled_bookings = sum(1 for b in bookings if b.status == BookingStatus.CANCELLED)
    member_bookings = sum(1 for b in bookings if b.member_id is not None)
    walk_in_bookings = sum(1 for b in bookings if b.is_walk_in)
    social_play_bookings = sum(1 for b in bookings if b.is_social_play)

    # Sport breakdown
    sports_map: Dict[str, Dict[str, Any]] = {
        st.value: {"sport": st.value, "bookings_count": 0, "total_booked_hours": 0.0}
        for st in SportType
    }

    for b in bookings:
        if b.status != BookingStatus.CANCELLED and b.court:
            sport_key = (
                b.court.sport_type.value
                if hasattr(b.court.sport_type, "value")
                else str(b.court.sport_type)
            )
            if sport_key not in sports_map:
                sports_map[sport_key] = {
                    "sport": sport_key,
                    "bookings_count": 0,
                    "total_booked_hours": 0.0,
                }
            sports_map[sport_key]["bookings_count"] += 1
            # Standard 1 hour session duration
            sports_map[sport_key]["total_booked_hours"] += 1.0

    return {
        "period": normalized_period,
        "date_range": {
            "start_date": start_date.isoformat(),
            "end_date": end_date.isoformat(),
        },
        "financial_summary": {
            "gross_revenue": revenue_data["gross_revenue"],
            "net_revenue": revenue_data["net_revenue"],
            "tax_amount": revenue_data["tax_amount"],
            "gst_rate": float(get_gst_rate(PaymentItemType.BOOKING)),
            "paid_amount": revenue_data["paid_amount"],
            "refunded_amount": revenue_data["refunded_amount"],
            "transactions_count": revenue_data["transactions_count"],
        },
        "payment_methods": revenue_data["by_payment_method"],
        "utilization_summary": {
            "total_bookings": total_bookings,
            "confirmed_bookings": confirmed_bookings,
            "completed_bookings": completed_bookings,
            "cancelled_bookings": cancelled_bookings,
            "member_bookings": member_bookings,
            "walk_in_bookings": walk_in_bookings,
            "social_play_bookings": social_play_bookings,
            "total_hours_booked": confirmed_bookings + completed_bookings,
        },
        "by_sport": list(sports_map.values()),
        "time_series": _fill_time_series_gaps(
            revenue_data["time_series"], start_date, end_date
        ),
    }


# ---------------------------------------------------------------------------
# 3. SHOP REVENUE REPORT
# ---------------------------------------------------------------------------

def get_shop_revenue_report(
    period: str = "month",
    custom_start: Optional[date] = None,
    custom_end: Optional[date] = None,
) -> Dict[str, Any]:
    """
    Detailed Pro Shop Revenue & Merchandise Report.
    Reconciles with PaymentItemType.SHOP_ORDER.
    """
    start_utc, end_utc, start_date, end_date, normalized_period = get_period_boundaries(
        period, custom_start, custom_end
    )

    revenue_data = calculate_reconciled_revenue(
        item_type=PaymentItemType.SHOP_ORDER,
        start_utc=start_utc,
        end_utc=end_utc,
    )

    # Query shop orders created in the date range
    orders = ShopOrder.query.filter(
        func.coalesce(ShopOrder.created_at, utc_now()) >= start_utc,
        func.coalesce(ShopOrder.created_at, utc_now()) <= end_utc,
    ).all()

    counter_orders = sum(1 for o in orders if o.order_type == OrderType.COUNTER)
    online_orders = sum(1 for o in orders if o.order_type == OrderType.ONLINE)
    pickup_orders = sum(1 for o in orders if o.fulfillment_type.value == "PICKUP")
    delivery_orders = sum(1 for o in orders if o.fulfillment_type.value == "DELIVERY")

    completed_orders = sum(
        1 for o in orders if o.status == ShopOrderStatus.COMPLETED
    )
    pending_orders = sum(
        1
        for o in orders
        if o.status
        in (
            ShopOrderStatus.PENDING,
            ShopOrderStatus.CONFIRMED,
            ShopOrderStatus.PROCESSING,
        )
    )
    cancelled_orders = sum(
        1 for o in orders if o.status == ShopOrderStatus.CANCELLED
    )

    # Top-selling product line items
    top_products_query = (
        db.session.query(
            ShopOrderItem.product_name,
            ShopOrderItem.product_sku,
            func.sum(ShopOrderItem.quantity).label("units_sold"),
            func.sum(ShopOrderItem.total_price).label("total_sales"),
        )
        .join(ShopOrder, ShopOrderItem.order_id == ShopOrder.id)
        .filter(
            ShopOrder.created_at >= start_utc,
            ShopOrder.created_at <= end_utc,
            ShopOrder.status != ShopOrderStatus.CANCELLED,
        )
        .group_by(ShopOrderItem.product_name, ShopOrderItem.product_sku)
        .order_by(func.sum(ShopOrderItem.total_price).desc())
        .limit(10)
        .all()
    )

    top_products = [
        {
            "product_name": row[0],
            "product_sku": row[1],
            "units_sold": int(row[2]) if row[2] else 0,
            "total_sales": float(row[3]) if row[3] else 0.0,
        }
        for row in top_products_query
    ]

    return {
        "period": normalized_period,
        "date_range": {
            "start_date": start_date.isoformat(),
            "end_date": end_date.isoformat(),
        },
        "financial_summary": {
            "gross_revenue": revenue_data["gross_revenue"],
            "net_revenue": revenue_data["net_revenue"],
            "tax_amount": revenue_data["tax_amount"],
            "gst_rate": float(get_gst_rate(PaymentItemType.SHOP_ORDER)),
            "paid_amount": revenue_data["paid_amount"],
            "refunded_amount": revenue_data["refunded_amount"],
            "transactions_count": revenue_data["transactions_count"],
        },
        "payment_methods": revenue_data["by_payment_method"],
        "orders_summary": {
            "total_orders": len(orders),
            "completed_orders": completed_orders,
            "pending_orders": pending_orders,
            "cancelled_orders": cancelled_orders,
            "counter_orders": counter_orders,
            "online_orders": online_orders,
            "pickup_orders": pickup_orders,
            "delivery_orders": delivery_orders,
        },
        "top_selling_products": top_products,
        "time_series": _fill_time_series_gaps(
            revenue_data["time_series"], start_date, end_date
        ),
    }


# ---------------------------------------------------------------------------
# 4. BAR & CAFETERIA (POS) REVENUE REPORT
# ---------------------------------------------------------------------------

def get_bar_revenue_report(
    period: str = "month",
    custom_start: Optional[date] = None,
    custom_end: Optional[date] = None,
) -> Dict[str, Any]:
    """
    Detailed Bar / Cafeteria POS Revenue Report.
    Reconciles with PaymentItemType.POS_ORDER (5% GST for F&B).
    """
    start_utc, end_utc, start_date, end_date, normalized_period = get_period_boundaries(
        period, custom_start, custom_end
    )

    revenue_data = calculate_reconciled_revenue(
        item_type=PaymentItemType.POS_ORDER,
        start_utc=start_utc,
        end_utc=end_utc,
    )

    # Query tabs in period
    tabs = POSTab.query.filter(
        func.coalesce(POSTab.created_at, utc_now()) >= start_utc,
        func.coalesce(POSTab.created_at, utc_now()) <= end_utc,
    ).all()

    total_tabs = len(tabs)
    closed_tabs = sum(1 for t in tabs if t.status == TabStatus.CLOSED)
    open_tabs = sum(1 for t in tabs if t.status == TabStatus.OPEN)
    voided_tabs = sum(1 for t in tabs if t.status == TabStatus.VOIDED)
    member_tabs = sum(1 for t in tabs if t.member_id is not None)
    guest_tabs = sum(1 for t in tabs if t.member_id is None)
    total_discounts = sum(float(t.discount_amount) for t in tabs)

    # Top selling menu items
    top_items_query = (
        db.session.query(
            POSOrderItem.item_name,
            func.sum(POSOrderItem.quantity).label("units_sold"),
            func.sum(POSOrderItem.total_amount).label("total_sales"),
        )
        .join(POSTab, POSOrderItem.tab_id == POSTab.id)
        .filter(
            POSTab.created_at >= start_utc,
            POSTab.created_at <= end_utc,
            POSTab.status != TabStatus.VOIDED,
        )
        .group_by(POSOrderItem.item_name)
        .order_by(func.sum(POSOrderItem.total_amount).desc())
        .limit(10)
        .all()
    )

    top_items = [
        {
            "item_name": row[0],
            "units_sold": int(row[1]) if row[1] else 0,
            "total_sales": float(row[2]) if row[2] else 0.0,
        }
        for row in top_items_query
    ]

    return {
        "period": normalized_period,
        "date_range": {
            "start_date": start_date.isoformat(),
            "end_date": end_date.isoformat(),
        },
        "financial_summary": {
            "gross_revenue": revenue_data["gross_revenue"],
            "net_revenue": revenue_data["net_revenue"],
            "tax_amount": revenue_data["tax_amount"],
            "gst_rate": float(get_gst_rate(PaymentItemType.POS_ORDER)),  # 5%
            "paid_amount": revenue_data["paid_amount"],
            "refunded_amount": revenue_data["refunded_amount"],
            "transactions_count": revenue_data["transactions_count"],
        },
        "payment_methods": revenue_data["by_payment_method"],
        "tabs_summary": {
            "total_tabs": total_tabs,
            "closed_tabs": closed_tabs,
            "open_tabs": open_tabs,
            "voided_tabs": voided_tabs,
            "member_tabs": member_tabs,
            "guest_tabs": guest_tabs,
            "total_discounts_granted": round(total_discounts, 2),
        },
        "top_menu_items": top_items,
        "time_series": _fill_time_series_gaps(
            revenue_data["time_series"], start_date, end_date
        ),
    }


# ---------------------------------------------------------------------------
# 5. MEMBERSHIP REVENUE REPORT
# ---------------------------------------------------------------------------

def get_membership_revenue_report(
    period: str = "month",
    custom_start: Optional[date] = None,
    custom_end: Optional[date] = None,
) -> Dict[str, Any]:
    """
    Detailed Membership Revenue & Subscription Report.
    Reconciles with PaymentItemType.MEMBERSHIP.
    """
    start_utc, end_utc, start_date, end_date, normalized_period = get_period_boundaries(
        period, custom_start, custom_end
    )
    today = date.today()

    revenue_data = calculate_reconciled_revenue(
        item_type=PaymentItemType.MEMBERSHIP,
        start_utc=start_utc,
        end_utc=end_utc,
    )

    # Active memberships count by plan
    plans = MembershipPlan.query.filter_by(is_active=True).all()
    active_by_plan: Dict[str, int] = {}
    for p in plans:
        count = (
            Membership.query.filter(
                Membership.plan_id == p.id,
                Membership.status == MembershipStatus.ACTIVE,
                Membership.start_date <= today,
                Membership.end_date >= today,
            ).count()
        )
        active_by_plan[p.code] = count

    total_active = sum(active_by_plan.values())

    # New memberships acquired in this period
    new_in_period = Membership.query.filter(
        Membership.start_date >= start_date,
        Membership.start_date <= end_date,
    ).count()

    # Expiring soon milestones
    expiring_7_days = Membership.query.filter(
        Membership.status == MembershipStatus.ACTIVE,
        Membership.end_date >= today,
        Membership.end_date <= today + timedelta(days=7),
    ).count()

    expiring_30_days = Membership.query.filter(
        Membership.status == MembershipStatus.ACTIVE,
        Membership.end_date >= today,
        Membership.end_date <= today + timedelta(days=30),
    ).count()

    return {
        "period": normalized_period,
        "date_range": {
            "start_date": start_date.isoformat(),
            "end_date": end_date.isoformat(),
        },
        "financial_summary": {
            "gross_revenue": revenue_data["gross_revenue"],
            "net_revenue": revenue_data["net_revenue"],
            "tax_amount": revenue_data["tax_amount"],
            "gst_rate": float(get_gst_rate(PaymentItemType.MEMBERSHIP)),
            "paid_amount": revenue_data["paid_amount"],
            "refunded_amount": revenue_data["refunded_amount"],
            "transactions_count": revenue_data["transactions_count"],
        },
        "payment_methods": revenue_data["by_payment_method"],
        "subscription_summary": {
            "total_active_memberships": total_active,
            "new_memberships_in_period": new_in_period,
            "expiring_within_7_days": expiring_7_days,
            "expiring_within_30_days": expiring_30_days,
            "active_by_plan": active_by_plan,
        },
        "time_series": _fill_time_series_gaps(
            revenue_data["time_series"], start_date, end_date
        ),
    }


# ---------------------------------------------------------------------------
# 6. OPERATIONAL SUMMARIES
# ---------------------------------------------------------------------------

def get_operational_summary() -> Dict[str, Any]:
    """
    Real-time operational snapshot required by owner & front-desk management:
    - Bookings today
    - Active memberships by plan
    - Memberships expiring soon (7 & 30 days)
    - Open bar tabs
    - Pending shop orders
    - Low-stock count & items
    - New CRM leads & pending follow-ups
    """
    club_tz = get_club_timezone()
    today_local = datetime.now(club_tz).date()

    # 1. Bookings Today
    bookings_today_query = (
        Booking.query.filter(
            Booking.booking_date == today_local,
            Booking.status != BookingStatus.CANCELLED,
        )
        .order_by(Booking.start_time.asc())
        .all()
    )

    bookings_today_items = [
        {
            "id": b.id,
            "booking_reference": b.booking_reference,
            "court_name": b.court.name if b.court else "Court",
            "sport_type": (
                b.court.sport_type.value
                if b.court and hasattr(b.court.sport_type, "value")
                else str(b.court.sport_type) if b.court else None
            ),
            "start_time": b.start_time.strftime("%H:%M") if b.start_time else None,
            "end_time": b.end_time.strftime("%H:%M") if b.end_time else None,
            "player_name": (
                b.member.user.full_name
                if b.member and b.member.user
                else (b.guest_name or "Walk-in")
            ),
            "is_walk_in": b.is_walk_in,
            "final_price": float(b.final_price) if b.final_price is not None else 0.0,
            "status": b.status.value if hasattr(b.status, "value") else str(b.status),
        }
        for b in bookings_today_query
    ]

    # 2. Active memberships by plan
    plans = MembershipPlan.query.filter_by(is_active=True).all()
    active_by_plan: Dict[str, int] = {}
    for p in plans:
        count = (
            Membership.query.filter(
                Membership.plan_id == p.id,
                Membership.status == MembershipStatus.ACTIVE,
                Membership.start_date <= today_local,
                Membership.end_date >= today_local,
            ).count()
        )
        active_by_plan[p.code] = count

    total_active = sum(active_by_plan.values())

    # 3. Memberships expiring soon
    expiring_soon_query = (
        Membership.query.filter(
            Membership.status == MembershipStatus.ACTIVE,
            Membership.end_date >= today_local,
            Membership.end_date <= today_local + timedelta(days=30),
        )
        .order_by(Membership.end_date.asc())
        .limit(20)
        .all()
    )

    expiring_items = [
        {
            "id": m.id,
            "member_id": m.member_id,
            "member_name": (
                m.member.user.full_name
                if m.member and m.member.user
                else f"Member #{m.member_id}"
            ),
            "phone": m.member.phone if m.member else None,
            "plan_code": m.plan.code if m.plan else "N/A",
            "end_date": m.end_date.isoformat(),
            "days_left": (m.end_date - today_local).days,
        }
        for m in expiring_soon_query
    ]

    expiring_7_count = sum(1 for item in expiring_items if item["days_left"] <= 7)
    expiring_30_count = len(expiring_items)

    # 4. Open bar tabs
    open_tabs_query = (
        POSTab.query.filter(POSTab.status == TabStatus.OPEN)
        .order_by(POSTab.opened_at.desc())
        .all()
    )

    open_tabs_items = [
        {
            "id": t.id,
            "tab_reference": t.tab_reference,
            "table_number": t.table.table_number if t.table else "N/A",
            "customer_name": t.customer_name,
            "total_amount": float(t.total_amount),
            "paid_amount": float(t.paid_amount),
            "unpaid_balance": float(t.total_amount - t.paid_amount),
            "opened_at": t.opened_at.isoformat() if t.opened_at else None,
        }
        for t in open_tabs_query
    ]
    unpaid_tab_balance = sum(item["unpaid_balance"] for item in open_tabs_items)

    # 5. Pending shop orders
    pending_orders_query = (
        ShopOrder.query.filter(
            ShopOrder.status.in_([
                ShopOrderStatus.PENDING,
                ShopOrderStatus.CONFIRMED,
                ShopOrderStatus.PROCESSING,
            ])
        )
        .order_by(ShopOrder.created_at.asc())
        .all()
    )

    pending_order_items = [
        {
            "id": o.id,
            "order_reference": o.order_reference,
            "order_type": o.order_type.value if hasattr(o.order_type, "value") else str(o.order_type),
            "customer_name": o.customer_name,
            "total_amount": float(o.total_amount),
            "status": o.status.value if hasattr(o.status, "value") else str(o.status),
            "created_at": o.created_at.isoformat() if o.created_at else None,
        }
        for o in pending_orders_query
    ]

    # 6. Low stock products
    low_stock_query = (
        Product.query.filter(
            Product.is_active == True,
            Product.stock_quantity <= Product.low_stock_threshold,
        )
        .order_by(Product.stock_quantity.asc())
        .all()
    )

    low_stock_items = [
        {
            "id": p.id,
            "sku": p.sku,
            "name": p.name,
            "stock_quantity": p.stock_quantity,
            "low_stock_threshold": p.low_stock_threshold,
            "price": float(p.price) if p.price is not None else 0.0,
        }
        for p in low_stock_query
    ]

    # 7. New CRM leads
    new_leads_query = (
        CRMLead.query.filter(CRMLead.status == LeadStatus.NEW)
        .order_by(CRMLead.created_at.desc())
        .all()
    )

    new_leads_items = [
        {
            "id": lead.id,
            "lead_reference": lead.lead_reference,
            "full_name": lead.full_name,
            "phone": lead.phone,
            "source": lead.source.value if hasattr(lead.source, "value") else str(lead.source),
            "preferred_sport": lead.preferred_sport,
            "created_at": lead.created_at.isoformat() if lead.created_at else None,
        }
        for lead in new_leads_query
    ]

    # 8. Pending CRM follow-ups
    pending_followups_query = (
        CRMFollowUp.query.filter(CRMFollowUp.status == FollowUpStatus.PENDING)
        .order_by(CRMFollowUp.scheduled_date.asc())
        .all()
    )

    pending_followup_items = [
        {
            "id": fu.id,
            "lead_id": fu.lead_id,
            "lead_name": fu.lead.full_name if fu.lead else "Lead",
            "follow_up_type": fu.follow_up_type.value if hasattr(fu.follow_up_type, "value") else str(fu.follow_up_type),
            "scheduled_date": fu.scheduled_date.isoformat() if fu.scheduled_date else None,
            "assigned_staff_name": (
                f"{fu.assigned_staff.first_name} {fu.assigned_staff.last_name}"
                if fu.assigned_staff else "Unassigned"
            ),
            "notes": fu.notes,
        }
        for fu in pending_followups_query
    ]

    return {
        "today_date": today_local.isoformat(),
        "timezone": "Asia/Kolkata",
        "bookings_today": {
            "count": len(bookings_today_items),
            "items": bookings_today_items,
        },
        "active_memberships": {
            "total_active": total_active,
            "by_plan": active_by_plan,
        },
        "memberships_expiring_soon": {
            "expiring_within_7_days_count": expiring_7_count,
            "expiring_within_30_days_count": expiring_30_count,
            "items": expiring_items,
        },
        "open_bar_tabs": {
            "count": len(open_tabs_items),
            "total_unpaid_balance": round(unpaid_tab_balance, 2),
            "items": open_tabs_items,
        },
        "pending_shop_orders": {
            "count": len(pending_order_items),
            "items": pending_order_items,
        },
        "low_stock": {
            "count": len(low_stock_items),
            "items": low_stock_items,
        },
        "new_leads": {
            "count": len(new_leads_items),
            "items": new_leads_items,
        },
        "pending_follow_ups": {
            "count": len(pending_followup_items),
            "items": pending_followup_items,
        },
    }


def get_club_glance_summary() -> Dict[str, Any]:
    """
    Lightweight, real-time overview metrics for owner/admin glance bar:
    - Today's confirmed court bookings count
    - Pending membership requests count
    - Court status breakdown (total, booked, available, maintenance, percentages)
    """
    club_tz = get_club_timezone()
    today_local = datetime.now(club_tz).date()

    # 1. Today's confirmed bookings
    todays_bookings_count = Booking.query.filter(
        Booking.booking_date == today_local,
        Booking.status != BookingStatus.CANCELLED,
    ).count()

    # 2. Pending memberships count (offline requests awaiting review + CRM membership inquiries)
    pending_membership_requests = 0
    try:
        pending_membership_requests = MembershipRequest.query.filter(
            MembershipRequest.status == MembershipRequestStatus.PENDING
        ).count()
    except Exception:
        pass

    pending_crm_leads = 0
    try:
        pending_crm_leads = CRMLead.query.filter(
            CRMLead.status == LeadStatus.NEW,
            func.lower(CRMLead.preferred_sport).like("%membership%"),
        ).count()
    except Exception:
        pass

    total_pending_memberships = pending_membership_requests + pending_crm_leads

    # 3. Court allocation and occupancy status
    courts = Court.query.all()
    total_courts = len(courts) if courts else 12

    today_booked_court_ids = set()
    try:
        rows = (
            db.session.query(Booking.court_id)
            .filter(
                Booking.booking_date == today_local,
                Booking.status != BookingStatus.CANCELLED,
                Booking.court_id.isnot(None),
            )
            .distinct()
            .all()
        )
        today_booked_court_ids = {r[0] for r in rows if r[0]}
    except Exception:
        pass

    booked_courts_count = len(today_booked_court_ids)
    maintenance_courts = sum(1 for c in courts if c.status == CourtStatus.MAINTENANCE)
    available_courts = max(0, total_courts - booked_courts_count - maintenance_courts)

    if total_courts > 0:
        booked_pct = round((booked_courts_count / total_courts) * 100)
        maintenance_pct = round((maintenance_courts / total_courts) * 100)
        available_pct = max(0, 100 - booked_pct - maintenance_pct)
    else:
        booked_pct, available_pct, maintenance_pct = 0, 100, 0

    return {
        "today_date": today_local.isoformat(),
        "todays_bookings_count": todays_bookings_count,
        "pending_memberships_count": total_pending_memberships,
        "court_status": {
            "total": total_courts,
            "booked": booked_courts_count,
            "available": available_courts,
            "maintenance": maintenance_courts,
            "booked_pct": booked_pct,
            "available_pct": available_pct,
            "maintenance_pct": maintenance_pct,
            "total_booking_slots": todays_bookings_count,
        },
    }

