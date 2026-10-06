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


class RequiredProdEnv:
    """Descriptor to enforce required non-empty environment variables in production."""

    def __init__(self, env_var: str, error_msg: str, transform=None):
        self.env_var = env_var
        self.error_msg = error_msg
        self.transform = transform

    def __get__(self, instance, owner=None):
        val = os.getenv(self.env_var)
        if not val or not val.strip():
            raise ValueError(self.error_msg)
        val = val.strip()
        if self.transform:
            return self.transform(val)
        return val


class RequiredProdAnyEnv:
    """Descriptor to enforce at least one of multiple environment variables in production."""

    def __init__(self, env_vars: list, error_msg: str, transform=None):
        self.env_vars = env_vars
        self.error_msg = error_msg
        self.transform = transform

    def __get__(self, instance, owner=None):
        for var in self.env_vars:
            val = os.getenv(var)
            if val and val.strip():
                val = val.strip()
                if self.transform:
                    return self.transform(val)
                return val
        raise ValueError(self.error_msg)


def _parse_prod_cors(val: str):
    origins = [origin.strip() for origin in val.split(",") if origin.strip()]
    if not origins:
        raise ValueError(
            "CORS_ORIGINS environment variable must contain at least one valid origin URL in production."
        )
    return origins


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
    MAX_DAILY_BOOKINGS_PER_MEMBER = int(os.getenv("MAX_DAILY_BOOKINGS_PER_MEMBER", 5))

    # Court Base Hourly Rates by Sport (INR)
    DEFAULT_SPORT_RATES = {
        "LAWN_TENNIS": float(os.getenv("RATE_LAWN_TENNIS", 800.0)),
        "SWIMMING_POOL": float(os.getenv("RATE_SWIMMING_POOL", 500.0)),
        "BADMINTON": float(os.getenv("RATE_BADMINTON", 400.0)),
        "BOX_CRICKET": float(os.getenv("RATE_BOX_CRICKET", 1500.0)),
        "TABLE_TENNIS": float(os.getenv("RATE_TABLE_TENNIS", 300.0)),
        "VOLLEYBALL": float(os.getenv("RATE_VOLLEYBALL", 600.0)),
    }

    # Member Discounts by Plan Code (percentage)
    MEMBER_DISCOUNT_PERCENTAGES = {
        "GOLD": float(os.getenv("DISCOUNT_GOLD", 100.0)),
        "SILVER": float(os.getenv("DISCOUNT_SILVER", 50.0)),
        "JUNIOR": float(os.getenv("DISCOUNT_JUNIOR", 50.0)),
    }

    # Friday Social Play Settings
    FRIDAY_SOCIAL_PLAY_ENABLED = os.getenv("FRIDAY_SOCIAL_PLAY_ENABLED", "True").lower() in ("true", "1", "yes")
    FRIDAY_SOCIAL_PLAY_BASE_RATE = float(os.getenv("FRIDAY_SOCIAL_PLAY_BASE_RATE", 300.0))
    FRIDAY_SOCIAL_PLAY_START_TIME = os.getenv("FRIDAY_SOCIAL_PLAY_START_TIME", "19:00")
    FRIDAY_SOCIAL_PLAY_END_TIME = os.getenv("FRIDAY_SOCIAL_PLAY_END_TIME", "22:00")
    FRIDAY_SOCIAL_PLAY_MAX_USERS_PER_COURT = int(os.getenv("FRIDAY_SOCIAL_PLAY_MAX_USERS_PER_COURT", 8))
    SOCIAL_PLAY_COUNTS_TOWARDS_DAILY_LIMIT = os.getenv("SOCIAL_PLAY_COUNTS_TOWARDS_DAILY_LIMIT", "False").lower() in ("true", "1", "yes")

    # Razorpay Payment Gateway Configuration
    RAZORPAY_KEY_ID = os.getenv("RAZORPAY_KEY_ID", None)
    RAZORPAY_KEY_SECRET = os.getenv("RAZORPAY_KEY_SECRET", None)
    RAZORPAY_WEBHOOK_SECRET = os.getenv("RAZORPAY_WEBHOOK_SECRET", None)
    DEFAULT_CURRENCY = os.getenv("DEFAULT_CURRENCY", "INR")

    # Timezone & Tax Configuration
    CLUB_TIMEZONE = os.getenv("CLUB_TIMEZONE", "Asia/Kolkata")
    GST_RATE_SERVICES = float(os.getenv("GST_RATE_SERVICES", 0.18))
    GST_RATE_POS = float(os.getenv("GST_RATE_POS", 0.05))
    GST_RATE_SHOP = float(os.getenv("GST_RATE_SHOP", 0.18))
    GST_RATE_INVOICE = float(os.getenv("GST_RATE_INVOICE", 0.18))

    # Redis and Celery configuration
    REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")
    CELERY_BROKER_URL = os.getenv("CELERY_BROKER_URL", REDIS_URL)
    CELERY_RESULT_BACKEND = os.getenv("CELERY_RESULT_BACKEND", REDIS_URL)

    # Rate Limiting Configuration (Flask-Limiter)
    RATELIMIT_ENABLED = os.getenv("RATELIMIT_ENABLED", "True").lower() in ("true", "1", "yes")
    RATELIMIT_STORAGE_URI = os.getenv("RATELIMIT_STORAGE_URI", os.getenv("REDIS_URL", "redis://localhost:6379/0"))
    RATELIMIT_DEFAULT = os.getenv("RATELIMIT_DEFAULT", "500 per minute")
    RATELIMIT_STRATEGY = "fixed-window"
    RATELIMIT_HEADERS_ENABLED = True

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
    RATELIMIT_STORAGE_URI = os.getenv("RATELIMIT_STORAGE_URI", "memory://")


from sqlalchemy.pool import StaticPool


class TestingConfig(BaseConfig):
    """Testing environment configuration."""

    DEBUG = True
    TESTING = True
    SQLALCHEMY_DATABASE_URI = os.getenv("TEST_DATABASE_URL", "sqlite:///:memory:")
    JWT_SECRET_KEY = "test-jwt-secret-key-minimum-32-bytes-length-ok"
    SECRET_KEY = "test-secret-key-minimum-32-bytes-length-ok"
    CELERY_TASK_ALWAYS_EAGER = True
    CELERY_TASK_EAGER_PROPAGATES = True
    RATELIMIT_STORAGE_URI = "memory://"
    RATELIMIT_ENABLED = True
    RAZORPAY_KEY_ID = None
    RAZORPAY_KEY_SECRET = None


class ProductionConfig(BaseConfig):
    """Production environment configuration."""

    DEBUG = False
    TESTING = False
    SQLALCHEMY_DATABASE_URI = RequiredProdEnv(
        "DATABASE_URL",
        "DATABASE_URL environment variable is required in production.",
    )

    # Required production secrets - must NOT silently fall back to hardcoded defaults
    SECRET_KEY = RequiredProdEnv(
        "SECRET_KEY",
        "SECRET_KEY environment variable is required in production.",
    )
    JWT_SECRET_KEY = RequiredProdEnv(
        "JWT_SECRET_KEY",
        "JWT_SECRET_KEY environment variable is required in production.",
    )

    # Required production CORS - must come from CORS_ORIGINS without localhost fallback
    CORS_ORIGINS = RequiredProdEnv(
        "CORS_ORIGINS",
        "CORS_ORIGINS environment variable is required in production (e.g. 'https://club.example.com').",
        transform=_parse_prod_cors,
    )

    # Rate limiting & Redis - must use configured Redis URL via env var without local fallback
    RATELIMIT_STORAGE_URI = RequiredProdAnyEnv(
        ["RATELIMIT_STORAGE_URI", "REDIS_URL"],
        "RATELIMIT_STORAGE_URI or REDIS_URL environment variable is required in production for rate limiting.",
    )
    REDIS_URL = RequiredProdEnv(
        "REDIS_URL",
        "REDIS_URL environment variable is required in production.",
    )
    CELERY_BROKER_URL = RequiredProdAnyEnv(
        ["CELERY_BROKER_URL", "REDIS_URL"],
        "CELERY_BROKER_URL or REDIS_URL environment variable is required in production.",
    )
    CELERY_RESULT_BACKEND = RequiredProdAnyEnv(
        ["CELERY_RESULT_BACKEND", "REDIS_URL"],
        "CELERY_RESULT_BACKEND or REDIS_URL environment variable is required in production.",
    )


config_by_name = {
    "development": DevelopmentConfig,
    "testing": TestingConfig,
    "production": ProductionConfig,
    "default": DevelopmentConfig,
}
