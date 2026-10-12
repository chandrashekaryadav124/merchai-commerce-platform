import re
from typing import Optional
from datetime import datetime
from pydantic import BaseModel, Field, field_validator

class AddressBase(BaseModel):
    recipient_name: str = Field(..., min_length=2, max_length=150, description="Full name of delivery recipient")
    phone_number: str = Field(..., min_length=10, max_length=20, description="Contact phone number (Indian 10-digit mobile or with country code)")
    address_line1: str = Field(..., min_length=3, max_length=255, description="Street address, building name, flat/house number")
    address_line2: Optional[str] = Field(None, max_length=255, description="Landmark, area, or additional instructions")
    city: str = Field(..., min_length=2, max_length=100, description="City / Town")
    state: str = Field(..., min_length=2, max_length=100, description="State / Union Territory")
    postal_code: str = Field(..., description="Indian 6-digit postal PIN code")
    country: str = Field(default="India", max_length=50, description="Country")
    is_default: bool = Field(default=False, description="Whether this is the default delivery address")

    @field_validator("postal_code")
    @classmethod
    def validate_indian_pincode(cls, v: str) -> str:
        clean = v.strip().replace(" ", "")
        if not re.match(r"^[1-9][0-9]{5}$", clean):
            raise ValueError("Postal code must be a valid 6-digit Indian PIN code (e.g., 560001, 110001).")
        return clean

    @field_validator("phone_number")
    @classmethod
    def validate_phone(cls, v: str) -> str:
        clean = re.sub(r"[^\d+]", "", v.strip())
        digits_only = re.sub(r"\D", "", clean)
        if len(digits_only) < 10 or len(digits_only) > 13:
            raise ValueError("Phone number must contain between 10 and 12 digits.")
        return clean

    @field_validator("recipient_name", "address_line1", "city", "state")
    @classmethod
    def strip_whitespace(cls, v: str) -> str:
        s = v.strip()
        if not s:
            raise ValueError("Field cannot be blank.")
        return s

class AddressCreate(AddressBase):
    pass

class AddressUpdate(BaseModel):
    recipient_name: Optional[str] = Field(None, min_length=2, max_length=150)
    phone_number: Optional[str] = Field(None, min_length=10, max_length=20)
    address_line1: Optional[str] = Field(None, min_length=3, max_length=255)
    address_line2: Optional[str] = Field(None, max_length=255)
    city: Optional[str] = Field(None, min_length=2, max_length=100)
    state: Optional[str] = Field(None, min_length=2, max_length=100)
    postal_code: Optional[str] = None
    country: Optional[str] = Field(None, max_length=50)
    is_default: Optional[bool] = None

    @field_validator("postal_code")
    @classmethod
    def validate_pincode_optional(cls, v: Optional[str]) -> Optional[str]:
        if v is not None:
            clean = v.strip().replace(" ", "")
            if not re.match(r"^[1-9][0-9]{5}$", clean):
                raise ValueError("Postal code must be a valid 6-digit Indian PIN code.")
            return clean
        return v

    @field_validator("phone_number")
    @classmethod
    def validate_phone_optional(cls, v: Optional[str]) -> Optional[str]:
        if v is not None:
            clean = re.sub(r"[^\d+]", "", v.strip())
            digits_only = re.sub(r"\D", "", clean)
            if len(digits_only) < 10 or len(digits_only) > 13:
                raise ValueError("Phone number must contain between 10 and 12 digits.")
            return clean
        return v

class AddressResponse(BaseModel):
    address_id: int
    user_id: str
    recipient_name: str
    phone_number: str
    address_line1: str
    address_line2: Optional[str] = None
    city: str
    state: str
    postal_code: str
    country: str
    is_default: bool
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True
