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

    SECRET_KEY = os.getenv("SECRET_KEY", "dev-champions-club-secret-key-change-in-prod")
    JWT_SECRET_KEY = os.getenv("JWT_SECRET_KEY", "dev-champions-club-jwt-secret-key")
    JWT_ACCESS_TOKEN_EXPIRES = timedelta(
        seconds=int(os.getenv("JWT_ACCESS_TOKEN_EXPIRES", 86400))
    )
    SQLALCHEMY_TRACK_MODIFICATIONS = False

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


class TestingConfig(BaseConfig):
    """Testing environment configuration."""

    DEBUG = True
    TESTING = True
    SQLALCHEMY_DATABASE_URI = os.getenv("TEST_DATABASE_URL", "sqlite:///:memory:")
    JWT_SECRET_KEY = "test-jwt-secret-key"
    SECRET_KEY = "test-secret-key"
    CELERY_TASK_ALWAYS_EAGER = True


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
