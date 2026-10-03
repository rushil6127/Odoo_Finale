"""Authentication Context Middleware for Champions Club backend."""
from typing import Dict, Any, Optional
from flask import Flask, g, has_request_context
from flask_jwt_extended import (
    verify_jwt_in_request,
    get_jwt_identity,
    get_jwt,
    current_user,
)


def get_auth_context() -> Dict[str, Any]:
    """Retrieve structured authentication context for the current request.

    Returns a dictionary containing:
      - user_id: Authenticated user's ID as str/int or None
      - role: Authenticated user's role string or None
      - email: Authenticated user's email or None
      - is_authenticated: Boolean flag
    """
    if not has_request_context():
        return {
            "user_id": None,
            "role": None,
            "email": None,
            "is_authenticated": False,
        }

    user_id = getattr(g, "auth_user_id", None)
    role = getattr(g, "auth_role", None)
    email = getattr(g, "auth_email", None)

    # Fallback to current_user if loaded via @jwt_required()
    if user_id is None:
        try:
            user_obj = current_user._get_current_object() if hasattr(current_user, "_get_current_object") else current_user
            if user_obj is not None and hasattr(user_obj, "id"):
                user_id = str(user_obj.id)
                role = user_obj.role.value if hasattr(user_obj.role, "value") else str(user_obj.role)
                email = getattr(user_obj, "email", None)
        except Exception:
            pass

    return {
        "user_id": user_id,
        "role": role,
        "email": email,
        "is_authenticated": user_id is not None,
    }


def register_auth_middleware(app: Flask) -> None:
    """Register authentication context hook on the Flask application.

    This hook safely detects valid JWT tokens on incoming requests and populates
    request context without rejecting unauthenticated requests. Endpoint-level
    decorators (@jwt_required, @roles_required) remain the authoritative gatekeepers.
    """

    @app.before_request
    def populate_auth_context():
        g.auth_user_id = None
        g.auth_role = None
        g.auth_email = None
        g.is_authenticated = False

        try:
            # optional=True allows public and webhook endpoints to proceed without token
            verify_jwt_in_request(optional=True)
            identity = get_jwt_identity()
            if identity is not None:
                claims = get_jwt() or {}
                g.auth_user_id = str(identity)
                g.auth_role = claims.get("role")
                g.auth_email = claims.get("email")
                g.is_authenticated = True
        except Exception:
            # Token invalid/expired or absent; leave auth context unpopulated.
            # Protected endpoints will raise 401 via their own @jwt_required() decorator.
            pass
