from sqlalchemy import Column, String, Boolean, DateTime, Enum, func
import enum
from app.db.session import Base

class UserRole(str, enum.Enum):
    CUSTOMER = "customer"
    SELLER = "seller"
    OPERATIONS = "operations"
    SUPPORT = "support"
    ADMIN = "admin"

class AppUser(Base):
    __tablename__ = "app_users"

    user_id = Column(String(64), primary_key=True)
    full_name = Column(String(150), nullable=False)
    email = Column(String(254), nullable=False, unique=True, index=True)
    password_hash = Column(String(255), nullable=False)
    role = Column(String(50), nullable=False, default="customer")
    is_active = Column(Boolean, default=True)
    is_demo_account = Column(Boolean, default=False)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())
