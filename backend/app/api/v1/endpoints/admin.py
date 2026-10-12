import uuid
import re
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from sqlalchemy import func
from pydantic import BaseModel
from app.db.session import get_db
from app.models.users import AppUser
from app.models.sellers import Seller
from app.schemas.auth import UserResponse
from app.schemas.sellers import SellerResponse
from app.core.security import get_password_hash
from app.core.deps import RoleChecker
from app.services.audit_service import log_audit_action

router = APIRouter()

class UserStatusUpdate(BaseModel):
    is_active: bool

class SellerApprovalUpdate(BaseModel):
    approval_status: Optional[str] = None  # approved, pending, suspended, rejected
    store_type: Optional[str] = None

class AdminProvisionUserRequest(BaseModel):
    full_name: str
    email: str
    password: str
    role: str  # support, operations, admin, seller

@router.get("/users", response_model=List[UserResponse])
def list_all_users(
    role_filter: Optional[str] = None,
    status_filter: Optional[str] = None,
    search: Optional[str] = None,
    limit: int = Query(default=200, le=1000),
    current_admin: AppUser = Depends(RoleChecker(["admin"])),
    db: Session = Depends(get_db)
):
    query = db.query(AppUser)
    if role_filter and role_filter.lower() != "all":
        query = query.filter(AppUser.role == role_filter.lower())
    if status_filter and status_filter.lower() != "all":
        if status_filter.lower() == "active":
            query = query.filter(AppUser.is_active == True)
        elif status_filter.lower() == "deactivated":
            query = query.filter(AppUser.is_active == False)
    if search:
        s_term = f"%{search.strip()}%"
        query = query.filter(
            (AppUser.full_name.ilike(s_term)) |
            (AppUser.email.ilike(s_term)) |
            (AppUser.user_id.ilike(s_term))
        )
    return query.limit(limit).all()

@router.patch("/users/{target_user_id}/status", response_model=UserResponse)
def update_user_status(
    target_user_id: str,
    update_in: UserStatusUpdate,
    current_admin: AppUser = Depends(RoleChecker(["admin"])),
    db: Session = Depends(get_db)
):
    user = db.query(AppUser).filter(AppUser.user_id == target_user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found.")
    
    user.is_active = update_in.is_active
    db.commit()
    db.refresh(user)

    log_audit_action(
        db,
        action="ADMIN_UPDATE_USER_STATUS",
        entity_type="user",
        user_id=current_admin.user_id,
        entity_id=target_user_id,
        details={"is_active": update_in.is_active}
    )

    return user

@router.get("/sellers", response_model=List[SellerResponse])
def list_all_sellers(
    approval_status: Optional[str] = None,
    search: Optional[str] = None,
    current_admin: AppUser = Depends(RoleChecker(["admin"])),
    db: Session = Depends(get_db)
):
    query = db.query(Seller)
    if approval_status and approval_status.lower() != "all":
        query = query.filter(Seller.approval_status == approval_status.lower())
    if search:
        s_term = f"%{search.strip()}%"
        query = query.filter(
            (Seller.store_name.ilike(s_term)) |
            (Seller.seller_id.ilike(s_term)) |
            (Seller.contact_email.ilike(s_term)) |
            (Seller.user_id.ilike(s_term))
        )
    sellers = query.all()

    # Populate owner metadata for relationship display
    user_ids = [s.user_id for s in sellers if s.user_id]
    users_map = {}
    if user_ids:
        users = db.query(AppUser).filter(AppUser.user_id.in_(user_ids)).all()
        users_map = {u.user_id: u for u in users}

    result = []
    for s in sellers:
        s_res = SellerResponse.from_orm(s)
        if s.user_id and s.user_id in users_map:
            u = users_map[s.user_id]
            s_res.owner_full_name = u.full_name
            s_res.owner_email = u.email
            s_res.owner_is_active = u.is_active
        result.append(s_res)

    return result

@router.patch("/sellers/{seller_id}/approval", response_model=SellerResponse)
def update_seller_approval(
    seller_id: str,
    update_in: SellerApprovalUpdate,
    current_admin: AppUser = Depends(RoleChecker(["admin"])),
    db: Session = Depends(get_db)
):
    seller = db.query(Seller).filter(Seller.seller_id == seller_id).first()
    if not seller:
        raise HTTPException(status_code=404, detail="Seller profile not found.")
    
    if update_in.approval_status:
        valid_statuses = ["approved", "pending", "suspended", "rejected"]
        if update_in.approval_status not in valid_statuses:
            raise HTTPException(status_code=400, detail=f"Invalid status. Must be one of {valid_statuses}")
        seller.approval_status = update_in.approval_status

    if update_in.store_type:
        from app.core.categories import VALID_STORE_TYPES
        clean_st = update_in.store_type.strip()
        if clean_st not in VALID_STORE_TYPES:
            raise HTTPException(status_code=400, detail=f"Invalid store type. Must be one of {VALID_STORE_TYPES}")
        seller.store_type = clean_st

    # When seller application is approved by Admin, grant 'seller' role to associated user account
    if seller.user_id and update_in.approval_status == "approved":
        user = db.query(AppUser).filter(AppUser.user_id == seller.user_id).first()
        if user and user.role != "admin":
            user.role = "seller"

    db.commit()
    db.refresh(seller)

    # Attach owner metadata for return response
    s_res = SellerResponse.from_orm(seller)
    if seller.user_id:
        user = db.query(AppUser).filter(AppUser.user_id == seller.user_id).first()
        if user:
            s_res.owner_full_name = user.full_name
            s_res.owner_email = user.email
            s_res.owner_is_active = user.is_active

    log_audit_action(
        db,
        action="ADMIN_UPDATE_SELLER_APPROVAL",
        entity_type="seller",
        user_id=current_admin.user_id,
        entity_id=seller_id,
        details={"approval_status": update_in.approval_status}
    )

    return s_res

@router.post("/users/provision", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
def provision_user_account(
    req: AdminProvisionUserRequest,
    current_admin: AppUser = Depends(RoleChecker(["admin"])),
    db: Session = Depends(get_db)
):
    email_clean = req.email.strip().lower()
    if not re.match(r"^[^@\s]+@[^@\s]+\.[^@\s]+$", email_clean):
        raise HTTPException(status_code=400, detail="Invalid email format.")

    if len(req.password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters long.")

    allowed_roles = ["seller", "operations", "support", "admin"]
    role = req.role.lower()
    if role not in allowed_roles:
        raise HTTPException(status_code=400, detail=f"Invalid provision role. Must be one of {allowed_roles}")

    existing = db.query(AppUser).filter(func.lower(AppUser.email) == email_clean).first()
    if existing:
        raise HTTPException(status_code=400, detail="An account with this email address already exists.")

    new_user_id = f"USR-{uuid.uuid4().hex[:8].upper()}"
    new_user = AppUser(
        user_id=new_user_id,
        full_name=req.full_name.strip(),
        email=email_clean,
        password_hash=get_password_hash(req.password),
        role=role,
        is_active=True,
        is_demo_account=False
    )
    db.add(new_user)
    db.flush()  # Flush app_users record so foreign key user_id is active for seller profile

    # If provisioned role is seller, automatically create an approved Seller profile
    if role == "seller":
        new_seller_id = f"SEL-{uuid.uuid4().hex[:6].upper()}"
        new_seller = Seller(
            seller_id=new_seller_id,
            user_id=new_user_id,
            store_name=f"{req.full_name.strip()}'s Storefront {uuid.uuid4().hex[:4]}",
            store_type="Other / General Store",
            business_description="Provisioned merchant storefront",
            approval_status="approved",
            contact_email=email_clean
        )
        db.add(new_seller)

    db.commit()
    db.refresh(new_user)

    log_audit_action(
        db,
        action="ADMIN_PROVISIONED_USER_ACCOUNT",
        entity_type="user",
        user_id=current_admin.user_id,
        entity_id=new_user_id,
        details={"email": email_clean, "role": role}
    )

    return new_user
