import re
import uuid
from typing import List, Optional
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.models.orders import Order, OrderItem, SellerOrder, SellerOrderItem, SellerOrderStatusHistory
from app.models.sellers import Seller, SellerProduct
from app.models.products import Product, ProductImage
from app.models.customer_account import CustomerProfile, Payment
from app.models.logistics import Shipment, CourierPartner, ShipmentTrackingEvent
from app.schemas.orders import (
    OrderResponse,
    OrderCreate,
    SellerOrderDetailResponse,
    SellerOrderItemDetail,
    SellerOrderHistoryItem,
    SellerOrderStatusUpdateRequest
)
from app.schemas.logistics import (
    CustomerOrderTrackingResponse,
    CustomerPackageTrackingResponse,
    ShipmentTrackingEventItem
)
from app.core.deps import get_current_user, RoleChecker
from app.models.users import AppUser
from app.services.audit_service import log_audit_action
from app.services.customer_account_service import resolve_customer_ids

router = APIRouter()

def mask_phone_number(phone: Optional[str]) -> Optional[str]:
    if not phone:
        return None
    cleaned = re.sub(r"[^\d+]", "", str(phone))
    if len(cleaned) < 5:
        return "****"
    return f"{cleaned[:3]}****{cleaned[-3:]}"

def mask_email_address(email: Optional[str]) -> Optional[str]:
    if not email:
        return None
    e = str(email).strip()
    if "@" not in e:
        return "****"
    user_part, domain = e.split("@", 1)
    if len(user_part) <= 2:
        return f"{user_part[0]}***@{domain}"
    return f"{user_part[0]}***{user_part[-1]}@{domain}"

def normalize_status(st: Optional[str]) -> str:
    if not st:
        return "PLACED"
    s = st.strip().upper()
    mapping = {
        "PENDING": "PLACED",
        "CONFIRMED": "ACCEPTED",
        "PROCESSING": "PROCESSING",
        "PACKED": "PACKED",
        "READY_FOR_PICKUP": "READY_FOR_PICKUP",
        "SHIPPED": "HANDED_OVER",
        "HANDED_OVER": "HANDED_OVER",
        "IN_TRANSIT": "IN_TRANSIT",
        "DELIVERED": "DELIVERED",
        "CANCELLED": "CANCELLED",
        "ORDER PLACED": "PLACED"
    }
    return mapping.get(s, s)

def build_seller_order_detail(db: Session, so: SellerOrder) -> SellerOrderDetailResponse:
    order = db.query(Order).filter(Order.order_id == so.order_id).first()
    seller = db.query(Seller).filter(Seller.seller_id == so.seller_id).first()
    
    # Locate specific shipment for this seller order
    shipment = db.query(Shipment).filter(Shipment.seller_order_id == so.seller_order_id).first()
    if not shipment:
        # Fallback to parent order shipment if individual not yet dispatched
        shipment = db.query(Shipment).filter(Shipment.order_id == so.order_id).first()

    payment = db.query(Payment).filter(Payment.order_id == so.order_id).first()

    customer_email = None
    if order and order.customer_id:
        cust_user = db.query(AppUser).filter(AppUser.user_id == order.customer_id).first()
        if cust_user:
            customer_email = cust_user.email

    # Items for this seller order
    so_items = db.query(SellerOrderItem).filter(SellerOrderItem.seller_order_id == so.seller_order_id).all()
    items_detail = []
    for soi in so_items:
        prod = db.query(Product).filter(Product.product_id == soi.product_id).first()
        sp = db.query(SellerProduct).filter(
            SellerProduct.product_id == soi.product_id,
            SellerProduct.seller_id == so.seller_id
        ).first()
        img = db.query(ProductImage).filter(ProductImage.product_id == soi.product_id).first()

        unit_p = float(soi.unit_price) if soi.unit_price else (float(sp.selling_price) if sp and sp.selling_price else 0.0)
        qty = int(soi.quantity) if soi.quantity else 1
        subt = round(unit_p * qty, 2)

        items_detail.append(SellerOrderItemDetail(
            seller_order_item_id=soi.seller_order_item_id,
            product_id=soi.product_id,
            title=prod.product_name if prod else (sp.sku if sp and sp.sku else soi.product_id),
            primary_image=img.image_path if img else None,
            sku=sp.sku if sp else None,
            quantity=qty,
            unit_price=unit_p,
            subtotal=subt
        ))

    # History for this seller order
    hist_records = db.query(SellerOrderStatusHistory).filter(
        SellerOrderStatusHistory.seller_order_id == so.seller_order_id
    ).order_by(SellerOrderStatusHistory.created_at.asc()).all()

    status_hist = [
        SellerOrderHistoryItem(
            history_id=h.history_id,
            previous_status=h.previous_status,
            new_status=h.new_status,
            changed_by=h.changed_by,
            notes=h.notes,
            created_at=str(h.created_at) if h.created_at else None
        )
        for h in hist_records
    ]

    return SellerOrderDetailResponse(
        seller_order_id=so.seller_order_id,
        order_id=so.order_id,
        seller_id=so.seller_id,
        seller_store_name=seller.store_name if seller else so.seller_id,
        status=normalize_status(so.status),
        subtotal=float(so.subtotal) if so.subtotal else sum(it.subtotal for it in items_detail),
        order_date=order.order_date if order else None,
        payment_status=payment.payment_status if payment else "Pending",
        payment_method=payment.payment_method if payment else None,
        customer_name=order.recipient_name if order and order.recipient_name else "Customer",
        customer_phone_masked=mask_phone_number(order.recipient_phone if order else None),
        customer_email_masked=mask_email_address(customer_email),
        shipping_address=order.shipping_address if order else None,
        delivery_city=order.delivery_city if order else None,
        delivery_state=order.delivery_state if order else None,
        delivery_pincode=order.delivery_pincode if order else None,
        shipment_id=shipment.shipment_id if shipment else None,
        shipment_status=shipment.delivery_status if shipment else "Pending Dispatch",
        tracking_number=shipment.tracking_number if shipment else None,
        courier_name=shipment.courier_name if shipment else None,
        items=items_detail,
        status_history=status_hist,
        created_at=str(so.created_at) if so.created_at else None,
        updated_at=str(so.updated_at) if so.updated_at else None
    )

@router.get("", response_model=List[OrderResponse])
def list_orders(
    limit: int = 50,
    current_user: AppUser = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    query = db.query(Order)
    if current_user.role == "customer":
        cust_ids = resolve_customer_ids(db, current_user)
        query = query.filter(Order.customer_id.in_(cust_ids))
    elif current_user.role == "seller":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Sellers must access store orders via /api/v1/orders/seller endpoint."
        )
    return query.limit(limit).all()

@router.post("", response_model=OrderResponse)
def place_order(
    order_in: OrderCreate,
    current_user: AppUser = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if not order_in.items:
        raise HTTPException(status_code=400, detail="Order must contain at least one item.")
    
    new_order_id = f"ORD{uuid.uuid4().hex[:7].upper()}"
    now = datetime.now()

    cust_profile = db.query(CustomerProfile).filter(CustomerProfile.app_user_id == current_user.user_id).first()
    cust_id = cust_profile.customer_id if cust_profile else current_user.user_id

    raw_addr = (order_in.shipping_address or "").strip()
    addr_parts = [p.strip() for p in raw_addr.split(",") if p.strip()]
    delivery_city = addr_parts[-2] if len(addr_parts) >= 2 else (addr_parts[0] if addr_parts else "Bengaluru")
    delivery_state = addr_parts[-1].split(" ")[0] if len(addr_parts) >= 1 else "Karnataka"

    resolved_items = []
    subtotal = 0.0

    for item in order_in.items:
        sp = db.query(SellerProduct).filter(
            SellerProduct.product_id == item.product_id
        ).with_for_update().first()
        prod = db.query(Product).filter(Product.product_id == item.product_id).first()

        if sp and sp.listing_status != "active":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Product '{prod.product_name if prod else item.product_id}' is inactive and cannot be ordered."
            )

        if sp and sp.stock_quantity is not None and sp.stock_quantity < item.quantity:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Insufficient inventory for '{prod.product_name if prod else item.product_id}'. Available: {sp.stock_quantity}, requested: {item.quantity}."
            )

        if sp and sp.selling_price is not None:
            authoritative_price = float(sp.selling_price)
        elif prod and prod.price is not None:
            authoritative_price = float(prod.price)
        else:
            authoritative_price = float(item.unit_price)

        line_rev = item.quantity * authoritative_price
        subtotal += line_rev

        resolved_items.append({
            "item": item,
            "sp": sp,
            "unit_price": authoritative_price,
            "line_rev": line_rev
        })

    shipping_fee = 0.0 if subtotal >= 1000.0 else 49.0
    tax_amount = round(subtotal * 0.05, 2)
    final_amount = round(subtotal + shipping_fee + tax_amount, 2)

    new_order = Order(
        order_id=new_order_id,
        customer_id=cust_id,
        order_date=now.strftime("%Y-%m-%d"),
        order_time=now.strftime("%H:%M:%S"),
        order_status="Processing",
        shipping_method="Standard",
        delivery_city=delivery_city,
        delivery_state=delivery_state,
        shipping_address=raw_addr,
        subtotal=subtotal,
        shipping_fee=shipping_fee,
        tax_amount=tax_amount,
        final_amount=final_amount
    )
    db.add(new_order)

    seller_items_map = {}
    for entry in resolved_items:
        item = entry["item"]
        unit_price = entry["unit_price"]
        sp = entry["sp"]
        line_rev = entry["line_rev"]

        order_item_id = f"ITEM-{uuid.uuid4().hex[:8]}"
        new_item = OrderItem(
            order_item_id=order_item_id,
            order_id=new_order_id,
            product_id=item.product_id,
            quantity=item.quantity,
            unit_price=unit_price,
            discount_percentage=0.0,
            item_revenue=line_rev,
            item_cost=round(line_rev * 0.7, 2),
            profit=round(line_rev * 0.3, 2)
        )
        db.add(new_item)

        if sp and sp.seller_id:
            if sp.seller_id not in seller_items_map:
                seller_items_map[sp.seller_id] = []
            seller_items_map[sp.seller_id].append((item, order_item_id, sp, unit_price))

    for seller_id, items_list in seller_items_map.items():
        so_subtotal = sum(it.quantity * u_price for it, _, _, u_price in items_list)
        seller_order = SellerOrder(
            order_id=new_order_id,
            seller_id=seller_id,
            status="PLACED",
            subtotal=so_subtotal
        )
        db.add(seller_order)
        db.flush()

        # Log initial status history
        db.add(SellerOrderStatusHistory(
            seller_order_id=seller_order.seller_order_id,
            previous_status=None,
            new_status="PLACED",
            changed_by="CUSTOMER",
            notes="Order placed by customer"
        ))

        for it, order_item_id, sp, u_price in items_list:
            soi = SellerOrderItem(
                seller_order_id=seller_order.seller_order_id,
                order_item_id=order_item_id,
                product_id=it.product_id,
                quantity=it.quantity,
                unit_price=u_price
            )
            db.add(soi)
            if sp.stock_quantity is not None:
                sp.stock_quantity = max(0, sp.stock_quantity - it.quantity)

    # Initial simulated payment
    pay = Payment(
        payment_id=f"PAY-{uuid.uuid4().hex[:7].upper()}",
        order_id=new_order_id,
        payment_date=now.strftime("%Y-%m-%d"),
        payment_method="Simulated Payment / Pending Capture",
        payment_status="Pending",
        amount_paid=0.0,
        transaction_fee=0.0,
        refund_amount=0.0
    )
    db.add(pay)

    db.commit()
    db.refresh(new_order)

    log_audit_action(
        db,
        action="ORDER_PLACED",
        entity_type="order",
        user_id=current_user.user_id,
        entity_id=new_order_id,
        details={"final_amount": final_amount, "items_count": len(order_in.items)}
    )

    return new_order

@router.get("/seller", response_model=List[SellerOrderDetailResponse])
def get_seller_orders(
    status_filter: Optional[str] = Query(default=None, alias="status"),
    search: Optional[str] = None,
    limit: int = Query(default=50, le=100),
    offset: int = Query(default=0, ge=0),
    current_user: AppUser = Depends(RoleChecker(["seller", "operations", "admin"])),
    db: Session = Depends(get_db)
):
    query = db.query(SellerOrder)
    if current_user.role == "seller":
        seller = db.query(Seller).filter(Seller.user_id == current_user.user_id).first()
        if not seller:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="No registered seller storefront associated with this user account."
            )
        if seller.approval_status != "approved":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Seller storefront status '{seller.approval_status}' does not permit order management."
            )
        query = query.filter(SellerOrder.seller_id == seller.seller_id)

    if status_filter and status_filter.upper() != "ALL":
        normalized = normalize_status(status_filter)
        query = query.filter(SellerOrder.status.ilike(normalized))

    if search and search.strip():
        term = f"%{search.strip()}%"
        # Search by order_id or recipient name via Order
        matched_order_ids = [r[0] for r in db.query(Order.order_id).filter(
            Order.order_id.ilike(term) | Order.recipient_name.ilike(term) | Order.delivery_city.ilike(term)
        ).all()]
        query = query.filter(SellerOrder.order_id.in_(matched_order_ids))

    orders = query.order_by(SellerOrder.created_at.desc()).offset(offset).limit(limit).all()
    return [build_seller_order_detail(db, so) for so in orders]

@router.get("/seller/{seller_order_id}", response_model=SellerOrderDetailResponse)
def get_single_seller_order(
    seller_order_id: int,
    current_user: AppUser = Depends(RoleChecker(["seller", "operations", "admin"])),
    db: Session = Depends(get_db)
):
    so = db.query(SellerOrder).filter(SellerOrder.seller_order_id == seller_order_id).first()
    if not so:
        raise HTTPException(status_code=404, detail="Seller order not found.")

    if current_user.role == "seller":
        seller = db.query(Seller).filter(Seller.user_id == current_user.user_id).first()
        if not seller or so.seller_id != seller.seller_id:
            raise HTTPException(status_code=403, detail="Access denied. You can only view orders for your storefront.")

    return build_seller_order_detail(db, so)

@router.patch("/seller/{seller_order_id}/status", response_model=SellerOrderDetailResponse)
def update_seller_order_status(
    seller_order_id: int,
    payload: SellerOrderStatusUpdateRequest,
    current_user: AppUser = Depends(RoleChecker(["seller", "operations", "admin"])),
    db: Session = Depends(get_db)
):
    so = db.query(SellerOrder).filter(SellerOrder.seller_order_id == seller_order_id).with_for_update().first()
    if not so:
        raise HTTPException(status_code=404, detail="Seller order not found.")

    if current_user.role == "seller":
        seller = db.query(Seller).filter(Seller.user_id == current_user.user_id).first()
        if not seller or so.seller_id != seller.seller_id:
            raise HTTPException(status_code=403, detail="Access denied. You do not own this order.")

    current_norm = normalize_status(so.status)
    target_norm = payload.new_status.strip().upper()

    # Seller transition permissions
    valid_seller_transitions = {
        "PLACED": ["ACCEPTED", "CANCELLED"],
        "ACCEPTED": ["PROCESSING", "CANCELLED"],
        "PROCESSING": ["PACKED"],
        "PACKED": ["READY_FOR_PICKUP"],
        "READY_FOR_PICKUP": [],
        "HANDED_OVER": [],
        "IN_TRANSIT": [],
        "DELIVERED": [],
        "CANCELLED": []
    }

    if current_user.role == "seller":
        allowed = valid_seller_transitions.get(current_norm, [])
        if target_norm not in allowed:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid state transition from '{current_norm}' to '{target_norm}'. Allowed next states: {allowed}. Handover and delivery must be handled by Operations."
            )

    prev_status = so.status
    so.status = target_norm
    so.updated_at = datetime.now()

    # Log to status history
    history_entry = SellerOrderStatusHistory(
        seller_order_id=so.seller_order_id,
        previous_status=prev_status,
        new_status=target_norm,
        changed_by=f"{current_user.role.upper()}:{current_user.user_id}",
        notes=payload.notes or f"Status updated to {target_norm}"
    )
    db.add(history_entry)

    db.commit()
    db.refresh(so)

    log_audit_action(
        db,
        action="SELLER_ORDER_STATUS_UPDATED",
        entity_type="seller_order",
        user_id=current_user.user_id,
        entity_id=str(so.seller_order_id),
        details={"previous_status": prev_status, "new_status": target_norm, "notes": payload.notes}
    )

    return build_seller_order_detail(db, so)

@router.get("/{order_id}/tracking", response_model=CustomerOrderTrackingResponse)
def get_customer_order_tracking(
    order_id: str,
    current_user: AppUser = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    order = db.query(Order).filter(Order.order_id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found.")

    if current_user.role == "customer":
        cust_ids = resolve_customer_ids(db, current_user)
        if order.customer_id not in cust_ids:
            raise HTTPException(status_code=403, detail="Access denied to tracking details for this order.")

    # Find all seller orders under this parent order
    seller_orders = db.query(SellerOrder).filter(SellerOrder.order_id == order_id).all()
    packages = []

    for so in seller_orders:
        seller = db.query(Seller).filter(Seller.seller_id == so.seller_id).first()
        store_name = seller.store_name if seller else so.seller_id

        # Find shipment linked to this seller order
        shipment = db.query(Shipment).filter(Shipment.seller_order_id == so.seller_order_id).first()
        if not shipment:
            shipment = db.query(Shipment).filter(Shipment.order_id == so.order_id).first()

        # Tracking events
        events_list = []
        tracking_url = None
        courier_name = None
        trk_num = None
        dsp_date = None
        exp_date = None
        act_date = None
        wh_city = "Seller Store"

        if shipment:
            courier_name = shipment.courier_name
            trk_num = shipment.tracking_number
            dsp_date = shipment.dispatch_date
            exp_date = shipment.expected_delivery_date
            act_date = shipment.actual_delivery_date
            wh_city = shipment.warehouse_city or "Central Fulfillment Hub"

            if shipment.courier_partner_id:
                cp = db.query(CourierPartner).filter(CourierPartner.courier_id == shipment.courier_partner_id).first()
                if cp and cp.tracking_url_template and trk_num:
                    tracking_url = cp.tracking_url_template.replace("{tracking_number}", trk_num)

            evts = db.query(ShipmentTrackingEvent).filter(
                ShipmentTrackingEvent.shipment_id == shipment.shipment_id
            ).order_by(ShipmentTrackingEvent.created_at.asc()).all()

            for ev in evts:
                events_list.append(ShipmentTrackingEventItem(
                    event_id=ev.event_id,
                    shipment_id=ev.shipment_id,
                    status=ev.status,
                    location=ev.location,
                    notes=ev.notes,
                    created_at=str(ev.created_at) if ev.created_at else None
                ))

        # Items in this package
        so_items = db.query(SellerOrderItem).filter(SellerOrderItem.seller_order_id == so.seller_order_id).all()
        pkg_items = []
        for it in so_items:
            prod = db.query(Product).filter(Product.product_id == it.product_id).first()
            img = db.query(ProductImage).filter(ProductImage.product_id == it.product_id).first()
            pkg_items.append({
                "product_id": it.product_id,
                "title": prod.product_name if prod else it.product_id,
                "quantity": it.quantity,
                "unit_price": float(it.unit_price) if it.unit_price else 0.0,
                "image": img.image_path if img else None
            })

        packages.append(CustomerPackageTrackingResponse(
            shipment_id=shipment.shipment_id if shipment else None,
            seller_order_id=so.seller_order_id,
            seller_id=so.seller_id,
            seller_store_name=store_name,
            status=shipment.delivery_status if shipment and shipment.delivery_status else normalize_status(so.status),
            courier_name=courier_name,
            tracking_number=trk_num,
            tracking_url=tracking_url,
            warehouse_city=wh_city,
            dispatch_date=dsp_date,
            expected_delivery_date=exp_date,
            actual_delivery_date=act_date,
            events=events_list,
            items=pkg_items
        ))

    return CustomerOrderTrackingResponse(
        order_id=order.order_id,
        order_status=order.order_status or "Processing",
        order_date=order.order_date,
        delivery_city=order.delivery_city,
        delivery_state=order.delivery_state,
        recipient_name=order.recipient_name,
        shipping_address=order.shipping_address,
        packages=packages
    )
