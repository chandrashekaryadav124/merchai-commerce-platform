import os
import sys
import secrets
import logging
from pathlib import Path
from typing import List, Optional, Dict, Any
from urllib.parse import quote_plus, urlparse
from pydantic import BaseModel, Field
from dotenv import load_dotenv

logger = logging.getLogger(__name__)

# Search and load .env from root workspace and backend directories
_backend_dir = Path(__file__).resolve().parent.parent.parent
_root_dir = _backend_dir.parent

if (_root_dir / ".env").exists():
    load_dotenv(_root_dir / ".env")

if (_backend_dir / ".env").exists():
    load_dotenv(_backend_dir / ".env", override=True)

# Known insecure keys that must never be accepted in production
KNOWN_INSECURE_KEYS = {
    "b9138b5bb2c3360e62a7246b500a7e16ee7812626c7d9b7dd76d7b7e8d7a79816f1577",
    "generate_with_openssl_rand_hex_32_or_secure_random_string",
    "your_jwt_secret_key_here",
    "secret",
    "secret_key",
    "changeme",
    "supersecret",
    "default_secret",
}

# Production database host patterns for safeguard detection
PRODUCTION_HOST_PATTERNS = [
    "aivencloud.com",
    "aiven",
]

_cached_ephemeral_dev_secret: Optional[str] = None

def _detect_default_app_env() -> str:
    """Detects environment mode. Honors explicit APP_ENV, detects Render cloud host, or defaults to development."""
    explicit = os.getenv("APP_ENV")
    if explicit:
        return explicit.strip().lower()
    if os.getenv("RENDER", "").lower() in ("true", "1") or os.getenv("IS_RENDER", "").lower() in ("true", "1"):
        return "production"
    return "development"

def _resolve_secret_key(app_env: Optional[str] = None) -> str:
    """
    Safely resolves SECRET_KEY:
    - In production: strictly requires a strong key (min 32 chars) from environment variables.
    - In development/testing: allows env key or generates a transient session key with a warning.
    - Never prints secrets to logs or outputs.
    """
    global _cached_ephemeral_dev_secret
    env_mode = (app_env or _detect_default_app_env()).strip().lower()
    configured_key = os.getenv("SECRET_KEY", "").strip()

    if env_mode == "production":
        if not configured_key or len(configured_key) < 32 or configured_key in KNOWN_INSECURE_KEYS:
            raise ValueError(
                "CRITICAL SECURITY CONFIGURATION ERROR: In production (APP_ENV=production), "
                "a cryptographically secure SECRET_KEY (minimum 32 characters) must be configured "
                "via environment variables. Refusing to start with missing, weak, or default secret key."
            )
        return configured_key

    # Non-production (development / testing):
    if configured_key and configured_key not in KNOWN_INSECURE_KEYS:
        return configured_key

    if _cached_ephemeral_dev_secret is None:
        _cached_ephemeral_dev_secret = secrets.token_hex(32)
        logger.warning(
            "NOTICE: SECRET_KEY is not set or using an insecure default. A transient random secret key "
            "has been generated for this local session. Set SECRET_KEY in your local .env to persist "
            "sessions across restarts."
        )
    return _cached_ephemeral_dev_secret


class Settings(BaseModel):
    PROJECT_NAME: str = "AI Commerce Discovery & Customer Support Platform"
    API_V1_STR: str = "/api/v1"
    PORT: int = int(os.getenv("PORT", "8000"))
    APP_ENV: str = Field(default_factory=_detect_default_app_env)

    # Database Configuration (supports discrete vars or full DATABASE_URL)
    DATABASE_URL: Optional[str] = os.getenv("DATABASE_URL")
    TEST_DATABASE_URL: Optional[str] = os.getenv("TEST_DATABASE_URL")
    MYSQL_HOST: str = os.getenv("MYSQL_HOST", "127.0.0.1")
    MYSQL_PORT: int = int(os.getenv("MYSQL_PORT", "3306"))
    MYSQL_USER: str = os.getenv("MYSQL_USER", "root")
    MYSQL_PASSWORD: str = os.getenv("MYSQL_PASSWORD", "")
    MYSQL_DB: str = os.getenv(
        "MYSQL_DB",
        "ai_commerce_cleaned" if _detect_default_app_env() == "production" else "ai_commerce_dev"
    )
    
    # Isolated Test Database Configuration
    MYSQL_TEST_HOST: str = os.getenv("MYSQL_TEST_HOST", "127.0.0.1")
    MYSQL_TEST_PORT: int = int(os.getenv("MYSQL_TEST_PORT", "3306"))
    MYSQL_TEST_USER: str = os.getenv("MYSQL_TEST_USER", "root")
    MYSQL_TEST_PASSWORD: str = os.getenv("MYSQL_TEST_PASSWORD", "")
    MYSQL_TEST_DB: str = os.getenv("MYSQL_TEST_DB", "ai_commerce_test")
    
    MYSQL_SSL_MODE: Optional[str] = os.getenv("MYSQL_SSL_MODE")
    MYSQL_SSL_CA: Optional[str] = os.getenv("MYSQL_SSL_CA")
    ALLOW_PRODUCTION_DB_ACCESS: bool = os.getenv("ALLOW_PRODUCTION_DB_ACCESS", "false").lower() in ("true", "1", "yes")

    # JWT Auth (fallback removed, safe resolution enforced)
    SECRET_KEY: str = Field(
        default_factory=lambda: _resolve_secret_key(_detect_default_app_env())
    )
    ALGORITHM: str = os.getenv("ALGORITHM", "HS256")
    ACCESS_TOKEN_EXPIRE_MINUTES: int = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "1440"))

    # CORS
    CORS_ORIGINS: List[str] = [
        origin.strip()
        for origin in os.getenv("CORS_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173,http://localhost:3000").split(",")
        if origin.strip()
    ]

    # AI / LLM
    LLM_PROVIDER: str = os.getenv("LLM_PROVIDER", "mock")
    LLM_API_KEY: str = os.getenv("LLM_API_KEY", "mock_key")

    @property
    def is_production(self) -> bool:
        return self.APP_ENV == "production"

    @property
    def is_testing(self) -> bool:
        return (
            self.APP_ENV == "testing"
            or os.getenv("TESTING") == "1"
            or "pytest" in sys.modules
            or any("test" in arg.lower() for arg in sys.argv)
        )

    def validate_database_target(self, host: str, is_test: Optional[bool] = None, is_migration: bool = False) -> None:
        """
        Safeguards against accidental connections to the production Aiven cloud database.
        """
        if not host:
            return

        host_lower = host.lower()
        is_prod_cloud = any(pattern in host_lower for pattern in PRODUCTION_HOST_PATTERNS)

        if not is_prod_cloud:
            return

        # 1. Tests must NEVER touch production cloud database under any circumstance
        in_test = is_test if is_test is not None else self.is_testing
        if in_test:
            raise RuntimeError(
                f"CRITICAL SAFETY SAFEGUARD: Tests are strictly prohibited from connecting to "
                f"production cloud database host ('{host}'). "
                f"Tests must execute against an isolated test database (e.g. host 127.0.0.1, db: {self.MYSQL_TEST_DB})."
            )

        # 2. Schema migrations against production require explicit flag and production environment
        if is_migration:
            allow_migration = os.getenv("ALLOW_PRODUCTION_MIGRATION", "false").lower() in ("true", "1", "yes")
            if not (self.is_production and allow_migration):
                raise RuntimeError(
                    f"CRITICAL SAFETY SAFEGUARD: Schema migrations against production database host ('{host}') "
                    "are blocked. Direct migrations require APP_ENV=production and ALLOW_PRODUCTION_MIGRATION=true."
                )

        # 3. Development commands are prevented from connecting to production cloud database
        if not self.is_production and not self.ALLOW_PRODUCTION_DB_ACCESS:
            raise RuntimeError(
                f"CRITICAL SAFETY SAFEGUARD: Connection to production cloud database host ('{host}') is blocked "
                f"because APP_ENV is '{self.APP_ENV}'. Development commands and local servers are prevented from "
                "connecting to or modifying the production Aiven database.\n"
                f"Please configure a separate local MySQL database (e.g. host: 127.0.0.1, db: {self.MYSQL_DB}) "
                "in your local .env file. For authorized read-only diagnostics from a secure environment, set "
                "ALLOW_PRODUCTION_DB_ACCESS=true."
            )

    @property
    def SQLALCHEMY_DATABASE_URI(self) -> str:
        try:
            import MySQLdb
            driver = "mysql+mysqldb"
        except ImportError:
            driver = "mysql+pymysql"

        # Testing Mode URI resolution
        if self.is_testing:
            if self.TEST_DATABASE_URL:
                uri = self.TEST_DATABASE_URL
                if uri.startswith("mysql://"):
                    uri = f"{driver}://" + uri[len("mysql://"):]
                parsed = urlparse(uri)
                self.validate_database_target(parsed.hostname or "", is_test=True)
                return uri

            # Default to isolated local test database
            self.validate_database_target(self.MYSQL_TEST_HOST, is_test=True)
            pwd_quoted = quote_plus(self.MYSQL_TEST_PASSWORD) if self.MYSQL_TEST_PASSWORD else ""
            auth = f"{self.MYSQL_TEST_USER}:{pwd_quoted}@" if self.MYSQL_TEST_USER else ""
            return f"{driver}://{auth}{self.MYSQL_TEST_HOST}:{self.MYSQL_TEST_PORT}/{self.MYSQL_TEST_DB}?charset=utf8mb4"

        # Standard Mode (Development / Production)
        if self.DATABASE_URL:
            uri = self.DATABASE_URL
            if uri.startswith("mysql://"):
                uri = f"{driver}://" + uri[len("mysql://"):]
            parsed = urlparse(uri)
            self.validate_database_target(parsed.hostname or "", is_test=False)
            return uri

        # Construct from discrete environment variables
        self.validate_database_target(self.MYSQL_HOST, is_test=False)
        pwd_quoted = quote_plus(self.MYSQL_PASSWORD) if self.MYSQL_PASSWORD else ""
        auth = f"{self.MYSQL_USER}:{pwd_quoted}@" if self.MYSQL_USER else ""
        return f"{driver}://{auth}{self.MYSQL_HOST}:{self.MYSQL_PORT}/{self.MYSQL_DB}?charset=utf8mb4"


settings = Settings()
