import os
import sys
import pytest

# Ensure repository root is in python path
repo_root = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
if repo_root not in sys.path:
    sys.path.insert(0, repo_root)

from backend.app import create_app
from backend.app.extensions import db as _db


@pytest.fixture(scope="function")
def app():
    """Create application for testing with fresh in-memory database per test."""
    app_instance = create_app("testing")
    with app_instance.app_context():
        _db.create_all()
        yield app_instance
        _db.session.remove()
        _db.drop_all()


@pytest.fixture(scope="function")
def client(app):
    """Test client fixture."""
    return app.test_client()


@pytest.fixture(scope="function")
def runner(app):
    """CLI test runner fixture."""
    return app.test_cli_runner()


@pytest.fixture(scope="function")
def db_session(app):
    """Database session fixture for tests."""
    with app.app_context():
        yield _db.session
        _db.session.rollback()
