from typing import List, Optional
from sqlalchemy.orm import Session
from fastapi import HTTPException, status
from app.models.users import AppUser
from app.models.customer_account import CustomerAddress
from app.schemas.address import AddressCreate, AddressUpdate, AddressResponse
from app.services.audit_service import log_audit_action

def list_customer_addresses_service(db: Session, current_user: AppUser) -> List[CustomerAddress]:
    """
    Returns saved delivery addresses strictly scoped to the authenticated customer.
    """
    return db.query(CustomerAddress).filter(
        CustomerAddress.user_id == current_user.user_id
    ).order_by(CustomerAddress.is_default.desc(), CustomerAddress.address_id.desc()).all()

def get_customer_address_service(db: Session, current_user: AppUser, address_id: int) -> CustomerAddress:
    """
    Retrieves a single address belonging to the authenticated customer.
    Enforces strict tenant isolation.
    """
    addr = db.query(CustomerAddress).filter(
        CustomerAddress.address_id == address_id,
        CustomerAddress.user_id == current_user.user_id
    ).first()
    if not addr:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Address not found or does not belong to your account."
        )
    return addr

def create_customer_address_service(db: Session, current_user: AppUser, addr_in: AddressCreate) -> CustomerAddress:
    """
    Creates a new delivery address for the authenticated customer.
    If marked as default or if this is the customer's first address, sets as default.
    """
    existing_count = db.query(CustomerAddress).filter(
        CustomerAddress.user_id == current_user.user_id
    ).count()

    is_default = addr_in.is_default or (existing_count == 0)

    if is_default:
        # Clear default flag on existing addresses
        db.query(CustomerAddress).filter(
            CustomerAddress.user_id == current_user.user_id,
            CustomerAddress.is_default == True
        ).update({"is_default": False})

    new_addr = CustomerAddress(
        user_id=current_user.user_id,
        recipient_name=addr_in.recipient_name,
        phone_number=addr_in.phone_number,
        address_line1=addr_in.address_line1,
        address_line2=addr_in.address_line2,
        city=addr_in.city,
        state=addr_in.state,
        postal_code=addr_in.postal_code,
        country=addr_in.country or "India",
        is_default=is_default
    )
    db.add(new_addr)
    db.commit()
    db.refresh(new_addr)

    log_audit_action(
        db,
        action="CUSTOMER_ADDRESS_CREATED",
        entity_type="address",
        user_id=current_user.user_id,
        entity_id=str(new_addr.address_id),
        details={"city": new_addr.city, "postal_code": new_addr.postal_code, "is_default": is_default}
    )

    return new_addr

def update_customer_address_service(
    db: Session,
    current_user: AppUser,
    address_id: int,
    addr_in: AddressUpdate
) -> CustomerAddress:
    """
    Updates an existing delivery address belonging to the authenticated customer.
    """
    addr = get_customer_address_service(db, current_user, address_id)

    update_data = addr_in.model_dump(exclude_unset=True)

    if update_data.get("is_default") is True:
        # Unset default on other addresses
        db.query(CustomerAddress).filter(
            CustomerAddress.user_id == current_user.user_id,
            CustomerAddress.address_id != address_id,
            CustomerAddress.is_default == True
        ).update({"is_default": False})

    for field, val in update_data.items():
        setattr(addr, field, val)

    db.commit()
    db.refresh(addr)

    log_audit_action(
        db,
        action="CUSTOMER_ADDRESS_UPDATED",
        entity_type="address",
        user_id=current_user.user_id,
        entity_id=str(addr.address_id),
        details={"updated_fields": list(update_data.keys())}
    )

    return addr

def delete_customer_address_service(db: Session, current_user: AppUser, address_id: int) -> bool:
    """
    Deletes an address belonging to the authenticated customer.
    If the deleted address was the default, automatically elevates the most recent address as default.
    """
    addr = get_customer_address_service(db, current_user, address_id)
    was_default = addr.is_default

    db.delete(addr)
    db.commit()

    if was_default:
        next_default = db.query(CustomerAddress).filter(
            CustomerAddress.user_id == current_user.user_id
        ).order_by(CustomerAddress.address_id.desc()).first()
        if next_default:
            next_default.is_default = True
            db.commit()

    log_audit_action(
        db,
        action="CUSTOMER_ADDRESS_DELETED",
        entity_type="address",
        user_id=current_user.user_id,
        entity_id=str(address_id),
        details={"was_default": was_default}
    )

    return True

def set_default_address_service(db: Session, current_user: AppUser, address_id: int) -> CustomerAddress:
    """
    Sets a specific address as the customer's default delivery address.
    """
    addr = get_customer_address_service(db, current_user, address_id)

    db.query(CustomerAddress).filter(
        CustomerAddress.user_id == current_user.user_id,
        CustomerAddress.is_default == True
    ).update({"is_default": False})

    addr.is_default = True
    db.commit()
    db.refresh(addr)

    return addr
