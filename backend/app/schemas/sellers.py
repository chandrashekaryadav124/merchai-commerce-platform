from typing import Optional
from pydantic import BaseModel
from datetime import datetime

class SellerApplyRequest(BaseModel):
    store_name: str
    store_type: Optional[str] = None
    business_description: Optional[str] = None
    contact_email: Optional[str] = None
    contact_phone: Optional[str] = None
    business_address: Optional[str] = None

class SellerResponse(BaseModel):
    seller_id: str
    user_id: Optional[str] = None
    store_name: str
    store_type: Optional[str] = "Other / General Store"
    business_description: Optional[str] = None
    approval_status: str
    contact_email: Optional[str] = None
    created_at: Optional[datetime] = None
    owner_full_name: Optional[str] = None
    owner_email: Optional[str] = None
    owner_is_active: Optional[bool] = None

    class Config:
        from_attributes = True

class SellerProductResponse(BaseModel):
    seller_product_id: int
    seller_id: str
    product_id: str
    selling_price: float
    stock_quantity: int
    listing_status: str
    product_name: Optional[str] = None
    category: Optional[str] = None
    image_url: Optional[str] = None

    class Config:
        from_attributes = True

class RevenueChartPoint(BaseModel):
    day: str
    revenue: float

class SellerAnalyticsResponse(BaseModel):
    seller_id: str
    store_name: str
    store_type: Optional[str] = "Other / General Store"
    monthly_gross_sales: float
    total_orders: int
    inventory_items_count: int
    fulfillment_rate: Optional[float] = None
    fulfillment_rate_display: str = "N/A"
    store_rating: Optional[float] = None
    total_reviews_count: int = 0
    revenue_chart: list[RevenueChartPoint] = []

    class Config:
        from_attributes = True

