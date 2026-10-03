import os
from datetime import timedelta
from dotenv import load_dotenv

basedir = os.path.abspath(os.path.dirname(__file__))
# Load environment variables from backend/.env if present
load_dotenv(os.path.join(basedir, "..", ".env"))

instance_dir = os.path.abspath(os.path.join(basedir, "..", "instance"))
os.makedirs(instance_dir, exist_ok=True)
default_sqlite_path = os.path.join(
    instance_dir, "champions_club_dev.db"
).replace("\\", "/")


class BaseConfig:
    """Base application configuration."""

    SECRET_KEY = os.getenv(
        "SECRET_KEY", "dev-champions-club-secret-key-change-in-prod-minimum-32-bytes"
    )
    JWT_SECRET_KEY = os.getenv(
        "JWT_SECRET_KEY", "dev-champions-club-jwt-secret-key-minimum-32-bytes"
    )
    JWT_ACCESS_TOKEN_EXPIRES = timedelta(
        seconds=int(os.getenv("JWT_ACCESS_TOKEN_EXPIRES", 86400))
    )
    SQLALCHEMY_TRACK_MODIFICATIONS = False

    # Court Operating Hours & Slot Settings
    COURT_OPEN_TIME = os.getenv("COURT_OPEN_TIME", "06:00")
    COURT_CLOSE_TIME = os.getenv("COURT_CLOSE_TIME", "22:00")
    COURT_SLOT_DURATION_MINUTES = int(os.getenv("COURT_SLOT_DURATION_MINUTES", 60))
    COURT_SLOT_INTERVAL_MINUTES = int(os.getenv("COURT_SLOT_INTERVAL_MINUTES", 30))
    MAX_DAILY_BOOKINGS_PER_MEMBER = int(os.getenv("MAX_DAILY_BOOKINGS_PER_MEMBER", 2))

    # Court Base Hourly Rates by Sport (INR)
    DEFAULT_SPORT_RATES = {
        "LAWN_TENNIS": float(os.getenv("RATE_LAWN_TENNIS", 800.0)),
        "BADMINTON": float(os.getenv("RATE_BADMINTON", 400.0)),
        "BOX_CRICKET": float(os.getenv("RATE_BOX_CRICKET", 1500.0)),
    }

    # Member Discounts by Plan Code (percentage)
    MEMBER_DISCOUNT_PERCENTAGES = {
        "GOLD": float(os.getenv("DISCOUNT_GOLD", 100.0)),
        "SILVER": float(os.getenv("DISCOUNT_SILVER", 50.0)),
        "JUNIOR": float(os.getenv("DISCOUNT_JUNIOR", 50.0)),
    }

    # Friday Social Play Settings
    FRIDAY_SOCIAL_PLAY_ENABLED = os.getenv("FRIDAY_SOCIAL_PLAY_ENABLED", "True").lower() in ("true", "1", "yes")
    FRIDAY_SOCIAL_PLAY_BASE_RATE = float(os.getenv("FRIDAY_SOCIAL_PLAY_BASE_RATE", 200.0))
    FRIDAY_SOCIAL_PLAY_START_TIME = os.getenv("FRIDAY_SOCIAL_PLAY_START_TIME", "18:00")
    FRIDAY_SOCIAL_PLAY_END_TIME = os.getenv("FRIDAY_SOCIAL_PLAY_END_TIME", "21:00")
    SOCIAL_PLAY_COUNTS_TOWARDS_DAILY_LIMIT = os.getenv("SOCIAL_PLAY_COUNTS_TOWARDS_DAILY_LIMIT", "False").lower() in ("true", "1", "yes")

    # Razorpay Payment Gateway Configuration
    RAZORPAY_KEY_ID = os.getenv("RAZORPAY_KEY_ID", None)
    RAZORPAY_KEY_SECRET = os.getenv("RAZORPAY_KEY_SECRET", None)
    RAZORPAY_WEBHOOK_SECRET = os.getenv("RAZORPAY_WEBHOOK_SECRET", None)
    DEFAULT_CURRENCY = os.getenv("DEFAULT_CURRENCY", "INR")

    # Redis and Celery configuration
    REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")
    CELERY_BROKER_URL = os.getenv("CELERY_BROKER_URL", REDIS_URL)
    CELERY_RESULT_BACKEND = os.getenv("CELERY_RESULT_BACKEND", REDIS_URL)

    # CORS configuration
    CORS_ORIGINS = [
        origin.strip()
        for origin in os.getenv(
            "CORS_ORIGINS", "http://localhost:3000,http://127.0.0.1:3000"
        ).split(",")
        if origin.strip()
    ]


class DevelopmentConfig(BaseConfig):
    """Development environment configuration."""

    DEBUG = True
    TESTING = False
    SQLALCHEMY_DATABASE_URI = os.getenv(
        "DATABASE_URL", f"sqlite:///{default_sqlite_path}"
    )


from sqlalchemy.pool import StaticPool


class TestingConfig(BaseConfig):
    """Testing environment configuration."""

    DEBUG = True
    TESTING = True
    SQLALCHEMY_DATABASE_URI = os.getenv("TEST_DATABASE_URL", "sqlite:///:memory:")
    SQLALCHEMY_ENGINE_OPTIONS = {
        "connect_args": {"check_same_thread": False},
        "poolclass": StaticPool,
    }
    JWT_SECRET_KEY = "test-jwt-secret-key-minimum-32-bytes-length-ok"
    SECRET_KEY = "test-secret-key-minimum-32-bytes-length-ok"
    CELERY_TASK_ALWAYS_EAGER = True
    CELERY_TASK_EAGER_PROPAGATES = True


class ProductionConfig(BaseConfig):
    """Production environment configuration."""

    DEBUG = False
    TESTING = False
    SQLALCHEMY_DATABASE_URI = os.getenv(
        "DATABASE_URL", "postgresql://localhost:5432/champions_club_prod"
    )


config_by_name = {
    "development": DevelopmentConfig,
    "testing": TestingConfig,
    "production": ProductionConfig,
    "default": DevelopmentConfig,
}
