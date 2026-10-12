from typing import Optional
from fastapi import APIRouter, Depends, Header, status
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.models.users import AppUser
from app.core.deps import RoleChecker
from app.schemas.checkout import CheckoutSummaryResponse, OrderPlacementRequest
from app.schemas.customer_account import OrderDetailResponse
from app.services.checkout_service import (
    get_checkout_summary_service,
    place_order_service
)

router = APIRouter()

@router.get("/summary", response_model=CheckoutSummaryResponse)
def get_checkout_summary(
    current_user: AppUser = Depends(RoleChecker(["customer", "admin"])),
    db: Session = Depends(get_db)
):
    """
    Returns an authoritative server-side pricing breakdown and stock validation summary.
    Employs decimal-safe arithmetic for line totals, merchandise subtotal, shipping fee, and GST tax.
    """
    return get_checkout_summary_service(db, current_user.user_id)

@router.post("/place-order", response_model=OrderDetailResponse, status_code=status.HTTP_201_CREATED)
def place_order(
    req: OrderPlacementRequest,
    idempotency_key: Optional[str] = Header(None, alias="Idempotency-Key"),
    current_user: AppUser = Depends(RoleChecker(["customer", "admin"])),
    db: Session = Depends(get_db)
):
    """
    Atomically places an order from the customer's persisted database cart.
    1. Authenticates customer from JWT.
    2. Validates selected delivery address ownership and 6-digit Indian PIN code.
    3. Revalidates inventory with row-level locks and current authoritative prices.
    4. Creates Order, OrderItems, SellerOrders, SellerOrderItems, Payment, Shipment.
    5. Deducts stock atomically.
    6. Protects against duplicate orders on retry via idempotency key.
    7. Clears active cart on commit.
    """
    return place_order_service(db, current_user, req, idempotency_key_header=idempotency_key)
