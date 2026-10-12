from typing import List
from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.models.users import AppUser
from app.core.deps import RoleChecker
from app.schemas.address import AddressCreate, AddressUpdate, AddressResponse
from app.services.address_service import (
    list_customer_addresses_service,
    get_customer_address_service,
    create_customer_address_service,
    update_customer_address_service,
    delete_customer_address_service,
    set_default_address_service
)

router = APIRouter()

@router.get("", response_model=List[AddressResponse])
def get_addresses(
    current_user: AppUser = Depends(RoleChecker(["customer", "admin"])),
    db: Session = Depends(get_db)
):
    """
    Lists saved delivery addresses for the authenticated customer only.
    """
    return list_customer_addresses_service(db, current_user)

@router.post("", response_model=AddressResponse, status_code=status.HTTP_201_CREATED)
def create_address(
    addr_in: AddressCreate,
    current_user: AppUser = Depends(RoleChecker(["customer", "admin"])),
    db: Session = Depends(get_db)
):
    """
    Adds a new delivery address for the authenticated customer.
    Validates required Indian address fields and 6-digit postal PIN code.
    """
    return create_customer_address_service(db, current_user, addr_in)

@router.get("/{address_id}", response_model=AddressResponse)
def get_address_detail(
    address_id: int,
    current_user: AppUser = Depends(RoleChecker(["customer", "admin"])),
    db: Session = Depends(get_db)
):
    """
    Retrieves a single delivery address. Strictly verifies ownership.
    """
    return get_customer_address_service(db, current_user, address_id)

@router.put("/{address_id}", response_model=AddressResponse)
def update_address(
    address_id: int,
    addr_in: AddressUpdate,
    current_user: AppUser = Depends(RoleChecker(["customer", "admin"])),
    db: Session = Depends(get_db)
):
    """
    Updates an existing delivery address. Strictly verifies ownership.
    """
    return update_customer_address_service(db, current_user, address_id, addr_in)

@router.delete("/{address_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_address(
    address_id: int,
    current_user: AppUser = Depends(RoleChecker(["customer", "admin"])),
    db: Session = Depends(get_db)
):
    """
    Deletes a delivery address. Strictly verifies ownership.
    """
    delete_customer_address_service(db, current_user, address_id)
    return None

@router.patch("/{address_id}/default", response_model=AddressResponse)
def set_default_address(
    address_id: int,
    current_user: AppUser = Depends(RoleChecker(["customer", "admin"])),
    db: Session = Depends(get_db)
):
    """
    Sets the specified address as the customer's default delivery address.
    """
    return set_default_address_service(db, current_user, address_id)
