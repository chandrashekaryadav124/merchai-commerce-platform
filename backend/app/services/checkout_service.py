import re
import uuid
from typing import Optional, Dict, Any, List
from datetime import datetime
from decimal import Decimal
from sqlalchemy.orm import Session
from fastapi import HTTPException, status
from app.models.users import AppUser
from app.models.cart import Cart, CartItem
from app.models.sellers import Seller, SellerProduct
from app.models.products import Product, ProductImage
from app.models.orders import Order, OrderItem, SellerOrder, SellerOrderItem
from app.models.customer_account import CustomerProfile, CustomerAddress, Payment
from app.models.logistics import Shipment
from app.schemas.checkout import CheckoutSummaryResponse, OrderPlacementRequest
from app.schemas.customer_account import OrderDetailResponse, OrderItemDetail, ShipmentTrackingResponse, PaymentHistoryResponse
from app.services.customer_account_service import resolve_customer_ids
from app.services.cart_service import get_or_create_active_cart, get_cart_details_service
from app.services.audit_service import log_audit_action

SHIPPING_THRESHOLD = Decimal("1000.00")
STANDARD_SHIPPING_FEE = Decimal("49.00")
TAX_RATE = Decimal("0.05")

def get_checkout_summary_service(db: Session, user_id: str) -> CheckoutSummaryResponse:
    """
    Computes an authoritative server-side checkout summary using Decimal arithmetic.
    Never relies on client-supplied totals, tax, or shipping fees.
    """
    cart_resp = get_cart_details_service(db, user_id)
    subtotal = Decimal(str(cart_resp.subtotal))

    validation_messages: List[str] = []
    is_eligible = len(cart_resp.items) > 0

    if len(cart_resp.items) == 0:
        validation_messages.append("Your shopping cart is currently empty.")
        is_eligible = False

    for it in cart_resp.items:
        if not it.is_in_stock:
            is_eligible = False
            if it.stock_quantity == 0:
                validation_messages.append(f"'{it.product_name}' is out of stock.")
            elif it.stock_quantity < it.quantity:
                validation_messages.append(f"'{it.product_name}' only has {it.stock_quantity} available (you requested {it.quantity}).")
            elif it.listing_status != "active":
                validation_messages.append(f"'{it.product_name}' is currently inactive ({it.listing_status}).")

    # Authoritative Shipping Policy
    if subtotal >= SHIPPING_THRESHOLD:
        shipping_fee = Decimal("0.00")
        shipping_basis = f"Free standard shipping applied (Order subtotal ₹{subtotal:,.2f} meets ₹{SHIPPING_THRESHOLD:,.2f} threshold)."
    elif subtotal > Decimal("0.00"):
        shipping_fee = STANDARD_SHIPPING_FEE
        shipping_basis = f"Standard flat delivery fee of ₹{STANDARD_SHIPPING_FEE:,.2f} applied (Free shipping on orders ₹{SHIPPING_THRESHOLD:,.2f}+)."
    else:
        shipping_fee = Decimal("0.00")
        shipping_basis = "Cart is empty."

    # Authoritative Tax Policy: 5% GST
    tax_amount = (subtotal * TAX_RATE).quantize(Decimal("0.01"))
    tax_basis = "Goods & Services Tax (GST) calculated at standard 5.0% on merchandise subtotal."

    final_total = subtotal + shipping_fee + tax_amount

    return CheckoutSummaryResponse(
        cart_id=cart_resp.cart_id,
        items=cart_resp.items,
        item_count=cart_resp.item_count,
        merchandise_subtotal=float(subtotal),
        shipping_fee=float(shipping_fee),
        shipping_fee_basis=shipping_basis,
        tax_amount=float(tax_amount),
        tax_rate=float(TAX_RATE * Decimal("100")),
        tax_basis=tax_basis,
        final_total=float(final_total),
        is_checkout_eligible=is_eligible,
        validation_messages=validation_messages
    )

def place_order_service(
    db: Session,
    current_user: AppUser,
    req: OrderPlacementRequest,
    idempotency_key_header: Optional[str] = None
) -> OrderDetailResponse:
    """
    Safely and atomically executes order placement in a single database transaction.
    1. Authenticates customer & enforces tenant isolation.
    2. Checks idempotency key to prevent duplicate orders on network retry.
    3. Validates address ownership and 6-digit Indian PIN code.
    4. Revalidates inventory with row-level locks and current authoritative prices.
    5. Creates Order, OrderItems, SellerOrders, SellerOrderItems, Payment, Shipment.
    6. Decrements inventory atomically.
    7. Clears cart on successful commit.
    """
    idempotency_key = req.idempotency_key or idempotency_key_header

    # 1. Check idempotency key for replay prevention
    if idempotency_key:
        existing_order = db.query(Order).filter(Order.idempotency_key == idempotency_key).first()
        if existing_order:
            # Return existing order safely without duplicate billing
            return _format_order_detail_response(db, existing_order)

    # 2. Resolve customer identity
    cust_ids = resolve_customer_ids(db, current_user)
    cust_id = cust_ids[0] if cust_ids else current_user.user_id

    # 3. Resolve & validate delivery address
    recip_name = ""
    recip_phone = ""
    line1 = ""
    line2 = ""
    city = ""
    state = ""
    pincode = ""

    if req.address_id:
        addr = db.query(CustomerAddress).filter(
            CustomerAddress.address_id == req.address_id,
            CustomerAddress.user_id == current_user.user_id
        ).first()
        if not addr:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Selected delivery address not found or does not belong to your account."
            )
        recip_name = addr.recipient_name
        recip_phone = addr.phone_number
        line1 = addr.address_line1
        line2 = addr.address_line2 or ""
        city = addr.city
        state = addr.state
        pincode = addr.postal_code
    else:
        # Validate direct address fields
        if not (req.recipient_name and req.recipient_phone and req.address_line1 and req.city and req.state and req.postal_code):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Please select a saved delivery address or provide complete delivery address fields."
            )
        clean_pin = req.postal_code.strip().replace(" ", "")
        if not re.match(r"^[1-9][0-9]{5}$", clean_pin):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Postal PIN code must be a valid 6-digit Indian postal code."
            )
        recip_name = req.recipient_name.strip()
        recip_phone = req.recipient_phone.strip()
        line1 = req.address_line1.strip()
        line2 = (req.address_line2 or "").strip()
        city = req.city.strip()
        state = req.state.strip()
        pincode = clean_pin

    full_shipping_address = f"{recip_name}, Phone: {recip_phone}, {line1}"
    if line2:
        full_shipping_address += f", {line2}"
    full_shipping_address += f", {city}, {state} - {pincode}"

    # 4. Load user's active cart
    cart = db.query(Cart).filter(
        Cart.customer_user_id == current_user.user_id,
        Cart.status == "active"
    ).first()

    if not cart:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No active shopping cart found. Please add products before placing an order."
        )

    cart_items = db.query(CartItem).filter(CartItem.cart_id == cart.cart_id).all()
    if not cart_items:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Your shopping cart is empty. Please add products before placing an order."
        )

    # Begin atomic transaction block
    try:
        # 5. Lock and validate inventory & prices for each cart item
        resolved_items = []
        merchandise_subtotal = Decimal("0.00")

        for ci in cart_items:
            # Row lock seller_product
            sp = db.query(SellerProduct).filter(
                SellerProduct.seller_product_id == ci.seller_product_id
            ).with_for_update().first()

            if not sp:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"Product listing #{ci.seller_product_id} is no longer available."
                )

            prod = db.query(Product).filter(Product.product_id == sp.product_id).first()
            prod_name = prod.product_name if prod else f"Product {sp.product_id}"

            if sp.listing_status != "active":
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Item '{prod_name}' is currently {sp.listing_status} and cannot be purchased."
                )

            avail_stock = int(sp.stock_quantity or 0)
            if avail_stock < ci.quantity:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Insufficient inventory for '{prod_name}'. Only {avail_stock} available in stock."
                )

            unit_price = Decimal(str(sp.selling_price))
            line_total = unit_price * ci.quantity
            merchandise_subtotal += line_total

            resolved_items.append({
                "cart_item": ci,
                "sp": sp,
                "product": prod,
                "unit_price": unit_price,
                "line_total": line_total
            })

        # Calculate authoritative totals
        if merchandise_subtotal >= SHIPPING_THRESHOLD:
            shipping_fee = Decimal("0.00")
        else:
            shipping_fee = STANDARD_SHIPPING_FEE

        tax_amount = (merchandise_subtotal * TAX_RATE).quantize(Decimal("0.01"))
        final_total = merchandise_subtotal + shipping_fee + tax_amount

        # 6. Create Order record
        new_order_id = f"ORD{uuid.uuid4().hex[:7].upper()}"
        now = datetime.now()

        new_order = Order(
            order_id=new_order_id,
            customer_id=cust_id,
            order_date=now.strftime("%Y-%m-%d"),
            order_time=now.strftime("%H:%M:%S"),
            order_status="Processing",
            shipping_method="Standard",
            delivery_city=city,
            delivery_state=state,
            shipping_address=full_shipping_address,
            delivery_pincode=pincode,
            recipient_name=recip_name,
            recipient_phone=recip_phone,
            subtotal=float(merchandise_subtotal),
            shipping_fee=float(shipping_fee),
            tax_amount=float(tax_amount),
            final_amount=float(final_total),
            idempotency_key=idempotency_key
        )
        db.add(new_order)
        db.flush()

        # 7. Create OrderItems & prepare seller order groups
        seller_order_groups: Dict[str, List[Any]] = {}

        for entry in resolved_items:
            ci = entry["cart_item"]
            sp = entry["sp"]
            u_price = float(entry["unit_price"])
            l_total = float(entry["line_total"])

            item_id = f"ITEM-{uuid.uuid4().hex[:8]}"
            oi = OrderItem(
                order_item_id=item_id,
                order_id=new_order_id,
                product_id=sp.product_id,
                quantity=ci.quantity,
                unit_price=u_price,
                discount_percentage=0.0,
                item_revenue=l_total,
                item_cost=round(l_total * 0.7, 2),
                profit=round(l_total * 0.3, 2)
            )
            db.add(oi)

            # Deduct stock atomically
            sp.stock_quantity = max(0, sp.stock_quantity - ci.quantity)

            if sp.seller_id not in seller_order_groups:
                seller_order_groups[sp.seller_id] = []
            seller_order_groups[sp.seller_id].append({
                "order_item_id": item_id,
                "product_id": sp.product_id,
                "quantity": ci.quantity,
                "unit_price": u_price
            })

        # 8. Create multi-seller orders
        for s_id, s_items in seller_order_groups.items():
            s_subtotal = sum(Decimal(str(it["unit_price"])) * it["quantity"] for it in s_items)
            so = SellerOrder(
                order_id=new_order_id,
                seller_id=s_id,
                status="Processing",
                subtotal=s_subtotal
            )
            db.add(so)
            db.flush()

            for it in s_items:
                soi = SellerOrderItem(
                    seller_order_id=so.seller_order_id,
                    order_item_id=it["order_item_id"],
                    product_id=it["product_id"],
                    quantity=it["quantity"],
                    unit_price=it["unit_price"]
                )
                db.add(soi)

        # 9. Create Payment record with explicit simulation/pending status
        pay_id = f"PAY-{uuid.uuid4().hex[:7].upper()}"
        payment = Payment(
            payment_id=pay_id,
            order_id=new_order_id,
            payment_date=now.strftime("%Y-%m-%d"),
            payment_method=req.payment_method or "Simulated Payment / Pending Capture",
            payment_status="Pending",
            amount_paid=0.0,
            transaction_fee=0.0,
            refund_amount=0.0
        )
        db.add(payment)

        # 10. Create Shipment record
        shp_id = f"SHP-{uuid.uuid4().hex[:7].upper()}"
        shipment = Shipment(
            shipment_id=shp_id,
            order_id=new_order_id,
            warehouse_city="Bengaluru",
            delivery_city=city,
            shipping_method="Standard",
            delivery_status="Order Placed"
        )
        db.add(shipment)

        # 11. Clear active cart
        db.query(CartItem).filter(CartItem.cart_id == cart.cart_id).delete()
        cart.status = "checked_out"

        # Commit atomic transaction
        db.commit()
        db.refresh(new_order)

    except HTTPException:
        db.rollback()
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Order placement transaction failed: {str(e)}"
        )

    log_audit_action(
        db,
        action="ORDER_PLACED_SAFELY",
        entity_type="order",
        user_id=current_user.user_id,
        entity_id=new_order_id,
        details={
            "final_amount": float(final_total),
            "merchandise_subtotal": float(merchandise_subtotal),
            "shipping_fee": float(shipping_fee),
            "tax_amount": float(tax_amount),
            "items_count": len(resolved_items),
            "idempotency_key": idempotency_key
        }
    )

    return _format_order_detail_response(db, new_order)

def _format_order_detail_response(db: Session, order: Order) -> OrderDetailResponse:
    items = db.query(OrderItem).filter(OrderItem.order_id == order.order_id).all()
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

    shp = db.query(Shipment).filter(Shipment.order_id == order.order_id).first()
    pay = db.query(Payment).filter(Payment.order_id == order.order_id).first()

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
