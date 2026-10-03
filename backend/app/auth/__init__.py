from backend.app.extensions import jwt, db
from backend.app.auth.models import User
from backend.app.auth.routes import auth_bp
from backend.app.auth.cli import create_owner_command


@jwt.user_identity_loader
def user_identity_lookup(user):
    """Callback to serialize user identity into JWT subject."""
    if isinstance(user, User):
        return str(user.id)
    return str(user)


@jwt.user_lookup_loader
def user_lookup_callback(_jwt_header, jwt_data):
    """Callback to load User instance into flask_jwt_extended.current_user."""
    identity = jwt_data.get("sub")
    if not identity:
        return None
    try:
        user_id = int(identity)
        return db.session.get(User, user_id)
    except (ValueError, TypeError):
        return None


__all__ = ["User", "auth_bp", "create_owner_command"]
