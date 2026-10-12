from typing import Generator, List
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.core.security import decode_token
from app.models.users import AppUser
from app.models.sellers import Seller

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login", auto_error=False)

def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db)
) -> AppUser:
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required. Please provide a valid Bearer token.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    payload = decode_token(token)
    if not payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token payload missing subject identifier.",
        )
    
    user = db.query(AppUser).filter(AppUser.user_id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User associated with token no longer exists.",
        )
    
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User account is deactivated.",
        )
    
    return user

class RoleChecker:
    def __init__(self, allowed_roles: List[str]):
        self.allowed_roles = allowed_roles

    def __call__(self, current_user: AppUser = Depends(get_current_user)) -> AppUser:
        if current_user.role not in self.allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Access denied. Required role in {self.allowed_roles}, but current role is '{current_user.role}'."
            )
        return current_user

def get_current_approved_seller(
    current_user: AppUser = Depends(get_current_user),
    db: Session = Depends(get_db)
) -> Seller:
    if current_user.role not in ["seller", "admin"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Access denied. Required role in ['seller', 'admin'], but current role is '{current_user.role}'."
        )

    if current_user.role == "admin":
        seller = db.query(Seller).first()
        if not seller:
            raise HTTPException(status_code=404, detail="No seller profile exists in the system.")
        return seller

    seller = db.query(Seller).filter(Seller.user_id == current_user.user_id).first()
    if not seller:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No registered seller storefront associated with this user account."
        )

    if seller.approval_status == "pending":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Seller storefront application is pending administrator approval. Selling operations are disabled."
        )
    elif seller.approval_status == "suspended":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Seller storefront is suspended. Product creation, inventory management, and seller order processing are disabled."
        )
    elif seller.approval_status == "rejected":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Seller storefront application was rejected. Selling operations are disabled."
        )
    elif seller.approval_status != "approved":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Seller storefront status '{seller.approval_status}' does not permit selling operations."
        )

    return seller
