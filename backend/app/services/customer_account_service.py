import uuid
from typing import List, Dict, Any, Optional
from datetime import datetime
from sqlalchemy.orm import Session
from sqlalchemy import func, or_
from app.models.users import AppUser
from app.models.orders import Order, OrderItem
from app.models.products import Product
from app.models.logistics import Shipment
from app.models.support import SupportTicket
from app.models.customer_account import (
    CustomerProfile,
    Payment,
    OrderReturn,
    CustomerReview,
    ReviewText
)
from app.schemas.customer_account import (
    CustomerProfileResponse,
    AccountSummaryResponse,
    PaginatedOrdersResponse,
    OrderDetailResponse,
    OrderItemDetail,
    ShipmentTrackingResponse,
    PaymentHistoryResponse,
    ReturnRefundResponse,
    CustomerReviewResponse,
    CreateReviewRequest,
    SupportTicketResponse,
    CreateSupportTicketRequest
)
from app.services.audit_service import log_audit_action

def resolve_customer_ids(db: Session, current_user: AppUser) -> List[str]:
    """
    Safely resolves all valid customer IDs associated with the authenticated user identity.
    Prioritizes explicit app_user_id foreign key relationship.
    Handles legacy ID mappings (e.g. CUST100000), direct app_users IDs, and email matches.
    """
    ids = []
    
    # 1. Query CustomerProfile by explicit app_user_id foreign key link
    linked_cust = db.query(CustomerProfile).filter(CustomerProfile.app_user_id == current_user.user_id).first()
    if linked_cust and linked_cust.customer_id:
        ids.append(linked_cust.customer_id)

    # 2. Check if user_id suffix maps to a legacy customer ID (e.g. USR-CUST-100000 -> CUST100000)
    if "CUST" in current_user.user_id.upper():
        clean_cust_id = current_user.user_id.upper().replace("USR-", "").replace("USER-", "")
        if clean_cust_id not in ids:
            ids.append(clean_cust_id)
            
    # 3. Check if there's a historical record in `customers` table matching user_id directly
    matching_cust = db.query(CustomerProfile).filter(
        or_(
            CustomerProfile.customer_id == current_user.user_id,
            CustomerProfile.customer_id.ilike(f"%{current_user.user_id}%")
        )
    ).first()
    
    if matching_cust and matching_cust.customer_id not in ids:
        ids.append(matching_cust.customer_id)

    # 4. For demo account preview, allow mapping to demo historical customer ID if specified
    if current_user.email == "customer.demo@example.invalid":
        demo_id = "CUST100000"
        if demo_id not in ids:
            ids.append(demo_id)
            
    # Fallback to current_user.user_id if no profile ID found
    if current_user.user_id not in ids:
        ids.append(current_user.user_id)

    return ids

def get_customer_profile_service(db: Session, current_user: AppUser) -> CustomerProfileResponse:
    customer_ids = resolve_customer_ids(db, current_user)
    
    # Try finding stored profile in `customers` table
    cust_record = db.query(CustomerProfile).filter(CustomerProfile.customer_id.in_(customer_ids)).first()
    
    # Compute live order metrics from MySQL orders table
    order_stats = db.query(
        func.count(Order.order_id),
        func.coalesce(func.sum(Order.final_amount), 0.0),
        func.coalesce(func.avg(Order.final_amount), 0.0)
    ).filter(Order.customer_id.in_(customer_ids)).first()
    
    total_orders_cnt = int(order_stats[0]) if order_stats else 0
    total_spend_val = float(order_stats[1]) if order_stats else 0.0
    avg_aov_val = float(order_stats[2]) if order_stats else 0.0

    # Determine loyalty tier dynamically based on spend
    if total_spend_val > 100000 or (cust_record and cust_record.loyalty_tier == "Gold"):
        tier = "Gold"
    elif total_spend_val > 25000 or (cust_record and cust_record.loyalty_tier == "Silver"):
        tier = "Silver"
    else:
        tier = "Bronze"

    return CustomerProfileResponse(
        customer_id=cust_record.customer_id if cust_record else customer_ids[0],
        user_id=current_user.user_id,
        full_name=current_user.full_name,
        email=current_user.email,
        signup_date=cust_record.customer_signup_date if cust_record else current_user.created_at.strftime("%Y-%m-%d"),
        gender=cust_record.gender if cust_record else "Not Specified",
        age=cust_record.age if cust_record else None,
        state=cust_record.state if cust_record else "Karnataka",
        city=cust_record.city if cust_record else "Bengaluru",
        customer_segment=cust_record.customer_segment if cust_record else "Regular",
        total_orders=max(total_orders_cnt, int(cust_record.total_orders) if cust_record and cust_record.total_orders else 0),
        total_spend=max(total_spend_val, float(cust_record.total_spend) if cust_record and cust_record.total_spend else 0.0),
        average_order_value=round(avg_aov_val if avg_aov_val > 0 else (float(cust_record.average_order_value) if cust_record and cust_record.average_order_value else 0.0), 2),
        customer_status=cust_record.customer_status if cust_record else "Active",
        loyalty_tier=tier
    )

def get_account_summary_service(db: Session, current_user: AppUser) -> AccountSummaryResponse:
    profile = get_customer_profile_service(db, current_user)
    customer_ids = resolve_customer_ids(db, current_user)

    active_cnt = db.query(func.count(Order.order_id)).filter(
        Order.customer_id.in_(customer_ids),
        Order.order_status.in_(["Processing", "Shipped", "Pending", "In Transit"])
    ).scalar() or 0

    completed_cnt = db.query(func.count(Order.order_id)).filter(
        Order.customer_id.in_(customer_ids),
        Order.order_status == "Delivered"
    ).scalar() or 0

    returns_cnt = db.query(func.count(OrderReturn.return_id)).filter(
        OrderReturn.customer_id.in_(customer_ids)
    ).scalar() or 0

    reviews_cnt = db.query(func.count(CustomerReview.review_id)).filter(
        CustomerReview.customer_id.in_(customer_ids)
    ).scalar() or 0

    # Fetch recent orders for activity timeline
    recent_orders = db.query(Order).filter(
        Order.customer_id.in_(customer_ids)
    ).order_by(Order.order_id.desc()).limit(5).all()

    activity = [
        {
            "event": f"Order #{o.order_id} placed ({o.order_status})",
            "date": o.order_date or "Recent",
            "amount": o.final_amount or 0.0
        }
        for o in recent_orders
    ]

    return AccountSummaryResponse(
        customer_id=profile.customer_id,
        full_name=profile.full_name,
        email=profile.email,
        total_spend=profile.total_spend,
        total_orders=profile.total_orders,
        active_orders_count=int(active_cnt),
        completed_orders_count=int(completed_cnt),
        returns_count=int(returns_cnt),
        reviews_count=int(reviews_cnt),
        loyalty_tier=profile.loyalty_tier or "Bronze",
        customer_segment=profile.customer_segment or "Regular",
        recent_activity=activity
    )

def get_paginated_customer_orders_service(
    db: Session,
    current_user: AppUser,
    page: int = 1,
    limit: int = 10,
    status_filter: Optional[str] = None
) -> PaginatedOrdersResponse:
    customer_ids = resolve_customer_ids(db, current_user)
    query = db.query(Order).filter(Order.customer_id.in_(customer_ids))
    
    if status_filter:
        query = query.filter(Order.order_status.ilike(f"%{status_filter}%"))
        
    total = query.count()
    pages = (total + limit - 1) // limit if limit > 0 else 1
    offset = (page - 1) * limit
    
    orders = query.order_by(Order.order_id.desc()).offset(offset).limit(limit).all()
    
    order_responses = []
    for o in orders:
        # Load items
        items = db.query(OrderItem).filter(OrderItem.order_id == o.order_id).all()
        item_details = []
        for it in items:
            p = db.query(Product).filter(Product.product_id == it.product_id).first()
            item_details.append(OrderItemDetail(
                order_item_id=it.order_item_id,
                product_id=it.product_id or "",
                product_name=p.product_name if p else f"Product {it.product_id}",
                quantity=int(it.quantity or 1),
                unit_price=float(it.unit_price or 0.0),
                discount_percentage=float(it.discount_percentage or 0.0),
                item_revenue=float(it.item_revenue or (it.quantity * it.unit_price if it.quantity and it.unit_price else 0.0))
            ))
            
        # Load shipment tracking
        shp = db.query(Shipment).filter(Shipment.order_id == o.order_id).first()
        shp_resp = ShipmentTrackingResponse.model_validate(shp) if shp else None
        
        # Load payment info
        pay = db.query(Payment).filter(Payment.order_id == o.order_id).first()
        pay_resp = PaymentHistoryResponse.model_validate(pay) if pay else None
        
        order_responses.append(OrderDetailResponse(
            order_id=o.order_id,
            customer_id=o.customer_id,
            order_date=o.order_date,
            order_time=o.order_time,
            order_status=o.order_status,
            shipping_method=o.shipping_method,
            delivery_city=o.delivery_city,
            delivery_state=o.delivery_state,
            coupon_code=o.coupon_code,
            subtotal=float(o.subtotal or 0.0),
            shipping_fee=float(o.shipping_fee or 0.0),
            tax_amount=float(o.tax_amount or 0.0),
            final_amount=float(o.final_amount or 0.0),
            items=item_details,
            shipment=shp_resp,
            payment=pay_resp
        ))
        
    return PaginatedOrdersResponse(
        total=total,
        page=page,
        limit=limit,
        pages=pages,
        items=order_responses
    )

def get_customer_order_detail_service(db: Session, current_user: AppUser, order_id: str) -> OrderDetailResponse:
    customer_ids = resolve_customer_ids(db, current_user)
    
    # Enforce strict ownership check
    order = db.query(Order).filter(
        Order.order_id == order_id,
        Order.customer_id.in_(customer_ids)
    ).first()
    
    if not order:
        raise ValueError("Order not found or access denied.")
        
    items = db.query(OrderItem).filter(OrderItem.order_id == order_id).all()
    item_details = []
    for it in items:
        p = db.query(Product).filter(Product.product_id == it.product_id).first()
        item_details.append(OrderItemDetail(
            order_item_id=it.order_item_id,
            product_id=it.product_id or "",
            product_name=p.product_name if p else f"Product {it.product_id}",
            quantity=int(it.quantity or 1),
            unit_price=float(it.unit_price or 0.0),
            discount_percentage=float(it.discount_percentage or 0.0),
            item_revenue=float(it.item_revenue or 0.0)
        ))
        
    shp = db.query(Shipment).filter(Shipment.order_id == order_id).first()
    pay = db.query(Payment).filter(Payment.order_id == order_id).first()

    return OrderDetailResponse(
        order_id=order.order_id,
        customer_id=order.customer_id,
        order_date=order.order_date,
        order_time=order.order_time,
        order_status=order.order_status,
        shipping_method=order.shipping_method,
        delivery_city=order.delivery_city,
        delivery_state=order.delivery_state,
        coupon_code=order.coupon_code,
        subtotal=float(order.subtotal or 0.0),
        shipping_fee=float(order.shipping_fee or 0.0),
        tax_amount=float(order.tax_amount or 0.0),
        final_amount=float(order.final_amount or 0.0),
        items=item_details,
        shipment=ShipmentTrackingResponse.model_validate(shp) if shp else None,
        payment=PaymentHistoryResponse.model_validate(pay) if pay else None
    )

def get_customer_shipments_service(db: Session, current_user: AppUser) -> List[ShipmentTrackingResponse]:
    customer_ids = resolve_customer_ids(db, current_user)
    
    # Query shipments joined with customer's orders
    shipments = db.query(Shipment).join(Order, Shipment.order_id == Order.order_id).filter(
        Order.customer_id.in_(customer_ids)
    ).all()
    
    return [ShipmentTrackingResponse.model_validate(s) for s in shipments]

def get_customer_payments_service(db: Session, current_user: AppUser) -> List[PaymentHistoryResponse]:
    customer_ids = resolve_customer_ids(db, current_user)
    
    payments = db.query(Payment).join(Order, Payment.order_id == Order.order_id).filter(
        Order.customer_id.in_(customer_ids)
    ).all()
    
    return [PaymentHistoryResponse.model_validate(p) for p in payments]

def get_customer_returns_service(db: Session, current_user: AppUser) -> List[ReturnRefundResponse]:
    customer_ids = resolve_customer_ids(db, current_user)
    
    returns = db.query(OrderReturn).filter(OrderReturn.customer_id.in_(customer_ids)).all()
    
    resp_list = []
    for r in returns:
        p = db.query(Product).filter(Product.product_id == r.product_id).first() if r.product_id else None
        resp_list.append(ReturnRefundResponse(
            return_id=r.return_id,
            order_id=r.order_id,
            customer_id=r.customer_id,
            product_id=r.product_id,
            product_name=p.product_name if p else "Marketplace Item",
            return_date=r.return_date,
            return_reason=r.return_reason,
            refund_amount=float(r.refund_amount or 0.0),
            return_status=r.return_status
        ))
        
    return resp_list

def get_customer_reviews_service(db: Session, current_user: AppUser) -> List[CustomerReviewResponse]:
    customer_ids = resolve_customer_ids(db, current_user)
    
    # Query review_text table for customer's written reviews
    reviews_text = db.query(ReviewText).filter(ReviewText.customer_id.in_(customer_ids)).all()
    
    resp_list = []
    for rt in reviews_text:
        p = db.query(Product).filter(Product.product_id == rt.product_id).first() if rt.product_id else None
        resp_list.append(CustomerReviewResponse(
            review_id=rt.review_id,
            order_id=rt.order_id,
            customer_id=rt.customer_id,
            product_id=rt.product_id,
            product_name=p.product_name if p else "Product Review",
            review_date=rt.review_date or datetime.now().strftime("%Y-%m-%d"),
            rating=int(rt.rating or 5),
            review_title=rt.review_title,
            review_text=rt.review_text,
            review_sentiment=rt.review_sentiment or "Positive",
            verified_purchase=bool(rt.verified_purchase) if rt.verified_purchase is not None else True
        ))
        
    return resp_list

def create_customer_review_service(
    db: Session,
    current_user: AppUser,
    req: CreateReviewRequest
) -> CustomerReviewResponse:
    customer_ids = resolve_customer_ids(db, current_user)
    cust_id = customer_ids[0]
    
    new_rev_id = f"REV{uuid.uuid4().hex[:7].upper()}"
    now_str = datetime.now().strftime("%Y-%m-%d")
    
    sentiment = "Positive" if req.rating >= 4 else ("Neutral" if req.rating == 3 else "Negative")

    # Add to customer_reviews table
    cr = CustomerReview(
        review_id=new_rev_id,
        order_id=req.order_id,
        customer_id=cust_id,
        product_id=req.product_id,
        review_date=now_str,
        rating=req.rating,
        review_sentiment=sentiment,
        verified_purchase=True
    )
    db.add(cr)

    # Add to review_text table
    rt = ReviewText(
        review_id=new_rev_id,
        order_id=req.order_id,
        customer_id=cust_id,
        product_id=req.product_id,
        review_date=now_str,
        rating=req.rating,
        review_title=req.review_title,
        review_text=req.review_text,
        review_sentiment=sentiment,
        verified_purchase=True,
        text_source="Customer My Account App",
        nlp_ready=True
    )
    db.add(rt)
    db.commit()

    p = db.query(Product).filter(Product.product_id == req.product_id).first()

    log_audit_action(
        db,
        action="CUSTOMER_REVIEW_SUBMITTED",
        entity_type="review",
        user_id=current_user.user_id,
        entity_id=new_rev_id,
        details={"product_id": req.product_id, "rating": req.rating}
    )

    return CustomerReviewResponse(
        review_id=new_rev_id,
        order_id=req.order_id,
        customer_id=cust_id,
        product_id=req.product_id,
        product_name=p.product_name if p else "Product Review",
        review_date=now_str,
        rating=req.rating,
        review_title=req.review_title,
        review_text=req.review_text,
        review_sentiment=sentiment,
        verified_purchase=True
    )

def get_customer_tickets_service(db: Session, current_user: AppUser) -> List[SupportTicketResponse]:
    customer_ids = resolve_customer_ids(db, current_user)
    tickets = db.query(SupportTicket).filter(
        SupportTicket.customer_id.in_(customer_ids)
    ).order_by(SupportTicket.created_at.desc()).all()
    
    return [SupportTicketResponse.model_validate(t) for t in tickets]

def create_customer_ticket_service(db: Session, current_user: AppUser, req: CreateSupportTicketRequest) -> SupportTicketResponse:
    customer_ids = resolve_customer_ids(db, current_user)
    cust_id = customer_ids[0] if customer_ids else current_user.user_id

    new_tkt_id = f"TKT{uuid.uuid4().hex[:7].upper()}"
    now_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    tkt = SupportTicket(
        ticket_id=new_tkt_id,
        customer_id=cust_id,
        order_id=req.order_id,
        issue_type=req.issue_type,
        customer_message=req.customer_message,
        resolution_guidance="Ticket submitted successfully. Support team will review shortly.",
        ticket_status="Open",
        created_at=now_str,
        source_type="Customer Portal"
    )
    db.add(tkt)
    db.commit()
    db.refresh(tkt)

    log_audit_action(
        db,
        action="CUSTOMER_TICKET_CREATED",
        entity_type="ticket",
        user_id=current_user.user_id,
        entity_id=new_tkt_id,
        details={"issue_type": req.issue_type, "order_id": req.order_id}
    )

    return SupportTicketResponse.model_validate(tkt)

