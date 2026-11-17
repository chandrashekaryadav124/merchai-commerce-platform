from typing import List, Optional
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func, desc
from app.db.session import get_db
from app.models.orders import Order, OrderItem, SellerOrder
from app.models.sellers import Seller
from app.models.products import Product
from app.models.customer_account import Payment, CustomerProfile
from app.models.audit import AuditLog
from app.schemas.analytics import (
    AdminMetricsResponse,
    SalesTrendPoint,
    OrderStatusDistributionItem,
    CategoryPerformanceItem,
    TopSellerItem,
    ActivityLogItem,
    FraudAlertResponse,
    AdminFinancialOverviewResponse,
    PaymentStatusDistributionItem,
    PlatformGrowthPoint,
    RecentTransactionItem
)
from app.core.deps import RoleChecker
from app.models.users import AppUser
from app.services.ml_service import get_fraud_alerts

router = APIRouter()

@router.get("/admin/metrics", response_model=AdminMetricsResponse)
def get_admin_metrics(
    current_user: AppUser = Depends(RoleChecker(["admin", "operations"])),
    db: Session = Depends(get_db)
):
    # 1. GMV & Gross Sales (Strictly calculated from authentic order records)
    gmv_total = db.query(func.coalesce(func.sum(Order.final_amount), 0.0)).scalar() or 0.0
    gross_sales = db.query(func.coalesce(func.sum(Order.subtotal), 0.0)).scalar() or 0.0

    # 2. Payments & Refunds (From authoritative payment transactions)
    total_payment = db.query(func.coalesce(func.sum(Payment.amount_paid), 0.0)).scalar() or 0.0
    total_refund = db.query(func.coalesce(func.sum(Payment.refund_amount), 0.0)).scalar() or 0.0

    # 3. Net Revenue: Completed/delivered order volume minus refunds
    delivered_revenue = db.query(func.coalesce(func.sum(Order.final_amount), 0.0)).filter(
        func.lower(Order.order_status).in_(["delivered", "completed", "processing"])
    ).scalar() or 0.0
    net_revenue = max(0.0, float(delivered_revenue) - float(total_refund))
    platform_commission = round(net_revenue * 0.05, 2)

    # 4. Order status lifecycle counts
    total_orders = db.query(func.count(Order.order_id)).scalar() or 0
    delivered_count = db.query(func.count(Order.order_id)).filter(func.lower(Order.order_status) == "delivered").scalar() or 0
    processing_count = db.query(func.count(Order.order_id)).filter(func.lower(Order.order_status) == "processing").scalar() or 0
    cancelled_count = db.query(func.count(Order.order_id)).filter(func.lower(Order.order_status) == "cancelled").scalar() or 0
    returned_count = db.query(func.count(Order.order_id)).filter(func.lower(Order.order_status) == "returned").scalar() or 0
    failed_count = db.query(func.count(Order.order_id)).filter(func.lower(Order.order_status) == "failed").scalar() or 0

    # 5. Seller counts
    total_sellers = db.query(func.count(Seller.seller_id)).scalar() or 0
    active_sellers = db.query(func.count(Seller.seller_id)).filter(Seller.approval_status == "approved").scalar() or 0
    pending_sellers = db.query(func.count(Seller.seller_id)).filter(Seller.approval_status == "pending").scalar() or 0
    suspended_sellers = db.query(func.count(Seller.seller_id)).filter(Seller.approval_status == "suspended").scalar() or 0

    # 6. Catalog and User counts
    total_products = db.query(func.count(Product.product_id)).scalar() or 0
    active_customers = db.query(func.count(CustomerProfile.customer_id)).scalar() or 0

    return AdminMetricsResponse(
        gmv_total=round(float(gmv_total), 2),
        gross_sales=round(float(gross_sales), 2),
        net_revenue=round(float(net_revenue), 2),
        total_payment_amount=round(float(total_payment), 2),
        total_refund_amount=round(float(total_refund), 2),
        platform_commission_est=platform_commission,
        active_sellers=int(active_sellers),
        pending_sellers=int(pending_sellers),
        suspended_sellers=int(suspended_sellers),
        total_sellers=int(total_sellers),
        total_products=int(total_products),
        active_customers=int(active_customers),
        total_orders=int(total_orders),
        delivered_orders_count=int(delivered_count),
        processing_orders_count=int(processing_count),
        cancelled_orders_count=int(cancelled_count),
        returned_orders_count=int(returned_count),
        failed_orders_count=int(failed_count),
        total_orders_processed=int(total_orders),
        gmv_net=round(float(delivered_revenue), 2)
    )

@router.get("/admin/analytics/financial-overview", response_model=AdminFinancialOverviewResponse)
def get_admin_financial_overview(
    current_user: AppUser = Depends(RoleChecker(["admin", "operations"])),
    db: Session = Depends(get_db)
):
    gmv_total = db.query(func.coalesce(func.sum(Order.final_amount), 0.0)).scalar() or 0.0
    gross_sales = db.query(func.coalesce(func.sum(Order.subtotal), 0.0)).scalar() or 0.0

    collected = db.query(func.coalesce(func.sum(Payment.amount_paid), 0.0)).filter(
        func.lower(Payment.payment_status).in_(["success", "paid"])
    ).scalar() or 0.0

    pending = db.query(func.coalesce(func.sum(Payment.amount_paid), 0.0)).filter(
        func.lower(Payment.payment_status).in_(["pending", "processing"])
    ).scalar() or 0.0

    failed = db.query(func.coalesce(func.sum(Payment.amount_paid), 0.0)).filter(
        func.lower(Payment.payment_status).in_(["failed", "not charged"])
    ).scalar() or 0.0

    refunded = db.query(func.coalesce(func.sum(Payment.refund_amount), 0.0)).scalar() or 0.0

    net_marketplace = max(0.0, float(collected) - float(refunded))
    commission = round(net_marketplace * 0.05, 2)

    return AdminFinancialOverviewResponse(
        gmv_total=round(float(gmv_total), 2),
        gross_sales=round(float(gross_sales), 2),
        collected_payments=round(float(collected), 2),
        pending_payments=round(float(pending), 2),
        failed_payments=round(float(failed), 2),
        refunded_amount=round(float(refunded), 2),
        net_marketplace_revenue=round(float(net_marketplace), 2),
        platform_commission=commission,
        seller_settlement_status="Settlement data unavailable",
        settlement_note="Direct automated seller payout engine is not enabled. Payouts require offline finance settlement reconciliation."
    )

@router.get("/admin/analytics/payment-status-distribution", response_model=List[PaymentStatusDistributionItem])
def get_admin_payment_status_distribution(
    current_user: AppUser = Depends(RoleChecker(["admin", "operations"])),
    db: Session = Depends(get_db)
):
    total_tx = db.query(func.count(Payment.payment_id)).scalar() or 0
    if total_tx == 0:
        return []

    results = db.query(
        Payment.payment_status.label("status"),
        func.count(Payment.payment_id).label("count"),
        func.coalesce(func.sum(func.coalesce(Payment.amount_paid, 0.0) + func.coalesce(Payment.refund_amount, 0.0)), 0.0).label("amount")
    ).group_by(Payment.payment_status).all()

    items = []
    for r in results:
        cnt = int(r.count)
        pct = round((cnt / total_tx) * 100.0, 1)
        items.append(PaymentStatusDistributionItem(
            status=r.status or "Unknown",
            count=cnt,
            amount=round(float(r.amount), 2),
            percentage=pct
        ))
    return sorted(items, key=lambda x: x.count, reverse=True)

@router.get("/admin/analytics/growth-trend", response_model=List[PlatformGrowthPoint])
def get_admin_growth_trend(
    current_user: AppUser = Depends(RoleChecker(["admin", "operations"])),
    db: Session = Depends(get_db)
):
    cust_res = db.query(
        func.substr(CustomerProfile.customer_signup_date, 1, 7).label("month"),
        func.count(CustomerProfile.customer_id).label("count")
    ).filter(
        CustomerProfile.customer_signup_date.isnot(None),
        CustomerProfile.customer_signup_date != ""
    ).group_by(
        func.substr(CustomerProfile.customer_signup_date, 1, 7)
    ).order_by(
        desc(func.substr(CustomerProfile.customer_signup_date, 1, 7))
    ).limit(12).all()

    cust_map = {r.month: int(r.count) for r in cust_res}

    all_months = sorted(cust_map.keys())
    total_sellers = db.query(func.count(Seller.seller_id)).scalar() or 0
    avg_sellers_per_month = max(1, total_sellers // max(1, len(all_months)))

    points = []
    for m in all_months:
        points.append(PlatformGrowthPoint(
            period=m,
            customers=cust_map.get(m, 0),
            sellers=avg_sellers_per_month
        ))
    return points

@router.get("/admin/analytics/recent-transactions", response_model=List[RecentTransactionItem])
def get_admin_recent_transactions(
    limit: int = 25,
    current_user: AppUser = Depends(RoleChecker(["admin", "operations"])),
    db: Session = Depends(get_db)
):
    payments = db.query(Payment).order_by(Payment.payment_date.desc()).limit(limit).all()
    return [
        RecentTransactionItem(
            payment_id=p.payment_id,
            order_id=p.order_id,
            payment_date=p.payment_date,
            payment_method=p.payment_method,
            payment_status=p.payment_status,
            amount_paid=float(p.amount_paid or 0.0),
            refund_amount=float(p.refund_amount or 0.0)
        )
        for p in payments
    ]

@router.get("/admin/analytics/sales-trend", response_model=List[SalesTrendPoint])
def get_sales_trend(
    days: int = 30,
    current_user: AppUser = Depends(RoleChecker(["admin", "operations"])),
    db: Session = Depends(get_db)
):
    results = db.query(
        Order.order_date.label("order_date"),
        func.coalesce(func.sum(Order.final_amount), 0.0).label("revenue"),
        func.count(Order.order_id).label("order_count")
    ).filter(
        Order.order_date.isnot(None),
        Order.order_date != ""
    ).group_by(Order.order_date).order_by(desc("order_date")).limit(days).all()

    points = [
        SalesTrendPoint(
            date=str(r.order_date),
            revenue=round(float(r.revenue), 2),
            order_count=int(r.order_count)
        )
        for r in reversed(results)
    ]
    return points

@router.get("/admin/analytics/order-status-distribution", response_model=List[OrderStatusDistributionItem])
def get_order_status_distribution(
    current_user: AppUser = Depends(RoleChecker(["admin", "operations"])),
    db: Session = Depends(get_db)
):
    total = db.query(func.count(Order.order_id)).scalar() or 0
    if total == 0:
        return []

    results = db.query(
        Order.order_status.label("status"),
        func.count(Order.order_id).label("count")
    ).group_by(Order.order_status).all()

    items = []
    for r in results:
        status_name = r.status or "Unknown"
        count_val = int(r.count)
        pct = round((count_val / total) * 100.0, 1)
        items.append(OrderStatusDistributionItem(
            status=status_name,
            count=count_val,
            percentage=pct
        ))
    return items

@router.get("/admin/analytics/category-performance", response_model=List[CategoryPerformanceItem])
def get_category_performance(
    limit: int = 10,
    current_user: AppUser = Depends(RoleChecker(["admin", "operations"])),
    db: Session = Depends(get_db)
):
    results = db.query(
        Product.category.label("category"),
        func.coalesce(func.sum(OrderItem.item_revenue), 0.0).label("revenue"),
        func.coalesce(func.sum(OrderItem.quantity), 0).label("units_sold"),
        func.count(func.distinct(Product.product_id)).label("product_count")
    ).join(
        OrderItem, Product.product_id == OrderItem.product_id
    ).filter(
        Product.category.isnot(None),
        Product.category != ""
    ).group_by(
        Product.category
    ).order_by(desc("revenue")).limit(limit).all()

    return [
        CategoryPerformanceItem(
            category=r.category,
            revenue=round(float(r.revenue), 2),
            units_sold=int(r.units_sold),
            product_count=int(r.product_count)
        )
        for r in results
    ]

@router.get("/admin/analytics/top-sellers", response_model=List[TopSellerItem])
def get_top_sellers(
    limit: int = 10,
    current_user: AppUser = Depends(RoleChecker(["admin", "operations"])),
    db: Session = Depends(get_db)
):
    results = db.query(
        Seller.seller_id.label("seller_id"),
        Seller.store_name.label("store_name"),
        Seller.store_type.label("store_type"),
        func.count(SellerOrder.seller_order_id).label("order_count"),
        func.coalesce(func.sum(SellerOrder.subtotal), 0.0).label("revenue")
    ).join(
        SellerOrder, Seller.seller_id == SellerOrder.seller_id
    ).group_by(
        Seller.seller_id, Seller.store_name, Seller.store_type
    ).order_by(desc("revenue")).limit(limit).all()

    return [
        TopSellerItem(
            seller_id=r.seller_id,
            store_name=r.store_name or "Store",
            store_type=r.store_type or "Other / General Store",
            order_count=int(r.order_count),
            revenue=round(float(r.revenue), 2)
        )
        for r in results
    ]

@router.get("/admin/analytics/recent-activity", response_model=List[ActivityLogItem])
def get_recent_activity(
    limit: int = 15,
    current_user: AppUser = Depends(RoleChecker(["admin", "operations"])),
    db: Session = Depends(get_db)
):
    logs = db.query(AuditLog).order_by(desc(AuditLog.created_at)).limit(limit).all()
    items = []
    for l in logs:
        user_name = None
        if l.user_id:
            u = db.query(AppUser.full_name).filter(AppUser.user_id == l.user_id).first()
            if u:
                user_name = u[0]
        items.append(ActivityLogItem(
            id=l.audit_log_id,
            user_id=l.user_id,
            user_name=user_name,
            action=l.action,
            entity_type=l.entity_type,
            entity_id=l.entity_id,
            details=l.details,
            created_at=str(l.created_at) if l.created_at else ""
        ))
    return items

@router.get("/admin/fraud-radar", response_model=List[FraudAlertResponse])
def get_fraud_radar(
    current_user: AppUser = Depends(RoleChecker(["admin", "operations"]))
):
    alerts = get_fraud_alerts()
    return [FraudAlertResponse(**a) for a in alerts]
