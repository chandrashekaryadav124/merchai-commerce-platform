from sqlalchemy import Column, BigInteger, String, JSON, DateTime, func
from app.db.session import Base

class AuditLog(Base):
    __tablename__ = "audit_logs"

    audit_log_id = Column(BigInteger, primary_key=True, autoincrement=True)
    user_id = Column(String(64), nullable=True, index=True)
    action = Column(String(100), nullable=False)
    entity_type = Column(String(100), nullable=False)
    entity_id = Column(String(255), nullable=True)
    details = Column(JSON, nullable=True)
    created_at = Column(DateTime, server_default=func.now())
