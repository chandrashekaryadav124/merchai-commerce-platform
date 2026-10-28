import os
import sys
from pathlib import Path
import pytest

# Ensure backend root is on sys.path
_backend_root = Path(__file__).resolve().parent.parent
if str(_backend_root) not in sys.path:
    sys.path.insert(0, str(_backend_root))

# Enforce testing environment before importing application
os.environ["APP_ENV"] = "testing"
os.environ["TESTING"] = "1"

from app.core.config import settings

@pytest.fixture(scope="session", autouse=True)
def verify_test_database_safety():
    """
    Session-level safeguard fixture that verifies tests NEVER run against
    a production cloud database.
    """
    target_test_host = settings.MYSQL_TEST_HOST
    if settings.TEST_DATABASE_URL:
        from urllib.parse import urlparse
        target_test_host = urlparse(settings.TEST_DATABASE_URL).hostname or ""
    settings.validate_database_target(target_test_host, is_test=True)
