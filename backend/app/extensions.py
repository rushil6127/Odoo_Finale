from sqlalchemy import MetaData
from flask_sqlalchemy import SQLAlchemy
from flask_migrate import Migrate
from flask_jwt_extended import JWTManager
from flask_bcrypt import Bcrypt
from flask_marshmallow import Marshmallow
from flask_cors import CORS

from flask import g
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address

naming_convention = {
    "ix": "ix_%(column_0_label)s",
    "uq": "uq_%(table_name)s_%(column_0_name)s",
    "ck": "ck_%(table_name)s_%(constraint_name)s",
    "fk": "fk_%(table_name)s_%(column_0_name)s_%(referred_table_name)s",
    "pk": "pk_%(table_name)s",
}

metadata = MetaData(naming_convention=naming_convention)
db = SQLAlchemy(metadata=metadata)
migrate = Migrate()
jwt = JWTManager()
bcrypt = Bcrypt()
ma = Marshmallow()
cors = CORS()


def get_rate_limit_key() -> str:
    """Return a rate limiting key based on authenticated user identity or client remote IP."""
    user_id = getattr(g, "user_id", None)
    if user_id is not None:
        return f"user:{user_id}"
    return get_remote_address()


limiter = Limiter(
    key_func=get_rate_limit_key,
    default_limits=["500 per minute"],
    storage_uri="memory://",
    strategy="fixed-window",
    headers_enabled=True,
)
