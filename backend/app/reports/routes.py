"""
API Routes for Champions Club Owner Dashboard and Revenue Reports.
==================================================================
All endpoints are strictly restricted to OWNER and ADMIN roles.
Responses conform to standard structured JSON responses that Next.js
frontend dashboards can directly consume and render.
"""

from datetime import date, datetime
from typing import Optional, Tuple
from flask import Blueprint, request, send_file
from flask_jwt_extended import current_user, verify_jwt_in_request, decode_token

from backend.app.extensions import db
from backend.app.auth.models import User
from backend.app.common.responses import success_response
from backend.app.common.permissions import roles_required, RoleEnum
from backend.app.common.errors import ValidationException, UnauthorizedException, ForbiddenException
from backend.app.payments.models import PaymentItemType, PaymentMethod
from backend.app.reports.services import (
    get_dashboard_overview,
    calculate_reconciled_revenue,
    get_court_revenue_report,
    get_shop_revenue_report,
    get_bar_revenue_report,
    get_membership_revenue_report,
    get_operational_summary,
    get_period_boundaries,
)
from backend.app.tasks.jobs import export_data_to_excel_task
from backend.app.reports.exports import generate_excel_workbook

reports_bp = Blueprint("reports", __name__, url_prefix="/api/v1/reports")


def _authenticate_export_user(allowed_roles=(RoleEnum.OWNER, RoleEnum.ADMIN, RoleEnum.FRONT_DESK)):
    """Authenticate caller via Bearer header or query param 'token', enforcing allowed roles."""
    token = request.args.get("token")
    user = None
    if token:
        try:
            decoded = decode_token(token)
            user_id = int(decoded.get("sub"))
            user = db.session.get(User, user_id)
        except Exception:
            raise UnauthorizedException("Invalid or expired download token")
    else:
        try:
            verify_jwt_in_request()
            user = current_user
        except Exception:
            raise UnauthorizedException("Authentication token required")

    if not user:
        raise UnauthorizedException("User account not found")
    if not user.is_active:
        raise ForbiddenException("Account is disabled")

    if allowed_roles:
        role_vals = [r.value if hasattr(r, "value") else str(r) for r in allowed_roles]
        user_role = user.role.value if hasattr(user.role, "value") else str(user.role)
        if user_role not in role_vals:
            raise ForbiddenException("Insufficient permissions to export this data")

    return user


def _parse_date_params() -> Tuple[Optional[date], Optional[date]]:
    """Parse and validate optional start_date and end_date query parameters."""
    start_str = request.args.get("start_date")
    end_str = request.args.get("end_date")

    start_d: Optional[date] = None
    end_d: Optional[date] = None

    if start_str:
        try:
            start_d = date.fromisoformat(start_str.strip())
        except (ValueError, TypeError):
            raise ValidationException(
                f"Invalid start_date '{start_str}'. Expected format is YYYY-MM-DD.",
                code="INVALID_DATE_FORMAT",
            )

    if end_str:
        try:
            end_d = date.fromisoformat(end_str.strip())
        except (ValueError, TypeError):
            raise ValidationException(
                f"Invalid end_date '{end_str}'. Expected format is YYYY-MM-DD.",
                code="INVALID_DATE_FORMAT",
            )

    if start_d and end_d and start_d > end_d:
        raise ValidationException(
            "start_date cannot be later than end_date.",
            code="INVALID_DATE_RANGE",
        )

    return start_d, end_d


@reports_bp.route("/overview", methods=["GET"])
@reports_bp.route("/dashboard", methods=["GET"])
@roles_required(RoleEnum.OWNER, RoleEnum.ADMIN)
def get_overview():
    """
    Owner dashboard main overview.
    Supports today, week, month, or custom date ranges.
    Returns executive KPIs, stream breakdown, payment method shares,
    period comparison with growth %, daily time series, and operational snapshot.
    """
    period = request.args.get("period", "today")
    start_d, end_d = _parse_date_params()

    overview_data = get_dashboard_overview(
        period=period, custom_start=start_d, custom_end=end_d
    )
    return success_response(
        data=overview_data,
        message="Owner dashboard overview retrieved successfully",
        status_code=200,
    )


@reports_bp.route("/revenue", methods=["GET"])
@roles_required(RoleEnum.OWNER, RoleEnum.ADMIN)
def get_revenue():
    """
    Comprehensive financial revenue breakdown.
    Reconciles directly with the payments table.
    Filters by period, date range, item_type (stream), or payment_method.
    """
    period = request.args.get("period", "month")
    start_d, end_d = _parse_date_params()
    item_type_raw = request.args.get("item_type")
    method_raw = request.args.get("payment_method")

    item_type = None
    if item_type_raw:
        item_upper = item_type_raw.upper().strip()
        # Aliases for convenience
        if item_upper in ("COURT", "COURTS"):
            item_upper = "BOOKING"
        elif item_upper in ("BAR", "CAFE", "CAFETERIA", "POS"):
            item_upper = "POS_ORDER"
        elif item_upper in ("SHOP", "MERCHANDISE"):
            item_upper = "SHOP_ORDER"
        elif item_upper in ("MEMBERSHIP", "MEMBERSHIPS"):
            item_upper = "MEMBERSHIP"
        elif item_upper in ("INVOICE", "INVOICES"):
            item_upper = "INVOICE"

        if not hasattr(PaymentItemType, item_upper):
            raise ValidationException(
                f"Invalid item_type '{item_type_raw}'. Supported types: BOOKING, MEMBERSHIP, SHOP_ORDER, POS_ORDER, INVOICE.",
                code="INVALID_ITEM_TYPE",
            )
        item_type = PaymentItemType(item_upper)

    method = None
    if method_raw:
        m_upper = method_raw.upper().strip()
        if not PaymentMethod.has_value(m_upper):
            raise ValidationException(
                f"Invalid payment_method '{method_raw}'. Supported methods: CASH, CARD, UPI, ONLINE.",
                code="INVALID_PAYMENT_METHOD",
            )
        method = PaymentMethod(m_upper)

    start_utc, end_utc, start_date, end_date, normalized_period = get_period_boundaries(
        period=period, custom_start=start_d, custom_end=end_d
    )

    revenue_data = calculate_reconciled_revenue(
        item_type=item_type,
        start_utc=start_utc,
        end_utc=end_utc,
        payment_method=method,
    )

    response_payload = {
        "period": normalized_period,
        "date_range": {
            "start_date": start_date.isoformat(),
            "end_date": end_date.isoformat(),
        },
        **revenue_data,
    }

    return success_response(
        data=response_payload,
        message="Revenue report retrieved successfully",
        status_code=200,
    )


@reports_bp.route("/courts", methods=["GET"])
@roles_required(RoleEnum.OWNER, RoleEnum.ADMIN)
def get_courts_report():
    """Court revenue, booking volume, sport distribution, and utilization report."""
    period = request.args.get("period", "month")
    start_d, end_d = _parse_date_params()

    court_data = get_court_revenue_report(
        period=period, custom_start=start_d, custom_end=end_d
    )
    return success_response(
        data=court_data,
        message="Court revenue report retrieved successfully",
        status_code=200,
    )


@reports_bp.route("/shop", methods=["GET"])
@roles_required(RoleEnum.OWNER, RoleEnum.ADMIN)
def get_shop_report():
    """Pro shop merchandise sales, order channels (online/counter), and top products."""
    period = request.args.get("period", "month")
    start_d, end_d = _parse_date_params()

    shop_data = get_shop_revenue_report(
        period=period, custom_start=start_d, custom_end=end_d
    )
    return success_response(
        data=shop_data,
        message="Shop revenue report retrieved successfully",
        status_code=200,
    )


@reports_bp.route("/bar", methods=["GET"])
@roles_required(RoleEnum.OWNER, RoleEnum.ADMIN)
def get_bar_report():
    """Bar and cafeteria POS sales, tab statistics, discounts, and menu popularity."""
    period = request.args.get("period", "month")
    start_d, end_d = _parse_date_params()

    bar_data = get_bar_revenue_report(
        period=period, custom_start=start_d, custom_end=end_d
    )
    return success_response(
        data=bar_data,
        message="Bar revenue report retrieved successfully",
        status_code=200,
    )


@reports_bp.route("/memberships", methods=["GET"])
@roles_required(RoleEnum.OWNER, RoleEnum.ADMIN)
def get_memberships_report():
    """Membership subscription revenue, plan distribution, and renewals/expiries."""
    period = request.args.get("period", "month")
    start_d, end_d = _parse_date_params()

    membership_data = get_membership_revenue_report(
        period=period, custom_start=start_d, custom_end=end_d
    )
    return success_response(
        data=membership_data,
        message="Membership revenue report retrieved successfully",
        status_code=200,
    )


@reports_bp.route("/operations", methods=["GET"])
@roles_required(RoleEnum.OWNER, RoleEnum.ADMIN)
def get_operations():
    """
    Real-time operational dashboard summary:
    - Today's court bookings
    - Active memberships count by plan
    - Memberships expiring soon (7-day and 30-day alerts)
    - Currently open bar tabs & unpaid balance
    - Pending shop orders
    - Low-stock inventory items
    - New CRM leads & pending follow-ups
    """
    ops_data = get_operational_summary()
    return success_response(
        data=ops_data,
        message="Operational summary retrieved successfully",
        status_code=200,
    )


@reports_bp.route("/export", methods=["POST"])
@roles_required(RoleEnum.OWNER, RoleEnum.ADMIN)
def export_report_excel():
    """
    Trigger Excel report export job asynchronously via Celery task.
    Supports REVENUE, INVENTORY, and BOOKINGS export schemas.
    """
    payload = request.get_json(silent=True) or {}
    export_type = payload.get("export_type", "REVENUE").upper().strip()

    valid_types = ("REVENUE", "INVENTORY", "BOOKINGS")
    if export_type not in valid_types:
        raise ValidationException(
            f"Invalid export_type '{export_type}'. Supported export types: {', '.join(valid_types)}.",
            code="INVALID_EXPORT_TYPE",
        )

    filters = {
        "period": payload.get("period", "month"),
        "start_date": payload.get("start_date"),
        "end_date": payload.get("end_date"),
        "requested_by_id": current_user.id if current_user else None,
    }

    task = export_data_to_excel_task.delay(export_type=export_type, filters=filters)

    return success_response(
        data={
            "task_id": task.id,
            "export_type": export_type,
            "status": "QUEUED",
            "filters": filters,
        },
        message=f"{export_type} Excel export task queued successfully",
        status_code=202,
    )


@reports_bp.route("/export/excel", methods=["GET"])
@reports_bp.route("/export/download", methods=["GET"])
def export_excel_download():
    """
    Direct synchronous Excel export endpoint.
    Supports individual sections or all combined into a master workbook:
      - section: all (default) | members | employees | revenue | courts | shop | bar | memberships
      - format: exl (default) | xlsx
      - start_date, end_date: YYYY-MM-DD (optional filter)
    Returns: .exl or .xlsx spreadsheet file stream directly.
    """
    _authenticate_export_user(allowed_roles=(RoleEnum.OWNER, RoleEnum.ADMIN, RoleEnum.FRONT_DESK))

    section = request.args.get("section", "all").lower().strip()
    valid_sections = (
        "all", "members", "member", "employees", "employee", "staff",
        "revenue", "all_revenue", "courts", "court", "bookings",
        "shop", "merchandise", "bar", "pos", "cafe", "memberships", "membership"
    )
    if section not in valid_sections:
        raise ValidationException(
            f"Invalid export section '{section}'. Supported sections: all, members, employees, revenue, courts, shop, bar, memberships.",
            code="INVALID_SECTION",
        )

    start_d, end_d = _parse_date_params()
    ext = "xlsx" if request.args.get("format", "").lower() == "xlsx" else "exl"

    buffer = generate_excel_workbook(section=section, start_d=start_d, end_d=end_d)
    timestamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
    clean_sec = "all" if section in ("all", "all_revenue") else section
    filename = f"champions_club_{clean_sec}_{timestamp}.{ext}"

    return send_file(
        buffer,
        mimetype="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        as_attachment=True,
        download_name=filename,
    )
