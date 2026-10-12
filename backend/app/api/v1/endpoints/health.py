from fastapi import APIRouter
from app.db.session import check_db_health

router = APIRouter()

@router.get("/health", tags=["Health"])
def health_check():
    """
    Root API Liveness check. Returns operational status of the FastAPI backend.
    """
    return {
        "status": "online",
        "service": "AI Commerce Marketplace API",
        "version": "1.0.0"
    }

@router.get("/health/db", tags=["Health"])
@router.get("/api/health/db", tags=["Health"])
@router.get("/db", tags=["Health"])
def db_health_check():
    """
    Database Readiness check. Verifies MySQL database connectivity cleanly without exposing sensitive credentials.
    """
    return check_db_health()
