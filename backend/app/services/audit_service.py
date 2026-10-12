from typing import Optional, Dict, Any
from sqlalchemy.orm import Session
from app.models.audit import AuditLog

def log_audit_action(
    db: Session,
    action: str,
    entity_type: str,
    user_id: Optional[str] = None,
    entity_id: Optional[str] = None,
    details: Optional[Dict[str, Any]] = None
) -> None:
    try:
        audit_entry = AuditLog(
            user_id=user_id,
            action=action,
            entity_type=entity_type,
            entity_id=entity_id,
            details=details
        )
        db.add(audit_entry)
        db.commit()
    except Exception as e:
        db.rollback()
        # Log error to stderr or logger without crashing main thread
        print(f"Failed to record audit log: {e}")
