import os
from pathlib import Path
from typing import List, Optional
from pydantic import BaseModel
from dotenv import load_dotenv

# Search and load .env from root workspace and backend directories
_backend_dir = Path(__file__).resolve().parent.parent.parent
_root_dir = _backend_dir.parent

if (_root_dir / ".env").exists():
    load_dotenv(_root_dir / ".env")

if (_backend_dir / ".env").exists():
    load_dotenv(_backend_dir / ".env", override=True)

class Settings(BaseModel):
    PROJECT_NAME: str = "AI Commerce Discovery & Customer Support Platform"
    API_V1_STR: str = "/api/v1"
    PORT: int = int(os.getenv("PORT", "8000"))
    
    # Database Configuration (supports discrete vars or full DATABASE_URL)
    DATABASE_URL: Optional[str] = os.getenv("DATABASE_URL")
    MYSQL_HOST: str = os.getenv("MYSQL_HOST", "localhost")
    MYSQL_PORT: int = int(os.getenv("MYSQL_PORT", "3306"))
    MYSQL_USER: str = os.getenv("MYSQL_USER", "root")
    MYSQL_PASSWORD: str = os.getenv("MYSQL_PASSWORD", "")
    MYSQL_DB: str = os.getenv("MYSQL_DB", "ai_commerce_cleaned")
    MYSQL_SSL_MODE: Optional[str] = os.getenv("MYSQL_SSL_MODE")
    MYSQL_SSL_CA: Optional[str] = os.getenv("MYSQL_SSL_CA")
    
    # JWT Auth
    SECRET_KEY: str = os.getenv("SECRET_KEY", "b9138b5bb2c3360e62a7246b500a7e16ee7812626c7d9b7dd76d7b7e8d7a79816f1577")
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
    def SQLALCHEMY_DATABASE_URI(self) -> str:
        from urllib.parse import quote_plus
        try:
            import MySQLdb
            driver = "mysql+mysqldb"
        except ImportError:
            driver = "mysql+pymysql"

        # 1. Use full DATABASE_URL if provided
        if self.DATABASE_URL:
            uri = self.DATABASE_URL
            if uri.startswith("mysql://"):
                uri = f"{driver}://" + uri[len("mysql://"):]
            return uri

        # 2. Construct from discrete environment variables
        pwd_quoted = quote_plus(self.MYSQL_PASSWORD) if self.MYSQL_PASSWORD else ""
        auth = f"{self.MYSQL_USER}:{pwd_quoted}@" if self.MYSQL_USER else ""
        return f"{driver}://{auth}{self.MYSQL_HOST}:{self.MYSQL_PORT}/{self.MYSQL_DB}?charset=utf8mb4"

settings = Settings()

