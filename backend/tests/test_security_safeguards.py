import os
import sys
import pytest

# Ensure backend root is on sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.core.config import Settings, _resolve_secret_key, KNOWN_INSECURE_KEYS
from fastapi.testclient import TestClient
from app.main import app

def test_production_db_blocked_in_development():
    """Verify that targeting an Aiven cloud host in development raises a critical safeguard error."""
    s = Settings(APP_ENV="development", MYSQL_HOST="127.0.0.1", ALLOW_PRODUCTION_DB_ACCESS=False)
    with pytest.raises(RuntimeError) as exc_info:
        s.validate_database_target("mysql-project.aivencloud.com", is_test=False)
    assert "CRITICAL SAFETY SAFEGUARD" in str(exc_info.value)
    assert "blocked" in str(exc_info.value).lower()

def test_production_db_strictly_blocked_in_tests():
    """Verify that tests are forbidden from connecting to Aiven cloud DB even if override is attempted."""
    s = Settings(APP_ENV="testing", MYSQL_HOST="127.0.0.1", ALLOW_PRODUCTION_DB_ACCESS=True)
    with pytest.raises(RuntimeError) as exc_info:
        s.validate_database_target("mysql-project.aivencloud.com", is_test=True)
    assert "CRITICAL SAFETY SAFEGUARD" in str(exc_info.value)
    assert "strictly prohibited" in str(exc_info.value).lower()

def test_production_db_allowed_in_production():
    """Verify that genuine production environments are permitted to connect to cloud DB."""
    s = Settings(APP_ENV="production", MYSQL_HOST="mysql-project.aivencloud.com", SECRET_KEY="a" * 32)
    # Should not raise exception
    s.validate_database_target("mysql-project.aivencloud.com", is_test=False)

def test_secret_key_required_in_production():
    """Verify that production mode raises ValueError if SECRET_KEY is missing or too short."""
    # Test empty secret
    with pytest.raises(ValueError) as exc_info:
        _resolve_secret_key("production")
    assert "CRITICAL SECURITY CONFIGURATION ERROR" in str(exc_info.value)

def test_insecure_default_secret_rejected_in_production():
    """Verify that previously hardcoded or default secrets are strictly rejected in production."""
    old_leaked_key = "b9138b5bb2c3360e62a7246b500a7e16ee7812626c7d9b7dd76d7b7e8d7a79816f1577"
    os.environ["SECRET_KEY"] = old_leaked_key
    try:
        with pytest.raises(ValueError) as exc_info:
            _resolve_secret_key("production")
        assert "CRITICAL SECURITY CONFIGURATION ERROR" in str(exc_info.value)
    finally:
        os.environ.pop("SECRET_KEY", None)

def test_transient_secret_generated_in_development():
    """Verify that development generates a transient secure key if none is set."""
    os.environ.pop("SECRET_KEY", None)
    key = _resolve_secret_key("development")
    assert isinstance(key, str)
    assert len(key) >= 32
    assert key not in KNOWN_INSECURE_KEYS

def test_root_health_endpoint():
    """Verify public health endpoint returns online status safely."""
    client = TestClient(app)
    res = client.get("/health")
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "online"
    assert "service" in data
