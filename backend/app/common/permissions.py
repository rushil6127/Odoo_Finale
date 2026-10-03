import enum
from functools import wraps
from typing import List, Union
from flask_jwt_extended import get_jwt_identity, current_user, jwt_required
from backend.app.common.errors import UnauthorizedException, ForbiddenException


class RoleEnum(str, enum.Enum):
    """System roles for Champions Club. Exactly 7 locked roles."""

    OWNER = "OWNER"
    ADMIN = "ADMIN"
    FRONT_DESK = "FRONT_DESK"
    SHOP_STAFF = "SHOP_STAFF"
    BAR_STAFF = "BAR_STAFF"
    COACH = "COACH"
    MEMBER = "MEMBER"

    @classmethod
    def has_value(cls, value: str) -> bool:
        return value in cls._value2member_map_


def roles_required(*allowed_roles: Union[RoleEnum, str]):
    """Decorator to require one of the specified roles to access a route.

    Must be used with or after @jwt_required().
    """
    normalized_roles = [
        role.value if isinstance(role, RoleEnum) else str(role)
        for role in allowed_roles
    ]

    def decorator(fn):
        @wraps(fn)
        @jwt_required()
        def wrapper(*args, **kwargs):
            if current_user is None:
                raise UnauthorizedException(
                    "User account not found or deactivated"
                )

            if not current_user.is_active:
                raise ForbiddenException("Account is disabled")

            user_role = (
                current_user.role.value
                if hasattr(current_user.role, "value")
                else str(current_user.role)
            )

            if user_role not in normalized_roles:
                raise ForbiddenException(
                    "You do not have permission to access this resource"
                )

            return fn(*args, **kwargs)

        return wrapper

    return decorator


def owner_required():
    """Decorator restricting route to OWNER role."""
    return roles_required(RoleEnum.OWNER)


def admin_required():
    """Decorator restricting route to OWNER or ADMIN role."""
    return roles_required(RoleEnum.OWNER, RoleEnum.ADMIN)


def staff_required():
    """Decorator restricting route to all staff roles."""
    return roles_required(
        RoleEnum.OWNER,
        RoleEnum.ADMIN,
        RoleEnum.FRONT_DESK,
        RoleEnum.SHOP_STAFF,
        RoleEnum.BAR_STAFF,
        RoleEnum.COACH,
    )
