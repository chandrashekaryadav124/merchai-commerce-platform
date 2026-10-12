import uuid
from typing import List, Optional
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.models.orders import Order, OrderItem, SellerOrder, SellerOrderItem
from app.models.sellers import Seller, SellerProduct
from app.models.products import Product
from app.models.customer_account import CustomerProfile, Payment
from app.models.logistics import Shipment
from app.schemas.orders import OrderResponse, OrderCreate, SellerOrderResponse
from app.core.deps import get_current_user, RoleChecker
from app.models.users import AppUser
from app.services.audit_service import log_audit_action
from app.services.customer_account_service import resolve_customer_ids

router = APIRouter()

@router.get("", response_model=List[OrderResponse])
def list_orders(
    limit: int = 50,
    current_user: AppUser = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    query = db.query(Order)
    if current_user.role == "customer":
        # Restrict customer access strictly to their own private orders
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

    # Resolve active customer_id associated with current user account
    cust_profile = db.query(CustomerProfile).filter(CustomerProfile.app_user_id == current_user.user_id).first()
    cust_id = cust_profile.customer_id if cust_profile else current_user.user_id

    # Parse address city and state if possible from shipping_address string
    raw_addr = (order_in.shipping_address or "").strip()
    addr_parts = [p.strip() for p in raw_addr.split(",") if p.strip()]
    delivery_city = addr_parts[-2] if len(addr_parts) >= 2 else (addr_parts[0] if addr_parts else "Bengaluru")
    delivery_state = addr_parts[-1].split(" ")[0] if len(addr_parts) >= 1 else "Karnataka"

    # Row lock and resolve authoritative server-side price and stock for each item
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

    # Track seller product associations
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

    # Create seller-specific orders for relevant sellers
    for seller_id, items_list in seller_items_map.items():
        so_subtotal = sum(it.quantity * u_price for it, _, _, u_price in items_list)
        seller_order = SellerOrder(
            order_id=new_order_id,
            seller_id=seller_id,
            status="Processing",
            subtotal=so_subtotal
        )
        db.add(seller_order)
        db.flush()

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

    # Create Payment (Pending) and Shipment (Order Placed) records
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

    shp = Shipment(
        shipment_id=f"SHP-{uuid.uuid4().hex[:7].upper()}",
        order_id=new_order_id,
        warehouse_city="Bengaluru",
        delivery_city=delivery_city,
        shipping_method="Standard",
        delivery_status="Order Placed"
    )
    db.add(shp)

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

@router.get("/seller", response_model=List[SellerOrderResponse])
def get_seller_orders(
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
        if seller.approval_status == "pending":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Seller storefront application is pending administrator approval. Order management is disabled."
            )
        elif seller.approval_status == "suspended":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Seller storefront is suspended. Seller order operations are disabled."
            )
        elif seller.approval_status == "rejected":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Seller storefront application was rejected."
            )
        elif seller.approval_status != "approved":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Seller storefront status '{seller.approval_status}' does not permit order management."
            )
        query = query.filter(SellerOrder.seller_id == seller.seller_id)
        
    orders = query.limit(50).all()
    return orders
