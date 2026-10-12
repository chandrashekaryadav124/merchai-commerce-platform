import uuid
import re
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import func
from app.db.session import get_db
from app.models.users import AppUser
from app.models.customer_account import CustomerProfile
from app.schemas.auth import UserLogin, UserRegister, UserResponse, Token, SetPasswordRequest
from app.core.security import verify_password, get_password_hash, create_access_token
from app.core.deps import get_current_user
from app.services.audit_service import log_audit_action

router = APIRouter()

@router.post("/login", response_model=Token)
def login(credentials: UserLogin, db: Session = Depends(get_db)):
    user = db.query(AppUser).filter(AppUser.email == credentials.email).first()
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password."
        )
    
    # Handle seeded user activation case safely
    if user.password_hash == "PASSWORD_SETUP_REQUIRED":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account setup required. Please call /api/v1/auth/set-password to establish a password."
        )

    if not verify_password(credentials.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password."
        )
    
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is deactivated."
        )
    
    token = create_access_token(subject=user.user_id, role=user.role)
    
    log_audit_action(
        db, 
        action="USER_LOGIN_SUCCESS", 
        entity_type="user", 
        user_id=user.user_id, 
        details={"email": user.email, "role": user.role}
    )

    return Token(
        access_token=token,
        token_type="bearer",
        user_id=user.user_id,
        full_name=user.full_name,
        email=user.email,
        role=user.role
    )

@router.post("/set-password")
def set_initial_password(req: SetPasswordRequest, db: Session = Depends(get_db)):
    user = db.query(AppUser).filter(AppUser.email == req.email).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found.")
    
    if len(req.new_password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters long.")
    
    user.password_hash = get_password_hash(req.new_password)
    user.is_active = True
    db.commit()

    log_audit_action(
        db,
        action="USER_PASSWORD_ESTABLISHED",
        entity_type="user",
        user_id=user.user_id,
        details={"email": user.email, "is_active": True}
    )

    return {"status": "success", "message": f"Password established and account activated successfully for {user.email}."}


@router.post("/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
def register(user_in: UserRegister, db: Session = Depends(get_db)):
    # 1. Input sanitization & server-side validation
    email_clean = user_in.email.strip().lower()
    if not re.match(r"^[^@\s]+@[^@\s]+\.[^@\s]+$", email_clean):
        raise HTTPException(status_code=400, detail="Please enter a valid email address.")

    if not user_in.full_name or len(user_in.full_name.strip()) < 2:
        raise HTTPException(status_code=400, detail="Full name must be at least 2 characters long.")

    if len(user_in.password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters long.")

    if user_in.age is not None and (user_in.age < 0 or user_in.age > 120):
        raise HTTPException(status_code=400, detail="Age must be between 0 and 120.")

    if user_in.pincode_prefix is not None and user_in.pincode_prefix < 0:
        raise HTTPException(status_code=400, detail="Pincode prefix must be a positive integer.")

    # 2. Check for duplicate email (case-insensitive)
    existing = db.query(AppUser).filter(func.lower(AppUser.email) == email_clean).first()
    if existing:
        raise HTTPException(status_code=400, detail="An account with this email already exists.")

    # Public registration always creates a customer account. Privileged roles require admin workflow.
    role = "customer"

    user_id = f"USR-{uuid.uuid4().hex[:8].upper()}"
    cust_id = f"CUST-{uuid.uuid4().hex[:8].upper()}"
    now_date = datetime.now().strftime("%Y-%m-%d")

    # Determine age group if age provided
    age_grp = None
    if user_in.age is not None:
        if user_in.age < 18:
            age_grp = "< 18"
        elif user_in.age <= 24:
            age_grp = "18-24"
        elif user_in.age <= 34:
            age_grp = "25-34"
        elif user_in.age <= 44:
            age_grp = "35-44"
        elif user_in.age <= 54:
            age_grp = "45-54"
        elif user_in.age <= 64:
            age_grp = "55-64"
        else:
            age_grp = "65+"

    # 3. Single database transaction for both AppUser and CustomerProfile
    try:
        new_user = AppUser(
            user_id=user_id,
            full_name=user_in.full_name.strip(),
            email=email_clean,
            password_hash=get_password_hash(user_in.password),
            role=role,
            is_active=True,
            is_demo_account=False
        )
        db.add(new_user)
        db.flush()  # Flush app_user record so foreign key app_user_id is available

        # Create linked CustomerProfile if registering a customer
        if role == "customer":
            new_customer = CustomerProfile(
                customer_id=cust_id,
                app_user_id=user_id,
                customer_signup_date=now_date,
                gender=user_in.gender if user_in.gender else None,
                age=user_in.age if user_in.age is not None else None,
                age_group=age_grp,
                state=user_in.state if user_in.state else None,
                city=user_in.city if user_in.city else None,
                pincode_prefix=user_in.pincode_prefix if user_in.pincode_prefix is not None else None,
                preferred_device=user_in.preferred_device if user_in.preferred_device else None,
                preferred_payment_method=user_in.preferred_payment_method if user_in.preferred_payment_method else None,
                customer_segment="Regular",
                acquisition_channel="Organic Registration",
                total_orders=0,
                total_spend=0.0,
                last_order_date=None,
                average_order_value=0.0,
                customer_status="Active",
                loyalty_tier="Bronze",
                calculated_aov=0.0,
                aov_difference=0.0
            )
            db.add(new_customer)

        db.commit()
        db.refresh(new_user)
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Registration failed due to a database transaction error."
        )

    log_audit_action(
        db,
        action="USER_REGISTERED",
        entity_type="user",
        user_id=new_user.user_id,
        details={"email": new_user.email, "role": new_user.role, "customer_id": cust_id if role == "customer" else None}
    )

    return new_user

@router.get("/me", response_model=UserResponse)
def get_me(current_user: AppUser = Depends(get_current_user)):
    return current_user
