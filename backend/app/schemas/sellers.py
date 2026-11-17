from typing import Optional, List
from pydantic import BaseModel, Field
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
    sku: Optional[str] = None
    selling_price: float
    discount_price: Optional[float] = None
    stock_quantity: int
    low_stock_threshold: Optional[int] = 10
    listing_status: str
    product_name: Optional[str] = None
    description: Optional[str] = None
    category: Optional[str] = None
    subcategory: Optional[str] = None
    brand: Optional[str] = None
    image_url: Optional[str] = None

    class Config:
        from_attributes = True

class RevenueChartPoint(BaseModel):
    day: str
    revenue: float
    order_count: int = 0

class SellerTopProduct(BaseModel):
    product_id: str
    product_name: str
    category: Optional[str] = None
    units_sold: int
    total_revenue: float
    current_stock: int

class SellerOrderStatusCount(BaseModel):
    status: str
    count: int
    percentage: float

class SellerCustomerReview(BaseModel):
    review_id: str
    order_id: Optional[str] = None
    product_id: str
    product_name: Optional[str] = None
    rating: float
    sentiment: Optional[str] = None
    review_text: Optional[str] = None
    review_date: Optional[str] = None

class SellerFinancialAnalyticsResponse(BaseModel):
    seller_id: str
    store_name: str
    gross_sales: float
    net_sales: float
    successfully_paid_amount: float
    pending_payment_amount: float
    unpaid_amount: float = 0.0
    refund_deductions: float
    platform_commission: float
    seller_payout_status: str = "Settlement data unavailable"
    payout_note: str = "Direct automated seller payout engine is not enabled. Payouts require offline finance settlement reconciliation."
    average_order_value: float
    total_orders: int
    paid_orders_count: int = 0
    pending_orders_count: int = 0
    delivered_orders_count: int = 0
    processing_orders_count: int = 0
    cancelled_orders_count: int = 0
    fulfillment_rate: float = 0.0
    active_products_count: int = 0
    low_stock_products_count: int = 0
    refund_rate: float = 0.0

class SellerTransactionItem(BaseModel):
    order_id: str
    seller_order_id: int
    order_date: Optional[str] = None
    subtotal: float
    allocated_paid: float
    allocated_refund: float
    payment_method: str
    payment_status: str
    allocation_percentage: float
    delivery_status: str

class SellerSalesTrendPoint(BaseModel):
    period: str
    revenue: float
    order_count: int

class SellerCategoryPerformanceItem(BaseModel):
    category: str
    revenue: float
    units_sold: int

class SellerPaymentMethodDistributionItem(BaseModel):
    payment_method: str
    order_count: int
    amount: float
    percentage: float

class SellerAnalyticsResponse(BaseModel):
    seller_id: str
    store_name: str
    store_type: Optional[str] = "Other / General Store"
    total_sales: float = 0.0
    monthly_gross_sales: float = 0.0  # Backward-compatibility alias
    total_orders: int = 0
    completed_orders: int = 0
    pending_orders: int = 0
    total_products: int = 0
    inventory_items_count: int = 0  # Backward-compatibility alias
    active_products: int = 0
    low_stock_products: int = 0
    out_of_stock_products: int = 0
    fulfillment_rate: Optional[float] = None
    fulfillment_rate_display: str = "N/A"
    store_rating: Optional[float] = None
    total_reviews_count: int = 0
    revenue_chart: List[RevenueChartPoint] = []

    class Config:
        from_attributes = True

# =====================================================================
# SPRINT 0.3: PRODUCT CRUD, IMAGE UPLOAD & INVENTORY MANAGEMENT SCHEMAS
# =====================================================================

class ProductImageItem(BaseModel):
    image_id: str
    image_url: str
    image_type: str = "gallery"
    is_primary: bool = False

    class Config:
        from_attributes = True

class SellerProductCreateRequest(BaseModel):
    product_name: str = Field(..., min_length=2, max_length=255)
    category: str = Field(..., min_length=2)
    subcategory: Optional[str] = "General"
    brand: Optional[str] = None
    selling_price: float = Field(..., gt=0)
    discount_price: Optional[float] = Field(default=None, ge=0)
    stock_quantity: int = Field(default=0, ge=0)
    sku: Optional[str] = None
    low_stock_threshold: Optional[int] = Field(default=10, ge=1)
    description: Optional[str] = None
    images: Optional[List[str]] = []
    primary_image_index: Optional[int] = 0
    listing_status: Optional[str] = "active"

class SellerProductUpdateRequest(BaseModel):
    product_name: Optional[str] = Field(default=None, min_length=2, max_length=255)
    category: Optional[str] = None
    subcategory: Optional[str] = None
    brand: Optional[str] = None
    selling_price: Optional[float] = Field(default=None, gt=0)
    discount_price: Optional[float] = Field(default=None, ge=0)
    stock_quantity: Optional[int] = Field(default=None, ge=0)
    sku: Optional[str] = None
    low_stock_threshold: Optional[int] = Field(default=None, ge=1)
    description: Optional[str] = None
    images: Optional[List[str]] = None
    primary_image_index: Optional[int] = None
    listing_status: Optional[str] = None

class SellerProductStatusUpdateRequest(BaseModel):
    listing_status: str = Field(..., pattern="^(active|paused|removed|draft)$")

class SellerProductDetailResponse(BaseModel):
    seller_product_id: int
    seller_id: str
    product_id: str
    sku: Optional[str] = None
    product_name: str
    description: Optional[str] = None
    category: Optional[str] = None
    subcategory: Optional[str] = None
    brand: Optional[str] = None
    selling_price: float
    discount_price: Optional[float] = None
    stock_quantity: int
    reserved_quantity: int = 0
    available_to_sell: int = 0
    low_stock_threshold: int = 10
    listing_status: str
    created_at: Optional[datetime] = None
    images: List[ProductImageItem] = []
    primary_image_url: Optional[str] = None
    units_sold: int = 0
    total_revenue: float = 0.0
    rating_average: Optional[float] = None
    rating_count: int = 0

    class Config:
        from_attributes = True

class ImageUploadResponse(BaseModel):
    filename: str
    url: str
    success: bool = True

class InventoryAdjustmentRequest(BaseModel):
    adjustment_type: str = Field(..., description="restock, damage, correction, return, or audit_reconciliation")
    quantity_change: int = Field(..., description="Change amount (positive for increase, negative for decrease)")
    adjustment_reason: str = Field(..., min_length=3, description="Detailed reason for this adjustment")
    order_reference: Optional[str] = None

class InventoryAdjustmentResponse(BaseModel):
    snapshot_id: str
    product_id: str
    sku: Optional[str] = None
    product_name: str
    previous_quantity: int
    quantity_change: int
    new_quantity: int
    adjustment_type: str
    adjustment_reason: str
    created_at: Optional[str] = None

class SellerInventoryItemResponse(BaseModel):
    seller_product_id: int
    product_id: str
    sku: Optional[str] = None
    product_name: str
    category: Optional[str] = None
    stock_quantity: int
    reserved_quantity: int = 0
    available_to_sell: int = 0
    low_stock_threshold: int = 10
    listing_status: str
    health_status: str  # HEALTHY, LOW_STOCK, OUT_OF_STOCK
    selling_price: float
    discount_price: Optional[float] = None
    image_url: Optional[str] = None

    class Config:
        from_attributes = True

class SellerInventorySummaryResponse(BaseModel):
    total_skus: int
    total_units: int
    healthy_count: int
    low_stock_count: int
    out_of_stock_count: int
    items: List[SellerInventoryItemResponse]

class InventoryHistoryItemResponse(BaseModel):
    inventory_snapshot_id: str
    product_id: str
    product_name: Optional[str] = None
    sku: Optional[str] = None
    previous_quantity: Optional[int] = None
    quantity_change: Optional[int] = None
    new_quantity: Optional[int] = None
    adjustment_type: Optional[str] = None
    adjustment_reason: Optional[str] = None
    user_id: Optional[str] = None
    order_reference: Optional[str] = None
    created_at: Optional[str] = None

    class Config:
        from_attributes = True
