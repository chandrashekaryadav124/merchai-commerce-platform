from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.models.users import AppUser
from app.core.deps import get_current_user, RoleChecker
from app.schemas.customer_account import (
    CustomerProfileResponse,
    AccountSummaryResponse,
    PaginatedOrdersResponse,
    OrderDetailResponse,
    ShipmentTrackingResponse,
    PaymentHistoryResponse,
    ReturnRefundResponse,
    CustomerReviewResponse,
    CreateReviewRequest,
    SupportTicketResponse,
    CreateSupportTicketRequest,
    CustomerFinancialOverviewResponse,
    CustomerSpendingTrendPoint
)
from app.services.customer_account_service import (
    get_customer_profile_service,
    get_account_summary_service,
    get_paginated_customer_orders_service,
    get_customer_order_detail_service,
    get_customer_shipments_service,
    get_customer_payments_service,
    get_customer_returns_service,
    get_customer_reviews_service,
    create_customer_review_service,
    get_customer_tickets_service,
    create_customer_ticket_service,
    get_customer_financial_overview_service,
    get_customer_spending_trend_service
)

router = APIRouter()

@router.get("/profile", response_model=CustomerProfileResponse)
def get_customer_profile(
    current_user: AppUser = Depends(RoleChecker(["customer", "admin"])),
    db: Session = Depends(get_db)
):
    """
    Returns the authenticated customer's profile details and live aggregated metrics.
    Verifies ownership using JWT identity.
    """
    return get_customer_profile_service(db, current_user)

@router.get("/summary", response_model=AccountSummaryResponse)
def get_account_summary(
    current_user: AppUser = Depends(RoleChecker(["customer", "admin"])),
    db: Session = Depends(get_db)
):
    """
    Returns high-level dashboard summary metrics for the authenticated customer.
    """
    return get_account_summary_service(db, current_user)

@router.get("/financial-overview", response_model=CustomerFinancialOverviewResponse)
def get_customer_financial_overview(
    current_user: AppUser = Depends(RoleChecker(["customer", "admin"])),
    db: Session = Depends(get_db)
):
    """
    Returns comprehensive customer financial KPIs and payment distribution metrics.
    """
    return get_customer_financial_overview_service(db, current_user)

@router.get("/spending-trend", response_model=List[CustomerSpendingTrendPoint])
def get_customer_spending_trend(
    current_user: AppUser = Depends(RoleChecker(["customer", "admin"])),
    db: Session = Depends(get_db)
):
    """
    Returns monthly spending trend for the authenticated customer.
    """
    return get_customer_spending_trend_service(db, current_user)

@router.get("/orders", response_model=PaginatedOrdersResponse)
def get_customer_orders(
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=10, ge=1, le=100),
    status_filter: Optional[str] = None,
    current_user: AppUser = Depends(RoleChecker(["customer", "admin"])),
    db: Session = Depends(get_db)
):
    """
    Returns paginated order history strictly filtered by the authenticated customer's verified ID(s).
    """
    return get_paginated_customer_orders_service(db, current_user, page=page, limit=limit, status_filter=status_filter)

@router.get("/orders/{order_id}", response_model=OrderDetailResponse)
def get_customer_order_detail(
    order_id: str,
    current_user: AppUser = Depends(RoleChecker(["customer", "admin"])),
    db: Session = Depends(get_db)
):
    """
    Returns complete order details, line items, shipment tracking, and payment breakdown.
    Enforces strict ownership check (returns 404/403 if order belongs to another customer).
    """
    try:
        return get_customer_order_detail_service(db, current_user, order_id)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))

@router.get("/shipments", response_model=List[ShipmentTrackingResponse])
def get_customer_shipments(
    current_user: AppUser = Depends(RoleChecker(["customer", "admin"])),
    db: Session = Depends(get_db)
):
    """
    Returns active & historical shipment tracking records linked to the customer's orders.
    """
    return get_customer_shipments_service(db, current_user)

@router.get("/payments", response_model=List[PaymentHistoryResponse])
def get_customer_payments(
    status_filter: Optional[str] = None,
    method_filter: Optional[str] = None,
    limit: int = Query(default=100, le=200),
    offset: int = Query(default=0, ge=0),
    current_user: AppUser = Depends(RoleChecker(["customer", "admin"])),
    db: Session = Depends(get_db)
):
    """
    Returns payment transaction history linked to the customer's orders with optional status & method filtering.
    """
    return get_customer_payments_service(
        db,
        current_user,
        status_filter=status_filter,
        method_filter=method_filter,
        limit=limit,
        offset=offset
    )

@router.get("/returns", response_model=List[ReturnRefundResponse])
def get_customer_returns(
    current_user: AppUser = Depends(RoleChecker(["customer", "admin"])),
    db: Session = Depends(get_db)
):
    """
    Returns return & refund request records for the authenticated customer.
    """
    return get_customer_returns_service(db, current_user)

@router.get("/reviews", response_model=List[CustomerReviewResponse])
def get_customer_reviews(
    current_user: AppUser = Depends(RoleChecker(["customer", "admin"])),
    db: Session = Depends(get_db)
):
    """
    Returns all product reviews submitted by the authenticated customer.
    """
    return get_customer_reviews_service(db, current_user)

@router.post("/reviews", response_model=CustomerReviewResponse)
def create_customer_review(
    req: CreateReviewRequest,
    current_user: AppUser = Depends(RoleChecker(["customer", "admin"])),
    db: Session = Depends(get_db)
):
    """
    Submits a new verified product review for the authenticated customer.
    """
    return create_customer_review_service(db, current_user, req)

@router.get("/tickets", response_model=List[SupportTicketResponse])
def get_customer_tickets(
    current_user: AppUser = Depends(RoleChecker(["customer", "admin"])),
    db: Session = Depends(get_db)
):
    """
    Returns all support tickets submitted by the authenticated customer.
    """
    return get_customer_tickets_service(db, current_user)

@router.post("/tickets", response_model=SupportTicketResponse)
def create_customer_ticket(
    req: CreateSupportTicketRequest,
    current_user: AppUser = Depends(RoleChecker(["customer", "admin"])),
    db: Session = Depends(get_db)
):
    """
    Submits a new customer support ticket for the authenticated customer.
    """
    return create_customer_ticket_service(db, current_user, req)

