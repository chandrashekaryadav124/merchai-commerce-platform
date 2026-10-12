from typing import Optional, List
from pydantic import BaseModel

class OrderItemSchema(BaseModel):
    product_id: str
    quantity: int
    unit_price: float

class OrderCreate(BaseModel):
    shipping_address: str
    items: List[OrderItemSchema]

class OrderResponse(BaseModel):
    order_id: str
    customer_id: Optional[str] = None
    order_date: Optional[str] = None
    order_status: Optional[str] = None
    shipping_method: Optional[str] = None
    delivery_city: Optional[str] = None
    delivery_state: Optional[str] = None
    subtotal: Optional[float] = None
    shipping_fee: Optional[float] = None
    tax_amount: Optional[float] = None
    final_amount: Optional[float] = None

    class Config:
        from_attributes = True

class SellerOrderResponse(BaseModel):
    seller_order_id: int
    order_id: str
    seller_id: str
    status: str
    subtotal: float

    class Config:
        from_attributes = True
