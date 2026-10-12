import uuid
from fastapi.testclient import TestClient
from app.main import app
from app.db.session import SessionLocal
from app.models.users import AppUser
from app.models.sellers import Seller, SellerProduct
from app.models.products import Product
from app.core.security import create_access_token, get_password_hash
from app.core.categories import (
    VALID_STORE_TYPES,
    DEFAULT_STORE_TYPE,
    STORE_TYPE_CATEGORIES,
    get_permitted_categories,
    is_category_permitted
)

client = TestClient(app)

def create_isolated_user(role="customer", is_active=True, email_prefix="user"):
    db = SessionLocal()
    unique_suffix = uuid.uuid4().hex[:6]
    uid = f"USR-{unique_suffix.upper()}"
    email = f"{email_prefix}_{unique_suffix}@example.com"
    user = AppUser(
        user_id=uid,
        full_name=f"Test {email_prefix.title()}",
        email=email,
        password_hash=get_password_hash("TestPass123!"),
        role=role,
        is_active=is_active
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    db.close()
    token = create_access_token(uid, role)
    return uid, email, token

def cleanup_seller_and_user(uid, seller_id=None):
    db = SessionLocal()
    if seller_id:
        db.query(SellerProduct).filter(SellerProduct.seller_id == seller_id).delete()
        db.query(Seller).filter(Seller.seller_id == seller_id).delete()
    db.query(AppUser).filter(AppUser.user_id == uid).delete()
    db.commit()
    db.close()

def test_1_new_seller_application_with_valid_store_type():
    uid, email, token = create_isolated_user()
    seller_id = None
    try:
        headers = {"Authorization": f"Bearer {token}"}
        store_name = f"Apex Footwear {uuid.uuid4().hex[:5]}"
        res = client.post("/api/v1/sellers/apply", headers=headers, json={
            "store_name": store_name,
            "store_type": "Fashion & Footwear",
            "business_description": "Exclusive Footwear Boutique",
            "contact_email": email
        })
        assert res.status_code == 201, f"Expected 201, got {res.status_code}: {res.text}"
        data = res.json()
        seller_id = data["seller_id"]
        assert data["store_name"] == store_name
        assert data["store_type"] == "Fashion & Footwear"
        assert data["approval_status"] == "pending"
    finally:
        cleanup_seller_and_user(uid, seller_id)

def test_2_missing_and_invalid_store_types_handling():
    uid, email, token = create_isolated_user()
    seller_id = None
    try:
        headers = {"Authorization": f"Bearer {token}"}

        # Invalid store type rejected with HTTP 400
        res_invalid = client.post("/api/v1/sellers/apply", headers=headers, json={
            "store_name": "Invalid Category Store",
            "store_type": "Rocket Ships & Nuclear Reactors"
        })
        assert res_invalid.status_code == 400
        assert "invalid store type" in res_invalid.json().get("detail", "").lower()

        # Empty string rejected with HTTP 400
        res_empty = client.post("/api/v1/sellers/apply", headers=headers, json={
            "store_name": "Empty Category Store",
            "store_type": ""
        })
        assert res_empty.status_code == 400

        # Missing store type safely defaults to 'Other / General Store'
        res_missing = client.post("/api/v1/sellers/apply", headers=headers, json={
            "store_name": f"Default Type Store {uuid.uuid4().hex[:5]}"
        })
        assert res_missing.status_code == 201
        seller_id = res_missing.json()["seller_id"]
        assert res_missing.json()["store_type"] == "Other / General Store"
    finally:
        cleanup_seller_and_user(uid, seller_id)

def test_3_store_type_persists_and_returned_in_profile():
    uid, email, token = create_isolated_user()
    seller_id = None
    try:
        headers = {"Authorization": f"Bearer {token}"}
        res_apply = client.post("/api/v1/sellers/apply", headers=headers, json={
            "store_name": f"Electronic World {uuid.uuid4().hex[:5]}",
            "store_type": "Electronics & Mobiles"
        })
        seller_id = res_apply.json()["seller_id"]

        # Fetch /me
        res_me = client.get("/api/v1/sellers/me", headers=headers)
        assert res_me.status_code == 200
        data = res_me.json()
        assert data["store_type"] == "Electronics & Mobiles"

        # Fetch permitted categories endpoint
        res_cats = client.get("/api/v1/sellers/me/permitted-categories", headers=headers)
        assert res_cats.status_code == 200
        cats = res_cats.json()
        assert "Electronics" in cats
        assert "Grocery" not in cats
    finally:
        cleanup_seller_and_user(uid, seller_id)

def test_4_shoes_shop_permitted_categories_filtering():
    # Verify Fashion & Footwear store sees only fashion/footwear categories
    cats = get_permitted_categories("Fashion & Footwear")
    assert "Footwear" in cats
    assert "Shoes" in cats
    assert "Fashion" in cats
    assert "Electronics" not in cats
    assert "Grocery" not in cats

def test_5_electronics_store_permitted_categories_filtering():
    cats = get_permitted_categories("Electronics & Mobiles")
    assert "Electronics" in cats
    assert "Mobiles" in cats
    assert "Computers" in cats
    assert "Footwear" not in cats
    assert "Fruits & Vegetables" not in cats

def test_6_grocery_store_permitted_categories_filtering():
    cats = get_permitted_categories("Grocery & Daily Essentials")
    assert "Grocery" in cats
    assert "Fruits & Vegetables" in cats
    assert "Household Essentials" in cats
    assert "Footwear" not in cats
    assert "Laptops" not in cats

def test_7_general_store_permitted_categories():
    cats = get_permitted_categories("Other / General Store")
    assert len(cats) >= 20
    assert "Grocery" in cats
    assert "Fashion" in cats
    assert "Electronics" in cats

def test_8_backend_rejects_unpermitted_category_for_store_type():
    # 1. Create seller with 'Fashion & Footwear'
    uid, email, token = create_isolated_user(role="seller", is_active=True)
    db = SessionLocal()
    seller_id = f"SEL-{uuid.uuid4().hex[:6].upper()}"
    seller = Seller(
        seller_id=seller_id,
        user_id=uid,
        store_name=f"Shoes & Boots {uuid.uuid4().hex[:4]}",
        store_type="Fashion & Footwear",
        approval_status="approved",
        contact_email=email
    )
    db.add(seller)
    db.commit()
    db.close()

    try:
        headers = {"Authorization": f"Bearer {token}"}

        # 2. Attempt to create an unauthorized product in 'Electronics'
        res_fail = client.post("/api/v1/products", headers=headers, json={
            "product_name": "Quantum Laptop Pro",
            "category": "Electronics",
            "price": 45000.0,
            "cost_price": 35000.0,
            "stock_quantity": 10
        })
        assert res_fail.status_code == 400, f"Expected 400 for category mismatch, got {res_fail.status_code}"
        assert "not permitted for store type 'fashion & footwear'" in res_fail.json().get("detail", "").lower()

        # 3. Attempt to create a permitted product in 'Footwear'
        res_ok = client.post("/api/v1/products", headers=headers, json={
            "product_name": "Premium Leather Oxford Shoes",
            "category": "Footwear",
            "price": 2499.0,
            "cost_price": 1500.0,
            "stock_quantity": 25
        })
        assert res_ok.status_code == 200, f"Expected 200 for valid category, got {res_ok.status_code}: {res_ok.text}"
        prod_id = res_ok.json()["product_id"]

        # Clean up created product
        db = SessionLocal()
        db.query(SellerProduct).filter(SellerProduct.product_id == prod_id).delete()
        db.query(Product).filter(Product.product_id == prod_id).delete()
        db.commit()
        db.close()
    finally:
        cleanup_seller_and_user(uid, seller_id)

def test_9_seller_cannot_modify_other_seller_store_type():
    uid1, _, token1 = create_isolated_user(role="seller", is_active=True)
    uid2, _, _ = create_isolated_user(role="seller", is_active=True)
    db = SessionLocal()
    s1_id = f"SEL-{uuid.uuid4().hex[:6].upper()}"
    s2_id = f"SEL-{uuid.uuid4().hex[:6].upper()}"
    s1 = Seller(seller_id=s1_id, user_id=uid1, store_name=f"Store 1 {uuid.uuid4().hex[:4]}", store_type="Fashion & Footwear", approval_status="approved")
    s2 = Seller(seller_id=s2_id, user_id=uid2, store_name=f"Store 2 {uuid.uuid4().hex[:4]}", store_type="Electronics & Mobiles", approval_status="approved")
    db.add_all([s1, s2])
    db.commit()
    db.close()

    try:
        headers1 = {"Authorization": f"Bearer {token1}"}
        # Seller 1 attempts to call admin patch endpoint to modify Seller 2's store type
        res = client.patch(f"/api/v1/admin/sellers/{s2_id}/approval", headers=headers1, json={
            "store_type": "Grocery & Daily Essentials"
        })
        assert res.status_code == 403, "Non-admin must not be able to modify another seller's store type"
    finally:
        cleanup_seller_and_user(uid1, s1_id)
        cleanup_seller_and_user(uid2, s2_id)

def test_10_unapproved_sellers_cannot_bypass_restrictions():
    uid, _, token = create_isolated_user(role="seller", is_active=True)
    db = SessionLocal()
    seller_id = f"SEL-{uuid.uuid4().hex[:6].upper()}"
    s = Seller(
        seller_id=seller_id,
        user_id=uid,
        store_name=f"Pending Store {uuid.uuid4().hex[:4]}",
        store_type="Fashion & Footwear",
        approval_status="pending"
    )
    db.add(s)
    db.commit()
    db.close()

    try:
        headers = {"Authorization": f"Bearer {token}"}
        res = client.post("/api/v1/products", headers=headers, json={
            "product_name": "Test Sneaker",
            "category": "Footwear",
            "price": 1200.0,
            "cost_price": 800.0,
            "stock_quantity": 5
        })
        assert res.status_code == 403, f"Expected 403 for pending seller product creation, got {res.status_code}"
    finally:
        cleanup_seller_and_user(uid, seller_id)
