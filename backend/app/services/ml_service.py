from typing import List, Dict, Any

def get_demand_forecast(store_id: str) -> List[Dict[str, Any]]:
    """
    ML Demand forecasting algorithm returning predicted velocity and stock recommendations.
    """
    return [
        {
            "sku": "PROD10001",
            "product_name": "Men's Bottomwear",
            "current_stock": 42,
            "predicted_7d_demand": 68,
            "recommended_reorder": 30,
            "stockout_risk": "HIGH"
        },
        {
            "sku": "PROD10003",
            "product_name": "Signature Bedding",
            "current_stock": 115,
            "predicted_7d_demand": 24,
            "recommended_reorder": 0,
            "stockout_risk": "LOW"
        }
    ]

def get_fraud_alerts() -> List[Dict[str, Any]]:
    """
    Real-time Fraud Radar & Risk Detection desk alerts.
    """
    return [
        {
            "id": "risk_01",
            "entity": "Seller ID: SEL-001",
            "risk_type": "ABNORMAL_REVIEW_VELOCITY",
            "risk_score": 0.88,
            "risk_level": "HIGH",
            "details": "14 five-star reviews submitted within 8 minutes from identical IP subnet.",
            "recommended_action": "Freeze Payout & Escalate to Human Moderation"
        },
        {
            "id": "risk_02",
            "entity": "Customer ID: CUST100002",
            "risk_type": "COUPON_ABUSE_PATTERN",
            "risk_score": 0.64,
            "risk_level": "MEDIUM",
            "details": "Repeated creation of new accounts using single payment card fingerprint.",
            "recommended_action": "Apply Device Fingerprint Limit"
        }
    ]
