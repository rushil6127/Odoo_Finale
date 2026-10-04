import os
from flask import Flask
from backend.app.config import config_by_name, DevelopmentConfig
from backend.app.extensions import db, migrate, jwt, bcrypt, ma, cors, limiter
from backend.app.middleware import init_middleware
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
from backend.app.inventory import (  # noqa: F401
    inventory_bp,
    ProductCategory,
    Product,
    InventoryMovement,
    MovementType,
    seed_inventory_command,
)
from backend.app.shop import shop_bp, ShopOrder, ShopOrderItem  # noqa: F401
from backend.app.pos import (  # noqa: F401
    pos_bp,
    POSTable,
    POSMenuCategory,
    POSMenuItem,
    StaffShift,
    POSTab,
    POSOrderItem,
    seed_pos_command,
)
from backend.app.crm import (  # noqa: F401
    crm_bp,
    CRMLead,
    CRMFollowUp,
    CRMNote,
    CRMTrialSession,
    CRMQuote,
)
from backend.app.notifications import Notification  # noqa: F401
from backend.app.reports import reports_bp
from backend.app.invoices import (  # noqa: F401
    invoices_bp,
    Invoice,
    InvoiceItem,
    BusinessClient,
    TaxRate,
)
from backend.app.employees import (  # noqa: F401
    employees_bp,
    Employee,
    LeaveRequest,
    PayrollRecord,
)
import backend.app.tasks.dispatcher  # noqa: F401 Ensure event listeners registered


def create_app(config_name: str = None) -> Flask:
    """Application factory for the Champions Club Flask backend."""
    if config_name is None:
        config_name = os.getenv("FLASK_ENV", "development").lower()

    config_class = config_by_name.get(config_name, DevelopmentConfig)

    app = Flask(__name__, instance_relative_config=True)
    app.config.from_object(config_class)

    # Configure database engine options based on SQLite vs PostgreSQL
    db_uri = app.config.get("SQLALCHEMY_DATABASE_URI", "")
    if db_uri.startswith("sqlite"):
        if ":memory:" in db_uri:
            from sqlalchemy.pool import StaticPool
            app.config["SQLALCHEMY_ENGINE_OPTIONS"] = {
                "connect_args": {"check_same_thread": False},
                "poolclass": StaticPool,
            }
        else:
            app.config["SQLALCHEMY_ENGINE_OPTIONS"] = {
                "connect_args": {"check_same_thread": False, "timeout": 30},
            }
    else:
        app.config["SQLALCHEMY_ENGINE_OPTIONS"] = {
            "pool_pre_ping": True,
        }

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
    limiter.init_app(app)

    cors_origins = app.config.get("CORS_ORIGINS", "*")
    cors.init_app(
        app,
        resources={r"/api/*": {"origins": cors_origins}, r"/health": {"origins": "*"}},
    )

    # Initialize Celery app context binding
    from backend.app.tasks.celery_app import make_celery
    make_celery(app)

    # Initialize request middleware & centralized error handlers
    init_middleware(app, jwt)

    # Register blueprints
    app.register_blueprint(health_bp)
    app.register_blueprint(auth_bp)
    app.register_blueprint(members_bp)
    app.register_blueprint(membership_plans_bp)
    app.register_blueprint(memberships_bp)
    app.register_blueprint(courts_bp)
    app.register_blueprint(bookings_bp)
    app.register_blueprint(payments_bp)
    app.register_blueprint(inventory_bp)
    app.register_blueprint(shop_bp)
    app.register_blueprint(pos_bp)
    app.register_blueprint(crm_bp)
    app.register_blueprint(reports_bp)
    app.register_blueprint(invoices_bp)
    app.register_blueprint(employees_bp)

    # Register CLI commands
    from backend.app.seeds import seed_cli
    app.cli.add_command(create_owner_command)
    app.cli.add_command(seed_plans_command)
    app.cli.add_command(seed_courts_command)
    app.cli.add_command(seed_inventory_command)
    app.cli.add_command(seed_pos_command)
    app.cli.add_command(seed_cli)

    return app
