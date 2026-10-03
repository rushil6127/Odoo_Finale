"""
Unit and Integration Tests for Finance & HR (Phase 14 MVP).
===========================================================
Tests verify:
1. Configurable tax rates (data-driven, not hardcoded to any jurisdiction).
2. Business invoices:
   - Creation with line items, tax calculation, and totals.
   - Draft updates.
   - Issuance & Immutability (issued invoices cannot be modified).
   - Voiding (with reason).
   - Shared payment service integration (item_type=INVOICE, records in payments table, status -> PAID).
   - Tax summary & reports integration.
3. Employees & Staff Shift integration (linking via user_id).
4. Leave management:
   - Request creation.
   - Privacy (employees only see their own leave requests; Admin/Owner see all).
   - Strict approval restriction to OWNER and ADMIN.
   - Overlapping approved leave rejection for the same employee.
   - Approval of non-overlapping leave and different employee overlapping leave.
   - Rejection with reason.
5. Payroll basics:
   - Record creation with base, allowances, deductions, and net calculation.
   - Marking as paid.
   - Role restrictions (restricted to OWNER and ADMIN).
"""

import pytest
from datetime import date, timedelta
from decimal import Decimal
from flask_jwt_extended import create_access_token

from backend.app.extensions import db
from backend.app.common.permissions import RoleEnum
from backend.app.auth.services import create_user
from backend.app.pos.models import StaffShift, ShiftStatus
from backend.app.payments.models import Payment, PaymentItemType, PaymentStatus
from backend.app.invoices.models import TaxRate, BusinessClient, Invoice, InvoiceItem, InvoiceStatus
from backend.app.invoices.services import seed_default_tax_rates
from backend.app.employees.models import (
    Employee,
    LeaveRequest,
    PayrollRecord,
    EmploymentType,
    EmployeeStatus,
    LeaveType,
    LeaveStatus,
    PayrollStatus,
)


@pytest.fixture
def owner_user(app, db_session):
    return create_user(
        email="owner_fin@championsclub.com",
        password="Password123!",
        first_name="Club",
        last_name="Owner",
        role=RoleEnum.OWNER,
    )


@pytest.fixture
def owner_token(owner_user):
    token = create_access_token(
        identity=str(owner_user.id),
        additional_claims={"role": RoleEnum.OWNER.value},
    )
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
def admin_user(app, db_session):
    return create_user(
        email="admin_fin@championsclub.com",
        password="Password123!",
        first_name="Club",
        last_name="Admin",
        role=RoleEnum.ADMIN,
    )


@pytest.fixture
def admin_token(admin_user):
    token = create_access_token(
        identity=str(admin_user.id),
        additional_claims={"role": RoleEnum.ADMIN.value},
    )
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
def staff_user_1(app, db_session):
    return create_user(
        email="staff1@championsclub.com",
        password="Password123!",
        first_name="Alice",
        last_name="Coach",
        role=RoleEnum.COACH,
    )


@pytest.fixture
def staff_token_1(staff_user_1):
    token = create_access_token(
        identity=str(staff_user_1.id),
        additional_claims={"role": RoleEnum.COACH.value},
    )
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
def staff_user_2(app, db_session):
    return create_user(
        email="staff2@championsclub.com",
        password="Password123!",
        first_name="Bob",
        last_name="Trainer",
        role=RoleEnum.COACH,
    )


@pytest.fixture
def staff_token_2(staff_user_2):
    token = create_access_token(
        identity=str(staff_user_2.id),
        additional_claims={"role": RoleEnum.COACH.value},
    )
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
def member_user(app, db_session):
    return create_user(
        email="member_fin@championsclub.com",
        password="Password123!",
        first_name="Regular",
        last_name="Member",
        role=RoleEnum.MEMBER,
    )


@pytest.fixture
def member_token(member_user):
    token = create_access_token(
        identity=str(member_user.id),
        additional_claims={"role": RoleEnum.MEMBER.value},
    )
    return {"Authorization": f"Bearer {token}"}


# ============================================================================
# 1. Configurable Tax Rates
# ============================================================================

def test_configurable_tax_rates_api(client, admin_token, member_token):
    """Verify tax rates are configurable data and cannot be managed by unauthorized users."""
    # Member cannot create tax rate
    res = client.post(
        "/api/v1/invoices/tax-rates",
        headers=member_token,
        json={"name": "VAT 10%", "code": "VAT10", "rate": 0.10},
    )
    assert res.status_code == 403

    # Admin creates custom tax rate
    res = client.post(
        "/api/v1/invoices/tax-rates",
        headers=admin_token,
        json={"name": "Corporate Service Tax 12%", "code": "CST12", "rate": 0.12, "is_default": False},
    )
    assert res.status_code == 201
    data = res.get_json()["data"]
    assert data["code"] == "CST12"
    assert float(data["rate"]) == 0.12

    # Duplicate code rejected
    res = client.post(
        "/api/v1/invoices/tax-rates",
        headers=admin_token,
        json={"name": "Duplicate CST", "code": "CST12", "rate": 0.12},
    )
    assert res.status_code == 409


# ============================================================================
# 2. Invoices Lifecycle & Calculations
# ============================================================================

def test_invoice_creation_totals_and_draft_update(client, admin_token):
    """Verify invoice creation, line item calculations, subtotal, tax and draft updates."""
    # 1. Create client
    client_res = client.post(
        "/api/v1/invoices/clients",
        headers=admin_token,
        json={
            "company_name": "Acme Sports Corp",
            "contact_person": "Wile E. Coyote",
            "email": "coyote@acme.com",
            "phone": "9876543210",
            "tax_id": "GSTIN9999ACME",
            "billing_address": "123 Desert Way",
        },
    )
    assert client_res.status_code == 201
    client_id = client_res.get_json()["data"]["id"]

    # 2. Create custom tax rate of 10%
    tax_res = client.post(
        "/api/v1/invoices/tax-rates",
        headers=admin_token,
        json={"name": "Custom 10%", "code": "CUSTOM10", "rate": 0.10},
    )
    assert tax_res.status_code == 201
    tax_rate_id = tax_res.get_json()["data"]["id"]

    # 3. Create Draft Invoice: 2 courts @ 1000 = 2000, 5 balls @ 200 = 1000 => subtotal = 3000
    # Tax @ 10% = 300 => Total = 3300
    inv_res = client.post(
        "/api/v1/invoices",
        headers=admin_token,
        json={
            "client_id": client_id,
            "tax_rate_id": tax_rate_id,
            "items": [
                {"description": "Court 1 & 2 Corporate Booking", "quantity": 2, "unit_price": 1000.0},
                {"description": "Pro Penn Tennis Balls (Can)", "quantity": 5, "unit_price": 200.0},
            ],
            "notes": "Corporate tournament reservation",
        },
    )
    assert inv_res.status_code == 201
    inv_data = inv_res.get_json()["data"]
    assert inv_data["status"] == "DRAFT"
    assert float(inv_data["subtotal_amount"]) == 3000.0
    assert float(inv_data["tax_amount"]) == 300.0
    assert float(inv_data["total_amount"]) == 3300.0

    inv_id = inv_data["id"]

    # 4. Update Draft Invoice (modify quantity)
    update_res = client.put(
        f"/api/v1/invoices/{inv_id}",
        headers=admin_token,
        json={
            "items": [
                {"description": "Court 1 & 2 Corporate Booking", "quantity": 3, "unit_price": 1000.0}, # 3000
                {"description": "Pro Penn Tennis Balls (Can)", "quantity": 5, "unit_price": 200.0},     # 1000
            ],
            "notes": "Updated to 3 hours",
        },
    )
    assert update_res.status_code == 200
    updated_data = update_res.get_json()["data"]
    assert float(updated_data["subtotal_amount"]) == 4000.0
    assert float(updated_data["tax_amount"]) == 400.0
    assert float(updated_data["total_amount"]) == 4400.0


def test_issued_invoice_immutability_and_voiding(client, admin_token):
    """Verify issued invoices are immutable except for voiding."""
    # 1. Create client and invoice
    client_res = client.post(
        "/api/v1/invoices/clients",
        headers=admin_token,
        json={
            "company_name": "Apex Athletics",
            "contact_person": "Apex Manager",
            "email": "info@apex.com",
        },
    )
    assert client_res.status_code == 201
    client_id = client_res.get_json()["data"]["id"]

    inv_res = client.post(
        "/api/v1/invoices",
        headers=admin_token,
        json={
            "client_id": client_id,
            "items": [{"description": "Badminton Court Block", "quantity": 1, "unit_price": 500.0}],
        },
    )
    assert inv_res.status_code == 201
    inv_id = inv_res.get_json()["data"]["id"]

    # 2. Issue the invoice
    issue_res = client.post(f"/api/v1/invoices/{inv_id}/issue", headers=admin_token)
    assert issue_res.status_code == 200
    assert issue_res.get_json()["data"]["status"] == "ISSUED"

    # 3. Immutability check: Trying to update an ISSUED invoice must be rejected
    mut_res = client.put(
        f"/api/v1/invoices/{inv_id}",
        headers=admin_token,
        json={"notes": "Trying to modify issued invoice"},
    )
    assert mut_res.status_code == 422
    assert "cannot be edited" in mut_res.get_json()["error"]["message"].lower()

    # 4. Voiding the invoice with a reason
    void_res = client.post(
        f"/api/v1/invoices/{inv_id}/void",
        headers=admin_token,
        json={"reason": "Client cancelled tournament schedule"},
    )
    assert void_res.status_code == 200
    assert void_res.get_json()["data"]["status"] == "VOIDED"
    assert void_res.get_json()["data"]["void_reason"] == "Client cancelled tournament schedule"


def test_invoice_payment_via_shared_payment_service_and_reports(client, admin_token, owner_token):
    """
    Verify invoice payments:
    - Route through shared payment service with item_type=INVOICE.
    - Status changes to PAID.
    - Payment is saved in the payments table.
    - Appears in reports & tax summary.
    """
    # 1. Setup client and invoice
    client_res = client.post(
        "/api/v1/invoices/clients",
        headers=admin_token,
        json={
            "company_name": "Zenith Corp",
            "contact_person": "Zenith Finance",
            "email": "accounts@zenith.com",
        },
    )
    assert client_res.status_code == 201
    client_id = client_res.get_json()["data"]["id"]

    tax_res = client.post(
        "/api/v1/invoices/tax-rates",
        headers=admin_token,
        json={"name": "GST 18%", "code": "GST18", "rate": 0.18},
    )
    assert tax_res.status_code == 201
    tax_id = tax_res.get_json()["data"]["id"]

    # Total: 1000 + 18% = 1180.0
    inv_res = client.post(
        "/api/v1/invoices",
        headers=admin_token,
        json={
            "client_id": client_id,
            "tax_rate_id": tax_id,
            "items": [{"description": "Sponsorship Package", "quantity": 1, "unit_price": 1000.0}],
        },
    )
    assert inv_res.status_code == 201
    inv_id = inv_res.get_json()["data"]["id"]

    # Cannot pay a draft invoice
    pay_draft_res = client.post(
        f"/api/v1/invoices/{inv_id}/pay",
        headers=admin_token,
        json={"payment_method": "UPI", "amount": 1180.0},
    )
    assert pay_draft_res.status_code == 422

    # Issue invoice
    client.post(f"/api/v1/invoices/{inv_id}/issue", headers=admin_token)

    # Pay issued invoice
    pay_res = client.post(
        f"/api/v1/invoices/{inv_id}/pay",
        headers=admin_token,
        json={"payment_method": "UPI", "amount": 1180.0, "notes": "NEFT ref 998877"},
    )
    assert pay_res.status_code == 200
    pay_data = pay_res.get_json()["data"]
    assert pay_data["invoice"]["status"] == "PAID"
    assert pay_data["payment"]["status"] == "PAID"
    assert pay_data["payment"]["item_type"] == "INVOICE"
    assert float(pay_data["payment"]["amount"]) == 1180.0

    # Verify payment in database payments table
    pmt = Payment.query.filter_by(item_type=PaymentItemType.INVOICE, item_id=inv_id).first()
    assert pmt is not None
    assert pmt.status == PaymentStatus.PAID
    assert float(pmt.amount) == 1180.0

    # Verify Tax Summary
    tax_summary_res = client.get("/api/v1/invoices/tax-summary", headers=owner_token)
    assert tax_summary_res.status_code == 200
    tax_summary = tax_summary_res.get_json()["data"]
    assert tax_summary["invoices_analyzed_count"] >= 1
    assert float(tax_summary["total_tax_collected"]) >= 180.0

    # Verify Owner Report includes invoice revenue
    revenue_res = client.get("/api/v1/reports/revenue?item_type=INVOICE", headers=owner_token)
    assert revenue_res.status_code == 200
    rev_data = revenue_res.get_json()["data"]
    assert float(rev_data["gross_revenue"]) >= 1180.0
    assert float(rev_data["tax_amount"]) >= 180.0


# ============================================================================
# 3. Employees & Staff Shifts Integration
# ============================================================================

def test_employee_creation_and_staff_shift_linkage(client, admin_token, staff_user_1, db_session):
    """Verify employee records link to user and retrieve shifts from Phase 10 StaffShift."""
    # 1. Create Employee linked to staff_user_1
    emp_res = client.post(
        "/api/v1/employees",
        headers=admin_token,
        json={
            "user_id": staff_user_1.id,
            "first_name": "Alice",
            "last_name": "Coach",
            "email": staff_user_1.email,
            "phone": "9123456780",
            "department": "Coaching",
            "designation": "Head Tennis Coach",
            "employment_type": "FULL_TIME",
            "hire_date": str(date.today()),
        },
    )
    assert emp_res.status_code == 201
    emp_data = emp_res.get_json()["data"]
    emp_id = emp_data["id"]

    # 2. Add a staff shift directly via model for staff_user_1
    shift = StaffShift(
        shift_reference="SHIFT-TEST-001",
        user_id=staff_user_1.id,
        status=ShiftStatus.ACTIVE,
        starting_cash=Decimal("500.00"),
    )
    db_session.add(shift)
    db_session.commit()

    # 3. Fetch employee details and verify shifts linked
    get_res = client.get(f"/api/v1/employees/{emp_id}", headers=admin_token)
    assert get_res.status_code == 200
    retrieved = get_res.get_json()["data"]
    assert len(retrieved["shifts"]) == 1
    assert retrieved["shifts"][0]["id"] == shift.id
    assert retrieved["shifts"][0]["status"] == "ACTIVE"


# ============================================================================
# 4. Leave Management & Strict Overlap Rules
# ============================================================================

def test_leave_overlap_rules_and_approval_workflow(
    client, admin_token, owner_token, staff_user_1, staff_token_1, staff_user_2, staff_token_2
):
    """
    Verify:
    - Employee requests leave.
    - Only Owner/Admin can approve/reject.
    - Overlapping approved leave for the SAME employee is strictly rejected.
    - Non-overlapping leave for the same employee can be approved.
    - Overlapping leave for a DIFFERENT employee can be approved.
    """
    # 1. Register Employee 1 and Employee 2
    emp1_res = client.post(
        "/api/v1/employees",
        headers=admin_token,
        json={
            "user_id": staff_user_1.id,
            "first_name": "Alice",
            "last_name": "Coach",
            "email": staff_user_1.email,
            "department": "Coaching",
            "designation": "Head Tennis Coach",
        },
    )
    assert emp1_res.status_code == 201
    emp1_id = emp1_res.get_json()["data"]["id"]

    emp2_res = client.post(
        "/api/v1/employees",
        headers=admin_token,
        json={
            "user_id": staff_user_2.id,
            "first_name": "Bob",
            "last_name": "Trainer",
            "email": staff_user_2.email,
            "department": "Fitness",
            "designation": "Fitness Trainer",
        },
    )
    assert emp2_res.status_code == 201
    emp2_id = emp2_res.get_json()["data"]["id"]

    # 2. Alice requests Leave Request 1: Nov 10 to Nov 15
    l1_res = client.post(
        "/api/v1/employees/leave",
        headers=staff_token_1,
        json={
            "leave_type": "ANNUAL",
            "start_date": "2026-11-10",
            "end_date": "2026-11-15",
            "reason": "Family vacation",
        },
    )
    assert l1_res.status_code == 201
    l1_id = l1_res.get_json()["data"]["id"]
    assert l1_res.get_json()["data"]["days_count"] == 6

    # 3. Staff cannot approve their own or anyone's leave
    appr_fail = client.post(f"/api/v1/employees/leave/{l1_id}/approve", headers=staff_token_1)
    assert appr_fail.status_code == 403

    # 4. Admin approves Leave Request 1
    appr_ok = client.post(f"/api/v1/employees/leave/{l1_id}/approve", headers=admin_token)
    assert appr_ok.status_code == 200
    assert appr_ok.get_json()["data"]["status"] == "APPROVED"

    # 5. Alice requests Leave Request 2: Nov 14 to Nov 18 (Overlaps Nov 14-15 with Leave 1)
    l2_res = client.post(
        "/api/v1/employees/leave",
        headers=staff_token_1,
        json={
            "leave_type": "SICK",
            "start_date": "2026-11-14",
            "end_date": "2026-11-18",
            "reason": "Overlap test",
        },
    )
    assert l2_res.status_code == 201
    l2_id = l2_res.get_json()["data"]["id"]

    # 6. Admin attempts to approve overlapping Leave Request 2 -> MUST BE REJECTED
    appr_overlap = client.post(f"/api/v1/employees/leave/{l2_id}/approve", headers=admin_token)
    assert appr_overlap.status_code == 422
    assert appr_overlap.get_json()["error"]["code"] == "OVERLAPPING_APPROVED_LEAVE"
    assert "already has an approved leave" in appr_overlap.get_json()["error"]["message"].lower()

    # 7. Reject Leave Request 2
    rej_res = client.post(
        f"/api/v1/employees/leave/{l2_id}/reject",
        headers=admin_token,
        json={"reason": "Overlaps with existing approved leave"},
    )
    assert rej_res.status_code == 200
    assert rej_res.get_json()["data"]["status"] == "REJECTED"

    # 8. Alice requests non-overlapping Leave Request 3: Nov 20 to Nov 22 -> CAN BE APPROVED
    l3_res = client.post(
        "/api/v1/employees/leave",
        headers=staff_token_1,
        json={
            "leave_type": "CASUAL",
            "start_date": "2026-11-20",
            "end_date": "2026-11-22",
            "reason": "Personal work",
        },
    )
    assert l3_res.status_code == 201
    l3_id = l3_res.get_json()["data"]["id"]

    appr_l3 = client.post(f"/api/v1/employees/leave/{l3_id}/approve", headers=owner_token)
    assert appr_l3.status_code == 200
    assert appr_l3.get_json()["data"]["status"] == "APPROVED"

    # 9. Bob (Employee 2) requests leave on the SAME dates as Alice's approved leave: Nov 10 to Nov 15
    # Since Bob is a DIFFERENT employee, this CAN be approved
    bob_l_res = client.post(
        "/api/v1/employees/leave",
        headers=staff_token_2,
        json={
            "leave_type": "ANNUAL",
            "start_date": "2026-11-10",
            "end_date": "2026-11-15",
            "reason": "Bob vacation",
        },
    )
    assert bob_l_res.status_code == 201
    bob_l_id = bob_l_res.get_json()["data"]["id"]

    bob_appr = client.post(f"/api/v1/employees/leave/{bob_l_id}/approve", headers=admin_token)
    assert bob_appr.status_code == 200
    assert bob_appr.get_json()["data"]["status"] == "APPROVED"


def test_leave_visibility_privacy(client, admin_token, staff_user_1, staff_token_1, staff_user_2, staff_token_2):
    """Verify employees only see their own leave requests, while Admin sees all."""
    # Register employees
    res1 = client.post(
        "/api/v1/employees",
        headers=admin_token,
        json={
            "user_id": staff_user_1.id,
            "first_name": "Alice",
            "last_name": "Coach",
            "email": staff_user_1.email,
            "department": "Coaching",
            "designation": "Coach",
        },
    )
    assert res1.status_code == 201

    res2 = client.post(
        "/api/v1/employees",
        headers=admin_token,
        json={
            "user_id": staff_user_2.id,
            "first_name": "Bob",
            "last_name": "Trainer",
            "email": staff_user_2.email,
            "department": "Fitness",
            "designation": "Trainer",
        },
    )
    assert res2.status_code == 201

    # Alice requests leave
    client.post(
        "/api/v1/employees/leave",
        headers=staff_token_1,
        json={"leave_type": "ANNUAL", "start_date": "2026-12-01", "end_date": "2026-12-05", "reason": "Alice Leave"},
    )

    # Bob requests leave
    client.post(
        "/api/v1/employees/leave",
        headers=staff_token_2,
        json={"leave_type": "SICK", "start_date": "2026-12-10", "end_date": "2026-12-12", "reason": "Bob Leave"},
    )

    # Alice queries leave -> should only see 1 (her own)
    alice_view = client.get("/api/v1/employees/leave", headers=staff_token_1)
    assert alice_view.status_code == 200
    alice_items = alice_view.get_json()["data"]["leave_requests"]
    assert len(alice_items) == 1
    assert alice_items[0]["reason"] == "Alice Leave"

    # Bob queries leave -> should only see 1 (his own)
    bob_view = client.get("/api/v1/employees/leave", headers=staff_token_2)
    assert bob_view.status_code == 200
    bob_items = bob_view.get_json()["data"]["leave_requests"]
    assert len(bob_items) == 1
    assert bob_items[0]["reason"] == "Bob Leave"

    # Admin queries leave -> should see both
    admin_view = client.get("/api/v1/employees/leave", headers=admin_token)
    assert admin_view.status_code == 200
    admin_items = admin_view.get_json()["data"]["leave_requests"]
    assert len(admin_items) >= 2


# ============================================================================
# 5. Basic Payroll Records
# ============================================================================

def test_payroll_record_creation_and_payment(client, admin_token, staff_token_1, staff_user_1):
    """Verify basic payroll record creation, net calculation, and status progression."""
    # Register employee
    emp_res = client.post(
        "/api/v1/employees",
        headers=admin_token,
        json={
            "user_id": staff_user_1.id,
            "first_name": "Alice",
            "last_name": "Coach",
            "email": staff_user_1.email,
            "department": "Coaching",
            "designation": "Coach",
        },
    )
    assert emp_res.status_code == 201
    emp_id = emp_res.get_json()["data"]["id"]

    # Staff cannot create payroll
    fail_create = client.post(
        "/api/v1/employees/payroll",
        headers=staff_token_1,
        json={
            "employee_id": emp_id,
            "pay_period_start": "2026-10-01",
            "pay_period_end": "2026-10-31",
            "base_amount": 50000.0,
        },
    )
    assert fail_create.status_code == 403

    # Admin creates payroll record: Base = 50000, Allowances = 5000, Deductions = 3000 => Net = 52000
    create_res = client.post(
        "/api/v1/employees/payroll",
        headers=admin_token,
        json={
            "employee_id": emp_id,
            "pay_period_start": "2026-10-01",
            "pay_period_end": "2026-10-31",
            "base_amount": 50000.0,
            "allowances": 5000.0,
            "deductions": 3000.0,
            "notes": "October 2026 coaching salary",
        },
    )
    assert create_res.status_code == 201
    pay_data = create_res.get_json()["data"]
    assert pay_data["status"] == "DRAFT"
    assert float(pay_data["base_amount"]) == 50000.0
    assert float(pay_data["allowances"]) == 5000.0
    assert float(pay_data["deductions"]) == 3000.0
    assert float(pay_data["net_paid"]) == 52000.0
    payroll_id = pay_data["id"]

    # Mark as paid
    mark_paid_res = client.post(
        f"/api/v1/employees/payroll/{payroll_id}/pay",
        headers=admin_token,
        json={"notes": "Direct bank transfer disbursed"},
    )
    assert mark_paid_res.status_code == 200
    paid_data = mark_paid_res.get_json()["data"]
    assert paid_data["status"] == "PAID"
    assert paid_data["payment_date"] is not None
