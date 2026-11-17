import uuid
from datetime import datetime
from typing import List, Optional, Dict
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File
from sqlalchemy.orm import Session
from sqlalchemy import func, desc
from app.db.session import get_db
from app.models.sellers import Seller, SellerProduct
from app.models.products import Product, ProductImage
from app.models.logistics import Shipment, InventoryHistory
from app.models.orders import SellerOrder, SellerOrderItem, Order
from app.models.customer_account import CustomerReview, ReviewText, Payment, OrderReturn
from app.services.storage_service import LocalStorageService
from app.schemas.sellers import (
    SellerResponse,
    SellerProductResponse,
    SellerApplyRequest,
    SellerAnalyticsResponse,
    RevenueChartPoint,
    SellerTopProduct,
    SellerOrderStatusCount,
    SellerCustomerReview,
    SellerFinancialAnalyticsResponse,
    SellerTransactionItem,
    SellerSalesTrendPoint,
    SellerCategoryPerformanceItem,
    SellerPaymentMethodDistributionItem,
    ProductImageItem,
    SellerProductCreateRequest,
    SellerProductUpdateRequest,
    SellerProductStatusUpdateRequest,
    SellerProductDetailResponse,
    ImageUploadResponse,
    InventoryAdjustmentRequest,
    InventoryAdjustmentResponse,
    SellerInventoryItemResponse,
    SellerInventorySummaryResponse,
    InventoryHistoryItemResponse
)
from app.core.deps import get_current_user, RoleChecker, get_current_approved_seller
from app.models.users import AppUser
from app.services.audit_service import log_audit_action

router = APIRouter()

@router.get("", response_model=List[SellerResponse])
def list_sellers(db: Session = Depends(get_db)):
    return db.query(Seller).filter(Seller.approval_status == "approved").all()

from app.core.categories import VALID_STORE_TYPES, DEFAULT_STORE_TYPE, get_permitted_categories

@router.post("/apply", response_model=SellerResponse, status_code=status.HTTP_201_CREATED)
def apply_for_seller_onboarding(
    req: SellerApplyRequest,
    current_user: AppUser = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if not req.store_name or len(req.store_name.strip()) < 2:
        raise HTTPException(status_code=400, detail="Store name must be at least 2 characters long.")

    if req.store_type is not None:
        if not req.store_type.strip() or req.store_type.strip() not in VALID_STORE_TYPES:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid store type '{req.store_type}'. Permitted store types: {VALID_STORE_TYPES}"
            )
        clean_store_type = req.store_type.strip()
    else:
        clean_store_type = DEFAULT_STORE_TYPE

    existing_seller = db.query(Seller).filter(Seller.user_id == current_user.user_id).first()
    if existing_seller:
        if existing_seller.approval_status == "approved":
            raise HTTPException(status_code=400, detail="Storefront already approved for this account.")
        elif existing_seller.approval_status == "pending":
            raise HTTPException(status_code=400, detail="Seller onboarding application is already pending administrator review.")
        elif existing_seller.approval_status == "suspended":
            raise HTTPException(status_code=400, detail="Seller storefront is suspended. Please contact support or appeal to administrator.")
        elif existing_seller.approval_status == "rejected":
            raise HTTPException(status_code=400, detail="Seller application was previously rejected. Please contact administrator support.")

    desc_parts = []
    if req.business_description and req.business_description.strip():
        desc_parts.append(req.business_description.strip())
    if req.contact_phone and req.contact_phone.strip():
        desc_parts.append(f"Phone: {req.contact_phone.strip()}")
    if req.business_address and req.business_address.strip():
        desc_parts.append(f"Location: {req.business_address.strip()}")
    full_description = " | ".join(desc_parts) if desc_parts else "Merchant Storefront Application"

    new_seller_id = f"SEL-{uuid.uuid4().hex[:6].upper()}"
    new_seller = Seller(
        seller_id=new_seller_id,
        user_id=current_user.user_id,
        store_name=req.store_name.strip(),
        store_type=clean_store_type,
        business_description=full_description,
        approval_status="pending",  # Always pending; administrative approval required
        contact_email=req.contact_email or current_user.email
    )

    db.add(new_seller)
    db.commit()
    db.refresh(new_seller)

    log_audit_action(
        db,
        action="SELLER_ONBOARDING_APPLICATION_SUBMITTED",
        entity_type="seller",
        user_id=current_user.user_id,
        entity_id=new_seller_id,
        details={"store_name": new_seller.store_name, "store_type": clean_store_type, "status": "pending"}
    )

    return new_seller

@router.get("/me", response_model=SellerResponse)
def get_my_seller_profile(
    current_user: AppUser = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    seller = db.query(Seller).filter(Seller.user_id == current_user.user_id).first()
    if not seller:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No registered seller storefront associated with this account."
        )
    return seller

@router.get("/me/stores", response_model=List[SellerResponse])
def get_my_seller_stores(
    current_user: AppUser = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    stores = db.query(Seller).filter(Seller.user_id == current_user.user_id).all()
    return stores

@router.get("/me/products", response_model=List[SellerProductResponse])
def get_my_seller_products(
    include_removed: bool = False,
    approved_seller: Seller = Depends(get_current_approved_seller),
    db: Session = Depends(get_db)
):
    query = db.query(SellerProduct).filter(SellerProduct.seller_id == approved_seller.seller_id)
    if not include_removed:
        query = query.filter(SellerProduct.listing_status != "removed")
    
    seller_products = query.order_by(SellerProduct.created_at.desc()).all()
    if not seller_products:
        return []

    product_ids = [sp.product_id for sp in seller_products]
    prods = db.query(Product).filter(Product.product_id.in_(product_ids)).all()
    prod_map = {p.product_id: p for p in prods}

    imgs = db.query(ProductImage).filter(ProductImage.product_id.in_(product_ids)).all()
    img_map = {}
    for img in imgs:
        if img.product_id and (img.product_id not in img_map or img.image_type == "primary"):
            img_map[img.product_id] = img.image_path

    results = []
    for sp in seller_products:
        p = prod_map.get(sp.product_id)
        results.append(
            SellerProductResponse(
                seller_product_id=sp.seller_product_id,
                seller_id=sp.seller_id,
                product_id=sp.product_id,
                sku=sp.sku or f"SKU-{sp.product_id}",
                selling_price=float(sp.selling_price),
                discount_price=float(sp.discount_price) if sp.discount_price is not None else None,
                stock_quantity=sp.stock_quantity or 0,
                low_stock_threshold=sp.low_stock_threshold or 10,
                listing_status=sp.listing_status,
                product_name=p.product_name if p else None,
                description=p.description if p else None,
                category=p.category if p else None,
                subcategory=p.subcategory if p else None,
                brand=p.brand if p else None,
                image_url=img_map.get(sp.product_id)
            )
        )
    return results

@router.post("/me/products/upload-images", response_model=List[ImageUploadResponse])
async def upload_seller_product_images(
    files: List[UploadFile] = File(...),
    approved_seller: Seller = Depends(get_current_approved_seller),
    db: Session = Depends(get_db)
):
    if not files:
        raise HTTPException(status_code=400, detail="No files provided for upload.")
    if len(files) > 5:
        raise HTTPException(status_code=400, detail="A maximum of 5 images can be uploaded simultaneously.")

    uploaded_items = []
    for f in files:
        filename, public_url = await LocalStorageService.save_product_image(f)
        uploaded_items.append(ImageUploadResponse(
            filename=filename,
            url=public_url,
            success=True
        ))

    log_audit_action(
        db,
        action="SELLER_PRODUCT_IMAGES_UPLOADED",
        entity_type="seller_media",
        user_id=approved_seller.user_id,
        entity_id=approved_seller.seller_id,
        details={"file_count": len(uploaded_items)}
    )
    return uploaded_items

@router.post("/me/products", response_model=SellerProductDetailResponse, status_code=status.HTTP_201_CREATED)
def create_seller_product(
    req: SellerProductCreateRequest,
    approved_seller: Seller = Depends(get_current_approved_seller),
    db: Session = Depends(get_db)
):
    # 1. Category validation against store type
    store_type = approved_seller.store_type or DEFAULT_STORE_TYPE
    permitted_categories = get_permitted_categories(store_type)
    if req.category not in permitted_categories:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Category '{req.category}' is not permitted for your store type '{store_type}'. Permitted categories: {permitted_categories}"
        )

    # 2. Generate unique product ID
    new_product_id = f"PRD-{uuid.uuid4().hex[:8].upper()}"

    # 3. Create core Product
    product = Product(
        product_id=new_product_id,
        product_name=req.product_name.strip(),
        description=req.description.strip() if req.description else None,
        category=req.category.strip(),
        subcategory=req.subcategory.strip() if req.subcategory else "General",
        brand=req.brand.strip() if req.brand else (approved_seller.store_name or "Generic"),
        price=float(req.selling_price),
        cost_price=round(float(req.selling_price) * 0.7, 2),
        stock_quantity=req.stock_quantity,
        rating_average=0.0,
        rating_count=0
    )
    db.add(product)

    # 4. Generate SKU if absent
    sku = req.sku.strip() if req.sku and req.sku.strip() else f"SKU-{new_product_id}"

    # 5. Create SellerProduct
    seller_product = SellerProduct(
        seller_id=approved_seller.seller_id,
        product_id=new_product_id,
        sku=sku,
        selling_price=req.selling_price,
        discount_price=req.discount_price,
        stock_quantity=req.stock_quantity,
        low_stock_threshold=req.low_stock_threshold or 10,
        listing_status=req.listing_status or "active",
        assigned_by=approved_seller.user_id
    )
    db.add(seller_product)
    db.flush()

    # 6. Save ProductImages
    images_response = []
    primary_url = None
    if req.images:
        for idx, img_url in enumerate(req.images):
            if not img_url:
                continue
            img_id = f"IMG-{uuid.uuid4().hex[:8].upper()}"
            is_primary = (idx == (req.primary_image_index or 0))
            if is_primary:
                primary_url = img_url
            img_type = "primary" if is_primary else "gallery"

            p_img = ProductImage(
                image_id=img_id,
                product_id=new_product_id,
                image_path=img_url,
                image_type=img_type,
                category=req.category,
                subcategory=req.subcategory,
                brand=req.brand,
                source_type="seller_upload"
            )
            db.add(p_img)
            images_response.append(ProductImageItem(
                image_id=img_id,
                image_url=img_url,
                image_type=img_type,
                is_primary=is_primary
            ))

    if not primary_url and images_response:
        primary_url = images_response[0].image_url

    # 7. Record initial InventoryHistory snapshot
    snapshot_id = f"INV-INIT-{uuid.uuid4().hex[:8].upper()}"
    threshold = req.low_stock_threshold or 10
    inv_status = "IN_STOCK" if req.stock_quantity > threshold else ("LOW_STOCK" if req.stock_quantity > 0 else "OUT_OF_STOCK")
    inv_history = InventoryHistory(
        inventory_snapshot_id=snapshot_id,
        product_id=new_product_id,
        seller_id=approved_seller.seller_id,
        stock_quantity=req.stock_quantity,
        reserved_quantity=0,
        available_quantity=req.stock_quantity,
        reorder_level=threshold,
        inventory_status=inv_status,
        source_type="seller_creation",
        previous_quantity=0,
        quantity_change=req.stock_quantity,
        new_quantity=req.stock_quantity,
        adjustment_type="restock",
        adjustment_reason="Initial product catalog listing creation",
        user_id=approved_seller.user_id
    )
    db.add(inv_history)

    # 8. Audit log
    log_audit_action(
        db,
        action="SELLER_PRODUCT_CREATED",
        entity_type="seller_product",
        user_id=approved_seller.user_id,
        entity_id=new_product_id,
        details={
            "seller_id": approved_seller.seller_id,
            "sku": sku,
            "name": req.product_name,
            "price": req.selling_price,
            "stock": req.stock_quantity
        }
    )

    db.commit()

    return SellerProductDetailResponse(
        seller_product_id=seller_product.seller_product_id,
        seller_id=seller_product.seller_id,
        product_id=new_product_id,
        sku=sku,
        product_name=product.product_name,
        description=product.description,
        category=product.category,
        subcategory=product.subcategory,
        brand=product.brand,
        selling_price=float(seller_product.selling_price),
        discount_price=float(seller_product.discount_price) if seller_product.discount_price is not None else None,
        stock_quantity=seller_product.stock_quantity,
        reserved_quantity=0,
        available_to_sell=seller_product.stock_quantity,
        low_stock_threshold=seller_product.low_stock_threshold or 10,
        listing_status=seller_product.listing_status,
        created_at=seller_product.created_at,
        images=images_response,
        primary_image_url=primary_url,
        units_sold=0,
        total_revenue=0.0,
        rating_average=0.0,
        rating_count=0
    )

@router.get("/me/inventory/history", response_model=List[InventoryHistoryItemResponse])
def get_seller_inventory_history(
    limit: int = 50,
    product_id: Optional[str] = None,
    approved_seller: Seller = Depends(get_current_approved_seller),
    db: Session = Depends(get_db)
):
    query = db.query(InventoryHistory).filter(InventoryHistory.seller_id == approved_seller.seller_id)
    if product_id:
        query = query.filter(InventoryHistory.product_id == product_id)

    records = query.order_by(desc(InventoryHistory.created_at)).limit(limit).all()
    if not records:
        return []

    prod_ids = list({r.product_id for r in records if r.product_id})
    prods = db.query(Product).filter(Product.product_id.in_(prod_ids)).all()
    prod_map = {p.product_id: p.product_name for p in prods}

    sps = db.query(SellerProduct).filter(
        SellerProduct.product_id.in_(prod_ids),
        SellerProduct.seller_id == approved_seller.seller_id
    ).all()
    sku_map = {sp.product_id: sp.sku for sp in sps}

    results = []
    for r in records:
        results.append(InventoryHistoryItemResponse(
            inventory_snapshot_id=r.inventory_snapshot_id,
            product_id=r.product_id or "",
            product_name=prod_map.get(r.product_id, f"Product {r.product_id}"),
            sku=sku_map.get(r.product_id, f"SKU-{r.product_id}"),
            previous_quantity=r.previous_quantity,
            quantity_change=r.quantity_change,
            new_quantity=r.new_quantity,
            adjustment_type=r.adjustment_type,
            adjustment_reason=r.adjustment_reason,
            user_id=r.user_id,
            order_reference=r.order_reference,
            created_at=str(r.created_at) if r.created_at else None
        ))
    return results

@router.get("/me/inventory", response_model=SellerInventorySummaryResponse)
def get_seller_inventory(
    status_filter: Optional[str] = None,
    approved_seller: Seller = Depends(get_current_approved_seller),
    db: Session = Depends(get_db)
):
    seller_products = db.query(SellerProduct).filter(
        SellerProduct.seller_id == approved_seller.seller_id,
        SellerProduct.listing_status != "removed"
    ).all()

    if not seller_products:
        return SellerInventorySummaryResponse(
            total_skus=0,
            total_units=0,
            healthy_count=0,
            low_stock_count=0,
            out_of_stock_count=0,
            items=[]
        )

    product_ids = [sp.product_id for sp in seller_products]
    prods = db.query(Product).filter(Product.product_id.in_(product_ids)).all()
    prod_map = {p.product_id: p for p in prods}

    imgs = db.query(ProductImage).filter(ProductImage.product_id.in_(product_ids)).all()
    img_map = {}
    for img in imgs:
        if img.product_id and (img.product_id not in img_map or img.image_type == "primary"):
            img_map[img.product_id] = img.image_path

    # Compute reserved counts from open orders
    reserved_counts = (
        db.query(
            SellerOrderItem.product_id,
            func.sum(SellerOrderItem.quantity)
        )
        .join(SellerOrder, SellerOrderItem.seller_order_id == SellerOrder.seller_order_id)
        .filter(
            SellerOrder.seller_id == approved_seller.seller_id,
            SellerOrderItem.product_id.in_(product_ids),
            SellerOrder.status.in_(["pending", "processing", "placed"])
        )
        .group_by(SellerOrderItem.product_id)
        .all()
    )
    reserved_map = {r[0]: int(r[1] or 0) for r in reserved_counts}

    items = []
    total_units = 0
    healthy_count = 0
    low_stock_count = 0
    out_of_stock_count = 0

    for sp in seller_products:
        p = prod_map.get(sp.product_id)
        stock = sp.stock_quantity or 0
        total_units += stock
        threshold = sp.low_stock_threshold or 10
        reserved = reserved_map.get(sp.product_id, 0)
        available = max(0, stock - reserved)

        if stock <= 0:
            health = "OUT_OF_STOCK"
            out_of_stock_count += 1
        elif stock <= threshold:
            health = "LOW_STOCK"
            low_stock_count += 1
        else:
            health = "HEALTHY"
            healthy_count += 1

        if status_filter and status_filter.upper() != "ALL" and health != status_filter.upper():
            continue

        items.append(SellerInventoryItemResponse(
            seller_product_id=sp.seller_product_id,
            product_id=sp.product_id,
            sku=sp.sku or f"SKU-{sp.product_id}",
            product_name=p.product_name if p else f"Product {sp.product_id}",
            category=p.category if p else None,
            stock_quantity=stock,
            reserved_quantity=reserved,
            available_to_sell=available,
            low_stock_threshold=threshold,
            listing_status=sp.listing_status,
            health_status=health,
            selling_price=float(sp.selling_price),
            discount_price=float(sp.discount_price) if sp.discount_price is not None else None,
            image_url=img_map.get(sp.product_id)
        ))

    return SellerInventorySummaryResponse(
        total_skus=len(seller_products),
        total_units=total_units,
        healthy_count=healthy_count,
        low_stock_count=low_stock_count,
        out_of_stock_count=out_of_stock_count,
        items=items
    )

@router.post("/me/inventory/{product_id}/adjust", response_model=InventoryAdjustmentResponse)
def adjust_seller_inventory(
    product_id: str,
    req: InventoryAdjustmentRequest,
    approved_seller: Seller = Depends(get_current_approved_seller),
    db: Session = Depends(get_db)
):
    # Lock row with SELECT FOR UPDATE to prevent concurrency race conditions
    sp = db.query(SellerProduct).filter(
        SellerProduct.product_id == product_id,
        SellerProduct.seller_id == approved_seller.seller_id
    ).with_for_update().first()

    if not sp:
        raise HTTPException(status_code=404, detail="Product not found in your seller catalog.")

    product = db.query(Product).filter(Product.product_id == product_id).with_for_update().first()
    if not product:
        raise HTTPException(status_code=404, detail="Core product not found.")

    previous_qty = sp.stock_quantity or 0
    new_qty = previous_qty + req.quantity_change

    # Enforce non-negative inventory rule
    if new_qty < 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Adjustment rejected: Inventory cannot be reduced below zero. Current stock is {previous_qty}, attempted reduction is {abs(req.quantity_change)}."
        )

    valid_types = {"restock", "damage", "correction", "return", "audit_reconciliation"}
    adj_type = req.adjustment_type.lower()
    if adj_type not in valid_types:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid adjustment type '{req.adjustment_type}'. Permitted types: {sorted(list(valid_types))}"
        )

    # Apply updated stock
    sp.stock_quantity = new_qty
    product.stock_quantity = new_qty

    # Record in inventory_history
    snapshot_id = f"INV-ADJ-{uuid.uuid4().hex[:8].upper()}"
    threshold = sp.low_stock_threshold or 10
    inv_status = "IN_STOCK" if new_qty > threshold else ("LOW_STOCK" if new_qty > 0 else "OUT_OF_STOCK")

    inv_entry = InventoryHistory(
        inventory_snapshot_id=snapshot_id,
        product_id=product_id,
        seller_id=approved_seller.seller_id,
        stock_quantity=new_qty,
        reserved_quantity=0,
        available_quantity=new_qty,
        reorder_level=threshold,
        inventory_status=inv_status,
        source_type="seller_adjustment",
        previous_quantity=previous_qty,
        quantity_change=req.quantity_change,
        new_quantity=new_qty,
        adjustment_type=adj_type,
        adjustment_reason=req.adjustment_reason.strip(),
        user_id=approved_seller.user_id,
        order_reference=req.order_reference
    )
    db.add(inv_entry)

    log_audit_action(
        db,
        action="SELLER_INVENTORY_ADJUSTED",
        entity_type="inventory",
        user_id=approved_seller.user_id,
        entity_id=product_id,
        details={
            "adjustment_type": adj_type,
            "previous_quantity": previous_qty,
            "quantity_change": req.quantity_change,
            "new_quantity": new_qty,
            "reason": req.adjustment_reason
        }
    )

    db.commit()

    return InventoryAdjustmentResponse(
        snapshot_id=snapshot_id,
        product_id=product_id,
        sku=sp.sku or f"SKU-{product_id}",
        product_name=product.product_name,
        previous_quantity=previous_qty,
        quantity_change=req.quantity_change,
        new_quantity=new_qty,
        adjustment_type=adj_type,
        adjustment_reason=req.adjustment_reason,
        created_at=datetime.utcnow().isoformat()
    )

@router.get("/me/products/{product_id}/performance")
def get_seller_product_performance(
    product_id: str,
    approved_seller: Seller = Depends(get_current_approved_seller),
    db: Session = Depends(get_db)
):
    sp = db.query(SellerProduct).filter(
        SellerProduct.product_id == product_id,
        SellerProduct.seller_id == approved_seller.seller_id
    ).first()
    if not sp:
        raise HTTPException(status_code=404, detail="Product not found in your seller catalog.")

    product = db.query(Product).filter(Product.product_id == product_id).first()

    sales = (
        db.query(
            func.coalesce(func.sum(SellerOrderItem.quantity), 0),
            func.coalesce(func.sum(SellerOrderItem.quantity * SellerOrderItem.unit_price), 0.0)
        )
        .join(SellerOrder, SellerOrderItem.seller_order_id == SellerOrder.seller_order_id)
        .filter(
            SellerOrder.seller_id == approved_seller.seller_id,
            SellerOrderItem.product_id == product_id,
            SellerOrder.status.notin_(["cancelled", "returned", "failed"])
        ).first()
    )
    units_sold = int(sales[0]) if sales else 0
    total_rev = float(sales[1]) if sales else 0.0

    pending_orders = (
        db.query(func.count(SellerOrder.seller_order_id))
        .join(SellerOrderItem, SellerOrderItem.seller_order_id == SellerOrder.seller_order_id)
        .filter(
            SellerOrder.seller_id == approved_seller.seller_id,
            SellerOrderItem.product_id == product_id,
            SellerOrder.status.in_(["pending", "processing", "placed"])
        ).scalar() or 0
    )

    returns_count = (
        db.query(func.count(OrderReturn.return_id))
        .filter(OrderReturn.product_id == product_id)
        .scalar() or 0
    )

    return {
        "product_id": product_id,
        "product_name": product.product_name if product else f"Product {product_id}",
        "sku": sp.sku or f"SKU-{product_id}",
        "stock_quantity": sp.stock_quantity or 0,
        "units_sold": units_sold,
        "total_revenue": round(total_rev, 2),
        "pending_orders": int(pending_orders),
        "return_count": int(returns_count),
        "rating_average": float(product.rating_average or 0.0) if product else 0.0,
        "rating_count": int(product.rating_count or 0) if product else 0
    }

@router.get("/me/products/{product_id}", response_model=SellerProductDetailResponse)
def get_seller_product_detail(
    product_id: str,
    approved_seller: Seller = Depends(get_current_approved_seller),
    db: Session = Depends(get_db)
):
    sp = db.query(SellerProduct).filter(
        SellerProduct.product_id == product_id,
        SellerProduct.seller_id == approved_seller.seller_id
    ).first()
    if not sp:
        raise HTTPException(status_code=404, detail="Product not found in your seller catalog.")

    product = db.query(Product).filter(Product.product_id == product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product core record not found.")

    p_imgs = db.query(ProductImage).filter(ProductImage.product_id == product_id).all()
    images_list = []
    primary_url = None
    for img in p_imgs:
        is_prim = (img.image_type == "primary")
        if is_prim and not primary_url:
            primary_url = img.image_path
        images_list.append(ProductImageItem(
            image_id=img.image_id,
            image_url=img.image_path or "",
            image_type=img.image_type or "gallery",
            is_primary=is_prim
        ))

    if not primary_url and images_list:
        primary_url = images_list[0].image_url

    reserved_qty = (
        db.query(func.coalesce(func.sum(SellerOrderItem.quantity), 0))
        .join(SellerOrder, SellerOrderItem.seller_order_id == SellerOrder.seller_order_id)
        .filter(
            SellerOrder.seller_id == approved_seller.seller_id,
            SellerOrderItem.product_id == product_id,
            SellerOrder.status.in_(["pending", "processing", "placed"])
        ).scalar() or 0
    )

    sales_data = (
        db.query(
            func.coalesce(func.sum(SellerOrderItem.quantity), 0),
            func.coalesce(func.sum(SellerOrderItem.quantity * SellerOrderItem.unit_price), 0.0)
        )
        .join(SellerOrder, SellerOrderItem.seller_order_id == SellerOrder.seller_order_id)
        .filter(
            SellerOrder.seller_id == approved_seller.seller_id,
            SellerOrderItem.product_id == product_id,
            SellerOrder.status.notin_(["cancelled", "returned", "failed"])
        ).first()
    )
    units_sold = int(sales_data[0]) if sales_data else 0
    total_rev = float(sales_data[1]) if sales_data else 0.0

    return SellerProductDetailResponse(
        seller_product_id=sp.seller_product_id,
        seller_id=sp.seller_id,
        product_id=sp.product_id,
        sku=sp.sku or f"SKU-{sp.product_id}",
        product_name=product.product_name,
        description=product.description,
        category=product.category,
        subcategory=product.subcategory,
        brand=product.brand,
        selling_price=float(sp.selling_price),
        discount_price=float(sp.discount_price) if sp.discount_price is not None else None,
        stock_quantity=sp.stock_quantity or 0,
        reserved_quantity=int(reserved_qty),
        available_to_sell=max(0, (sp.stock_quantity or 0) - int(reserved_qty)),
        low_stock_threshold=sp.low_stock_threshold or 10,
        listing_status=sp.listing_status,
        created_at=sp.created_at,
        images=images_list,
        primary_image_url=primary_url,
        units_sold=units_sold,
        total_revenue=round(total_rev, 2),
        rating_average=float(product.rating_average or 0.0),
        rating_count=int(product.rating_count or 0)
    )

@router.put("/me/products/{product_id}", response_model=SellerProductDetailResponse)
def update_seller_product(
    product_id: str,
    req: SellerProductUpdateRequest,
    approved_seller: Seller = Depends(get_current_approved_seller),
    db: Session = Depends(get_db)
):
    sp = db.query(SellerProduct).filter(
        SellerProduct.product_id == product_id,
        SellerProduct.seller_id == approved_seller.seller_id
    ).with_for_update().first()

    if not sp:
        raise HTTPException(status_code=404, detail="Product not found in your seller catalog.")

    product = db.query(Product).filter(Product.product_id == product_id).with_for_update().first()
    if not product:
        raise HTTPException(status_code=404, detail="Product core record not found.")

    if req.category is not None and req.category != product.category:
        store_type = approved_seller.store_type or DEFAULT_STORE_TYPE
        permitted_categories = get_permitted_categories(store_type)
        if req.category not in permitted_categories:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Category '{req.category}' is not permitted for your store type '{store_type}'."
            )
        product.category = req.category.strip()

    if req.product_name is not None:
        product.product_name = req.product_name.strip()
    if req.description is not None:
        product.description = req.description.strip()
    if req.subcategory is not None:
        product.subcategory = req.subcategory.strip()
    if req.brand is not None:
        product.brand = req.brand.strip()

    if req.selling_price is not None:
        sp.selling_price = req.selling_price
        product.price = float(req.selling_price)
    if req.discount_price is not None:
        sp.discount_price = req.discount_price
    if req.sku is not None:
        sp.sku = req.sku.strip()
    if req.low_stock_threshold is not None:
        sp.low_stock_threshold = req.low_stock_threshold
    if req.listing_status is not None:
        sp.listing_status = req.listing_status

    if req.stock_quantity is not None and req.stock_quantity != sp.stock_quantity:
        if req.stock_quantity < 0:
            raise HTTPException(status_code=400, detail="Stock quantity cannot be negative.")
        diff = req.stock_quantity - sp.stock_quantity
        old_qty = sp.stock_quantity
        sp.stock_quantity = req.stock_quantity
        product.stock_quantity = req.stock_quantity

        snapshot_id = f"INV-EDIT-{uuid.uuid4().hex[:8].upper()}"
        inv_history = InventoryHistory(
            inventory_snapshot_id=snapshot_id,
            product_id=product_id,
            seller_id=approved_seller.seller_id,
            stock_quantity=req.stock_quantity,
            reserved_quantity=0,
            available_quantity=req.stock_quantity,
            reorder_level=sp.low_stock_threshold or 10,
            inventory_status="IN_STOCK" if req.stock_quantity > (sp.low_stock_threshold or 10) else ("LOW_STOCK" if req.stock_quantity > 0 else "OUT_OF_STOCK"),
            source_type="seller_edit",
            previous_quantity=old_qty,
            quantity_change=diff,
            new_quantity=req.stock_quantity,
            adjustment_type="correction",
            adjustment_reason="Direct catalog inventory edit",
            user_id=approved_seller.user_id
        )
        db.add(inv_history)

    if req.images is not None:
        db.query(ProductImage).filter(ProductImage.product_id == product_id).delete(synchronize_session=False)
        for idx, img_url in enumerate(req.images):
            if not img_url:
                continue
            is_prim = (idx == (req.primary_image_index or 0))
            img_type = "primary" if is_prim else "gallery"
            new_p_img = ProductImage(
                image_id=f"IMG-{uuid.uuid4().hex[:8].upper()}",
                product_id=product_id,
                image_path=img_url,
                image_type=img_type,
                category=product.category,
                subcategory=product.subcategory,
                brand=product.brand,
                source_type="seller_upload"
            )
            db.add(new_p_img)

    log_audit_action(
        db,
        action="SELLER_PRODUCT_UPDATED",
        entity_type="seller_product",
        user_id=approved_seller.user_id,
        entity_id=product_id,
        details={"name": product.product_name, "price": float(sp.selling_price), "stock": sp.stock_quantity}
    )

    db.commit()

    return get_seller_product_detail(product_id=product_id, approved_seller=approved_seller, db=db)

@router.patch("/me/products/{product_id}/status")
def update_seller_product_status(
    product_id: str,
    req: SellerProductStatusUpdateRequest,
    approved_seller: Seller = Depends(get_current_approved_seller),
    db: Session = Depends(get_db)
):
    sp = db.query(SellerProduct).filter(
        SellerProduct.product_id == product_id,
        SellerProduct.seller_id == approved_seller.seller_id
    ).first()
    if not sp:
        raise HTTPException(status_code=404, detail="Product not found in your seller catalog.")

    old_status = sp.listing_status
    sp.listing_status = req.listing_status

    log_audit_action(
        db,
        action="SELLER_PRODUCT_STATUS_CHANGED",
        entity_type="seller_product",
        user_id=approved_seller.user_id,
        entity_id=product_id,
        details={"old_status": old_status, "new_status": req.listing_status}
    )

    db.commit()
    return {"product_id": product_id, "listing_status": req.listing_status, "success": True}

@router.delete("/me/products/{product_id}")
def archive_seller_product(
    product_id: str,
    approved_seller: Seller = Depends(get_current_approved_seller),
    db: Session = Depends(get_db)
):
    sp = db.query(SellerProduct).filter(
        SellerProduct.product_id == product_id,
        SellerProduct.seller_id == approved_seller.seller_id
    ).first()
    if not sp:
        raise HTTPException(status_code=404, detail="Product not found in your seller catalog.")

    # Soft-delete preserves referential integrity with cart_items and historical orders
    sp.listing_status = "removed"
    old_qty = sp.stock_quantity
    sp.stock_quantity = 0

    snapshot_id = f"INV-DEL-{uuid.uuid4().hex[:8].upper()}"
    inv_history = InventoryHistory(
        inventory_snapshot_id=snapshot_id,
        product_id=product_id,
        seller_id=approved_seller.seller_id,
        stock_quantity=0,
        reserved_quantity=0,
        available_quantity=0,
        reorder_level=0,
        inventory_status="OUT_OF_STOCK",
        source_type="seller_removal",
        previous_quantity=old_qty,
        quantity_change=-old_qty,
        new_quantity=0,
        adjustment_type="correction",
        adjustment_reason="Product listing removed / archived by seller",
        user_id=approved_seller.user_id
    )
    db.add(inv_history)

    log_audit_action(
        db,
        action="SELLER_PRODUCT_ARCHIVED",
        entity_type="seller_product",
        user_id=approved_seller.user_id,
        entity_id=product_id,
        details={"previous_stock": old_qty}
    )

    db.commit()
    return {
        "product_id": product_id,
        "action": "archived",
        "listing_status": "removed",
        "message": "Product successfully removed from active storefront catalog."
    }


@router.get("/me/permitted-categories", response_model=List[str])
def get_my_permitted_categories(
    current_user: AppUser = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    seller = db.query(Seller).filter(Seller.user_id == current_user.user_id).first()
    store_type = seller.store_type if seller and seller.store_type else DEFAULT_STORE_TYPE
    return get_permitted_categories(store_type)

@router.get("/categories", response_model=Dict[str, List[str]])
def get_all_store_type_categories():
    from app.core.categories import STORE_TYPE_CATEGORIES
    return STORE_TYPE_CATEGORIES



@router.get("/me/analytics", response_model=SellerAnalyticsResponse)
def get_my_seller_analytics(
    current_user: AppUser = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    seller = db.query(Seller).filter(Seller.user_id == current_user.user_id).first()
    if not seller:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No registered seller storefront associated with this account."
        )

    # 1. Product count and inventory status breakdown
    seller_products = db.query(SellerProduct).filter(SellerProduct.seller_id == seller.seller_id).all()
    total_products = len(seller_products)
    active_products = sum(1 for p in seller_products if p.listing_status == "active")
    low_stock_products = sum(1 for p in seller_products if 0 < (p.stock_quantity or 0) <= 10)
    out_of_stock_products = sum(1 for p in seller_products if (p.stock_quantity or 0) == 0)

    # 2. Orders & Sales metrics
    seller_orders = db.query(SellerOrder).filter(SellerOrder.seller_id == seller.seller_id).all()
    total_orders = len(seller_orders)

    valid_orders = [
        o for o in seller_orders
        if o.status and o.status.lower() not in ["cancelled", "returned", "failed"]
    ]
    total_sales = sum(float(o.subtotal or 0.0) for o in valid_orders)

    completed_orders = [
        o for o in seller_orders
        if o.status and o.status.lower() in ["delivered", "completed"]
    ]
    pending_orders = [
        o for o in seller_orders
        if o.status and o.status.lower() in ["pending", "processing", "shipped"]
    ]

    # 3. Fulfillment Rate
    if total_orders == 0:
        fulfillment_rate = None
        fulfillment_rate_display = "N/A"
    else:
        fulfillment_rate = round((len(completed_orders) / total_orders) * 100.0, 1)
        fulfillment_rate_display = f"{fulfillment_rate}%"

    # 4. Authentic Store Rating & Review count from customer_reviews table
    seller_product_ids = [p.product_id for p in seller_products if p.product_id]
    if seller_product_ids:
        rev_stats = db.query(
            func.avg(CustomerReview.rating).label("avg_rating"),
            func.count(CustomerReview.review_id).label("total_reviews")
        ).filter(CustomerReview.product_id.in_(seller_product_ids)).first()

        if rev_stats and rev_stats.avg_rating is not None and rev_stats.total_reviews:
            store_rating = round(float(rev_stats.avg_rating), 1)
            total_reviews_count = int(rev_stats.total_reviews)
        else:
            store_rating = None
            total_reviews_count = 0
    else:
        store_rating = None
        total_reviews_count = 0

    # 5. Real Chronological Revenue Chart Data from actual orders
    if total_orders == 0 or len(valid_orders) == 0:
        chart_data = []
    else:
        date_rev_map = {}
        for o in valid_orders:
            d_str = o.created_at.strftime("%Y-%m-%d") if o.created_at else "Recent"
            if d_str not in date_rev_map:
                date_rev_map[d_str] = {"revenue": 0.0, "order_count": 0}
            date_rev_map[d_str]["revenue"] += float(o.subtotal or 0.0)
            date_rev_map[d_str]["order_count"] += 1

        chart_data = [
            RevenueChartPoint(day=d, revenue=round(info["revenue"], 2), order_count=info["order_count"])
            for d, info in sorted(date_rev_map.items())[-14:]
        ]

    return SellerAnalyticsResponse(
        seller_id=seller.seller_id,
        store_name=seller.store_name,
        store_type=seller.store_type or DEFAULT_STORE_TYPE,
        total_sales=round(total_sales, 2),
        monthly_gross_sales=round(total_sales, 2),
        total_orders=total_orders,
        completed_orders=len(completed_orders),
        pending_orders=len(pending_orders),
        total_products=total_products,
        inventory_items_count=total_products,
        active_products=active_products,
        low_stock_products=low_stock_products,
        out_of_stock_products=out_of_stock_products,
        fulfillment_rate=fulfillment_rate,
        fulfillment_rate_display=fulfillment_rate_display,
        store_rating=store_rating,
        total_reviews_count=total_reviews_count,
        revenue_chart=chart_data
    )

@router.get("/me/financial-analytics", response_model=SellerFinancialAnalyticsResponse)
def get_my_seller_financial_analytics(
    current_user: AppUser = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    seller = db.query(Seller).filter(Seller.user_id == current_user.user_id).first()
    if not seller:
        raise HTTPException(status_code=404, detail="Seller storefront not found.")

    seller_orders = db.query(SellerOrder).filter(SellerOrder.seller_id == seller.seller_id).all()
    total_orders = len(seller_orders)

    # Products owned by seller
    seller_prods = db.query(SellerProduct).filter(SellerProduct.seller_id == seller.seller_id).all()
    seller_product_ids = [p.product_id for p in seller_prods if p.product_id]
    active_products = sum(1 for p in seller_prods if p.listing_status == "active")
    low_stock_products = sum(1 for p in seller_prods if 0 < (p.stock_quantity or 0) <= 10)

    delivered_count = sum(1 for o in seller_orders if (o.status or "").lower() in ["delivered", "completed"])
    processing_count = sum(1 for o in seller_orders if (o.status or "").lower() in ["pending", "confirmed", "processing", "shipped"])
    cancelled_count = sum(1 for o in seller_orders if (o.status or "").lower() in ["cancelled", "failed"])

    valid_orders = [o for o in seller_orders if (o.status or "").lower() not in ["cancelled"]]
    gross_sales = sum(float(o.subtotal or 0.0) for o in valid_orders)

    allocated_captured = 0.0
    allocated_pending = 0.0
    allocated_unpaid = 0.0
    allocated_refunds = 0.0
    paid_orders_count = 0
    pending_orders_count = 0

    for s_ord in valid_orders:
        s_sub = float(s_ord.subtotal or 0.0)
        parent_order = db.query(Order).filter(Order.order_id == s_ord.order_id).first()
        parent_subtotal = float(parent_order.subtotal or 0.0) if parent_order else s_sub
        alloc_ratio = min(1.0, max(0.0, s_sub / parent_subtotal)) if parent_subtotal > 0 else 1.0

        payments = db.query(Payment).filter(Payment.order_id == s_ord.order_id).all()
        if payments:
            order_had_successful_payment = False
            order_had_pending_payment = False
            for p in payments:
                p_status = (p.payment_status or "").strip().lower()
                amt_paid = float(p.amount_paid or 0.0)
                ref_amt = float(p.refund_amount or 0.0)

                if p_status in ["success", "paid", "completed"]:
                    allocated_captured += (amt_paid if amt_paid > 0 else s_sub) * alloc_ratio
                    order_had_successful_payment = True
                elif p_status in ["pending", "processing", "in_progress", "simulated payment / pending capture"]:
                    pending_val = amt_paid if amt_paid > 0 else s_sub
                    allocated_pending += pending_val * alloc_ratio
                    order_had_pending_payment = True
                elif p_status in ["failed", "declined"]:
                    failed_val = amt_paid if amt_paid > 0 else s_sub
                    allocated_unpaid += failed_val * alloc_ratio

                if ref_amt > 0:
                    allocated_refunds += ref_amt * alloc_ratio

            if order_had_successful_payment:
                paid_orders_count += 1
            elif order_had_pending_payment:
                pending_orders_count += 1
        else:
            allocated_unpaid += s_sub

        if seller_product_ids:
            returns = db.query(OrderReturn).filter(
                OrderReturn.order_id == s_ord.order_id,
                OrderReturn.product_id.in_(seller_product_ids)
            ).all()
            for r in returns:
                if r.refund_amount:
                    allocated_refunds += float(r.refund_amount or 0.0)

    net_sales = max(0.0, round(gross_sales - allocated_refunds, 2))
    platform_commission = round(net_sales * 0.05, 2)
    aov = round(gross_sales / total_orders, 2) if total_orders > 0 else 0.0
    fulfillment_rate = round((delivered_count / total_orders) * 100.0, 1) if total_orders > 0 else 0.0
    refund_rate = round((allocated_refunds / gross_sales) * 100.0, 1) if gross_sales > 0 else 0.0

    return SellerFinancialAnalyticsResponse(
        seller_id=seller.seller_id,
        store_name=seller.store_name,
        gross_sales=round(gross_sales, 2),
        net_sales=round(net_sales, 2),
        successfully_paid_amount=round(allocated_captured, 2),
        pending_payment_amount=round(allocated_pending, 2),
        unpaid_amount=round(allocated_unpaid, 2),
        refund_deductions=round(allocated_refunds, 2),
        platform_commission=platform_commission,
        seller_payout_status="Settlement data unavailable",
        payout_note="Direct automated seller payout engine is not enabled. Customer payments are held centrally by marketplace treasury. Payouts require offline finance settlement reconciliation.",
        average_order_value=aov,
        total_orders=total_orders,
        paid_orders_count=paid_orders_count,
        pending_orders_count=pending_orders_count,
        delivered_orders_count=delivered_count,
        processing_orders_count=processing_count,
        cancelled_orders_count=cancelled_count,
        fulfillment_rate=fulfillment_rate,
        active_products_count=active_products,
        low_stock_products_count=low_stock_products,
        refund_rate=refund_rate
    )

@router.get("/me/transactions", response_model=List[SellerTransactionItem])
def get_my_seller_transactions(
    current_user: AppUser = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    seller = db.query(Seller).filter(Seller.user_id == current_user.user_id).first()
    if not seller:
        raise HTTPException(status_code=404, detail="Seller storefront not found.")

    seller_orders = db.query(SellerOrder).filter(SellerOrder.seller_id == seller.seller_id).order_by(desc(SellerOrder.created_at)).all()

    items = []
    for s_ord in seller_orders:
        s_sub = float(s_ord.subtotal or 0.0)
        parent_order = db.query(Order).filter(Order.order_id == s_ord.order_id).first()
        parent_subtotal = float(parent_order.subtotal or 0.0) if parent_order else s_sub
        alloc_ratio = min(1.0, max(0.0, s_sub / parent_subtotal)) if parent_subtotal > 0 else 1.0

        payments = db.query(Payment).filter(Payment.order_id == s_ord.order_id).all()
        shipment = db.query(Shipment).filter(Shipment.order_id == s_ord.order_id).first()
        del_status = shipment.delivery_status if shipment and shipment.delivery_status else (s_ord.status or "Processing")

        if payments:
            for p in payments:
                amt = float(p.amount_paid or 0.0)
                ref = float(p.refund_amount or 0.0)
                items.append(SellerTransactionItem(
                    order_id=s_ord.order_id,
                    seller_order_id=s_ord.seller_order_id,
                    order_date=str(s_ord.created_at) if s_ord.created_at else (parent_order.order_date if parent_order else None),
                    subtotal=round(s_sub, 2),
                    allocated_paid=round(amt * alloc_ratio, 2),
                    allocated_refund=round(ref * alloc_ratio, 2),
                    payment_method=p.payment_method or "Simulated Payment / Pending Capture",
                    payment_status=p.payment_status or "Pending",
                    allocation_percentage=round(alloc_ratio * 100.0, 1),
                    delivery_status=del_status
                ))
        else:
            items.append(SellerTransactionItem(
                order_id=s_ord.order_id,
                seller_order_id=s_ord.seller_order_id,
                order_date=str(s_ord.created_at) if s_ord.created_at else (parent_order.order_date if parent_order else None),
                subtotal=round(s_sub, 2),
                allocated_paid=0.0,
                allocated_refund=0.0,
                payment_method="Unrecorded Payment / Missing Gateway Record",
                payment_status="Unpaid / Missing Payment Record",
                allocation_percentage=round(alloc_ratio * 100.0, 1),
                delivery_status=del_status
            ))
    return items

@router.get("/me/sales-trend", response_model=List[SellerSalesTrendPoint])
def get_my_seller_sales_trend(
    timeframe: str = "daily",  # daily, weekly, monthly
    current_user: AppUser = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    seller = db.query(Seller).filter(Seller.user_id == current_user.user_id).first()
    if not seller:
        raise HTTPException(status_code=404, detail="Seller storefront not found.")

    orders = db.query(SellerOrder).filter(
        SellerOrder.seller_id == seller.seller_id,
        SellerOrder.status != "cancelled"
    ).all()

    agg = {}
    for o in orders:
        if not o.created_at:
            continue
        if timeframe == "monthly":
            key = o.created_at.strftime("%Y-%m")
        elif timeframe == "weekly":
            key = f"{o.created_at.year}-W{o.created_at.isocalendar()[1]:02d}"
        else:  # daily
            key = o.created_at.strftime("%Y-%m-%d")

        if key not in agg:
            agg[key] = {"revenue": 0.0, "order_count": 0}
        agg[key]["revenue"] += float(o.subtotal or 0.0)
        agg[key]["order_count"] += 1

    limit = 30 if timeframe == "daily" else (24 if timeframe == "weekly" else 12)
    sorted_keys = sorted(agg.keys())[-limit:]

    return [
        SellerSalesTrendPoint(
            period=k,
            revenue=round(agg[k]["revenue"], 2),
            order_count=agg[k]["order_count"]
        )
        for k in sorted_keys
    ]

@router.get("/me/category-performance", response_model=List[SellerCategoryPerformanceItem])
def get_my_seller_category_performance(
    current_user: AppUser = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    seller = db.query(Seller).filter(Seller.user_id == current_user.user_id).first()
    if not seller:
        raise HTTPException(status_code=404, detail="Seller storefront not found.")

    results = db.query(
        Product.category.label("category"),
        func.coalesce(func.sum(SellerOrderItem.quantity * SellerOrderItem.unit_price), 0.0).label("revenue"),
        func.coalesce(func.sum(SellerOrderItem.quantity), 0).label("units_sold")
    ).join(
        SellerOrder, SellerOrderItem.seller_order_id == SellerOrder.seller_order_id
    ).join(
        Product, SellerOrderItem.product_id == Product.product_id
    ).filter(
        SellerOrder.seller_id == seller.seller_id
    ).group_by(
        Product.category
    ).order_by(desc("revenue")).all()

    return [
        SellerCategoryPerformanceItem(
            category=r.category or "Other",
            revenue=round(float(r.revenue), 2),
            units_sold=int(r.units_sold)
        )
        for r in results
    ]

@router.get("/me/payment-distribution", response_model=List[SellerPaymentMethodDistributionItem])
def get_my_seller_payment_distribution(
    current_user: AppUser = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    seller = db.query(Seller).filter(Seller.user_id == current_user.user_id).first()
    if not seller:
        raise HTTPException(status_code=404, detail="Seller storefront not found.")

    seller_orders = db.query(SellerOrder).filter(SellerOrder.seller_id == seller.seller_id).all()
    if not seller_orders:
        return []

    total_orders = len(seller_orders)
    order_ids = [o.order_id for o in seller_orders if o.order_id]

    payments = db.query(Payment).filter(Payment.order_id.in_(order_ids)).all() if order_ids else []
    orders_with_payments = set()
    method_counts = {}

    for p in payments:
        m = (p.payment_method or "Unspecified").strip()
        if m not in method_counts:
            method_counts[m] = {"count": 0, "amount": 0.0}
        method_counts[m]["count"] += 1
        method_counts[m]["amount"] += float(p.amount_paid or 0.0)
        orders_with_payments.add(p.order_id)

    unrecorded_orders = [o for o in seller_orders if o.order_id not in orders_with_payments]
    if unrecorded_orders:
        method_counts["Unrecorded / Missing Payment Record"] = {
            "count": len(unrecorded_orders),
            "amount": sum(float(o.subtotal or 0.0) for o in unrecorded_orders)
        }

    items = []
    for method, data in method_counts.items():
        pct = round((data["count"] / total_orders) * 100.0, 1) if total_orders > 0 else 0.0
        items.append(SellerPaymentMethodDistributionItem(
            payment_method=method,
            order_count=data["count"],
            amount=round(data["amount"], 2),
            percentage=pct
        ))
    return items

@router.get("/me/order-status-distribution", response_model=List[SellerOrderStatusCount])
def get_my_seller_order_status_distribution(
    current_user: AppUser = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    seller = db.query(Seller).filter(Seller.user_id == current_user.user_id).first()
    if not seller:
        raise HTTPException(status_code=404, detail="Seller storefront not found.")

    total = db.query(func.count(SellerOrder.seller_order_id)).filter(SellerOrder.seller_id == seller.seller_id).scalar() or 0
    if total == 0:
        return []

    results = db.query(
        SellerOrder.status.label("status"),
        func.count(SellerOrder.seller_order_id).label("count")
    ).filter(
        SellerOrder.seller_id == seller.seller_id
    ).group_by(SellerOrder.status).all()

    items = []
    for r in results:
        cnt = int(r.count)
        pct = round((cnt / total) * 100.0, 1)
        items.append(SellerOrderStatusCount(
            status=r.status or "Unknown",
            count=cnt,
            percentage=pct
        ))
    return items

@router.get("/me/top-products", response_model=List[SellerTopProduct])
def get_my_seller_top_products(
    limit: int = 10,
    current_user: AppUser = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    seller = db.query(Seller).filter(Seller.user_id == current_user.user_id).first()
    if not seller:
        raise HTTPException(status_code=404, detail="Seller storefront not found.")

    results = db.query(
        SellerOrderItem.product_id,
        func.sum(SellerOrderItem.quantity).label("units_sold"),
        func.sum(SellerOrderItem.quantity * SellerOrderItem.unit_price).label("total_revenue")
    ).join(
        SellerOrder, SellerOrderItem.seller_order_id == SellerOrder.seller_order_id
    ).filter(
        SellerOrder.seller_id == seller.seller_id
    ).group_by(
        SellerOrderItem.product_id
    ).order_by(desc("total_revenue")).limit(limit).all()

    items = []
    for r in results:
        prod = db.query(Product).filter(Product.product_id == r.product_id).first()
        sp = db.query(SellerProduct).filter(
            SellerProduct.seller_id == seller.seller_id,
            SellerProduct.product_id == r.product_id
        ).first()

        name = prod.product_name if prod else f"Product {r.product_id}"
        category = prod.category if prod else None
        current_stock = sp.stock_quantity if sp else (prod.stock_quantity if prod else 0)

        items.append(SellerTopProduct(
            product_id=r.product_id,
            product_name=name,
            category=category,
            units_sold=int(r.units_sold or 0),
            total_revenue=round(float(r.total_revenue or 0.0), 2),
            current_stock=int(current_stock or 0)
        ))
    return items

@router.get("/me/reviews", response_model=List[SellerCustomerReview])
def get_my_seller_reviews(
    limit: int = 20,
    current_user: AppUser = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    seller = db.query(Seller).filter(Seller.user_id == current_user.user_id).first()
    if not seller:
        raise HTTPException(status_code=404, detail="Seller storefront not found.")

    seller_products = db.query(SellerProduct.product_id).filter(SellerProduct.seller_id == seller.seller_id).all()
    product_ids = [p[0] for p in seller_products if p[0]]
    if not product_ids:
        return []

    reviews = db.query(CustomerReview).filter(
        CustomerReview.product_id.in_(product_ids)
    ).order_by(desc(CustomerReview.review_date)).limit(limit).all()

    items = []
    for rev in reviews:
        rt = db.query(ReviewText).filter(ReviewText.review_id == rev.review_id).first()
        prod = db.query(Product.product_name).filter(Product.product_id == rev.product_id).first()
        prod_name = prod[0] if prod else f"Product {rev.product_id}"

        items.append(SellerCustomerReview(
            review_id=rev.review_id,
            order_id=rev.order_id,
            product_id=rev.product_id or "",
            product_name=prod_name,
            rating=float(rev.rating or 0.0),
            sentiment=rev.review_sentiment or (rt.review_sentiment if rt else None),
            review_text=rt.review_text if rt else None,
            review_date=str(rev.review_date) if rev.review_date else None
        ))
    return items

@router.get("/{seller_id}", response_model=SellerResponse)
def get_seller(seller_id: str, db: Session = Depends(get_db)):
    seller = db.query(Seller).filter(Seller.seller_id == seller_id).first()
    if not seller:
        raise HTTPException(status_code=404, detail="Seller store not found.")
    return seller

