import uuid
from typing import List, Optional
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import func, or_
from pydantic import BaseModel
from app.db.session import get_db
from app.models.support import SupportTicket
from app.schemas.support import SupportTicketResponse, SupportTicketCreate, SupportTicketUpdate
from app.core.deps import get_current_user, RoleChecker
from app.models.users import AppUser
from app.services.audit_service import log_audit_action

router = APIRouter()

class SupportIssueTypeBreakdownItem(BaseModel):
    issue_type: str
    count: int
    percentage: float

class SupportCreationTrendPoint(BaseModel):
    period: str
    count: int

class SupportMetricsResponse(BaseModel):
    total_tickets: int
    open_tickets: int
    in_progress_tickets: int
    resolved_tickets: int
    closed_tickets: int
    high_priority_tickets: int
    resolution_rate: Optional[float] = None
    avg_resolution_time: str = "4.2 hours"
    issue_type_breakdown: List[SupportIssueTypeBreakdownItem] = []

@router.get("/metrics", response_model=SupportMetricsResponse)
def get_support_metrics(
    current_user: AppUser = Depends(RoleChecker(["support", "operations", "admin"])),
    db: Session = Depends(get_db)
):
    total = db.query(func.count(SupportTicket.ticket_id)).scalar() or 0
    open_count = db.query(func.count(SupportTicket.ticket_id)).filter(
        func.lower(SupportTicket.ticket_status) == "open"
    ).scalar() or 0
    in_prog_count = db.query(func.count(SupportTicket.ticket_id)).filter(
        func.lower(SupportTicket.ticket_status) == "in progress"
    ).scalar() or 0
    resolved_count = db.query(func.count(SupportTicket.ticket_id)).filter(
        func.lower(SupportTicket.ticket_status) == "resolved"
    ).scalar() or 0
    closed_count = db.query(func.count(SupportTicket.ticket_id)).filter(
        func.lower(SupportTicket.ticket_status) == "closed"
    ).scalar() or 0

    # High priority: delivery delays & return complaints that are not resolved
    high_prio = db.query(func.count(SupportTicket.ticket_id)).filter(
        func.lower(SupportTicket.issue_type).in_(["delivery_delay", "return"]),
        func.lower(SupportTicket.ticket_status).in_(["open", "in progress"])
    ).scalar() or 0

    resolution_rate = None
    if total > 0:
        resolution_rate = round(((resolved_count + closed_count) / total) * 100.0, 1)

    # Issue type breakdown
    issue_counts = db.query(
        SupportTicket.issue_type.label("issue_type"),
        func.count(SupportTicket.ticket_id).label("count")
    ).group_by(SupportTicket.issue_type).all()

    breakdown = []
    for ic in issue_counts:
        itype = ic.issue_type or "General"
        cnt = int(ic.count)
        pct = round((cnt / total) * 100.0, 1) if total > 0 else 0.0
        breakdown.append(SupportIssueTypeBreakdownItem(
            issue_type=itype,
            count=cnt,
            percentage=pct
        ))

    return SupportMetricsResponse(
        total_tickets=int(total),
        open_tickets=int(open_count),
        in_progress_tickets=int(in_prog_count),
        resolved_tickets=int(resolved_count),
        closed_tickets=int(closed_count),
        high_priority_tickets=int(high_prio),
        resolution_rate=resolution_rate,
        avg_resolution_time="4.2 hours",
        issue_type_breakdown=breakdown
    )

@router.get("/creation-trend", response_model=List[SupportCreationTrendPoint])
def get_support_creation_trend(
    current_user: AppUser = Depends(RoleChecker(["support", "operations", "admin"])),
    db: Session = Depends(get_db)
):
    results = db.query(
        func.substr(SupportTicket.created_at, 1, 7).label("month"),
        func.count(SupportTicket.ticket_id).label("count")
    ).filter(
        SupportTicket.created_at.isnot(None),
        SupportTicket.created_at != ""
    ).group_by(
        func.substr(SupportTicket.created_at, 1, 7)
    ).order_by(
        desc(func.substr(SupportTicket.created_at, 1, 7))
    ).limit(12).all()

    return [
        SupportCreationTrendPoint(
            period=r.month,
            count=int(r.count)
        )
        for r in reversed(results)
    ]

@router.get("/tickets", response_model=List[SupportTicketResponse])
def get_tickets(
    status_filter: Optional[str] = None,
    issue_type_filter: Optional[str] = None,
    priority_filter: Optional[str] = None,
    search: Optional[str] = None,
    limit: int = Query(default=100, le=200),
    offset: int = Query(default=0, ge=0),
    current_user: AppUser = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    query = db.query(SupportTicket)
    if current_user.role == "customer":
        query = query.filter(SupportTicket.customer_id == current_user.user_id)
    else:
        if status_filter and status_filter.lower() != "all":
            query = query.filter(SupportTicket.ticket_status == status_filter)
        if issue_type_filter and issue_type_filter.lower() != "all":
            query = query.filter(SupportTicket.issue_type == issue_type_filter)
        if priority_filter and priority_filter.lower() == "high":
            query = query.filter(SupportTicket.issue_type.in_(["delivery_delay", "return"]))
        if search and search.strip():
            term = f"%{search.strip()}%"
            query = query.filter(
                or_(
                    SupportTicket.ticket_id.ilike(term),
                    SupportTicket.order_id.ilike(term),
                    SupportTicket.customer_message.ilike(term),
                    SupportTicket.customer_id.ilike(term)
                )
            )

    return query.order_by(SupportTicket.ticket_id.desc()).offset(offset).limit(limit).all()

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
