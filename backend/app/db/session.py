from typing import Generator, Dict, Any
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker, declarative_base
from app.core.config import settings

# Configure SSL connection arguments if SSL mode or CA cert is provided
connect_args: Dict[str, Any] = {}
if settings.MYSQL_SSL_CA:
    connect_args["ssl"] = {"ca": settings.MYSQL_SSL_CA}
elif settings.MYSQL_SSL_MODE:
    if "pymysql" in settings.SQLALCHEMY_DATABASE_URI:
        connect_args["ssl"] = {"ssl_mode": settings.MYSQL_SSL_MODE.upper()}
    else:
        connect_args["ssl_mode"] = settings.MYSQL_SSL_MODE.upper()

engine = create_engine(
    settings.SQLALCHEMY_DATABASE_URI,
    pool_pre_ping=True,
    pool_recycle=300,
    pool_size=10,
    max_overflow=20,
    connect_args=connect_args,
    echo=False
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

def get_db() -> Generator:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def check_db_health() -> Dict[str, Any]:
    """
    Verifies database connection without exposing credentials or sensitive database details.
    """
    try:
        with engine.connect() as conn:
            result = conn.execute(text("SELECT 1;")).fetchone()
            table_count = conn.execute(text("SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = DATABASE();")).fetchone()[0]
            
            if result and result[0] == 1:
                return {
                    "status": "healthy",
                    "database_connected": True,
                    "database_name": settings.MYSQL_DB,
                    "total_tables": table_count,
                    "engine_driver": "MySQLdb / SQLAlchemy"
                }
    except Exception as e:
        return {
            "status": "unhealthy",
            "database_connected": False,
            "error_summary": "Failed to establish MySQL connection. Verify database service and credentials."
        }
