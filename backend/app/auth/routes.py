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
