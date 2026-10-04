import os
from sqlalchemy import text
from backend.app import create_app
from backend.app.config import DevelopmentConfig, TestingConfig, ProductionConfig
from backend.app.extensions import db, jwt, bcrypt, ma, migrate, cors


def test_app_creation():
    """Test that the application factory creates a valid Flask app."""
    app = create_app("testing")
    assert app is not None
    assert app.config["TESTING"] is True


def test_configurations(monkeypatch):
    """Test that configuration classes load expected values."""
    dev_app = create_app("development")
    assert dev_app.config["DEBUG"] is True
    assert dev_app.config["TESTING"] is False

    test_app = create_app("testing")
    assert test_app.config["TESTING"] is True
    expected_test_uri = os.getenv("TEST_DATABASE_URL", "sqlite:///:memory:")
    assert test_app.config["SQLALCHEMY_DATABASE_URI"] == expected_test_uri

    monkeypatch.setenv("SECRET_KEY", "prod-secret-key-minimum-32-chars-long")
    monkeypatch.setenv("JWT_SECRET_KEY", "prod-jwt-secret-key-minimum-32-chars-long")
    monkeypatch.setenv("CORS_ORIGINS", "https://app.championsclub.example.com")
    monkeypatch.setenv("REDIS_URL", "redis://localhost:6379/0")
    monkeypatch.setenv("DATABASE_URL", "sqlite:///:memory:")

    prod_app = create_app("production")
    assert prod_app.config["TESTING"] is False
    assert prod_app.config["DEBUG"] is False


def test_database_connection(app, db_session):
    """Test that database connectivity works with SQLAlchemy."""
    with app.app_context():
        result = db_session.execute(text("SELECT 1 as is_alive")).scalar()
        assert result == 1


def test_extensions_initialized(app):
    """Test that all required extensions are registered on the app."""
    assert "sqlalchemy" in app.extensions
    assert "migrate" in app.extensions
    assert "flask-jwt-extended" in app.extensions
    assert "flask-marshmallow" in app.extensions
    assert hasattr(bcrypt, "generate_password_hash")
    assert hasattr(ma, "Schema")
    assert cors is not None


def test_bcrypt_hashing(app):
    """Test that password hashing extension works."""
    with app.app_context():
        password = "SecurePassword123!"
        hashed = bcrypt.generate_password_hash(password).decode("utf-8")
        assert hashed != password
        assert bcrypt.check_password_hash(hashed, password) is True
        assert bcrypt.check_password_hash(hashed, "WrongPassword") is False
