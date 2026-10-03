from flask import Blueprint
from flask_jwt_extended import jwt_required, current_user
from backend.app.common.responses import success_response
from backend.app.common.validation import validate_schema
from backend.app.common.permissions import roles_required, RoleEnum
from backend.app.auth.schemas import LoginSchema, UserRegisterSchema
from backend.app.auth.services import authenticate_user, create_user

auth_bp = Blueprint("auth", __name__, url_prefix="/api/v1/auth")


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
    )

    return success_response(
        data={"user": user.to_dict()},
        message="User account created successfully",
        status_code=201,
    )

