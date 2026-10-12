from typing import List, Optional
from pydantic import BaseModel

class AdminMetricsResponse(BaseModel):
    gmv_total: float
    gmv_net: float
    platform_commission_est: float
    active_sellers: int
    pending_sellers: int
    suspended_sellers: int
    total_sellers: int
    total_products: int
    total_orders_processed: int
    delivered_orders_count: int
    cancelled_orders_count: int
    returned_orders_count: int
    failed_orders_count: int
    ai_token_usage_today: int
    ai_satisfaction_score: float

class FraudAlertResponse(BaseModel):
    id: str
    entity: str
    risk_type: str
    risk_score: float
    risk_level: str
    details: str
    recommended_action: str
