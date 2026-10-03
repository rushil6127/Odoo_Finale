from datetime import date
from flask import Blueprint
from flask_jwt_extended import jwt_required, current_user
from backend.app.extensions import db
from backend.app.common.responses import success_response
from backend.app.common.validation import validate_schema
from backend.app.common.permissions import roles_required, RoleEnum
from backend.app.common.errors import NotFoundException, ForbiddenException
from backend.app.members.models import Member
from backend.app.memberships.models import MembershipPlan
from backend.app.memberships.schemas import AssignMembershipSchema, ChangePlanSchema
from backend.app.memberships.services import (
    get_all_plans,
    get_plan_by_id,
    get_active_membership,
    get_membership_history,
    assign_membership,
    change_membership_plan,
)

membership_plans_bp = Blueprint("membership_plans", __name__, url_prefix="/api/v1/membership-plans")
memberships_bp = Blueprint("memberships", __name__, url_prefix="/api/v1/members")


def _check_member_access(member_id: int) -> Member:
    """Verify that current_user has permission to view this member's data."""
    member = db.session.get(Member, member_id)
    if not member:
        raise NotFoundException(f"Member with ID {member_id} not found.")

    user_role = (
        current_user.role.value
        if hasattr(current_user.role, "value")
        else str(current_user.role)
    )

    if user_role == RoleEnum.MEMBER.value:
        if member.user_id != current_user.id:
            raise ForbiddenException("You do not have permission to access another member's data.")

    return member


# ---------------------------------------------------------
# Membership Plans Endpoints
# ---------------------------------------------------------

@membership_plans_bp.route("", methods=["GET"])
def list_plans():
    """Retrieve all available membership plans with pricing and structured benefits."""
    plans = get_all_plans(active_only=True)
    return success_response(
        data={"plans": [p.to_dict() for p in plans]},
        status_code=200,
    )


@membership_plans_bp.route("/<int:plan_id>", methods=["GET"])
def get_plan_details(plan_id: int):
    """Retrieve details for a specific membership plan."""
    plan = get_plan_by_id(plan_id)
    if not plan:
        raise NotFoundException(f"Membership plan with ID {plan_id} not found.")
    return success_response(
        data={"plan": plan.to_dict()},
        status_code=200,
    )


# ---------------------------------------------------------
# Member Membership History and Assignment Endpoints
# ---------------------------------------------------------

@memberships_bp.route("/<int:member_id>/memberships", methods=["GET"])
@jwt_required()
def list_member_memberships(member_id: int):
    """List full membership history for a specific member."""
    _check_member_access(member_id)
    history = get_membership_history(member_id)
    return success_response(
        data={"memberships": [m.to_dict(include_plan=True) for m in history]},
        status_code=200,
    )


@memberships_bp.route("/<int:member_id>/memberships/active", methods=["GET"])
@jwt_required()
def get_member_active_membership(member_id: int):
    """Retrieve currently active membership and benefits for a member."""
    _check_member_access(member_id)
    active_ms = get_active_membership(member_id)
    return success_response(
        data={"active_membership": active_ms.to_dict(include_plan=True) if active_ms else None},
        status_code=200,
    )


@memberships_bp.route("/<int:member_id>/memberships", methods=["POST"])
@roles_required(RoleEnum.OWNER, RoleEnum.ADMIN, RoleEnum.FRONT_DESK)
@validate_schema(AssignMembershipSchema)
def assign_member_plan(member_id: int, validated_data):
    """Assign an initial membership plan to a member (Staff/Admin only)."""
    membership = assign_membership(
        member_id=member_id,
        plan_id=validated_data["plan_id"],
        start_date=validated_data["start_date"],
        duration_months=validated_data.get("duration_months"),
        price_paid=validated_data.get("price_paid"),
        notes=validated_data.get("notes"),
    )

    return success_response(
        data={"membership": membership.to_dict(include_plan=True)},
        message="Membership assigned successfully",
        status_code=201,
    )


@memberships_bp.route("/<int:member_id>/memberships/change-plan", methods=["POST"])
@roles_required(RoleEnum.OWNER, RoleEnum.ADMIN, RoleEnum.FRONT_DESK)
@validate_schema(ChangePlanSchema)
def change_member_plan(member_id: int, validated_data):
    """Upgrade or downgrade a member's plan while preserving history (Staff/Admin only)."""
    new_membership, old_membership = change_membership_plan(
        member_id=member_id,
        new_plan_id=validated_data["new_plan_id"],
        effective_date=validated_data["effective_date"],
        price_paid=validated_data.get("price_paid"),
        notes=validated_data.get("notes"),
    )

    return success_response(
        data={
            "new_membership": new_membership.to_dict(include_plan=True),
            "previous_membership": old_membership.to_dict(include_plan=True) if old_membership else None,
        },
        message="Membership plan changed successfully",
        status_code=200,
    )
