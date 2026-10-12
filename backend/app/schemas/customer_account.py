from typing import Optional, List
from pydantic import BaseModel, Field

class CustomerProfileResponse(BaseModel):
    customer_id: str
    user_id: str
    full_name: str
    email: str
    signup_date: Optional[str] = None
    gender: Optional[str] = None
    age: Optional[float] = None
    state: Optional[str] = "Karnataka"
    city: Optional[str] = "Bengaluru"
    customer_segment: Optional[str] = "Regular"
    total_orders: int = 0
    total_spend: float = 0.0
    average_order_value: float = 0.0
    customer_status: Optional[str] = "Active"
    loyalty_tier: Optional[str] = "Bronze"

    class Config:
        from_attributes = True

class AccountSummaryResponse(BaseModel):
    customer_id: str
    full_name: str
    email: str
    total_spend: float
    total_orders: int
    active_orders_count: int
    completed_orders_count: int
    returns_count: int
    reviews_count: int
    loyalty_tier: str
    customer_segment: str
    recent_activity: List[dict]

class OrderItemDetail(BaseModel):
    order_item_id: str
    product_id: str
    product_name: Optional[str] = "Product Item"
    quantity: int
    unit_price: float
    discount_percentage: Optional[float] = 0.0
    item_revenue: Optional[float] = 0.0
    image_url: Optional[str] = None

class ShipmentTrackingResponse(BaseModel):
    shipment_id: str
    order_id: Optional[str] = None
    warehouse_city: Optional[str] = None
    delivery_city: Optional[str] = None
    shipping_method: Optional[str] = None
    dispatch_date: Optional[str] = None
    expected_delivery_date: Optional[str] = None
    actual_delivery_date: Optional[str] = None
    delivery_days: Optional[float] = None
    delivery_status: Optional[str] = None
    delayed_flag: Optional[int] = 0

    class Config:
        from_attributes = True

class PaymentHistoryResponse(BaseModel):
    payment_id: str
    order_id: Optional[str] = None
    payment_date: Optional[str] = None
    payment_method: Optional[str] = None
    payment_status: Optional[str] = None
    amount_paid: Optional[float] = 0.0
    transaction_fee: Optional[float] = 0.0
    refund_amount: Optional[float] = 0.0

    class Config:
        from_attributes = True

class OrderDetailResponse(BaseModel):
    order_id: str
    customer_id: Optional[str] = None
    order_date: Optional[str] = None
    order_time: Optional[str] = None
    order_status: Optional[str] = None
    shipping_method: Optional[str] = None
    delivery_city: Optional[str] = None
    delivery_state: Optional[str] = None
    coupon_code: Optional[str] = None
    subtotal: Optional[float] = 0.0
    shipping_fee: Optional[float] = 0.0
    tax_amount: Optional[float] = 0.0
    final_amount: Optional[float] = 0.0
    items: List[OrderItemDetail] = []
    shipment: Optional[ShipmentTrackingResponse] = None
    payment: Optional[PaymentHistoryResponse] = None

class PaginatedOrdersResponse(BaseModel):
    total: int
    page: int
    limit: int
    pages: int
    items: List[OrderDetailResponse]

class ReturnRefundResponse(BaseModel):
    return_id: str
    order_id: Optional[str] = None
    customer_id: Optional[str] = None
    product_id: Optional[str] = None
    product_name: Optional[str] = "Marketplace Product"
    return_date: Optional[str] = None
    return_reason: Optional[str] = None
    refund_amount: Optional[float] = 0.0
    return_status: Optional[str] = None

    class Config:
        from_attributes = True

class CustomerReviewResponse(BaseModel):
    review_id: str
    order_id: Optional[str] = None
    customer_id: Optional[str] = None
    product_id: Optional[str] = None
    product_name: Optional[str] = "Marketplace Product"
    review_date: Optional[str] = None
    rating: int = 5
    review_title: Optional[str] = None
    review_text: Optional[str] = None
    review_sentiment: Optional[str] = "Positive"
    verified_purchase: bool = True

class CreateReviewRequest(BaseModel):
    order_id: Optional[str] = None
    product_id: str
    rating: int = Field(..., ge=1, le=5)
    review_title: str
    review_text: str

class SupportTicketResponse(BaseModel):
    ticket_id: str
    customer_id: Optional[str] = None
    order_id: Optional[str] = None
    issue_type: Optional[str] = None
    customer_message: Optional[str] = None
    resolution_guidance: Optional[str] = None
    ticket_status: Optional[str] = None
    created_at: Optional[str] = None
    source_type: Optional[str] = "Customer Account"

    class Config:
        from_attributes = True

class CreateSupportTicketRequest(BaseModel):
    order_id: Optional[str] = None
    issue_type: str
    customer_message: str

