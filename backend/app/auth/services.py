from typing import Tuple, Optional
from flask_jwt_extended import create_access_token
from backend.app.extensions import db
from backend.app.auth.models import User
from backend.app.common.permissions import RoleEnum
from backend.app.common.errors import UnauthorizedException, ConflictException, NotFoundException


OWNER_EMAILS = {"pushplamba104@gmail.com", "admin@championsclub.in"}


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
    department: Optional[str] = None,
    is_active: bool = True,
) -> User:
    """Create a new user account."""
    normalized_email = email.lower().strip()
    existing = get_user_by_email(normalized_email)
    if existing is not None:
        raise ConflictException("A user with this email address already exists.")

    # Designated owner check
    if normalized_email in OWNER_EMAILS:
        role = RoleEnum.OWNER

    user = User(
        email=normalized_email,
        first_name=first_name.strip(),
        last_name=last_name.strip(),
        role=role,
        department=department.strip().upper() if department else None,
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

    # Ensure designated owners maintain OWNER role
    if normalized_email in OWNER_EMAILS and user.role != RoleEnum.OWNER:
        user.role = RoleEnum.OWNER
        db.session.commit()

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
    user_role = RoleEnum.OWNER if email in OWNER_EMAILS else RoleEnum.MEMBER

    if user is None:
        random_pw = secrets.token_urlsafe(16)
        user = create_user(
            email=email,
            password=random_pw,
            first_name=first_name,
            last_name=last_name,
            role=user_role,
        )
        from backend.app.members.services import create_member
        try:
            create_member(user_id=user.id)
        except Exception:
            pass
    elif email in OWNER_EMAILS and user.role != RoleEnum.OWNER:
        user.role = RoleEnum.OWNER
        db.session.commit()

    if not user.is_active:
        raise UnauthorizedException("Account is disabled. Please contact club administration.")

    role_val = user.role.value if hasattr(user.role, "value") else str(user.role)
    access_token = create_access_token(
        identity=str(user.id),
        additional_claims={"role": role_val, "email": user.email},
    )

    return user, access_token


def list_users(
    role_filter: Optional[str] = None,
    search: Optional[str] = None,
    is_active: Optional[bool] = None,
    page: int = 1,
    per_page: int = 50,
) -> Tuple[List[User], int]:
    """List system users with filtering for admin role management."""
    query = User.query

    if role_filter:
        try:
            role_enum = RoleEnum(role_filter.upper())
            query = query.filter(User.role == role_enum)
        except ValueError:
            pass

    if search:
        s = f"%{search.strip().lower()}%"
        query = query.filter(
            db.or_(
                db.func.lower(User.email).like(s),
                db.func.lower(User.first_name).like(s),
                db.func.lower(User.last_name).like(s),
            )
        )

    if is_active is not None:
        query = query.filter(User.is_active == is_active)

    query = query.order_by(User.id.desc())
    pagination = query.paginate(page=page, per_page=per_page, error_out=False)
    return pagination.items, pagination.total


def normalize_role_enum(role_str: str) -> RoleEnum:
    """Safely normalize and map role strings to defined RoleEnum values."""
    clean = role_str.strip().upper()
    mapping = {
        "OWNER": RoleEnum.OWNER,
        "ADMIN": RoleEnum.ADMIN,
        "MANAGER": RoleEnum.ADMIN,
        "FRONT_DESK": RoleEnum.FRONT_DESK,
        "STAFF": RoleEnum.FRONT_DESK,
        "SHOP_STAFF": RoleEnum.SHOP_STAFF,
        "BAR_STAFF": RoleEnum.BAR_STAFF,
        "COACH": RoleEnum.COACH,
        "TRAINER": RoleEnum.COACH,
        "MEMBER": RoleEnum.MEMBER,
        "GUEST": RoleEnum.MEMBER,
    }
    if clean in mapping:
        return mapping[clean]
    try:
        return RoleEnum(clean)
    except ValueError:
        raise ConflictException(f"Invalid role '{role_str}'. Allowed: {[r.value for r in RoleEnum]}")


def update_user_role(target_user_id: int, new_role_str: str, acting_user: User) -> User:
    """Update role of a target user. Enforces hierarchy checks server-side."""
    target_user = get_user_by_id(target_user_id)
    if not target_user:
        raise NotFoundException(f"User with ID {target_user_id} not found.")

    acting_role = acting_user.role.value if hasattr(acting_user.role, "value") else str(acting_user.role)
    new_role = normalize_role_enum(new_role_str)

    # Only OWNER can grant or revoke OWNER role
    if (new_role == RoleEnum.OWNER or target_user.role == RoleEnum.OWNER) and acting_role != RoleEnum.OWNER.value:
        raise ForbiddenException("Only the system Owner can assign or modify the OWNER role.")

    # Admins cannot edit other Admins or Owners
    if acting_role == RoleEnum.ADMIN.value:
        if target_user.role in (RoleEnum.OWNER, RoleEnum.ADMIN) and target_user.id != acting_user.id:
            raise ForbiddenException("Admins cannot modify another Admin or Owner account.")

    target_user.role = new_role
    db.session.commit()
    return target_user


def update_user_status(target_user_id: int, is_active: bool, acting_user: User) -> User:
    """Enable or disable a user account."""
    target_user = get_user_by_id(target_user_id)
    if not target_user:
        raise NotFoundException(f"User with ID {target_user_id} not found.")

    if target_user.id == acting_user.id and not is_active:
        raise ConflictException("You cannot disable your own user account.")

    acting_role = acting_user.role.value if hasattr(acting_user.role, "value") else str(acting_user.role)
    if target_user.role == RoleEnum.OWNER and acting_role != RoleEnum.OWNER.value:
        raise ForbiddenException("Only an Owner can modify an Owner account status.")

    target_user.is_active = is_active
    db.session.commit()
    return target_user


def update_user_department(target_user_id: int, department: Optional[str], acting_user: User) -> User:
    """Assign or update an employee's department/sport section."""
    target_user = get_user_by_id(target_user_id)
    if not target_user:
        raise NotFoundException(f"User with ID {target_user_id} not found.")

    target_user.department = department.strip().upper() if department else None
    db.session.commit()
    return target_user


def assign_custom_access(
    email: str,
    role_str: str,
    department: Optional[str],
    first_name: Optional[str],
    last_name: Optional[str],
    acting_user: User,
) -> User:
    """Owner/Admin utility to assign or provision custom role & department by email/Gmail."""
    import secrets

    normalized_email = email.lower().strip()
    new_role = normalize_role_enum(role_str)

    acting_role = acting_user.role.value if hasattr(acting_user.role, "value") else str(acting_user.role)
    if new_role == RoleEnum.OWNER and acting_role != RoleEnum.OWNER.value:
        raise ForbiddenException("Only the Owner can grant the OWNER role.")

    dept_clean = department.strip().upper() if department else None
    user = get_user_by_email(normalized_email)

    if user:
        if (user.role == RoleEnum.OWNER) and acting_role != RoleEnum.OWNER.value:
            raise ForbiddenException("Cannot modify an Owner account.")
        user.role = new_role
        user.department = dept_clean
        if first_name and first_name.strip():
            user.first_name = first_name.strip()
        if last_name and last_name.strip():
            user.last_name = last_name.strip()
        user.is_active = True
        db.session.commit()
        return user
    else:
        fn = first_name.strip() if first_name else normalized_email.split("@")[0].capitalize()
        ln = last_name.strip() if last_name else "Staff"
        random_pw = secrets.token_urlsafe(12)
        return create_user(
            email=normalized_email,
            password=random_pw,
            first_name=fn,
            last_name=ln,
            role=new_role,
            department=dept_clean,
            is_active=True,
        )



