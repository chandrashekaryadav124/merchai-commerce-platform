from typing import List, Optional
from pydantic import BaseModel, Field
from app.schemas.cart import CartItemResponse

class CheckoutSummaryResponse(BaseModel):
    cart_id: int
    items: List[CartItemResponse]
    item_count: int
    merchandise_subtotal: float
    shipping_fee: float
    shipping_fee_basis: str
    tax_amount: float
    tax_rate: float
    tax_basis: str
    final_total: float
    is_checkout_eligible: bool
    validation_messages: List[str]

class OrderPlacementRequest(BaseModel):
    address_id: Optional[int] = Field(None, description="ID of saved delivery address")
    # Alternatively provide address fields directly:
    recipient_name: Optional[str] = Field(None, description="Recipient full name")
    recipient_phone: Optional[str] = Field(None, description="Recipient contact phone")
    address_line1: Optional[str] = Field(None, description="Delivery address line 1")
    address_line2: Optional[str] = Field(None, description="Delivery address line 2")
    city: Optional[str] = Field(None, description="City")
    state: Optional[str] = Field(None, description="State")
    postal_code: Optional[str] = Field(None, description="Indian 6-digit postal PIN code")
    payment_method: Optional[str] = Field(default="Simulated Payment / Pending Capture", description="Selected payment method")
    idempotency_key: Optional[str] = Field(None, description="Client idempotency key to prevent duplicate order placement")
