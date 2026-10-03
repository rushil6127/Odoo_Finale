import os
from flask import Flask
from backend.app.config import config_by_name, DevelopmentConfig
from backend.app.extensions import db, migrate, jwt, bcrypt, ma, cors
from backend.app.common.errors import register_error_handlers
from backend.app.health.routes import health_bp
from backend.app.auth import auth_bp, create_owner_command, User  # noqa: F401
from backend.app.members import members_bp, Member  # noqa: F401
from backend.app.memberships import (  # noqa: F401
    membership_plans_bp,
    memberships_bp,
    seed_plans_command,
    MembershipPlan,
    Membership,
)
from backend.app.courts import courts_bp, seed_courts_command, Court  # noqa: F401
from backend.app.bookings import bookings_bp, Booking, CourtOccupancy  # noqa: F401
from backend.app.payments import payments_bp, Payment, PaymentAudit, PaymentWebhookEvent  # noqa: F401


def create_app(config_name: str = None) -> Flask:
    """Application factory for the Champions Club Flask backend."""
    if config_name is None:
        config_name = os.getenv("FLASK_ENV", "development").lower()

    config_class = config_by_name.get(config_name, DevelopmentConfig)

    app = Flask(__name__, instance_relative_config=True)
    app.config.from_object(config_class)

    # Ensure the instance directory exists for SQLite storage
    os.makedirs(app.instance_path, exist_ok=True)

    # Migrations directory path (backend/migrations)
    backend_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
    migrations_dir = os.path.join(backend_dir, "migrations")

    # Initialize extensions
    db.init_app(app)
    migrate.init_app(app, db, directory=migrations_dir)
    jwt.init_app(app)
    bcrypt.init_app(app)
    ma.init_app(app)

    cors_origins = app.config.get("CORS_ORIGINS", "*")
    cors.init_app(
        app,
        resources={r"/api/*": {"origins": cors_origins}, r"/health": {"origins": "*"}},
    )

    # Register custom JSON error handlers & JWT callbacks
    register_error_handlers(app, jwt)

    # Register blueprints
    app.register_blueprint(health_bp)
    app.register_blueprint(auth_bp)
    app.register_blueprint(members_bp)
    app.register_blueprint(membership_plans_bp)
    app.register_blueprint(memberships_bp)
    app.register_blueprint(courts_bp)
    app.register_blueprint(bookings_bp)
    app.register_blueprint(payments_bp)

    # Register CLI commands
    app.cli.add_command(create_owner_command)
    app.cli.add_command(seed_plans_command)
    app.cli.add_command(seed_courts_command)

    return app
