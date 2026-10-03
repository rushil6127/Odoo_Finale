"""
Employee, Leave Management, and Basic Payroll Models for Champions Club.
=======================================================================
Implements employee master records, leave requests with overlap controls,
and basic payroll records. Links employees to staff shifts via the User relationship.
"""

import enum
import uuid
from datetime import datetime, date
from decimal import Decimal
from typing import Optional, Dict, Any, List

from sqlalchemy import (
    Column,
    Integer,
    String,
    Text,
    DateTime,
    Date,
    Numeric,
    Boolean,
    ForeignKey,
    Index,
    CheckConstraint,
    JSON,
    Enum as SQLEnum,
)
from sqlalchemy.orm import relationship

from backend.app.extensions import db
from backend.app.common.utils import utc_now


class EmploymentType(str, enum.Enum):
    """Staff employment classifications."""
    FULL_TIME = "FULL_TIME"
    PART_TIME = "PART_TIME"
    CONTRACT = "CONTRACT"
    INTERN = "INTERN"

    @classmethod
    def has_value(cls, value: str) -> bool:
        if not value:
            return False
        return value.upper().strip() in cls._value2member_map_


class EmployeeStatus(str, enum.Enum):
    """Staff operational status."""
    ACTIVE = "ACTIVE"
    ON_LEAVE = "ON_LEAVE"
    TERMINATED = "TERMINATED"
    RESIGNED = "RESIGNED"

    @classmethod
    def has_value(cls, value: str) -> bool:
        if not value:
            return False
        return value.upper().strip() in cls._value2member_map_


class LeaveType(str, enum.Enum):
    """Categories of employee leave."""
    CASUAL = "CASUAL"
    SICK = "SICK"
    ANNUAL = "ANNUAL"
    UNPAID = "UNPAID"
    OTHER = "OTHER"

    @classmethod
    def has_value(cls, value: str) -> bool:
        if not value:
            return False
        return value.upper().strip() in cls._value2member_map_


class LeaveStatus(str, enum.Enum):
    """Lifecycle status of a leave request."""
    PENDING = "PENDING"
    APPROVED = "APPROVED"
    REJECTED = "REJECTED"
    CANCELLED = "CANCELLED"

    @classmethod
    def has_value(cls, value: str) -> bool:
        if not value:
            return False
        return value.upper().strip() in cls._value2member_map_


class PayrollStatus(str, enum.Enum):
    """Status of payroll processing."""
    DRAFT = "DRAFT"
    PROCESSED = "PROCESSED"
    PAID = "PAID"

    @classmethod
    def has_value(cls, value: str) -> bool:
        if not value:
            return False
        return value.upper().strip() in cls._value2member_map_


def generate_employee_code(prefix: str = "EMP") -> str:
    """Generate clean, unique employee reference: EMP-YYYYMM-XXXX."""
    date_str = utc_now().strftime("%Y%m")
    unique_suffix = uuid.uuid4().hex[:4].upper()
    return f"{prefix}-{date_str}-{unique_suffix}"


def generate_payroll_reference(prefix: str = "PAYROLL") -> str:
    """Generate clean, unique payroll reference: PAYROLL-YYYYMM-XXXX."""
    date_str = utc_now().strftime("%Y%m")
    unique_suffix = uuid.uuid4().hex[:6].upper()
    return f"{prefix}-{date_str}-{unique_suffix}"


class Employee(db.Model):
    """
    Employee master entity for club staff, coaches, and administrators.
    Links to User account where one exists and connects to StaffShifts.
    """

    __tablename__ = "employees"

    id = Column(Integer, primary_key=True, autoincrement=True)
    employee_code = Column(String(30), unique=True, nullable=False, index=True, default=generate_employee_code)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), unique=True, nullable=True, index=True)
    first_name = Column(String(100), nullable=False)
    last_name = Column(String(100), nullable=False)
    email = Column(String(120), unique=True, nullable=False, index=True)
    phone = Column(String(20), nullable=True)
    department = Column(String(100), nullable=False, index=True)
    designation = Column(String(100), nullable=False)
    employment_type = Column(
        SQLEnum(EmploymentType, native_enum=False),
        nullable=False,
        default=EmploymentType.FULL_TIME,
    )
    status = Column(
        SQLEnum(EmployeeStatus, native_enum=False),
        nullable=False,
        default=EmployeeStatus.ACTIVE,
        index=True,
    )
    hire_date = Column(Date, nullable=False, default=date.today)
    exit_date = Column(Date, nullable=True)
    base_salary = Column(Numeric(10, 2), nullable=True)
    hourly_rate = Column(Numeric(10, 2), nullable=True)
    emergency_contact_name = Column(String(100), nullable=True)
    emergency_contact_phone = Column(String(20), nullable=True)
    bank_account_info = Column(JSON, nullable=False, default=dict)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), nullable=False, default=utc_now)
    updated_at = Column(DateTime(timezone=True), nullable=False, default=utc_now, onupdate=utc_now)

    # Relationships
    user = relationship("User", foreign_keys=[user_id])
    leave_requests = relationship("LeaveRequest", back_populates="employee", cascade="all, delete-orphan", lazy="dynamic")
    payroll_records = relationship("PayrollRecord", back_populates="employee", cascade="all, delete-orphan", lazy="dynamic")

    @property
    def full_name(self) -> str:
        return f"{self.first_name} {self.last_name}".strip()

    @property
    def shifts(self) -> List[Any]:
        """Link employee to cafeteria / bar staff shifts through the linked User."""
        if not self.user_id:
            return []
        from backend.app.pos.models import StaffShift
        return StaffShift.query.filter_by(user_id=self.user_id).order_by(StaffShift.start_time.desc()).all()

    def to_dict(self, include_shifts_count: bool = False, include_shifts: bool = False) -> Dict[str, Any]:
        data = {
            "id": self.id,
            "employee_code": self.employee_code,
            "user_id": self.user_id,
            "first_name": self.first_name,
            "last_name": self.last_name,
            "full_name": self.full_name,
            "email": self.email,
            "phone": self.phone,
            "department": self.department,
            "designation": self.designation,
            "employment_type": self.employment_type.value if hasattr(self.employment_type, "value") else str(self.employment_type),
            "status": self.status.value if hasattr(self.status, "value") else str(self.status),
            "hire_date": self.hire_date.isoformat() if self.hire_date else None,
            "exit_date": self.exit_date.isoformat() if self.exit_date else None,
            "base_salary": float(self.base_salary) if self.base_salary is not None else None,
            "hourly_rate": float(self.hourly_rate) if self.hourly_rate is not None else None,
            "emergency_contact_name": self.emergency_contact_name,
            "emergency_contact_phone": self.emergency_contact_phone,
            "bank_account_info": self.bank_account_info or {},
            "notes": self.notes,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }
        if include_shifts_count:
            data["shifts_count"] = len(self.shifts)
        if include_shifts:
            data["shifts"] = [s.to_dict() for s in self.shifts]
        return data

    def __repr__(self) -> str:
        return f"<Employee id={self.id} code='{self.employee_code}' name='{self.full_name}'>"


class LeaveRequest(db.Model):
    """
    Employee leave request record.
    Overlapping approved leaves for the same employee are strictly forbidden.
    Approval/rejection restricted to OWNER and ADMIN.
    """

    __tablename__ = "leave_requests"

    id = Column(Integer, primary_key=True, autoincrement=True)
    employee_id = Column(Integer, ForeignKey("employees.id", ondelete="CASCADE"), nullable=False, index=True)
    leave_type = Column(
        SQLEnum(LeaveType, native_enum=False),
        nullable=False,
        default=LeaveType.CASUAL,
    )
    start_date = Column(Date, nullable=False, index=True)
    end_date = Column(Date, nullable=False, index=True)
    days_count = Column(Integer, nullable=False, default=1)
    reason = Column(Text, nullable=False)
    status = Column(
        SQLEnum(LeaveStatus, native_enum=False),
        nullable=False,
        default=LeaveStatus.PENDING,
        index=True,
    )
    approved_by_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    rejection_reason = Column(Text, nullable=True)
    decision_notes = Column(Text, nullable=True)
    decision_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), nullable=False, default=utc_now)
    updated_at = Column(DateTime(timezone=True), nullable=False, default=utc_now, onupdate=utc_now)

    # Relationships
    employee = relationship("Employee", back_populates="leave_requests")
    approved_by = relationship("User", foreign_keys=[approved_by_id])

    __table_args__ = (
        CheckConstraint("days_count > 0", name="check_leave_days_positive"),
        Index("ix_leave_employee_dates", "employee_id", "start_date", "end_date"),
    )

    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "employee_id": self.employee_id,
            "employee_code": self.employee.employee_code if self.employee else None,
            "employee_name": self.employee.full_name if self.employee else None,
            "department": self.employee.department if self.employee else None,
            "leave_type": self.leave_type.value if hasattr(self.leave_type, "value") else str(self.leave_type),
            "start_date": self.start_date.isoformat() if self.start_date else None,
            "end_date": self.end_date.isoformat() if self.end_date else None,
            "days_count": self.days_count,
            "reason": self.reason,
            "status": self.status.value if hasattr(self.status, "value") else str(self.status),
            "approved_by_id": self.approved_by_id,
            "approved_by_name": self.approved_by.full_name if self.approved_by else None,
            "rejection_reason": self.rejection_reason,
            "decision_notes": self.decision_notes,
            "decision_at": self.decision_at.isoformat() if self.decision_at else None,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }

    def __repr__(self) -> str:
        return f"<LeaveRequest id={self.id} emp={self.employee_id} {self.start_date}->{self.end_date} status='{self.status}'>"


class PayrollRecord(db.Model):
    """
    Basic payroll record representing a periodic pay settlement for an employee.
    Focused on MVP compensation tracking without full general ledger complexity.
    """

    __tablename__ = "payroll_records"

    id = Column(Integer, primary_key=True, autoincrement=True)
    payroll_reference = Column(String(30), unique=True, nullable=False, index=True, default=generate_payroll_reference)
    employee_id = Column(Integer, ForeignKey("employees.id", ondelete="CASCADE"), nullable=False, index=True)
    pay_period_start = Column(Date, nullable=False)
    pay_period_end = Column(Date, nullable=False)
    base_amount = Column(Numeric(10, 2), nullable=False)
    allowances = Column(Numeric(10, 2), nullable=False, default=Decimal("0.00"))
    deductions = Column(Numeric(10, 2), nullable=False, default=Decimal("0.00"))
    net_paid = Column(Numeric(10, 2), nullable=False)
    payment_date = Column(Date, nullable=True)
    payment_method = Column(String(30), default="BANK_TRANSFER", nullable=False)
    status = Column(
        SQLEnum(PayrollStatus, native_enum=False),
        nullable=False,
        default=PayrollStatus.DRAFT,
        index=True,
    )
    notes = Column(Text, nullable=True)
    processed_by_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    created_at = Column(DateTime(timezone=True), nullable=False, default=utc_now)
    updated_at = Column(DateTime(timezone=True), nullable=False, default=utc_now, onupdate=utc_now)

    # Relationships
    employee = relationship("Employee", back_populates="payroll_records")
    processed_by = relationship("User", foreign_keys=[processed_by_id])

    __table_args__ = (
        CheckConstraint("base_amount >= 0", name="check_payroll_base_non_negative"),
        CheckConstraint("allowances >= 0", name="check_payroll_allowances_non_negative"),
        CheckConstraint("deductions >= 0", name="check_payroll_deductions_non_negative"),
        CheckConstraint("net_paid >= 0", name="check_payroll_net_non_negative"),
        Index("ix_payroll_employee_period", "employee_id", "pay_period_start", "pay_period_end"),
    )

    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "payroll_reference": self.payroll_reference,
            "employee_id": self.employee_id,
            "employee_code": self.employee.employee_code if self.employee else None,
            "employee_name": self.employee.full_name if self.employee else None,
            "department": self.employee.department if self.employee else None,
            "pay_period_start": self.pay_period_start.isoformat() if self.pay_period_start else None,
            "pay_period_end": self.pay_period_end.isoformat() if self.pay_period_end else None,
            "base_amount": float(self.base_amount),
            "allowances": float(self.allowances),
            "deductions": float(self.deductions),
            "net_paid": float(self.net_paid),
            "payment_date": self.payment_date.isoformat() if self.payment_date else None,
            "payment_method": self.payment_method,
            "status": self.status.value if hasattr(self.status, "value") else str(self.status),
            "notes": self.notes,
            "processed_by_id": self.processed_by_id,
            "processed_by_name": self.processed_by.full_name if self.processed_by else None,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }

    def __repr__(self) -> str:
        return f"<PayrollRecord id={self.id} ref='{self.payroll_reference}' emp={self.employee_id} net={self.net_paid}>"
