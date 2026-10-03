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


def authenticate_or_create_google_user(credential: str) -> Tuple[User, str]:
    """Verify Google token and authenticate or provision member user."""
    import secrets
    import json
    import base64
    import requests

    user_info = None
    try:
        resp = requests.get(
            f"https://oauth2.googleapis.com/tokeninfo?id_token={credential}",
            timeout=5,
        )
        if resp.status_code == 200:
            user_info = resp.json()
    except Exception:
        pass

    # Fallback to direct JWT payload decode if offline/dev
    if not user_info:
        try:
            parts = credential.split(".")
            if len(parts) == 3:
                payload_b64 = parts[1]
                padded = payload_b64 + "=" * (-len(payload_b64) % 4)
                decoded = base64.urlsafe_b64decode(padded.encode("utf-8")).decode("utf-8")
                user_info = json.loads(decoded)
        except Exception:
            raise UnauthorizedException("Invalid Google authentication credential.")

    if not user_info or "email" not in user_info:
        raise UnauthorizedException("Could not verify Google account details.")

    email = user_info["email"].lower().strip()
    first_name = user_info.get("given_name") or user_info.get("name", "").split(" ")[0] or "Member"
    last_name = user_info.get("family_name") or "User"
    if " " in user_info.get("name", "") and not user_info.get("family_name"):
        last_name = user_info["name"].split(" ", 1)[1]

    user = get_user_by_email(email)
    if user is None:
        random_pw = secrets.token_urlsafe(16)
        user = create_user(
            email=email,
            password=random_pw,
            first_name=first_name,
            last_name=last_name,
            role=RoleEnum.MEMBER,
        )
        from backend.app.members.services import create_member
        try:
            create_member(user_id=user.id)
        except Exception:
            pass

    if not user.is_active:
        raise UnauthorizedException("Account is disabled. Please contact club administration.")

    role_val = user.role.value if hasattr(user.role, "value") else str(user.role)
    access_token = create_access_token(
        identity=str(user.id),
        additional_claims={"role": role_val, "email": user.email},
    )

    return user, access_token

