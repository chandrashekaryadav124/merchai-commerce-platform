import uuid
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import or_
from app.db.session import get_db
from app.models.products import Product, ProductImage, ProductKnowledge
from app.models.sellers import Seller, SellerProduct
from app.schemas.products import ProductResponse, ProductCreate, ProductListResponse
from app.core.deps import get_current_user, RoleChecker
from app.models.users import AppUser
from app.services.audit_service import log_audit_action
from app.core.categories import is_category_permitted, get_permitted_categories, ALL_MARKETPLACE_CATEGORIES

router = APIRouter()

def enrich_product_response(
    product: Product,
    sp: Optional[SellerProduct] = None,
    seller: Optional[Seller] = None,
    images: Optional[List[str]] = None,
    description: Optional[str] = None
) -> ProductResponse:
    seller_id = sp.seller_id if sp else None
    selling_price = float(sp.selling_price) if (sp and sp.selling_price is not None) else product.price
    stock_qty = sp.stock_quantity if (sp and sp.stock_quantity is not None) else product.stock_quantity

    store_name = None
    if seller:
        store_name = seller.store_name
    elif sp and sp.seller_id:
        store_name = sp.seller_id
    if not store_name:
        store_name = product.brand if (product.brand and product.brand.lower() != "generic") else "Marketplace Partner"

    img_list = images or []
    image_url = img_list[0] if img_list else None

    # Authoritative price calculation:
    # A discount is only valid when selling_price is genuinely lower than original catalog price
    base_price = product.price if product.price is not None else selling_price
    discount_price = None
    if selling_price is not None and base_price is not None and selling_price < base_price:
        discount_price = selling_price
    else:
        base_price = selling_price

    return ProductResponse(
        product_id=product.product_id,
        product_name=product.product_name,
        category=product.category,
        subcategory=product.subcategory,
        brand=product.brand,
        price=base_price,
        cost_price=product.cost_price,
        discount_range=product.discount_range,
        rating_average=product.rating_average,
        rating_count=product.rating_count,
        stock_quantity=stock_qty,
        product_launch_date=product.product_launch_date,
        product_type=product.product_type,
        image_url=image_url,
        images=img_list,
        description=description,
        store_name=store_name,
        seller_id=seller_id,
        selling_price=selling_price,
        discount_price=discount_price
    )

@router.get("/categories", response_model=List[str])
def get_marketplace_categories():
    return ALL_MARKETPLACE_CATEGORIES

@router.get("", response_model=ProductListResponse)
def list_products(
    category: Optional[str] = None,
    search: Optional[str] = None,
    min_price: Optional[float] = None,
    max_price: Optional[float] = None,
    limit: int = Query(default=50, le=200),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db)
):
    query = db.query(Product)
    
    if category and category != "All":
        cat_terms = [c.strip() for c in category.replace("&", ",").split(",") if c.strip()]
        conditions = []
        for term in cat_terms:
            conditions.append(Product.category.ilike(f"%{term}%"))
            conditions.append(Product.category.ilike(term))
        query = query.filter(or_(*conditions))

    if search:
        query = query.filter(Product.product_name.ilike(f"%{search}%"))
    if min_price is not None:
        query = query.filter(Product.price >= min_price)
    if max_price is not None:
        query = query.filter(Product.price <= max_price)

    offset_val = offset if isinstance(offset, int) else 0
    limit_val = limit if isinstance(limit, int) else 50

    total = query.count()
    items = query.offset(offset_val).limit(limit_val).all()

    # Batch enrich items
    product_ids = [p.product_id for p in items]
    sps = db.query(SellerProduct).filter(SellerProduct.product_id.in_(product_ids)).all() if product_ids else []
    sp_map = {sp.product_id: sp for sp in sps}

    seller_ids = list({sp.seller_id for sp in sps if sp.seller_id})
    sellers = db.query(Seller).filter(Seller.seller_id.in_(seller_ids)).all() if seller_ids else []
    seller_map = {s.seller_id: s for s in sellers}

    imgs = db.query(ProductImage).filter(ProductImage.product_id.in_(product_ids)).all() if product_ids else []
    img_map = {}
    for img in imgs:
        if img.image_path:
            img_map.setdefault(img.product_id, []).append(img.image_path)

    pks = db.query(ProductKnowledge).filter(ProductKnowledge.product_id.in_(product_ids)).all() if product_ids else []
    pk_map = {}
    for pk in pks:
        if pk.content and pk.product_id not in pk_map:
            pk_map[pk.product_id] = pk.content

    enriched_items = [
        enrich_product_response(
            product=p,
            sp=sp_map.get(p.product_id),
            seller=seller_map.get(sp_map.get(p.product_id).seller_id) if (sp_map.get(p.product_id) and sp_map.get(p.product_id).seller_id) else None,
            images=img_map.get(p.product_id, []),
            description=pk_map.get(p.product_id)
        )
        for p in items
    ]

    return ProductListResponse(total=total, items=enriched_items)

@router.get("/{product_id}", response_model=ProductResponse)
def get_product(product_id: str, db: Session = Depends(get_db)):
    product = db.query(Product).filter(Product.product_id == product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found.")

    sp = db.query(SellerProduct).filter(SellerProduct.product_id == product.product_id).first()
    seller = None
    if sp and sp.seller_id:
        seller = db.query(Seller).filter(Seller.seller_id == sp.seller_id).first()

    imgs = db.query(ProductImage).filter(ProductImage.product_id == product.product_id).all()
    images = [img.image_path for img in imgs if img.image_path]

    pk = db.query(ProductKnowledge).filter(ProductKnowledge.product_id == product.product_id).first()
    description = pk.content if pk and pk.content else None

    return enrich_product_response(
        product=product,
        sp=sp,
        seller=seller,
        images=images,
        description=description
    )

@router.post("", response_model=ProductResponse)
def create_product(
    product_in: ProductCreate,
    current_user: AppUser = Depends(RoleChecker(["seller", "operations", "admin"])),
    db: Session = Depends(get_db)
):
    seller_id = None
    seller_store_name = "Marketplace"
    seller_obj = None
    if current_user.role == "seller":
        seller = db.query(Seller).filter(Seller.user_id == current_user.user_id).first()
        if not seller:
            raise HTTPException(
                status_code=403,
                detail="No registered seller storefront associated with this account."
            )
        if seller.approval_status == "pending":
            raise HTTPException(
                status_code=403,
                detail="Seller storefront application is pending administrator approval. Product creation is disabled."
            )
        elif seller.approval_status == "suspended":
            raise HTTPException(
                status_code=403,
                detail="Seller storefront is suspended. Product creation and selling operations are disabled."
            )
        elif seller.approval_status == "rejected":
            raise HTTPException(
                status_code=403,
                detail="Seller storefront application was rejected. Product creation is disabled."
            )
        elif seller.approval_status != "approved":
            raise HTTPException(
                status_code=403,
                detail=f"An approved seller storefront is required to create products. Current status: '{seller.approval_status}'."
            )
        
        # Enforce server-side category validation based on seller's store_type
        seller_store_type = seller.store_type or "Other / General Store"
        if not is_category_permitted(product_in.category, seller_store_type):
            permitted = get_permitted_categories(seller_store_type)
            raise HTTPException(
                status_code=400,
                detail=f"Category '{product_in.category}' is not permitted for store type '{seller_store_type}'. Permitted categories for this store type are: {', '.join(permitted)}."
            )

        seller_id = seller.seller_id
        seller_store_name = seller.store_name
        seller_obj = seller

    new_id = f"PROD{uuid.uuid4().hex[:6].upper()}"
    effective_brand = product_in.brand or seller_store_name
    new_product = Product(
        product_id=new_id,
        product_name=product_in.product_name,
        category=product_in.category,
        subcategory=product_in.subcategory or "General",
        brand=effective_brand,
        price=product_in.price,
        cost_price=product_in.cost_price,
        stock_quantity=product_in.stock_quantity,
        rating_average=4.5,
        rating_count=1
    )
    db.add(new_product)

    # Link product to seller storefront inventory assignment
    sp = None
    if seller_id:
        sp = SellerProduct(
            seller_id=seller_id,
            product_id=new_id,
            selling_price=product_in.price,
            stock_quantity=product_in.stock_quantity,
            listing_status="active",
            assigned_by=current_user.user_id
        )
        db.add(sp)

    # Persist image if provided
    created_images = []
    if product_in.image_url and product_in.image_url.strip():
        img_id = f"IMG{uuid.uuid4().hex[:6].upper()}"
        clean_img_url = product_in.image_url.strip()
        new_img = ProductImage(
            image_id=img_id,
            product_id=new_id,
            image_path=clean_img_url,
            image_type="primary",
            category=product_in.category,
            subcategory=product_in.subcategory or "General",
            brand=effective_brand,
            source_type="seller_upload"
        )
        db.add(new_img)
        created_images.append(clean_img_url)

    # Persist description if provided
    if product_in.description and product_in.description.strip():
        know_id = f"KNOW{uuid.uuid4().hex[:6].upper()}"
        new_know = ProductKnowledge(
            knowledge_id=know_id,
            product_id=new_id,
            product_name=product_in.product_name,
            category=product_in.category,
            subcategory=product_in.subcategory or "General",
            brand=effective_brand,
            knowledge_type="product_description",
            title=f"{product_in.product_name} - Product Description",
            content=product_in.description.strip(),
            source_type="seller_submission"
        )
        db.add(new_know)

    db.commit()
    db.refresh(new_product)

    log_audit_action(
        db,
        action="PRODUCT_CREATED",
        entity_type="product",
        user_id=current_user.user_id,
        entity_id=new_id,
        details={"name": new_product.product_name, "price": new_product.price, "seller_id": seller_id}
    )

    return enrich_product_response(
        product=new_product,
        sp=sp,
        seller=seller_obj,
        images=created_images,
        description=product_in.description.strip() if product_in.description else None
    )
