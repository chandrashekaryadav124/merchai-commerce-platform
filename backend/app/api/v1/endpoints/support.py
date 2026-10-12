import uuid
from typing import List, Optional
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.models.support import SupportTicket
from app.schemas.support import SupportTicketResponse, SupportTicketCreate, SupportTicketUpdate
from app.core.deps import get_current_user, RoleChecker
from app.models.users import AppUser
from app.services.audit_service import log_audit_action

router = APIRouter()

@router.get("/tickets", response_model=List[SupportTicketResponse])
def get_tickets(
    status_filter: Optional[str] = None,
    current_user: AppUser = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    query = db.query(SupportTicket)
    if current_user.role == "customer":
        query = query.filter(SupportTicket.customer_id == current_user.user_id)
    elif status_filter:
        query = query.filter(SupportTicket.ticket_status == status_filter)
    
    return query.order_by(SupportTicket.ticket_id.desc()).limit(100).all()

@router.post("/tickets", response_model=SupportTicketResponse)
def create_ticket(
    ticket_in: SupportTicketCreate,
    current_user: AppUser = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    new_ticket_id = f"TKT{uuid.uuid4().hex[:7].upper()}"
    now_str = datetime.now().strftime("%Y-%m-%d")

    new_ticket = SupportTicket(
        ticket_id=new_ticket_id,
        customer_id=current_user.user_id,
        order_id=ticket_in.order_id,
        issue_type=ticket_in.issue_type,
        customer_message=ticket_in.customer_message,
        resolution_guidance="Pending agent review.",
        ticket_status="Open",
        created_at=now_str,
        source_type="Customer Support App"
    )
    db.add(new_ticket)
    db.commit()
    db.refresh(new_ticket)

    log_audit_action(
        db,
        action="SUPPORT_TICKET_CREATED",
        entity_type="support_ticket",
        user_id=current_user.user_id,
        entity_id=new_ticket_id,
        details={"issue_type": ticket_in.issue_type}
    )

    return new_ticket

@router.patch("/tickets/{ticket_id}", response_model=SupportTicketResponse)
def update_ticket(
    ticket_id: str,
    update_in: SupportTicketUpdate,
    current_user: AppUser = Depends(RoleChecker(["support", "operations", "admin"])),
    db: Session = Depends(get_db)
):
    ticket = db.query(SupportTicket).filter(SupportTicket.ticket_id == ticket_id).first()
    if not ticket:
        raise HTTPException(status_code=404, detail="Support ticket not found.")
    
    if update_in.ticket_status:
        ticket.ticket_status = update_in.ticket_status
    if update_in.resolution_guidance:
        ticket.resolution_guidance = update_in.resolution_guidance
    
    db.commit()
    db.refresh(ticket)

    log_audit_action(
        db,
        action="SUPPORT_TICKET_UPDATED",
        entity_type="support_ticket",
        user_id=current_user.user_id,
        entity_id=ticket_id,
        details={"new_status": ticket.ticket_status}
    )

    return ticket
