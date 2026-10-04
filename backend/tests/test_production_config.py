import pytest
import os
from flask import Flask
from backend.app.config import (
    ProductionConfig,
    DevelopmentConfig,
    TestingConfig,
    BaseConfig,
)


def test_production_config_requires_secret_key(monkeypatch):
    """Production configuration must fail if SECRET_KEY is not provided."""
    monkeypatch.delenv("SECRET_KEY", raising=False)
    monkeypatch.setenv("JWT_SECRET_KEY", "valid-prod-jwt-secret-key-min-32-chars")
    monkeypatch.setenv("CORS_ORIGINS", "https://championsclub.example.com")
    monkeypatch.setenv("REDIS_URL", "rediss://prod-redis.internal:6379/0")
    monkeypatch.setenv("DATABASE_URL", "postgresql://prod-db:5432/champions")

    app = Flask(__name__)
    with pytest.raises(ValueError, match="SECRET_KEY"):
        app.config.from_object(ProductionConfig)


def test_production_config_requires_jwt_secret_key(monkeypatch):
    """Production configuration must fail if JWT_SECRET_KEY is not provided."""
    monkeypatch.setenv("SECRET_KEY", "valid-prod-flask-secret-key-min-32-chars")
    monkeypatch.delenv("JWT_SECRET_KEY", raising=False)
    monkeypatch.setenv("CORS_ORIGINS", "https://championsclub.example.com")
    monkeypatch.setenv("REDIS_URL", "rediss://prod-redis.internal:6379/0")
    monkeypatch.setenv("DATABASE_URL", "postgresql://prod-db:5432/champions")

    app = Flask(__name__)
    with pytest.raises(ValueError, match="JWT_SECRET_KEY"):
        app.config.from_object(ProductionConfig)


def test_production_config_requires_cors_origins(monkeypatch):
    """Production configuration must fail if CORS_ORIGINS is missing or empty, with no localhost fallback."""
    monkeypatch.setenv("SECRET_KEY", "valid-prod-flask-secret-key-min-32-chars")
    monkeypatch.setenv("JWT_SECRET_KEY", "valid-prod-jwt-secret-key-min-32-chars")
    monkeypatch.delenv("CORS_ORIGINS", raising=False)
    monkeypatch.setenv("REDIS_URL", "rediss://prod-redis.internal:6379/0")
    monkeypatch.setenv("DATABASE_URL", "postgresql://prod-db:5432/champions")

    app = Flask(__name__)
    with pytest.raises(ValueError, match="CORS_ORIGINS"):
        app.config.from_object(ProductionConfig)


def test_production_config_requires_redis_for_rate_limiting(monkeypatch):
    """Production configuration must require Redis URL and not silently use local Redis or memory."""
    monkeypatch.setenv("SECRET_KEY", "valid-prod-flask-secret-key-min-32-chars")
    monkeypatch.setenv("JWT_SECRET_KEY", "valid-prod-jwt-secret-key-min-32-chars")
    monkeypatch.setenv("CORS_ORIGINS", "https://championsclub.example.com")
    monkeypatch.delenv("RATELIMIT_STORAGE_URI", raising=False)
    monkeypatch.delenv("REDIS_URL", raising=False)
    monkeypatch.setenv("DATABASE_URL", "postgresql://prod-db:5432/champions")

    with pytest.raises(ValueError, match="RATELIMIT_STORAGE_URI or REDIS_URL"):
        _ = ProductionConfig.RATELIMIT_STORAGE_URI


def test_production_config_loads_with_valid_env(monkeypatch):
    """Production configuration succeeds and populates properly when all required env vars are present."""
    monkeypatch.setenv("SECRET_KEY", "valid-prod-flask-secret-key-min-32-chars")
    monkeypatch.setenv("JWT_SECRET_KEY", "valid-prod-jwt-secret-key-min-32-chars")
    monkeypatch.setenv("CORS_ORIGINS", "https://club.champions.com, https://members.champions.com")
    monkeypatch.setenv("REDIS_URL", "rediss://prod-redis.internal:6379/0")
    monkeypatch.setenv("DATABASE_URL", "postgresql://prod-db:5432/champions")

    app = Flask(__name__)
    app.config.from_object(ProductionConfig)

    assert app.config["SECRET_KEY"] == "valid-prod-flask-secret-key-min-32-chars"
    assert app.config["JWT_SECRET_KEY"] == "valid-prod-jwt-secret-key-min-32-chars"
    assert app.config["CORS_ORIGINS"] == ["https://club.champions.com", "https://members.champions.com"]
    assert "localhost" not in app.config["CORS_ORIGINS"][0]
    assert app.config["RATELIMIT_STORAGE_URI"] == "rediss://prod-redis.internal:6379/0"
    assert app.config["REDIS_URL"] == "rediss://prod-redis.internal:6379/0"
    assert app.config["DEBUG"] is False
    assert app.config["TESTING"] is False


def test_development_and_testing_configs_preserve_safe_defaults():
    """Development and Testing configs maintain convenient and safe local defaults."""
    dev_app = Flask(__name__)
    dev_app.config.from_object(DevelopmentConfig)
    assert dev_app.config["DEBUG"] is True
    assert dev_app.config["TESTING"] is False
    assert dev_app.config["RATELIMIT_STORAGE_URI"] == "memory://"
    assert "localhost:3000" in dev_app.config["CORS_ORIGINS"][0]

    test_app = Flask(__name__)
    test_app.config.from_object(TestingConfig)
    assert test_app.config["TESTING"] is True
    assert test_app.config["SECRET_KEY"] == "test-secret-key-minimum-32-bytes-length-ok"
    assert test_app.config["JWT_SECRET_KEY"] == "test-jwt-secret-key-minimum-32-bytes-length-ok"
    assert test_app.config["RATELIMIT_STORAGE_URI"] == "memory://"


def test_friday_social_play_finalized_settings():
    """Verify finalized Friday Social Play configuration constants."""
    assert BaseConfig.FRIDAY_SOCIAL_PLAY_BASE_RATE == 300.0
    assert BaseConfig.FRIDAY_SOCIAL_PLAY_START_TIME == "19:00"
    assert BaseConfig.FRIDAY_SOCIAL_PLAY_END_TIME == "22:00"
    assert BaseConfig.FRIDAY_SOCIAL_PLAY_MAX_USERS_PER_COURT == 8
