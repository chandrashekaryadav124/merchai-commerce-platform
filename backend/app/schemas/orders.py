from typing import Optional, List, Any
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

class SellerOrderItemDetail(BaseModel):
    seller_order_item_id: int
    product_id: str
    title: str
    primary_image: Optional[str] = None
    sku: Optional[str] = None
    quantity: int
    unit_price: float
    subtotal: float

class SellerOrderHistoryItem(BaseModel):
    history_id: int
    previous_status: Optional[str] = None
    new_status: str
    changed_by: Optional[str] = None
    notes: Optional[str] = None
    created_at: Optional[str] = None

class SellerOrderDetailResponse(BaseModel):
    seller_order_id: int
    order_id: str
    seller_id: str
    seller_store_name: Optional[str] = None
    status: str
    subtotal: float
    order_date: Optional[str] = None
    payment_status: Optional[str] = None
    payment_method: Optional[str] = None
    customer_name: Optional[str] = None
    customer_phone_masked: Optional[str] = None
    customer_email_masked: Optional[str] = None
    shipping_address: Optional[str] = None
    delivery_city: Optional[str] = None
    delivery_state: Optional[str] = None
    delivery_pincode: Optional[str] = None
    shipment_id: Optional[str] = None
    shipment_status: Optional[str] = None
    tracking_number: Optional[str] = None
    courier_name: Optional[str] = None
    items: List[SellerOrderItemDetail] = []
    status_history: List[SellerOrderHistoryItem] = []
    created_at: Optional[str] = None
    updated_at: Optional[str] = None

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

class SellerOrderStatusUpdateRequest(BaseModel):
    new_status: str
    notes: Optional[str] = None
