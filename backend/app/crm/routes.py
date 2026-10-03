from datetime import date
from flask import Blueprint, request
from flask_jwt_extended import jwt_required, current_user
from marshmallow import ValidationError

from backend.app.common.permissions import RoleEnum, roles_required
from backend.app.common.responses import success_response
from backend.app.common.errors import ValidationException
from backend.app.crm.schemas import (
    PublicEnquirySchema,
    CreateLeadSchema,
    UpdateLeadSchema,
    CreateFollowUpSchema,
    UpdateFollowUpSchema,
    AddNoteSchema,
    RequestTrialSchema,
    ConfirmTrialSchema,
    CreateQuoteSchema,
    ConvertLeadSchema,
    MarkLostSchema,
)
from backend.app.crm.services import (
    process_public_enquiry,
    get_lead,
    list_leads,
    update_lead,
    add_lead_note,
    create_follow_up,
    update_follow_up,
    list_follow_ups_due_today,
    request_trial_session,
    confirm_trial_session,
    create_quote,
    convert_lead_to_member,
    mark_lead_lost,
    get_public_club_info,
    get_public_plans,
    get_public_court_availability,
    get_public_products,
)

crm_bp = Blueprint("crm", __name__, url_prefix="/api/v1/crm")

CRM_STAFF_ROLES = (
    RoleEnum.FRONT_DESK,
    RoleEnum.ADMIN,
    RoleEnum.OWNER,
)


# ---------------------------------------------------------
# Public Unauthenticated Endpoints for Website Visitors
# ---------------------------------------------------------

@crm_bp.route("/public/enquiries", methods=["POST"])
def api_public_enquiry():
    """Submit a public website enquiry.
    
    Includes strict schema validation, length bounds, and anti-spam honeypot detection.
    Creates an immediate follow-up task for the front desk.
    """
    payload = request.get_json() or {}
    try:
        data = PublicEnquirySchema().load(payload)
    except ValidationError as err:
        raise ValidationException("Enquiry validation failed.", details=err.messages)

    lead, follow_up = process_public_enquiry(data)
    return success_response(
        data={
            "lead_reference": lead.lead_reference,
            "status": lead.status.value,
            "created_at": lead.created_at.isoformat(),
        },
        message="Thank you for your enquiry! Our concierge team will contact you shortly.",
        status_code=201,
    )


@crm_bp.route("/public/club-info", methods=["GET"])
def api_public_club_info():
    """Public club details and facility overview."""
    info = get_public_club_info()
    return success_response(data=info)


@crm_bp.route("/public/plans", methods=["GET"])
def api_public_plans():
    """Public membership tiers, prices, and benefits."""
    plans = get_public_plans()
    return success_response(data=plans)


@crm_bp.route("/public/availability", methods=["GET"])
def api_public_availability():
    """Public court availability for a date range without leaking member identities."""
    start_str = request.args.get("start_date")
    end_str = request.args.get("end_date")

    try:
        start_d = date.fromisoformat(start_str.strip()) if start_str else date.today()
        end_d = date.fromisoformat(end_str.strip()) if end_str else start_d
    except ValueError:
        raise ValidationException("Invalid date format. Use YYYY-MM-DD.", code="INVALID_DATE")

    availability = get_public_court_availability(start_d, end_d)
    return success_response(data=availability)


@crm_bp.route("/public/products", methods=["GET"])
def api_public_products():
    """Public active catalog of pro shop merchandise."""
    products = get_public_products()
    return success_response(data=products)


# ---------------------------------------------------------
# Staff CRM Endpoints (FRONT_DESK, ADMIN, OWNER)
# ---------------------------------------------------------

@crm_bp.route("/leads", methods=["GET"])
@roles_required(*CRM_STAFF_ROLES)
def api_list_leads():
    """List and filter CRM leads."""
    status = request.args.get("status")
    source = request.args.get("source")
    search = request.args.get("search")
    page = request.args.get("page", 1, type=int)
    per_page = request.args.get("per_page", 20, type=int)

    leads, total = list_leads(
        status=status,
        source=source,
        search=search,
        page=page,
        per_page=per_page,
    )
    return success_response(
        data=[lead.to_dict(include_relations=False) for lead in leads],
        meta={"page": page, "per_page": per_page, "total": total},
    )


@crm_bp.route("/leads/<int:lead_id>", methods=["GET"])
@roles_required(*CRM_STAFF_ROLES)
def api_get_lead(lead_id: int):
    """Retrieve complete lead dossier with notes, follow-ups, and quotes."""
    lead = get_lead(lead_id)
    return success_response(data=lead.to_dict(include_relations=True))


@crm_bp.route("/leads/<int:lead_id>", methods=["PATCH"])
@roles_required(*CRM_STAFF_ROLES)
def api_update_lead(lead_id: int):
    """Update lead details and lifecycle status."""
    payload = request.get_json() or {}
    try:
        data = UpdateLeadSchema().load(payload)
    except ValidationError as err:
        raise ValidationException("Validation failed.", details=err.messages)

    lead = update_lead(lead_id=lead_id, updates=data, requesting_user=current_user)
    return success_response(
        data=lead.to_dict(include_relations=True),
        message="Lead updated successfully.",
    )


@crm_bp.route("/leads/<int:lead_id>/notes", methods=["POST"])
@roles_required(*CRM_STAFF_ROLES)
def api_add_note(lead_id: int):
    """Add a timestamped staff note to a lead."""
    payload = request.get_json() or {}
    try:
        data = AddNoteSchema().load(payload)
    except ValidationError as err:
        raise ValidationException("Validation failed.", details=err.messages)

    note = add_lead_note(
        lead_id=lead_id,
        content=data["content"],
        staff_user=current_user,
    )
    return success_response(
        data=note.to_dict(),
        message="Note added to lead.",
        status_code=201,
    )


@crm_bp.route("/leads/<int:lead_id>/follow-ups", methods=["POST"])
@roles_required(*CRM_STAFF_ROLES)
def api_create_follow_up(lead_id: int):
    """Schedule a new follow-up for a lead."""
    payload = request.get_json() or {}
    try:
        data = CreateFollowUpSchema().load(payload)
    except ValidationError as err:
        raise ValidationException("Validation failed.", details=err.messages)

    follow_up = create_follow_up(
        lead_id=lead_id,
        follow_up_type=data.get("follow_up_type", "CALL"),
        scheduled_date=data["scheduled_date"],
        notes=data.get("notes"),
        assigned_staff_id=data.get("assigned_staff_id"),
    )
    return success_response(
        data=follow_up.to_dict(),
        message="Follow-up scheduled.",
        status_code=201,
    )


@crm_bp.route("/follow-ups/<int:follow_up_id>", methods=["PATCH"])
@roles_required(*CRM_STAFF_ROLES)
def api_update_follow_up(follow_up_id: int):
    """Update follow-up status (e.g. COMPLETED) and outcome."""
    payload = request.get_json() or {}
    try:
        data = UpdateFollowUpSchema().load(payload)
    except ValidationError as err:
        raise ValidationException("Validation failed.", details=err.messages)

    follow_up = update_follow_up(
        follow_up_id=follow_up_id,
        status=data.get("status"),
        outcome=data.get("outcome"),
        notes=data.get("notes"),
    )
    return success_response(
        data=follow_up.to_dict(),
        message="Follow-up updated.",
    )


@crm_bp.route("/follow-ups/due-today", methods=["GET"])
@roles_required(*CRM_STAFF_ROLES)
def api_follow_ups_due_today():
    """Retrieve all pending follow-ups due today or overdue."""
    date_str = request.args.get("date")
    target_d = None
    if date_str:
        try:
            target_d = date.fromisoformat(date_str.strip())
        except ValueError:
            raise ValidationException("Invalid date format. Use YYYY-MM-DD.", code="INVALID_DATE")

    staff_id = request.args.get("staff_id", type=int)
    follow_ups = list_follow_ups_due_today(target_date=target_d, assigned_staff_id=staff_id)
    return success_response(data=[f.to_dict() for f in follow_ups])


@crm_bp.route("/leads/<int:lead_id>/trial", methods=["POST"])
@roles_required(*CRM_STAFF_ROLES)
def api_request_trial(lead_id: int):
    """Request a trial session for a lead."""
    payload = request.get_json() or {}
    try:
        data = RequestTrialSchema().load(payload)
    except ValidationError as err:
        raise ValidationException("Validation failed.", details=err.messages)

    trial = request_trial_session(
        lead_id=lead_id,
        preferred_date=data["preferred_date"],
        preferred_time_slot=data["preferred_time_slot"],
        sport=data.get("sport", "LAWN_TENNIS"),
    )
    return success_response(
        data=trial.to_dict(),
        message="Trial session requested.",
        status_code=201,
    )


@crm_bp.route("/trial-sessions/<int:trial_id>/confirm", methods=["POST"])
@roles_required(*CRM_STAFF_ROLES)
def api_confirm_trial(trial_id: int):
    """Confirm a trial session with specific date, court, and coach."""
    payload = request.get_json() or {}
    try:
        data = ConfirmTrialSchema().load(payload)
    except ValidationError as err:
        raise ValidationException("Validation failed.", details=err.messages)

    trial = confirm_trial_session(
        trial_id=trial_id,
        confirmed_datetime=data["confirmed_datetime"],
        court_id=data.get("court_id"),
        coach_user_id=data.get("coach_user_id"),
        staff_notes=data.get("staff_notes"),
    )
    return success_response(
        data=trial.to_dict(),
        message="Trial session confirmed.",
    )


@crm_bp.route("/leads/<int:lead_id>/quotes", methods=["POST"])
@roles_required(*CRM_STAFF_ROLES)
def api_create_quote(lead_id: int):
    """Issue a formal membership quote."""
    payload = request.get_json() or {}
    try:
        data = CreateQuoteSchema().load(payload)
    except ValidationError as err:
        raise ValidationException("Validation failed.", details=err.messages)

    quote = create_quote(
        lead_id=lead_id,
        plan_name=data["plan_name"],
        amount=data["amount"],
        valid_until=data["valid_until"],
        plan_code=data.get("plan_code"),
        discount_amount=data.get("discount_amount", "0.00"),
        notes=data.get("notes"),
        created_by_user_id=current_user.id,
    )
    return success_response(
        data=quote.to_dict(),
        message=f"Quote {quote.quote_reference} generated.",
        status_code=201,
    )


@crm_bp.route("/leads/<int:lead_id>/convert", methods=["POST"])
@roles_required(*CRM_STAFF_ROLES)
def api_convert_lead(lead_id: int):
    """Convert a CRM lead into an active club member."""
    payload = request.get_json() or {}
    try:
        data = ConvertLeadSchema().load(payload)
    except ValidationError as err:
        raise ValidationException("Validation failed.", details=err.messages)

    lead, member = convert_lead_to_member(
        lead_id=lead_id,
        plan_code=data.get("plan_code"),
        address=data.get("address"),
        date_of_birth=data.get("date_of_birth"),
        gender=data.get("gender", "Unspecified"),
        emergency_contact_name=data.get("emergency_contact_name"),
        emergency_contact_phone=data.get("emergency_contact_phone"),
        requesting_user=current_user,
    )
    return success_response(
        data={
            "lead": lead.to_dict(include_relations=False),
            "member_id": member.id,
            "member_user_id": member.user_id,
            "member_name": member.user.full_name if member.user else lead.full_name,
        },
        message=f"Lead converted to Member #{member.id}.",
    )


@crm_bp.route("/leads/<int:lead_id>/lost", methods=["POST"])
@roles_required(*CRM_STAFF_ROLES)
def api_mark_lost(lead_id: int):
    """Mark a lead as LOST with a reason."""
    payload = request.get_json() or {}
    try:
        data = MarkLostSchema().load(payload)
    except ValidationError as err:
        raise ValidationException("Validation failed.", details=err.messages)

    lead = mark_lead_lost(
        lead_id=lead_id,
        reason=data["reason"],
        requesting_user=current_user,
    )
    return success_response(
        data=lead.to_dict(include_relations=False),
        message="Lead marked as lost.",
    )
