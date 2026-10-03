import os
from flask import Flask
from backend.app.config import config_by_name, DevelopmentConfig
from backend.app.extensions import db, migrate, jwt, bcrypt, ma, cors
from backend.app.common.errors import register_error_handlers
from backend.app.health.routes import health_bp


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

    return app
