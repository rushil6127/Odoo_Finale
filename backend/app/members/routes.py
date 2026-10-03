from flask import Blueprint, request
from flask_jwt_extended import jwt_required, current_user
from backend.app.common.responses import success_response
from backend.app.common.validation import validate_schema
from backend.app.common.permissions import roles_required, RoleEnum
from backend.app.common.errors import NotFoundException, ForbiddenException
from backend.app.members.schemas import (
    MemberCreateSchema,
    MemberUpdateSchema,
    MemberSearchQuerySchema,
)
from backend.app.members.services import (
    create_member,
    get_member_by_id,
    get_member_by_user_id,
    update_member,
    search_members,
)

members_bp = Blueprint("members", __name__, url_prefix="/api/v1/members")


def _enforce_member_access(member_id: int):
    """Ensure current user is authorized to access the requested member profile."""
    member = get_member_by_id(member_id)
    if not member:
        raise NotFoundException(f"Member with ID {member_id} not found.")

    user_role = (
        current_user.role.value
        if hasattr(current_user.role, "value")
        else str(current_user.role)
    )

    # If the user is a regular MEMBER, they cannot view another member's profile
    if user_role == RoleEnum.MEMBER.value:
        if member.user_id != current_user.id:
            raise ForbiddenException("You do not have permission to view another member's profile.")

    return member


@members_bp.route("", methods=["GET"])
@roles_required(RoleEnum.OWNER, RoleEnum.ADMIN, RoleEnum.FRONT_DESK, RoleEnum.SHOP_STAFF, RoleEnum.BAR_STAFF, RoleEnum.COACH)
def list_and_search_members():
    """Staff endpoint to search and filter club members."""
    query_str = request.args.get("q")
    plan_code = request.args.get("plan")
    is_active_raw = request.args.get("is_active")
    page = int(request.args.get("page", 1))
    per_page = int(request.args.get("per_page", 20))

    is_active = None
    if is_active_raw is not None:
        is_active = is_active_raw.lower() in ("true", "1", "yes")

    members, total = search_members(
        query_str=query_str,
        plan_code=plan_code,
        is_active=is_active,
        page=page,
        per_page=per_page,
    )

    return success_response(
        data={"members": [m.to_dict(include_membership=True, include_user=True) for m in members]},
        meta={"total": total, "page": page, "per_page": per_page},
        status_code=200,
    )


@members_bp.route("/me", methods=["GET"])
@jwt_required()
def get_my_member_profile():
    """Retrieve profile of the currently logged-in user."""
    member = get_member_by_user_id(current_user.id)
    if not member:
        raise NotFoundException("Member profile not found for the current user.")
    return success_response(
        data={"member": member.to_dict(include_membership=True, include_user=True)},
        status_code=200,
    )


@members_bp.route("", methods=["POST"])
@jwt_required()
@validate_schema(MemberCreateSchema)
def create_member_profile(validated_data):
    """Create a member profile for a user account."""
    user_role = (
        current_user.role.value
        if hasattr(current_user.role, "value")
        else str(current_user.role)
    )

    # Regular members can only create their own profile
    target_user_id = validated_data["user_id"]
    if user_role == RoleEnum.MEMBER.value and current_user.id != target_user_id:
        raise ForbiddenException("You cannot create a member profile for another user.")

    member = create_member(
        user_id=target_user_id,
        phone=validated_data.get("phone"),
        date_of_birth=validated_data.get("date_of_birth"),
        gender=validated_data.get("gender"),
        address=validated_data.get("address"),
        emergency_contact_name=validated_data.get("emergency_contact_name"),
        emergency_contact_phone=validated_data.get("emergency_contact_phone"),
    )

    return success_response(
        data={"member": member.to_dict(include_membership=False, include_user=True)},
        message="Member profile created successfully",
        status_code=201,
    )


@members_bp.route("/<int:member_id>", methods=["GET"])
@jwt_required()
def get_member_by_id_endpoint(member_id: int):
    """Retrieve member profile by ID (Self or Staff)."""
    member = _enforce_member_access(member_id)
    return success_response(
        data={"member": member.to_dict(include_membership=True, include_user=True)},
        status_code=200,
    )


@members_bp.route("/<int:member_id>", methods=["PUT", "PATCH"])
@jwt_required()
@validate_schema(MemberUpdateSchema)
def update_member_endpoint(member_id: int, validated_data):
    """Update member profile details (Self or Staff)."""
    _enforce_member_access(member_id)
    member = update_member(member_id, **validated_data)
    return success_response(
        data={"member": member.to_dict(include_membership=True, include_user=True)},
        message="Member profile updated successfully",
        status_code=200,
    )


@members_bp.route("/export", methods=["GET"])
@members_bp.route("/export/excel", methods=["GET"])
def export_members_excel():
    """Export member directory data as an Excel (.exl / .xlsx) spreadsheet."""
    from backend.app.reports.routes import _authenticate_export_user
    from backend.app.reports.exports import generate_excel_workbook
    from flask import send_file
    from datetime import datetime

    _authenticate_export_user(allowed_roles=(RoleEnum.OWNER, RoleEnum.ADMIN, RoleEnum.FRONT_DESK))
    ext = "xlsx" if request.args.get("format", "").lower() == "xlsx" else "exl"
    buffer = generate_excel_workbook(section="members")
    timestamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
    filename = f"champions_club_members_{timestamp}.{ext}"

    return send_file(
        buffer,
        mimetype="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        as_attachment=True,
        download_name=filename,
    )
