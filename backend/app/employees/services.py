"""
Employee, Leave Management, and Basic Payroll Services for Champions Club.
=========================================================================
Implements employee lifecycle, leave overlap detection & approval logic,
and basic payroll records.
"""

from datetime import datetime, date, timedelta
from decimal import Decimal, ROUND_HALF_UP
from typing import Optional, Dict, Any, List, Tuple
from flask import current_app

from backend.app.extensions import db
from backend.app.common.utils import utc_now
from backend.app.common.errors import (
    NotFoundException,
    ValidationException,
    ConflictException,
    ForbiddenException,
)
from backend.app.employees.models import (
    Employee,
    LeaveRequest,
    PayrollRecord,
    EmploymentType,
    EmployeeStatus,
    LeaveType,
    LeaveStatus,
    PayrollStatus,
    generate_employee_code,
    generate_payroll_reference,
)


# ---------------------------------------------------------------------------
# 1. EMPLOYEE MASTER SERVICES
# ---------------------------------------------------------------------------

def create_employee(
    first_name: str,
    last_name: str,
    email: str,
    department: str,
    designation: str,
    user_id: Optional[int] = None,
    phone: Optional[str] = None,
    employment_type: str = "FULL_TIME",
    status: str = "ACTIVE",
    hire_date: Optional[date] = None,
    base_salary: Optional[Decimal] = None,
    hourly_rate: Optional[Decimal] = None,
    emergency_contact_name: Optional[str] = None,
    emergency_contact_phone: Optional[str] = None,
    bank_account_info: Optional[Dict[str, Any]] = None,
    notes: Optional[str] = None,
) -> Employee:
    """Create a new employee profile in the club directory."""
    if not first_name or not first_name.strip():
        raise ValidationException("First name is required.", code="MISSING_FIRST_NAME")
    if not last_name or not last_name.strip():
        raise ValidationException("Last name is required.", code="MISSING_LAST_NAME")
    if not email or "@" not in email:
        raise ValidationException("A valid email address is required.", code="INVALID_EMAIL")
    if not department or not department.strip():
        raise ValidationException("Department is required.", code="MISSING_DEPARTMENT")
    if not designation or not designation.strip():
        raise ValidationException("Designation / job title is required.", code="MISSING_DESIGNATION")

    normalized_email = email.strip().lower()
    if Employee.query.filter_by(email=normalized_email).first():
        raise ConflictException(f"Employee with email '{normalized_email}' already exists.", code="EMAIL_EXISTS")

    if user_id:
        if Employee.query.filter_by(user_id=user_id).first():
            raise ConflictException(f"User ID {user_id} is already linked to another employee.", code="USER_LINKED")

    enum_type = EmploymentType(employment_type.upper().strip()) if EmploymentType.has_value(employment_type) else EmploymentType.FULL_TIME
    enum_status = EmployeeStatus(status.upper().strip()) if EmployeeStatus.has_value(status) else EmployeeStatus.ACTIVE

    employee = Employee(
        employee_code=generate_employee_code(),
        user_id=user_id,
        first_name=first_name.strip(),
        last_name=last_name.strip(),
        email=normalized_email,
        phone=phone.strip() if phone else None,
        department=department.strip(),
        designation=designation.strip(),
        employment_type=enum_type,
        status=enum_status,
        hire_date=hire_date or date.today(),
        base_salary=base_salary,
        hourly_rate=hourly_rate,
        emergency_contact_name=emergency_contact_name.strip() if emergency_contact_name else None,
        emergency_contact_phone=emergency_contact_phone.strip() if emergency_contact_phone else None,
        bank_account_info=bank_account_info or {},
        notes=notes.strip() if notes else None,
    )
    db.session.add(employee)
    db.session.commit()
    return employee


def update_employee(
    employee_id: int,
    first_name: Optional[str] = None,
    last_name: Optional[str] = None,
    email: Optional[str] = None,
    phone: Optional[str] = None,
    department: Optional[str] = None,
    designation: Optional[str] = None,
    user_id: Optional[int] = None,
    employment_type: Optional[str] = None,
    status: Optional[str] = None,
    hire_date: Optional[date] = None,
    exit_date: Optional[date] = None,
    base_salary: Optional[Decimal] = None,
    hourly_rate: Optional[Decimal] = None,
    emergency_contact_name: Optional[str] = None,
    emergency_contact_phone: Optional[str] = None,
    bank_account_info: Optional[Dict[str, Any]] = None,
    notes: Optional[str] = None,
) -> Employee:
    """Update employee master details."""
    employee = db.session.get(Employee, employee_id)
    if not employee:
        raise NotFoundException(f"Employee with ID {employee_id} not found.")

    if first_name is not None:
        employee.first_name = first_name.strip()
    if last_name is not None:
        employee.last_name = last_name.strip()
    if email is not None:
        norm_email = email.strip().lower()
        if norm_email != employee.email:
            if Employee.query.filter_by(email=norm_email).first():
                raise ConflictException("Email already in use by another employee.", code="EMAIL_EXISTS")
            employee.email = norm_email
    if phone is not None:
        employee.phone = phone.strip()
    if department is not None:
        employee.department = department.strip()
    if designation is not None:
        employee.designation = designation.strip()
    if user_id is not None:
        if user_id != employee.user_id:
            if Employee.query.filter(Employee.user_id == user_id, Employee.id != employee_id).first():
                raise ConflictException("User ID is already linked to another employee.", code="USER_LINKED")
            employee.user_id = user_id
    if employment_type is not None:
        if EmploymentType.has_value(employment_type):
            employee.employment_type = EmploymentType(employment_type.upper().strip())
    if status is not None:
        if EmployeeStatus.has_value(status):
            employee.status = EmployeeStatus(status.upper().strip())
    if hire_date is not None:
        employee.hire_date = hire_date
    if exit_date is not None:
        employee.exit_date = exit_date
    if base_salary is not None:
        employee.base_salary = base_salary
    if hourly_rate is not None:
        employee.hourly_rate = hourly_rate
    if emergency_contact_name is not None:
        employee.emergency_contact_name = emergency_contact_name.strip()
    if emergency_contact_phone is not None:
        employee.emergency_contact_phone = emergency_contact_phone.strip()
    if bank_account_info is not None:
        employee.bank_account_info = bank_account_info
    if notes is not None:
        employee.notes = notes.strip()

    db.session.commit()
    return employee


def get_employee(employee_id: int) -> Employee:
    """Retrieve employee by primary key."""
    employee = db.session.get(Employee, employee_id)
    if not employee:
        raise NotFoundException(f"Employee with ID {employee_id} not found.")
    return employee


def get_employee_by_user_id(user_id: int) -> Optional[Employee]:
    """Retrieve employee linked to a User account."""
    return Employee.query.filter_by(user_id=user_id).first()


def list_employees(
    department: Optional[str] = None,
    status: Optional[str] = None,
    search: Optional[str] = None,
) -> List[Employee]:
    """Query and filter employee records."""
    query = Employee.query
    if department:
        query = query.filter(Employee.department.ilike(f"%{department.strip()}%"))
    if status:
        query = query.filter(Employee.status == EmployeeStatus(status.upper().strip()))
    if search:
        term = f"%{search.strip()}%"
        query = query.filter(
            db.or_(
                Employee.first_name.ilike(term),
                Employee.last_name.ilike(term),
                Employee.email.ilike(term),
                Employee.employee_code.ilike(term),
                Employee.designation.ilike(term),
            )
        )
    return query.order_by(Employee.first_name.asc(), Employee.last_name.asc()).all()


# ---------------------------------------------------------------------------
# 2. LEAVE REQUESTS & OVERLAP RULES
# ---------------------------------------------------------------------------

def request_leave(
    employee_id: int,
    leave_type: str,
    start_date: date,
    end_date: date,
    reason: str,
) -> LeaveRequest:
    """
    Submit a leave request.
    Validates date boundaries.
    """
    employee = db.session.get(Employee, employee_id)
    if not employee:
        raise NotFoundException(f"Employee with ID {employee_id} not found.")

    if start_date > end_date:
        raise ValidationException("start_date cannot be later than end_date.", code="INVALID_DATE_RANGE")

    if not reason or not reason.strip():
        raise ValidationException("Reason for leave is required.", code="MISSING_REASON")

    enum_type = LeaveType(leave_type.upper().strip()) if LeaveType.has_value(leave_type) else LeaveType.CASUAL
    days_count = (end_date - start_date).days + 1

    leave = LeaveRequest(
        employee_id=employee_id,
        leave_type=enum_type,
        start_date=start_date,
        end_date=end_date,
        days_count=days_count,
        reason=reason.strip(),
        status=LeaveStatus.PENDING,
    )
    db.session.add(leave)
    db.session.commit()
    return leave


def approve_leave(
    leave_id: int,
    approving_user: Any,
    decision_notes: Optional[str] = None,
) -> LeaveRequest:
    """
    Approve an employee leave request.
    RULE: Restricted to OWNER and ADMIN.
    RULE: Overlapping approved leave for the same employee is strictly rejected.
    """
    leave = db.session.get(LeaveRequest, leave_id)
    if not leave:
        raise NotFoundException(f"Leave request with ID {leave_id} not found.")

    if leave.status != LeaveStatus.PENDING:
        raise ValidationException(
            f"Cannot approve leave request with status '{leave.status.value}'. Must be PENDING.",
            code="INVALID_STATUS",
        )

    # OVERLAP CHECK RULE: No two approved leaves can overlap for the same employee
    existing_approved = LeaveRequest.query.filter(
        LeaveRequest.employee_id == leave.employee_id,
        LeaveRequest.id != leave.id,
        LeaveRequest.status == LeaveStatus.APPROVED,
        LeaveRequest.start_date <= leave.end_date,
        LeaveRequest.end_date >= leave.start_date,
    ).first()

    if existing_approved:
        raise ValidationException(
            f"Cannot approve leave: employee already has an approved leave from {existing_approved.start_date} to {existing_approved.end_date} (Leave ID {existing_approved.id}).",
            code="OVERLAPPING_APPROVED_LEAVE",
        )

    leave.status = LeaveStatus.APPROVED
    leave.approved_by_id = approving_user.id if approving_user else None
    leave.decision_notes = decision_notes.strip() if decision_notes else None
    leave.decision_at = utc_now()

    db.session.commit()
    return leave


def reject_leave(
    leave_id: int,
    rejecting_user: Any,
    rejection_reason: str,
) -> LeaveRequest:
    """
    Reject an employee leave request.
    RULE: Restricted to OWNER and ADMIN.
    """
    leave = db.session.get(LeaveRequest, leave_id)
    if not leave:
        raise NotFoundException(f"Leave request with ID {leave_id} not found.")

    if leave.status != LeaveStatus.PENDING:
        raise ValidationException(
            f"Cannot reject leave request with status '{leave.status.value}'. Must be PENDING.",
            code="INVALID_STATUS",
        )

    if not rejection_reason or not rejection_reason.strip():
        raise ValidationException("A rejection reason is required.", code="MISSING_REJECTION_REASON")

    leave.status = LeaveStatus.REJECTED
    leave.approved_by_id = rejecting_user.id if rejecting_user else None
    leave.rejection_reason = rejection_reason.strip()
    leave.decision_at = utc_now()

    db.session.commit()
    return leave


def cancel_leave(leave_id: int, requesting_user: Any) -> LeaveRequest:
    """Cancel a pending or approved leave request."""
    leave = db.session.get(LeaveRequest, leave_id)
    if not leave:
        raise NotFoundException(f"Leave request with ID {leave_id} not found.")

    leave.status = LeaveStatus.CANCELLED
    db.session.commit()
    return leave


def get_leave_request(leave_id: int) -> LeaveRequest:
    """Retrieve single leave request."""
    leave = db.session.get(LeaveRequest, leave_id)
    if not leave:
        raise NotFoundException(f"Leave request with ID {leave_id} not found.")
    return leave


def list_leave_requests(
    employee_id: Optional[int] = None,
    status: Optional[str] = None,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
) -> List[LeaveRequest]:
    """Query and filter leave requests."""
    query = LeaveRequest.query
    if employee_id:
        query = query.filter(LeaveRequest.employee_id == employee_id)
    if status:
        query = query.filter(LeaveRequest.status == LeaveStatus(status.upper().strip()))
    if start_date:
        query = query.filter(LeaveRequest.end_date >= start_date)
    if end_date:
        query = query.filter(LeaveRequest.start_date <= end_date)

    return query.order_by(LeaveRequest.start_date.desc(), LeaveRequest.id.desc()).all()


# ---------------------------------------------------------------------------
# 3. BASIC PAYROLL RECORDS
# ---------------------------------------------------------------------------

def create_payroll_record(
    employee_id: int,
    pay_period_start: date,
    pay_period_end: date,
    base_amount: Decimal,
    allowances: Decimal = Decimal("0.00"),
    deductions: Decimal = Decimal("0.00"),
    payment_method: str = "BANK_TRANSFER",
    notes: Optional[str] = None,
    processed_by_id: Optional[int] = None,
) -> PayrollRecord:
    """Create a periodic compensation / payroll entry for an employee."""
    employee = db.session.get(Employee, employee_id)
    if not employee:
        raise NotFoundException(f"Employee with ID {employee_id} not found.")

    if pay_period_start > pay_period_end:
        raise ValidationException("pay_period_start cannot be later than pay_period_end.", code="INVALID_PERIOD")

    if base_amount < Decimal("0.00"):
        raise ValidationException("base_amount cannot be negative.", code="INVALID_BASE_AMOUNT")
    if allowances < Decimal("0.00"):
        raise ValidationException("allowances cannot be negative.", code="INVALID_ALLOWANCES")
    if deductions < Decimal("0.00"):
        raise ValidationException("deductions cannot be negative.", code="INVALID_DEDUCTIONS")

    net_paid = max(Decimal("0.00"), base_amount + allowances - deductions)

    record = PayrollRecord(
        payroll_reference=generate_payroll_reference(),
        employee_id=employee_id,
        pay_period_start=pay_period_start,
        pay_period_end=pay_period_end,
        base_amount=base_amount,
        allowances=allowances,
        deductions=deductions,
        net_paid=net_paid,
        payment_method=payment_method.strip(),
        status=PayrollStatus.DRAFT,
        notes=notes.strip() if notes else None,
        processed_by_id=processed_by_id,
    )
    db.session.add(record)
    db.session.commit()
    return record


def mark_payroll_paid(
    payroll_id: int,
    payment_date: Optional[date] = None,
    payment_method: Optional[str] = None,
    notes: Optional[str] = None,
) -> PayrollRecord:
    """Mark a payroll record as settled and paid."""
    record = db.session.get(PayrollRecord, payroll_id)
    if not record:
        raise NotFoundException(f"Payroll record with ID {payroll_id} not found.")

    record.status = PayrollStatus.PAID
    record.payment_date = payment_date or date.today()
    if payment_method:
        record.payment_method = payment_method.strip()
    if notes:
        record.notes = f"{record.notes or ''} | {notes.strip()}".strip(" |")

    db.session.commit()
    return record


def list_payroll_records(
    employee_id: Optional[int] = None,
    status: Optional[str] = None,
    period_start: Optional[date] = None,
    period_end: Optional[date] = None,
) -> List[PayrollRecord]:
    """Query payroll records."""
    query = PayrollRecord.query
    if employee_id:
        query = query.filter(PayrollRecord.employee_id == employee_id)
    if status:
        query = query.filter(PayrollRecord.status == PayrollStatus(status.upper().strip()))
    if period_start:
        query = query.filter(PayrollRecord.pay_period_end >= period_start)
    if period_end:
        query = query.filter(PayrollRecord.pay_period_start <= period_end)

    return query.order_by(PayrollRecord.pay_period_end.desc(), PayrollRecord.id.desc()).all()


def get_payroll_record(payroll_id: int) -> PayrollRecord:
    """Fetch payroll record by ID."""
    record = db.session.get(PayrollRecord, payroll_id)
    if not record:
        raise NotFoundException(f"Payroll record with ID {payroll_id} not found.")
    return record
