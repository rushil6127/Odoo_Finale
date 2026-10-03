"""
API Routes for Employees, Leave Management, and Basic Payroll.
==============================================================
Enforces strict role permissions:
- Leave approval and payroll management are restricted to OWNER and ADMIN.
- Employees can only view their own leave requests.
"""

from datetime import date
from decimal import Decimal
from flask import Blueprint, request
from flask_jwt_extended import current_user, jwt_required

from backend.app.common.responses import success_response
from backend.app.common.permissions import roles_required, RoleEnum
from backend.app.common.errors import ValidationException, ForbiddenException, NotFoundException
from backend.app.employees.services import (
    create_employee,
    update_employee,
    get_employee,
    get_employee_by_user_id,
    list_employees,
    request_leave,
    approve_leave,
    reject_leave,
    cancel_leave,
    get_leave_request,
    list_leave_requests,
    create_payroll_record,
    mark_payroll_paid,
    list_payroll_records,
    get_payroll_record,
)

employees_bp = Blueprint("employees", __name__, url_prefix="/api/v1/employees")


# ---------------------------------------------------------------------------
# EMPLOYEE DIRECTORY ENDPOINTS
# ---------------------------------------------------------------------------

@employees_bp.route("", methods=["GET"])
@roles_required(RoleEnum.OWNER, RoleEnum.ADMIN, RoleEnum.FRONT_DESK)
def get_employees():
    """List and filter employees by department, status, or search query."""
    department = request.args.get("department")
    status = request.args.get("status")
    search = request.args.get("q")

    employees = list_employees(department=department, status=status, search=search)
    return success_response(
        data={"employees": [e.to_dict(include_shifts_count=True) for e in employees]},
        meta={"total": len(employees)},
    )


@employees_bp.route("", methods=["POST"])
@roles_required(RoleEnum.OWNER, RoleEnum.ADMIN)
def post_employee():
    """Register a new employee profile."""
    payload = request.get_json(silent=True) or {}
    hire_date = date.fromisoformat(payload["hire_date"]) if payload.get("hire_date") else None
    base_salary = Decimal(str(payload["base_salary"])) if payload.get("base_salary") is not None else None
    hourly_rate = Decimal(str(payload["hourly_rate"])) if payload.get("hourly_rate") is not None else None

    employee = create_employee(
        first_name=payload.get("first_name"),
        last_name=payload.get("last_name"),
        email=payload.get("email"),
        department=payload.get("department"),
        designation=payload.get("designation"),
        user_id=payload.get("user_id"),
        phone=payload.get("phone"),
        employment_type=payload.get("employment_type", "FULL_TIME"),
        status=payload.get("status", "ACTIVE"),
        hire_date=hire_date,
        base_salary=base_salary,
        hourly_rate=hourly_rate,
        emergency_contact_name=payload.get("emergency_contact_name"),
        emergency_contact_phone=payload.get("emergency_contact_phone"),
        bank_account_info=payload.get("bank_account_info"),
        notes=payload.get("notes"),
    )
    return success_response(
        data=employee.to_dict(include_shifts_count=True),
        message="Employee registered successfully",
        status_code=201,
    )


@employees_bp.route("/<int:employee_id>", methods=["GET"])
@jwt_required()
def get_single_employee(employee_id: int):
    """Retrieve full employee details."""
    employee = get_employee(employee_id)

    # Permission check: OWNER, ADMIN, FRONT_DESK, or the linked employee themselves
    user_role = current_user.role.value if hasattr(current_user.role, "value") else str(current_user.role)
    if user_role not in (RoleEnum.OWNER.value, RoleEnum.ADMIN.value, RoleEnum.FRONT_DESK.value):
        if employee.user_id != current_user.id:
            raise ForbiddenException("You are not authorized to view this employee profile.")

    return success_response(data=employee.to_dict(include_shifts_count=True, include_shifts=True))


@employees_bp.route("/<int:employee_id>", methods=["PUT"])
@roles_required(RoleEnum.OWNER, RoleEnum.ADMIN)
def put_employee(employee_id: int):
    """Update employee details."""
    payload = request.get_json(silent=True) or {}
    hire_date = date.fromisoformat(payload["hire_date"]) if payload.get("hire_date") else None
    exit_date = date.fromisoformat(payload["exit_date"]) if payload.get("exit_date") else None
    base_salary = Decimal(str(payload["base_salary"])) if payload.get("base_salary") is not None else None
    hourly_rate = Decimal(str(payload["hourly_rate"])) if payload.get("hourly_rate") is not None else None

    employee = update_employee(
        employee_id=employee_id,
        first_name=payload.get("first_name"),
        last_name=payload.get("last_name"),
        email=payload.get("email"),
        phone=payload.get("phone"),
        department=payload.get("department"),
        designation=payload.get("designation"),
        user_id=payload.get("user_id"),
        employment_type=payload.get("employment_type"),
        status=payload.get("status"),
        hire_date=hire_date,
        exit_date=exit_date,
        base_salary=base_salary,
        hourly_rate=hourly_rate,
        emergency_contact_name=payload.get("emergency_contact_name"),
        emergency_contact_phone=payload.get("emergency_contact_phone"),
        bank_account_info=payload.get("bank_account_info"),
        notes=payload.get("notes"),
    )
    return success_response(
        data=employee.to_dict(include_shifts_count=True),
        message="Employee details updated successfully",
    )


@employees_bp.route("/<int:employee_id>/shifts", methods=["GET"])
@jwt_required()
def get_employee_linked_shifts(employee_id: int):
    """Retrieve staff shifts linked to this employee through the User account."""
    employee = get_employee(employee_id)

    user_role = current_user.role.value if hasattr(current_user.role, "value") else str(current_user.role)
    if user_role not in (RoleEnum.OWNER.value, RoleEnum.ADMIN.value):
        if employee.user_id != current_user.id:
            raise ForbiddenException("You are not authorized to view shifts for this employee.")

    shifts = employee.shifts
    return success_response(
        data={"shifts": [s.to_dict() for s in shifts]},
        meta={"total": len(shifts)},
    )


# ---------------------------------------------------------------------------
# LEAVE MANAGEMENT ENDPOINTS
# ---------------------------------------------------------------------------

@employees_bp.route("/leave", methods=["GET"])
@jwt_required()
def get_leave_requests():
    """
    List leave requests.
    RULE: Employees may see only their own leave.
    OWNER and ADMIN may see all leave requests or filter by employee_id.
    """
    user_role = current_user.role.value if hasattr(current_user.role, "value") else str(current_user.role)
    status = request.args.get("status")
    start_str = request.args.get("start_date")
    end_str = request.args.get("end_date")

    start_d = date.fromisoformat(start_str.strip()) if start_str else None
    end_d = date.fromisoformat(end_str.strip()) if end_str else None

    # Privilege routing
    if user_role in (RoleEnum.OWNER.value, RoleEnum.ADMIN.value):
        emp_id_raw = request.args.get("employee_id")
        emp_id = int(emp_id_raw) if emp_id_raw and emp_id_raw.isdigit() else None
    else:
        # Non-admin user can ONLY see their own linked employee leave
        emp = get_employee_by_user_id(current_user.id)
        if not emp:
            return success_response(data={"leave_requests": []}, meta={"total": 0})
        emp_id = emp.id

    requests_list = list_leave_requests(
        employee_id=emp_id,
        status=status,
        start_date=start_d,
        end_date=end_d,
    )
    return success_response(
        data={"leave_requests": [lr.to_dict() for lr in requests_list]},
        meta={"total": len(requests_list)},
    )


@employees_bp.route("/leave", methods=["POST"])
@jwt_required()
def post_leave_request():
    """Submit a new leave request."""
    payload = request.get_json(silent=True) or {}
    start_str = payload.get("start_date")
    end_str = payload.get("end_date")
    reason = payload.get("reason")
    leave_type = payload.get("leave_type", "CASUAL")

    if not start_str or not end_str:
        raise ValidationException("Both 'start_date' and 'end_date' are required (YYYY-MM-DD).", code="MISSING_DATES")

    start_d = date.fromisoformat(start_str.strip())
    end_d = date.fromisoformat(end_str.strip())

    user_role = current_user.role.value if hasattr(current_user.role, "value") else str(current_user.role)
    emp_id = payload.get("employee_id")

    if user_role not in (RoleEnum.OWNER.value, RoleEnum.ADMIN.value):
        # Employees submit for themselves
        emp = get_employee_by_user_id(current_user.id)
        if not emp:
            raise ForbiddenException("No employee profile found linked to your account.")
        emp_id = emp.id
    else:
        if not emp_id:
            raise ValidationException("Field 'employee_id' is required for admin submission.", code="MISSING_EMPLOYEE_ID")

    leave = request_leave(
        employee_id=emp_id,
        leave_type=leave_type,
        start_date=start_d,
        end_date=end_d,
        reason=reason,
    )
    return success_response(
        data=leave.to_dict(),
        message="Leave request submitted successfully",
        status_code=201,
    )


@employees_bp.route("/leave/<int:leave_id>/approve", methods=["POST", "PUT"])
@roles_required(RoleEnum.OWNER, RoleEnum.ADMIN)
def put_approve_leave(leave_id: int):
    """
    Approve an employee leave request.
    Restricted to OWNER and ADMIN.
    Rejects overlapping approved leave for the same employee.
    """
    payload = request.get_json(silent=True) or {}
    decision_notes = payload.get("decision_notes")

    leave = approve_leave(
        leave_id=leave_id,
        approving_user=current_user,
        decision_notes=decision_notes,
    )
    return success_response(
        data=leave.to_dict(),
        message=f"Leave request #{leave.id} approved successfully",
    )


@employees_bp.route("/leave/<int:leave_id>/reject", methods=["POST", "PUT"])
@roles_required(RoleEnum.OWNER, RoleEnum.ADMIN)
def put_reject_leave(leave_id: int):
    """
    Reject an employee leave request.
    Restricted to OWNER and ADMIN.
    """
    payload = request.get_json(silent=True) or {}
    reason = payload.get("rejection_reason") or payload.get("reason")
    if not reason:
        raise ValidationException("Field 'rejection_reason' is required.", code="MISSING_REJECTION_REASON")

    leave = reject_leave(
        leave_id=leave_id,
        rejecting_user=current_user,
        rejection_reason=reason,
    )
    return success_response(
        data=leave.to_dict(),
        message=f"Leave request #{leave.id} rejected",
    )


# ---------------------------------------------------------------------------
# PAYROLL BASIC RECORDS ENDPOINTS
# ---------------------------------------------------------------------------

@employees_bp.route("/payroll", methods=["GET"])
@roles_required(RoleEnum.OWNER, RoleEnum.ADMIN)
def get_payroll():
    """List payroll records (OWNER, ADMIN only)."""
    emp_id_raw = request.args.get("employee_id")
    emp_id = int(emp_id_raw) if emp_id_raw and emp_id_raw.isdigit() else None
    status = request.args.get("status")
    start_str = request.args.get("period_start")
    end_str = request.args.get("period_end")

    start_d = date.fromisoformat(start_str.strip()) if start_str else None
    end_d = date.fromisoformat(end_str.strip()) if end_str else None

    records = list_payroll_records(
        employee_id=emp_id,
        status=status,
        period_start=start_d,
        period_end=end_d,
    )
    return success_response(
        data={"payroll_records": [pr.to_dict() for pr in records]},
        meta={"total": len(records)},
    )


@employees_bp.route("/payroll", methods=["POST"])
@roles_required(RoleEnum.OWNER, RoleEnum.ADMIN)
def post_payroll():
    """Create a new periodic payroll record."""
    payload = request.get_json(silent=True) or {}
    emp_id = payload.get("employee_id")
    if not emp_id:
        raise ValidationException("Field 'employee_id' is required.", code="MISSING_EMPLOYEE_ID")

    start_str = payload.get("pay_period_start")
    end_str = payload.get("pay_period_end")
    if not start_str or not end_str:
        raise ValidationException("Both 'pay_period_start' and 'pay_period_end' are required.", code="MISSING_PERIOD")

    start_d = date.fromisoformat(start_str.strip())
    end_d = date.fromisoformat(end_str.strip())
    base_amount = Decimal(str(payload.get("base_amount", "0.00")))
    allowances = Decimal(str(payload.get("allowances", "0.00")))
    deductions = Decimal(str(payload.get("deductions", "0.00")))
    payment_method = payload.get("payment_method", "BANK_TRANSFER")
    notes = payload.get("notes")

    record = create_payroll_record(
        employee_id=emp_id,
        pay_period_start=start_d,
        pay_period_end=end_d,
        base_amount=base_amount,
        allowances=allowances,
        deductions=deductions,
        payment_method=payment_method,
        notes=notes,
        processed_by_id=current_user.id if current_user else None,
    )
    return success_response(
        data=record.to_dict(),
        message="Payroll record created successfully",
        status_code=201,
    )


@employees_bp.route("/payroll/<int:payroll_id>/pay", methods=["POST", "PUT"])
@roles_required(RoleEnum.OWNER, RoleEnum.ADMIN)
def put_pay_payroll(payroll_id: int):
    """Mark a payroll compensation record as settled and paid."""
    payload = request.get_json(silent=True) or {}
    pay_date = date.fromisoformat(payload["payment_date"]) if payload.get("payment_date") else None
    payment_method = payload.get("payment_method")
    notes = payload.get("notes")

    record = mark_payroll_paid(
        payroll_id=payroll_id,
        payment_date=pay_date,
        payment_method=payment_method,
        notes=notes,
    )
    return success_response(
        data=record.to_dict(),
        message=f"Payroll record {record.payroll_reference} marked as paid",
    )


@employees_bp.route("/export", methods=["GET"])
@employees_bp.route("/export/excel", methods=["GET"])
def export_employees_excel():
    """Export staff & employee directory data as an Excel (.exl / .xlsx) spreadsheet."""
    from backend.app.reports.routes import _authenticate_export_user
    from backend.app.reports.exports import generate_excel_workbook
    from flask import send_file
    from datetime import datetime

    _authenticate_export_user(allowed_roles=(RoleEnum.OWNER, RoleEnum.ADMIN, RoleEnum.FRONT_DESK))
    ext = "xlsx" if request.args.get("format", "").lower() == "xlsx" else "exl"
    buffer = generate_excel_workbook(section="employees")
    timestamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
    filename = f"champions_club_employees_{timestamp}.{ext}"

    return send_file(
        buffer,
        mimetype="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        as_attachment=True,
        download_name=filename,
    )
