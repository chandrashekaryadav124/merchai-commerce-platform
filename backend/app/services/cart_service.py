from typing import List, Optional, Tuple
from decimal import Decimal
from sqlalchemy.orm import Session
from fastapi import HTTPException, status
from app.models.cart import Cart, CartItem
from app.models.sellers import Seller, SellerProduct
from app.models.products import Product, ProductImage
from app.schemas.cart import (
    CartItemAdd,
    CartItemUpdate,
    CartItemResponse,
    CartResponse,
    CartMergeRequest
)

def get_or_create_active_cart(db: Session, user_id: str) -> Cart:
    """
    Finds or creates an active shopping cart for the authenticated user.
    """
    cart = db.query(Cart).filter(
        Cart.customer_user_id == user_id,
        Cart.status == "active"
    ).order_by(Cart.cart_id.desc()).first()

    if not cart:
        cart = Cart(
            customer_user_id=user_id,
            status="active"
        )
        db.add(cart)
        db.commit()
        db.refresh(cart)

    return cart

def get_cart_details_service(db: Session, user_id: str) -> CartResponse:
    """
    Retrieves full cart details with live product pricing, stock availability, and calculated subtotals.
    Never relies on client-supplied prices or discounts.
    """
    cart = get_or_create_active_cart(db, user_id)
    items = db.query(CartItem).filter(CartItem.cart_id == cart.cart_id).all()

    item_responses: List[CartItemResponse] = []
    total_subtotal = Decimal("0.00")
    total_count = 0

    for ci in items:
        # Load seller product
        sp = db.query(SellerProduct).filter(SellerProduct.seller_product_id == ci.seller_product_id).first()
        if not sp:
            # Stale record, remove safely
            db.delete(ci)
            continue

        prod = db.query(Product).filter(Product.product_id == sp.product_id).first()
        seller = db.query(Seller).filter(Seller.seller_id == sp.seller_id).first()
        img = db.query(ProductImage).filter(ProductImage.product_id == sp.product_id).first()

        unit_price = Decimal(str(sp.selling_price)) if sp.selling_price is not None else Decimal("0.00")
        line_total = unit_price * ci.quantity
        available_stock = int(sp.stock_quantity or 0)
        is_in_stock = (available_stock >= ci.quantity) and (sp.listing_status == "active")

        # Sync unit price if altered by seller
        if ci.unit_price != sp.selling_price:
            ci.unit_price = sp.selling_price

        item_responses.append(CartItemResponse(
            cart_item_id=ci.cart_item_id,
            seller_product_id=ci.seller_product_id,
            product_id=sp.product_id,
            product_name=prod.product_name if prod else f"Product {sp.product_id}",
            brand=prod.brand if prod else None,
            category=prod.category if prod else None,
            image_url=img.image_path if img else None,
            seller_id=sp.seller_id,
            store_name=seller.store_name if seller else "Official Store",
            unit_price=float(unit_price),
            quantity=ci.quantity,
            line_total=float(line_total),
            stock_quantity=available_stock,
            is_in_stock=is_in_stock,
            listing_status=sp.listing_status or "active"
        ))

        total_subtotal += line_total
        total_count += ci.quantity

    db.commit()

    return CartResponse(
        cart_id=cart.cart_id,
        items=item_responses,
        item_count=total_count,
        subtotal=float(total_subtotal)
    )

def add_item_to_cart_service(db: Session, user_id: str, item_in: CartItemAdd) -> CartResponse:
    """
    Safely adds a product or seller_product to the user's active cart.
    Validates active listing status and available stock.
    """
    cart = get_or_create_active_cart(db, user_id)

    # 1. Resolve SellerProduct
    sp: Optional[SellerProduct] = None
    if item_in.seller_product_id:
        sp = db.query(SellerProduct).filter(
            SellerProduct.seller_product_id == item_in.seller_product_id
        ).first()
    elif item_in.product_id:
        # Prefer active listing with stock
        sp = db.query(SellerProduct).filter(
            SellerProduct.product_id == item_in.product_id,
            SellerProduct.listing_status == "active",
            SellerProduct.stock_quantity > 0
        ).first()
        if not sp:
            sp = db.query(SellerProduct).filter(
                SellerProduct.product_id == item_in.product_id
            ).first()

    if not sp:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Product listing not found in store catalog."
        )

    # 2. Check listing status
    if sp.listing_status != "active":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"This product listing is currently {sp.listing_status} and unavailable for purchase."
        )

    # 3. Check stock availability
    existing_ci = db.query(CartItem).filter(
        CartItem.cart_id == cart.cart_id,
        CartItem.seller_product_id == sp.seller_product_id
    ).first()

    current_qty = existing_ci.quantity if existing_ci else 0
    requested_total = current_qty + item_in.quantity

    available_stock = int(sp.stock_quantity or 0)
    if requested_total > available_stock:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Insufficient inventory. Only {available_stock} item(s) available in stock."
        )

    # 4. Upsert cart item
    if existing_ci:
        existing_ci.quantity = requested_total
        existing_ci.unit_price = sp.selling_price
    else:
        new_ci = CartItem(
            cart_id=cart.cart_id,
            seller_product_id=sp.seller_product_id,
            quantity=item_in.quantity,
            unit_price=sp.selling_price
        )
        db.add(new_ci)

    db.commit()
    return get_cart_details_service(db, user_id)

def update_cart_item_quantity_service(
    db: Session,
    user_id: str,
    cart_item_id: int,
    quantity: int
) -> CartResponse:
    """
    Updates item quantity in active cart. If quantity <= 0, deletes the item.
    Enforces stock validation.
    """
    cart = get_or_create_active_cart(db, user_id)
    ci = db.query(CartItem).filter(
        CartItem.cart_item_id == cart_item_id,
        CartItem.cart_id == cart.cart_id
    ).first()

    if not ci:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Item not found in your shopping cart."
        )

    if quantity <= 0:
        db.delete(ci)
        db.commit()
        return get_cart_details_service(db, user_id)

    # Validate stock
    sp = db.query(SellerProduct).filter(SellerProduct.seller_product_id == ci.seller_product_id).first()
    if sp:
        available_stock = int(sp.stock_quantity or 0)
        if quantity > available_stock:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Insufficient inventory. Only {available_stock} item(s) available."
            )
        ci.unit_price = sp.selling_price

    ci.quantity = quantity
    db.commit()
    return get_cart_details_service(db, user_id)

def remove_cart_item_service(db: Session, user_id: str, cart_item_id: int) -> CartResponse:
    """
    Removes a single item from active cart.
    """
    cart = get_or_create_active_cart(db, user_id)
    ci = db.query(CartItem).filter(
        CartItem.cart_item_id == cart_item_id,
        CartItem.cart_id == cart.cart_id
    ).first()

    if ci:
        db.delete(ci)
        db.commit()

    return get_cart_details_service(db, user_id)

def clear_cart_service(db: Session, user_id: str) -> CartResponse:
    """
    Clears all items from user's active cart.
    """
    cart = get_or_create_active_cart(db, user_id)
    db.query(CartItem).filter(CartItem.cart_id == cart.cart_id).delete()
    db.commit()
    return get_cart_details_service(db, user_id)

def merge_guest_cart_service(db: Session, user_id: str, req: CartMergeRequest) -> CartResponse:
    """
    Safely merges guest items into authenticated cart upon login.
    """
    for item in req.items:
        try:
            add_item_to_cart_service(db, user_id, item)
        except Exception:
            # Skip invalid or out-of-stock items without failing whole merge
            pass

    return get_cart_details_service(db, user_id)
