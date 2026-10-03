from flask import Blueprint
from flask_jwt_extended import jwt_required, current_user
from backend.app.common.responses import success_response
from backend.app.common.validation import validate_schema
from backend.app.common.permissions import roles_required, RoleEnum
from backend.app.auth.schemas import LoginSchema, UserRegisterSchema
from backend.app.auth.services import authenticate_user, create_user

auth_bp = Blueprint("auth", __name__, url_prefix="/api/v1/auth")

ROLE_PERMISSIONS = {
    "OWNER": {
        "title": "Club Owner",
        "description": "Full unconstrained administrative, financial, system configuration, and role assignment access.",
        "permissions": [
            "Manage all system roles and assign Owner/Admin privileges",
            "Approve & reject membership payment requests and activate memberships",
            "View real-time financial KPI analytics, executive revenue reports, and ledger",
            "Full court operations, rate management, and bypass restrictions",
            "Manage POS terminals, pro shop inventory, and member charge tabs",
            "Access CRM pipeline, quote approvals, and staff audit logs",
        ],
    },
    "ADMIN": {
        "title": "Operations Administrator",
        "description": "General club administration, staff management, court booking overrides, and membership approvals.",
        "permissions": [
            "Assign roles (Front Desk, Shop Staff, Bar Staff, Coach, Member)",
            "Review and approve/reject membership requests and payment proofs",
            "Create, modify, and cancel court bookings across all 22+ venues",
            "Manage member accounts, membership plans, and emergency contacts",
            "View daily operational reports and inventory levels",
        ],
    },
    "FRONT_DESK": {
        "title": "Front Desk Receptionist",
        "description": "Member check-in, court slot booking, equipment rental, and visitor registration.",
        "permissions": [
            "Create & check-in member court reservations",
            "Search member profiles and view active membership status",
            "Capture CRM trial inquiries and visitor leads",
            "Collect walk-in guest fees and process court payments",
        ],
    },
    "SHOP_STAFF": {
        "title": "Pro Shop Attendant",
        "description": "Retail shop point-of-sale, stringing workshop queue, racket stock, and member discount applications.",
        "permissions": [
            "Operate Pro Shop POS terminal and process gear purchases",
            "Apply member 10%-20% retail discount tiers",
            "Charge orders directly to active member accounts",
            "Manage inventory movements and stock replenishment",
        ],
    },
    "BAR_STAFF": {
        "title": "Lounge & Café Attendant",
        "description": "Champions Lounge POS, recovery smoothie kitchen orders, table management, and member tabs.",
        "permissions": [
            "Operate Café & Lounge POS orders and table tabs",
            "Charge nutrition/dining orders to member accounts",
            "Open, transfer, and close member dining tabs",
            "View café stock and daily shift summaries",
        ],
    },
    "COACH": {
        "title": "Sports Instructor & Coach",
        "description": "Conduct member training drills, clinics, tournament scoring, and court schedule visibility.",
        "permissions": [
            "View court schedules and reserved training slots",
            "Track athlete training attendance and drill sessions",
            "Submit court maintenance or condition notes",
        ],
    },
    "MEMBER": {
        "title": "Club Member",
        "description": "Book court sessions, view personal membership perks, submit payment receipts, and track tabs.",
        "permissions": [
            "Book 60-minute court match sessions (up to 2/day)",
            "Submit membership request with payment screenshot & UTR reference",
            "View personal membership status and historical requests",
            "Enjoy court booking privileges and Pro Shop discounts",
        ],
    },
}


@auth_bp.route("/login", methods=["POST"])
@validate_schema(LoginSchema)
def login(validated_data):
    """Authenticate a user and return a JWT access token."""
    user, access_token = authenticate_user(
        email=validated_data["email"],
        password=validated_data["password"],
    )

    return success_response(
        data={
            "access_token": access_token,
            "token_type": "Bearer",
            "user": user.to_dict(),
        },
        message="Login successful",
        status_code=200,
    )


@auth_bp.route("/me", methods=["GET"])
@jwt_required()
def get_current_user_profile():
    """Retrieve profile data for the currently authenticated user."""
    return success_response(
        data={"user": current_user.to_dict()},
        status_code=200,
    )


@auth_bp.route("/demo-login", methods=["POST"])
def demo_login():
    """Issue a valid JWT access token for demo profiles (alex, coach_david, admin)."""
    from flask import request
    from flask_jwt_extended import create_access_token
    from datetime import date, timedelta
    from backend.app.extensions import db
    from backend.app.auth.models import User
    from backend.app.members.models import Member
    from backend.app.memberships.models import Membership, MembershipPlan, MembershipStatus
    from backend.app.common.permissions import RoleEnum

    body = request.get_json(silent=True) or {}
    demo_id = str(body.get("demo_id") or body.get("role") or "").lower()
    email = str(body.get("email") or "").lower()

    if "coach" in demo_id or "coach" in email:
        target_email = "coach.david@championsclub.in"
        first_name, last_name, role = "David", "Miller", RoleEnum.COACH
        dept = "BADMINTON"
    elif "admin" in demo_id or "admin" in email:
        target_email = "priya.sharma@championsclub.in"
        first_name, last_name, role = "Priya", "Sharma", RoleEnum.ADMIN
        dept = "ADMINISTRATION"
    else:
        # Default: Alex Morgan (Gold Member)
        target_email = "alex.morgan@championsclub.in"
        first_name, last_name, role = "Alex", "Morgan", RoleEnum.MEMBER
        dept = None

    user = User.query.filter_by(email=target_email).first()
    if not user:
        user = User(
            email=target_email,
            first_name=first_name,
            last_name=last_name,
            role=role,
            department=dept,
            is_active=True,
        )
        user.set_password("ChampionsDemo2026!")
        db.session.add(user)
        db.session.flush()

    if role == RoleEnum.MEMBER:
        member = Member.query.filter_by(user_id=user.id).first()
        if not member:
            member = Member(user_id=user.id, phone="+91 98250 14820")
            db.session.add(member)
            db.session.flush()

        gold = MembershipPlan.query.filter_by(code="GOLD").first()
        if gold:
            ms = Membership.query.filter_by(member_id=member.id, status=MembershipStatus.ACTIVE).first()
            if not ms:
                ms = Membership(
                    member_id=member.id,
                    plan_id=gold.id,
                    start_date=date.today() - timedelta(days=30),
                    end_date=date.today() + timedelta(days=335),
                    status=MembershipStatus.ACTIVE,
                )
                db.session.add(ms)

    db.session.commit()
    access_token = create_access_token(identity=str(user.id))

    return success_response(
        data={
            "access_token": access_token,
            "token_type": "Bearer",
            "user": user.to_dict(),
        },
        message="Demo login successful",
        status_code=200,
    )


@auth_bp.route("/google", methods=["POST"])
def google_auth():
    """Authenticate or register user via Google OAuth ID token."""
    from flask import request
    from backend.app.common.errors import BadRequestException
    from backend.app.auth.services import authenticate_or_create_google_user

    body = request.get_json(silent=True) or {}
    credential = body.get("credential") or body.get("token") or body.get("id_token")

    if not credential:
        raise BadRequestException("Google authentication credential is required.")

    user, access_token = authenticate_or_create_google_user(credential)

    return success_response(
        data={
            "access_token": access_token,
            "token_type": "Bearer",
            "user": user.to_dict(),
        },
        message="Google sign-in successful",
        status_code=200,
    )



@auth_bp.route("/register", methods=["POST"])
@validate_schema(UserRegisterSchema)
def register_member(validated_data):
    """Public self-service registration endpoint for new club members."""
    user = create_user(
        email=validated_data["email"],
        password=validated_data["password"],
        first_name=validated_data["first_name"],
        last_name=validated_data["last_name"],
        role=RoleEnum.MEMBER,
    )

    # Automatically provision associated member record
    from backend.app.members.services import create_member
    try:
        create_member(user_id=user.id)
    except Exception:
        pass

    user, access_token = authenticate_user(
        email=validated_data["email"],
        password=validated_data["password"],
    )

    return success_response(
        data={
            "access_token": access_token,
            "token_type": "Bearer",
            "user": user.to_dict(),
        },
        message="Account created successfully",
        status_code=201,
    )


@auth_bp.route("/roles", methods=["GET"])
def get_roles():
    """Retrieve all system roles and their capability permissions."""
    roles_data = [
        {
            "role": role_key,
            "title": info["title"],
            "description": info["description"],
            "permissions": info["permissions"],
        }
        for role_key, info in ROLE_PERMISSIONS.items()
    ]
    return success_response(
        data={"roles": roles_data},
        status_code=200,
    )


@auth_bp.route("/users", methods=["GET"])
@roles_required(RoleEnum.OWNER, RoleEnum.ADMIN)
def get_users_list():
    """List system users with filtering and search for administrator role management."""
    from flask import request
    from backend.app.auth.services import list_users

    role_filter = request.args.get("role")
    search = request.args.get("q")
    page = int(request.args.get("page", 1))
    per_page = int(request.args.get("per_page", 50))
    is_active_param = request.args.get("is_active")

    is_active = None
    if is_active_param is not None:
        is_active = is_active_param.lower() in ("true", "1", "yes")

    users, total = list_users(
        role_filter=role_filter,
        search=search,
        is_active=is_active,
        page=page,
        per_page=per_page,
    )

    return success_response(
        data={"users": [u.to_dict() for u in users]},
        meta={"total": total, "page": page, "per_page": per_page},
        status_code=200,
    )


@auth_bp.route("/users/<int:user_id>/role", methods=["PATCH"])
@roles_required(RoleEnum.OWNER, RoleEnum.ADMIN)
def update_user_role_endpoint(user_id: int):
    """Assign or change a user's system role."""
    from flask import request
    from backend.app.common.errors import BadRequestException
    from backend.app.auth.services import update_user_role

    body = request.get_json(silent=True) or {}
    new_role = body.get("role")
    if not new_role:
        raise BadRequestException("Field 'role' is required.")

    updated_user = update_user_role(
        target_user_id=user_id,
        new_role_str=new_role,
        acting_user=current_user,
    )

    return success_response(
        data={"user": updated_user.to_dict()},
        message=f"User role updated to {updated_user.role.value if hasattr(updated_user.role, 'value') else updated_user.role}",
        status_code=200,
    )


@auth_bp.route("/users/<int:user_id>/status", methods=["PATCH"])
@roles_required(RoleEnum.OWNER, RoleEnum.ADMIN)
def update_user_status_endpoint(user_id: int):
    """Enable or disable a user account."""
    from flask import request
    from backend.app.common.errors import BadRequestException
    from backend.app.auth.services import update_user_status

    body = request.get_json(silent=True) or {}
    if "is_active" not in body:
        raise BadRequestException("Field 'is_active' is required.")

    is_active = bool(body["is_active"])
    updated_user = update_user_status(
        target_user_id=user_id,
        is_active=is_active,
        acting_user=current_user,
    )

    return success_response(
        data={"user": updated_user.to_dict()},
        message=f"User account {'enabled' if is_active else 'disabled'}",
        status_code=200,
    )


@auth_bp.route("/users", methods=["POST"])
@roles_required(RoleEnum.OWNER, RoleEnum.ADMIN)
@validate_schema(UserRegisterSchema)
def create_staff_or_user(validated_data):
    """Administrative endpoint to provision a new user or staff account."""
    user = create_user(
        email=validated_data["email"],
        password=validated_data["password"],
        first_name=validated_data["first_name"],
        last_name=validated_data["last_name"],
        role=validated_data.get("role", RoleEnum.MEMBER),
        department=validated_data.get("department"),
    )

    return success_response(
        data={"user": user.to_dict()},
        message="User account created successfully",
        status_code=201,
    )


@auth_bp.route("/assign-access", methods=["POST"])
@roles_required(RoleEnum.OWNER, RoleEnum.ADMIN)
def assign_custom_access_endpoint():
    """Owner/Admin endpoint to grant custom role and department access to an employee via Gmail/email."""
    from flask import request
    from backend.app.common.errors import BadRequestException
    from backend.app.auth.services import assign_custom_access

    body = request.get_json(silent=True) or {}
    email = body.get("email")
    role = body.get("role", "STAFF")
    department = body.get("department")
    first_name = body.get("first_name")
    last_name = body.get("last_name")

    if not email:
        raise BadRequestException("Field 'email' (Employee Gmail/Work Email) is required.")

    user = assign_custom_access(
        email=email,
        role_str=role,
        department=department,
        first_name=first_name,
        last_name=last_name,
        acting_user=current_user,
    )

    return success_response(
        data={"user": user.to_dict()},
        message=f"Access granted: {user.email} assigned role '{user.role.value if hasattr(user.role, 'value') else user.role}' in '{user.department or 'General'}' department.",
        status_code=200,
    )


@auth_bp.route("/users/<int:user_id>/department", methods=["PATCH"])
@roles_required(RoleEnum.OWNER, RoleEnum.ADMIN)
def update_user_department_endpoint(user_id: int):
    """Assign or update employee department/sport section."""
    from flask import request
    from backend.app.auth.services import update_user_department

    body = request.get_json(silent=True) or {}
    department = body.get("department")

    user = update_user_department(
        target_user_id=user_id,
        department=department,
        acting_user=current_user,
    )

    return success_response(
        data={"user": user.to_dict()},
        message=f"Department updated to '{user.department or 'None'}'",
        status_code=200,
    )



