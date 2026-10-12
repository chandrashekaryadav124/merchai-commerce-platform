from typing import List
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func
from app.db.session import get_db
from app.models.orders import Order
from app.models.sellers import Seller
from app.models.products import Product
from app.schemas.analytics import AdminMetricsResponse, FraudAlertResponse
from app.core.deps import RoleChecker
from app.models.users import AppUser
from app.services.ml_service import get_fraud_alerts

router = APIRouter()

@router.get("/admin/metrics", response_model=AdminMetricsResponse)
def get_admin_metrics(
    current_user: AppUser = Depends(RoleChecker(["admin", "operations"])),
    db: Session = Depends(get_db)
):
    gmv_total = db.query(func.coalesce(func.sum(Order.final_amount), 0.0)).scalar()
    gmv_net = db.query(func.coalesce(func.sum(Order.final_amount), 0.0)).filter(
        Order.order_status.in_(["Delivered", "Processing"])
    ).scalar()

    total_orders = db.query(func.count(Order.order_id)).scalar()
    delivered_count = db.query(func.count(Order.order_id)).filter(Order.order_status == "Delivered").scalar()
    cancelled_count = db.query(func.count(Order.order_id)).filter(Order.order_status == "Cancelled").scalar()
    returned_count = db.query(func.count(Order.order_id)).filter(Order.order_status == "Returned").scalar()
    failed_count = db.query(func.count(Order.order_id)).filter(Order.order_status == "Failed").scalar()

    total_sellers = db.query(func.count(Seller.seller_id)).scalar()
    active_sellers = db.query(func.count(Seller.seller_id)).filter(Seller.approval_status == "approved").scalar()
    pending_sellers = db.query(func.count(Seller.seller_id)).filter(Seller.approval_status == "pending").scalar()
    suspended_sellers = db.query(func.count(Seller.seller_id)).filter(Seller.approval_status == "suspended").scalar()

    total_products = db.query(func.count(Product.product_id)).scalar()

    net_gmv_val = float(gmv_net or 0.0)

    return AdminMetricsResponse(
        gmv_total=round(float(gmv_total or 0.0), 2),
        gmv_net=round(net_gmv_val, 2),
        platform_commission_est=round(net_gmv_val * 0.05, 2),
        active_sellers=int(active_sellers or 0),
        pending_sellers=int(pending_sellers or 0),
        suspended_sellers=int(suspended_sellers or 0),
        total_sellers=int(total_sellers or 0),
        total_products=int(total_products or 0),
        total_orders_processed=int(total_orders or 0),
        delivered_orders_count=int(delivered_count or 0),
        cancelled_orders_count=int(cancelled_count or 0),
        returned_orders_count=int(returned_count or 0),
        failed_orders_count=int(failed_count or 0),
        ai_token_usage_today=142850,
        ai_satisfaction_score=98.4
    )

@router.get("/admin/fraud-radar", response_model=List[FraudAlertResponse])
def get_fraud_radar(
    current_user: AppUser = Depends(RoleChecker(["admin", "operations"]))
):
    alerts = get_fraud_alerts()
    return [FraudAlertResponse(**a) for a in alerts]
