from typing import Optional
from pydantic import BaseModel

class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user_id: str
    full_name: str
    email: str
    role: str

class TokenData(BaseModel):
    user_id: Optional[str] = None
    role: Optional[str] = None

class UserLogin(BaseModel):
    email: str
    password: str

class UserRegister(BaseModel):
    full_name: str
    email: str
    password: str
    role: str = "customer"

    # Optional Customer Profile Fields
    gender: Optional[str] = None
    age: Optional[float] = None
    state: Optional[str] = None
    city: Optional[str] = None
    pincode_prefix: Optional[int] = None
    preferred_device: Optional[str] = None
    preferred_payment_method: Optional[str] = None

class UserResponse(BaseModel):
    user_id: str
    full_name: str
    email: str
    role: str
    is_active: bool
    is_demo_account: bool

    class Config:
        from_attributes = True

class SetPasswordRequest(BaseModel):
    email: str
    new_password: str

