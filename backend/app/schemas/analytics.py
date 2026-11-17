from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field

class AdminMetricsResponse(BaseModel):
    # Accounting / Financial Disclosures
    gmv_total: float = Field(..., description="Gross Merchandise Value: total final amount of all placed orders")
    gross_sales: float = Field(..., description="Gross merchandise subtotal before shipping and taxes")
    net_revenue: float = Field(..., description="Authoritative net revenue from completed/delivered orders minus refunds")
    total_payment_amount: float = Field(0.0, description="Total amount captured from payments")
    total_refund_amount: float = Field(0.0, description="Total refunds processed")
    platform_commission_est: float = Field(..., description="Estimated platform commission from completed orders")
    
    # Store & Merchant Metrics
    active_sellers: int
    pending_sellers: int
    suspended_sellers: int
    total_sellers: int
    
    # Product & Customer Directory
    total_products: int
    active_customers: int = 0
    
    # Order Status Lifecycle Breakdown
    total_orders: int = 0
    delivered_orders_count: int = 0
    processing_orders_count: int = 0
    cancelled_orders_count: int = 0
    returned_orders_count: int = 0
    failed_orders_count: int = 0
    
    # Legacy compatibility fields
    total_orders_processed: Optional[int] = None
    gmv_net: Optional[float] = None

class SalesTrendPoint(BaseModel):
    date: str
    revenue: float
    order_count: int

class OrderStatusDistributionItem(BaseModel):
    status: str
    count: int
    percentage: float

class CategoryPerformanceItem(BaseModel):
    category: str
    revenue: float
    units_sold: int
    product_count: int

class TopSellerItem(BaseModel):
    seller_id: str
    store_name: str
    store_type: Optional[str] = "Other / General Store"
    order_count: int
    revenue: float

class AdminFinancialOverviewResponse(BaseModel):
    gmv_total: float
    gross_sales: float
    collected_payments: float
    pending_payments: float
    failed_payments: float
    refunded_amount: float
    net_marketplace_revenue: float
    platform_commission: float
    seller_settlement_status: str = "Settlement data unavailable"
    settlement_note: str = "Direct automated seller payout engine is not enabled. Payouts require offline finance settlement reconciliation."

class PaymentStatusDistributionItem(BaseModel):
    status: str
    count: int
    amount: float
    percentage: float

class PlatformGrowthPoint(BaseModel):
    period: str
    customers: int
    sellers: int

class RecentTransactionItem(BaseModel):
    payment_id: str
    order_id: Optional[str] = None
    payment_date: Optional[str] = None
    payment_method: Optional[str] = None
    payment_status: Optional[str] = None
    amount_paid: float = 0.0
    refund_amount: float = 0.0

class ActivityLogItem(BaseModel):
    id: int
    user_id: Optional[str] = None
    user_name: Optional[str] = None
    action: str
    entity_type: str
    entity_id: Optional[str] = None
    details: Optional[Dict[str, Any]] = None
    created_at: str

class FraudAlertResponse(BaseModel):
    id: str
    entity: str
    risk_type: str
    risk_score: float
    risk_level: str
    details: str
    recommended_action: str
