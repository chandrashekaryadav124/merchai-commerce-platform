import os
import sys
import uuid
import pytest
from datetime import datetime, timedelta
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
from fastapi.testclient import TestClient

# Ensure backend root is on sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.db.session import Base, get_db
from app.core.security import create_access_token, get_password_hash
from app.models.users import AppUser
from app.models.cart import Cart, CartItem
from app.models.products import Product, ProductImage
from app.models.sellers import Seller, SellerProduct
from app.models.orders import Order, OrderItem
from app.models.support import SupportTicket
from app.models.audit import AuditLog
from app.main import app

# Create dedicated in-memory SQLite engine for complete isolation
engine_test = create_engine(
    "sqlite:///:memory:",
    connect_args={"check_same_thread": False},
    poolclass=StaticPool
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine_test)

Base.metadata.create_all(bind=engine_test)

def override_get_db():
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()

client = TestClient(app)

@pytest.fixture(scope="module", autouse=True)
def setup_test_data():
    """Seeds test users for all 5 roles plus sample catalog and orders."""
    app.dependency_overrides[get_db] = override_get_db
    Base.metadata.create_all(bind=engine_test)
    db = TestingSessionLocal()
    try:
        # 1. Seed users for all 5 roles
        cust_a = AppUser(
            user_id="USR_CUST_A",
            full_name="Customer Alice",
            email="alice@test.local",
            password_hash=get_password_hash("Pass123!"),
            role="customer",
            is_active=True
        )
        cust_b = AppUser(
            user_id="USR_CUST_B",
            full_name="Customer Bob",
            email="bob@test.local",
            password_hash=get_password_hash("Pass123!"),
            role="customer",
            is_active=True
        )
        seller_user = AppUser(
            user_id="USR_SELLER_1",
            full_name="Seller Sam",
            email="sam@test.local",
            password_hash=get_password_hash("Pass123!"),
            role="seller",
            is_active=True
        )
        seller_user_2 = AppUser(
            user_id="USR_SELLER_2",
            full_name="Seller Sally",
            email="sally@test.local",
            password_hash=get_password_hash("Pass123!"),
            role="seller",
            is_active=True
        )
        ops_user = AppUser(
            user_id="USR_OPS_1",
            full_name="Operations Ollie",
            email="ollie@test.local",
            password_hash=get_password_hash("Pass123!"),
            role="operations",
            is_active=True
        )
        support_user = AppUser(
            user_id="USR_SUPP_1",
            full_name="Support Sue",
            email="sue@test.local",
            password_hash=get_password_hash("Pass123!"),
            role="support",
            is_active=True
        )
        admin_user = AppUser(
            user_id="USR_ADMIN_1",
            full_name="Admin Alex",
            email="alex@test.local",
            password_hash=get_password_hash("Pass123!"),
            role="admin",
            is_active=True
        )
        db.add_all([cust_a, cust_b, seller_user, seller_user_2, ops_user, support_user, admin_user])
        db.commit()

        # 2. Seed Sellers
        seller_1 = Seller(
            seller_id="SEL_STORE_1",
            user_id="USR_SELLER_1",
            store_name="Sam Artisan Crafts",
            store_type="handicrafts",
            approval_status="approved"
        )
        seller_2 = Seller(
            seller_id="SEL_STORE_2",
            user_id="USR_SELLER_2",
            store_name="Sally Organic Spices",
            store_type="groceries",
            approval_status="approved"
        )
        db.add_all([seller_1, seller_2])
        db.commit()

        # 3. Seed Products
        p1 = Product(
            product_id="PROD_TEST_101",
            product_name="Handcrafted Brass Diya",
            category="Home & Living",
            price=799.0,
            stock_quantity=50
        )
        p2 = Product(
            product_id="PROD_TEST_102",
            product_name="Organic Malabar Cardamom",
            category="Food & Gourmet",
            price=349.0,
            stock_quantity=100
        )
        db.add_all([p1, p2])
        db.commit()

        sp1 = SellerProduct(
            seller_product_id=1001,
            seller_id="SEL_STORE_1",
            product_id="PROD_TEST_101",
            selling_price=799.0,
            stock_quantity=50,
            listing_status="active"
        )
        sp2 = SellerProduct(
            seller_product_id=1002,
            seller_id="SEL_STORE_2",
            product_id="PROD_TEST_102",
            selling_price=349.0,
            stock_quantity=100,
            listing_status="active"
        )
        db.add_all([sp1, sp2])
        db.commit()

        # 4. Seed Orders
        ord_a = Order(
            order_id="ORD-ALICE-1001",
            customer_id="USR_CUST_A",
            order_date="2026-10-25",
            order_status="Shipped",
            shipping_method="Standard",
            delivery_city="Bengaluru",
            final_amount=799.0,
            recipient_name="Alice Customer"
        )
        ord_b = Order(
            order_id="ORD-BOB-2002",
            customer_id="USR_CUST_B",
            order_date="2026-10-26",
            order_status="Processing",
            shipping_method="Express",
            delivery_city="Hyderabad",
            final_amount=349.0,
            recipient_name="Bob Customer"
        )
        db.add_all([ord_a, ord_b])
        db.commit()

    finally:
        db.close()
    yield
    app.dependency_overrides.pop(get_db, None)

def make_headers(user_id: str, role: str = "customer") -> dict:
    token = create_access_token(subject=user_id, role=role)
    return {"Authorization": f"Bearer {token}"}

# ============================================================================
# TASK 2: Cart & Role Restriction Tests
# ============================================================================

def test_guest_cannot_access_cart_endpoints():
    """Unauthenticated guest receives 401 Unauthorized on cart endpoints."""
    res_get = client.get("/api/v1/cart")
    assert res_get.status_code == 401

    res_post = client.post("/api/v1/cart/items", json={"product_id": "PROD_TEST_101", "quantity": 1})
    assert res_post.status_code == 401

    res_clear = client.delete("/api/v1/cart")
    assert res_clear.status_code == 401

def test_authenticated_customer_can_add_to_cart():
    """Customer role can add items and fetch their database-backed cart."""
    headers = make_headers("USR_CUST_A", "customer")
    res_add = client.post("/api/v1/cart/items", json={"product_id": "PROD_TEST_101", "quantity": 2}, headers=headers)
    assert res_add.status_code == 201
    data = res_add.json()
    assert data["item_count"] >= 2
    assert len(data["items"]) >= 1

    res_get = client.get("/api/v1/cart", headers=headers)
    assert res_get.status_code == 200
    assert res_get.json()["subtotal"] >= 799.0 * 2

def test_seller_cannot_use_customer_cart_endpoints():
    """Seller role receives 403 Forbidden on cart endpoints."""
    headers = make_headers("USR_SELLER_1", "seller")
    res = client.get("/api/v1/cart", headers=headers)
    assert res.status_code == 403
    assert "Access denied" in res.json()["detail"]

    res_post = client.post("/api/v1/cart/items", json={"product_id": "PROD_TEST_101", "quantity": 1}, headers=headers)
    assert res.status_code == 403

def test_operations_cannot_use_customer_cart_endpoints():
    """Operations role receives 403 Forbidden on cart endpoints."""
    headers = make_headers("USR_OPS_1", "operations")
    res = client.get("/api/v1/cart", headers=headers)
    assert res.status_code == 403

def test_support_cannot_use_customer_cart_endpoints():
    """Support role receives 403 Forbidden on cart endpoints."""
    headers = make_headers("USR_SUPP_1", "support")
    res = client.get("/api/v1/cart", headers=headers)
    assert res.status_code == 403

def test_admin_cannot_use_customer_cart_endpoints():
    """Admin role receives 403 Forbidden on customer cart endpoints."""
    headers = make_headers("USR_ADMIN_1", "admin")
    res = client.get("/api/v1/cart", headers=headers)
    assert res.status_code == 403

def test_customer_a_cannot_view_or_modify_customer_b_cart():
    """Cart is strictly partitioned by authenticated user identity; Customer B cannot see Customer A's items."""
    # Alice has items in cart
    headers_a = make_headers("USR_CUST_A", "customer")
    res_a = client.get("/api/v1/cart", headers=headers_a)
    assert res_a.status_code == 200
    items_a = res_a.json()["items"]
    assert len(items_a) > 0

    # Bob's cart is empty or independent
    headers_b = make_headers("USR_CUST_B", "customer")
    res_b = client.get("/api/v1/cart", headers=headers_b)
    assert res_b.status_code == 200
    assert res_b.json()["item_count"] == 0

    # Bob cannot update or delete Alice's cart item
    alice_item_id = items_a[0]["cart_item_id"]
    res_hack = client.put(f"/api/v1/cart/items/{alice_item_id}", json={"quantity": 99}, headers=headers_b)
    assert res_hack.status_code == 404  # Not found in Bob's active cart

# ============================================================================
# TASK 4 & 5: Seller Isolation & Cross-Tenant Security
# ============================================================================

def test_seller_a_cannot_view_seller_b_products():
    """Seller storefront products are strictly partitioned to the authenticated seller."""
    headers_s1 = make_headers("USR_SELLER_1", "seller")
    res_s1 = client.get("/api/v1/sellers/me/products", headers=headers_s1)
    assert res_s1.status_code == 200
    products_s1 = res_s1.json()
    assert all(p["seller_id"] == "SEL_STORE_1" for p in products_s1)
    assert any(p["product_id"] == "PROD_TEST_101" for p in products_s1)
    assert not any(p["product_id"] == "PROD_TEST_102" for p in products_s1)

    headers_s2 = make_headers("USR_SELLER_2", "seller")
    res_s2 = client.get("/api/v1/sellers/me/products", headers=headers_s2)
    assert res_s2.status_code == 200
    products_s2 = res_s2.json()
    assert all(p["seller_id"] == "SEL_STORE_2" for p in products_s2)
    assert any(p["product_id"] == "PROD_TEST_102" for p in products_s2)

# ============================================================================
# TASK 3: Chatbot Order Tracking & Authorization
# ============================================================================

def test_guest_cannot_track_order_via_chatbot():
    """Unauthenticated guest cannot track private orders via chatbot."""
    res = client.post("/api/v1/ai/chat", json={
        "messages": [{"role": "user", "content": "Where is my order ORD-ALICE-1001?"}]
    })
    assert res.status_code == 200
    data = res.json()
    assert "sign in" in data["reply"].lower()
    assert data["order_status_card"] is None

def test_customer_tracks_only_their_own_order_via_chatbot():
    """Customer Alice can track her own order ORD-ALICE-1001, but asking for Bob's order returns safe refusal."""
    headers_a = make_headers("USR_CUST_A", "customer")

    # 1. Alice tracks her own order
    res_own = client.post("/api/v1/ai/chat", json={
        "messages": [{"role": "user", "content": "Track my order ORD-ALICE-1001"}]
    }, headers=headers_a)
    assert res_own.status_code == 200
    data_own = res_own.json()
    assert data_own["order_status_card"] is not None
    assert data_own["order_status_card"]["order_id"] == "ORD-ALICE-1001"

    # 2. Alice tries to track Bob's order (Cross-Tenant isolation)
    res_cross = client.post("/api/v1/ai/chat", json={
        "messages": [{"role": "user", "content": "Track order ORD-BOB-2002"}]
    }, headers=headers_a)
    assert res_cross.status_code == 200
    data_cross = res_cross.json()
    assert data_cross["order_status_card"] is None
    assert "no order with reference 'ord-bob-2002' was found under your registered account" in data_cross["reply"].lower()

# ============================================================================
# Token Integrity & Admin Governance
# ============================================================================

def test_unauthorized_roles_blocked_from_admin_governance():
    """Non-admin roles are rejected with 403 Forbidden on admin governance routes."""
    headers_cust = make_headers("USR_CUST_A", "customer")
    res_cust = client.get("/api/v1/admin/sellers", headers=headers_cust)
    assert res_cust.status_code == 403

    headers_seller = make_headers("USR_SELLER_1", "seller")
    res_seller = client.get("/api/v1/admin/sellers", headers=headers_seller)
    assert res_seller.status_code == 403

    headers_admin = make_headers("USR_ADMIN_1", "admin")
    res_admin = client.get("/api/v1/admin/sellers", headers=headers_admin)
    assert res_admin.status_code == 200

def test_invalid_and_expired_tokens_rejected():
    """Tampered or invalid JWT tokens return 401 Unauthorized."""
    # Bad token string
    res_bad = client.get("/api/v1/cart", headers={"Authorization": "Bearer not-a-valid-token"})
    assert res_bad.status_code == 401

    # Expired token (create token with negative expiry)
    expired_token = create_access_token(
        subject="USR_CUST_A",
        role="customer",
        expires_delta=timedelta(seconds=-60)
    )
    res_exp = client.get("/api/v1/cart", headers={"Authorization": f"Bearer {expired_token}"})
    assert res_exp.status_code == 401
