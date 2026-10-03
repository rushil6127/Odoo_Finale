from typing import Tuple, Optional
from flask_jwt_extended import create_access_token
from backend.app.extensions import db
from backend.app.auth.models import User
from backend.app.common.permissions import RoleEnum
from backend.app.common.errors import UnauthorizedException, ConflictException, NotFoundException


def get_user_by_id(user_id: int) -> Optional[User]:
    """Retrieve user by primary key ID."""
    return db.session.get(User, user_id)


def get_user_by_email(email: str) -> Optional[User]:
    """Retrieve user by normalized email address."""
    if not email:
        return None
    return User.query.filter(db.func.lower(User.email) == email.lower().strip()).first()


def create_user(
    email: str,
    password: str,
    first_name: str,
    last_name: str,
    role: RoleEnum = RoleEnum.MEMBER,
    is_active: bool = True,
) -> User:
    """Create a new user account."""
    normalized_email = email.lower().strip()
    existing = get_user_by_email(normalized_email)
    if existing is not None:
        raise ConflictException("A user with this email address already exists.")

    user = User(
        email=normalized_email,
        first_name=first_name.strip(),
        last_name=last_name.strip(),
        role=role,
        is_active=is_active,
    )
    user.set_password(password)

    db.session.add(user)
    db.session.commit()
    return user


def authenticate_user(email: str, password: str) -> Tuple[User, str]:
    """Authenticate user credentials and issue a JWT access token."""
    normalized_email = email.lower().strip()
    user = get_user_by_email(normalized_email)

    # Use a generic error message for invalid credentials to avoid enumeration
    if user is None or not user.check_password(password):
        raise UnauthorizedException("Invalid email or password.")

    if not user.is_active:
        raise UnauthorizedException("Account is disabled. Please contact club administration.")

    role_val = user.role.value if hasattr(user.role, "value") else str(user.role)
    access_token = create_access_token(
        identity=str(user.id),
        additional_claims={"role": role_val, "email": user.email},
    )

    return user, access_token
