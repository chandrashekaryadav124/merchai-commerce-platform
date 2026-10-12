from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.models.users import AppUser
from app.core.deps import RoleChecker
from app.schemas.cart import (
    CartItemAdd,
    CartItemUpdate,
    CartResponse,
    CartMergeRequest
)
from app.services.cart_service import (
    get_cart_details_service,
    add_item_to_cart_service,
    update_cart_item_quantity_service,
    remove_cart_item_service,
    clear_cart_service,
    merge_guest_cart_service
)

router = APIRouter()

@router.get("", response_model=CartResponse)
def get_cart(
    current_user: AppUser = Depends(RoleChecker(["customer", "admin"])),
    db: Session = Depends(get_db)
):
    """
    Returns the authenticated customer's persisted active cart from MySQL.
    """
    return get_cart_details_service(db, current_user.user_id)

@router.post("/items", response_model=CartResponse, status_code=status.HTTP_201_CREATED)
def add_to_cart(
    item_in: CartItemAdd,
    current_user: AppUser = Depends(RoleChecker(["customer", "admin"])),
    db: Session = Depends(get_db)
):
    """
    Adds a product to the authenticated customer's database-backed cart.
    Validates active listing status and available inventory.
    """
    return add_item_to_cart_service(db, current_user.user_id, item_in)

@router.put("/items/{cart_item_id}", response_model=CartResponse)
def update_cart_item(
    cart_item_id: int,
    item_in: CartItemUpdate,
    current_user: AppUser = Depends(RoleChecker(["customer", "admin"])),
    db: Session = Depends(get_db)
):
    """
    Updates item quantity or removes item (quantity=0) in active cart.
    Validates available stock.
    """
    return update_cart_item_quantity_service(db, current_user.user_id, cart_item_id, item_in.quantity)

@router.delete("/items/{cart_item_id}", response_model=CartResponse)
def remove_from_cart(
    cart_item_id: int,
    current_user: AppUser = Depends(RoleChecker(["customer", "admin"])),
    db: Session = Depends(get_db)
):
    """
    Removes a specific item from active cart.
    """
    return remove_cart_item_service(db, current_user.user_id, cart_item_id)

@router.delete("", response_model=CartResponse)
def clear_cart(
    current_user: AppUser = Depends(RoleChecker(["customer", "admin"])),
    db: Session = Depends(get_db)
):
    """
    Empties the authenticated customer's active cart.
    """
    return clear_cart_service(db, current_user.user_id)

@router.post("/merge", response_model=CartResponse)
def merge_cart(
    req: CartMergeRequest,
    current_user: AppUser = Depends(RoleChecker(["customer", "admin"])),
    db: Session = Depends(get_db)
):
    """
    Merges local guest cart items into the user's database cart upon sign-in.
    """
    return merge_guest_cart_service(db, current_user.user_id, req)
