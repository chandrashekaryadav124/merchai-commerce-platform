import sys
import os
import uuid
from fastapi.testclient import TestClient
from sqlalchemy import text
from app.main import app
from app.db.session import SessionLocal
from app.models.users import AppUser
from app.models.sellers import Seller, SellerProduct
from app.models.orders import Order, SellerOrder
from app.core.security import get_password_hash, create_access_token

client = TestClient(app)

def create_user_and_token(role: str = "customer", full_name: str = "Test User"):
    db = SessionLocal()
    uid = f"TST-{uuid.uuid4().hex[:8].upper()}"
    email = f"test_{uuid.uuid4().hex[:6]}@example.com"
    user = AppUser(
        user_id=uid,
        full_name=full_name,
        email=email,
        password_hash=get_password_hash("Password123!"),
        role=role,
        is_active=True,
        is_demo_account=False
    )
    db.add(user)
    db.commit()
    token = create_access_token(subject=uid, role=role)
    db.close()
    return uid, email, token

def get_admin_token():
    db = SessionLocal()
    try:
        admin_user = db.query(AppUser).filter(AppUser.role == "admin", AppUser.is_active == True).first()
        if not admin_user:
            uid = f"USR-{uuid.uuid4().hex[:8].upper()}"
            email = f"admin_{uuid.uuid4().hex[:6]}@example.invalid"
            admin_user = AppUser(
                user_id=uid,
                full_name="Admin Test User",
                email=email,
                password_hash=get_password_hash("AdminPassword123!"),
                role="admin",
                is_active=True,
                is_demo_account=True
            )
            db.add(admin_user)
            db.commit()
        token = create_access_token(subject=admin_user.user_id, role="admin")
        return token
    finally:
        db.close()

def create_approved_seller(store_name: str):
    uid, email, token = create_user_and_token(role="seller", full_name=f"Owner of {store_name}")
    db = SessionLocal()
    sid = f"SEL-{uuid.uuid4().hex[:6].upper()}"
    seller = Seller(
        seller_id=sid,
        user_id=uid,
        store_name=store_name,
        approval_status="approved",
        contact_email=email
    )
    db.add(seller)
    db.commit()
    db.close()
    return uid, email, token, sid

def test_1_new_approved_seller_zero_sales_and_orders():
    """Verify a newly approved seller with 0 products and 0 orders sees zero sales and zero orders."""
    _, _, token, seller_id = create_approved_seller(f"New Empty Store {uuid.uuid4().hex[:4]}")
    headers = {"Authorization": f"Bearer {token}"}

    res = client.get("/api/v1/sellers/me/analytics", headers=headers)
    assert res.status_code == 200, f"Expected 200, got {res.status_code}: {res.text}"
    data = res.json()

    assert data["seller_id"] == seller_id
    assert data["monthly_gross_sales"] == 0.0
    assert data["total_orders"] == 0
    assert data["inventory_items_count"] == 0

def test_2_fulfillment_rate_na_when_no_eligible_orders():
    """Verify fulfillment rate is N/A when no eligible orders exist."""
    _, _, token, _ = create_approved_seller(f"Zero Orders Store {uuid.uuid4().hex[:4]}")
    headers = {"Authorization": f"Bearer {token}"}

    res = client.get("/api/v1/sellers/me/analytics", headers=headers)
    assert res.status_code == 200
    data = res.json()

    assert data["fulfillment_rate"] is None
    assert data["fulfillment_rate_display"] == "N/A"
    assert data["store_rating"] is None

def test_3_existing_seller_metrics_scoped_only_to_authorized_data():
    """Verify existing seller analytics include only that seller's authorized data."""
    db = SessionLocal()
    try:
        seller_001 = db.query(Seller).filter(Seller.seller_id == "SEL-001").first()
        assert seller_001 is not None, "Seeded SEL-001 must exist"
        user = db.query(AppUser).filter(AppUser.user_id == seller_001.user_id).first()
        token = create_access_token(subject=user.user_id, role=user.role)
    finally:
        db.close()

    headers = {"Authorization": f"Bearer {token}"}
    res = client.get("/api/v1/sellers/me/analytics", headers=headers)
    assert res.status_code == 200
    data = res.json()

    assert data["seller_id"] == "SEL-001"
    assert data["total_orders"] >= 3356
    assert data["monthly_gross_sales"] > 0
    assert data["fulfillment_rate_display"] != "N/A"

def test_4_adding_product_updates_only_correct_seller_count():
    """Verify adding a product updates only the product count of the seller who created it."""
    _, _, token_a, sid_a = create_approved_seller(f"Store Alpha {uuid.uuid4().hex[:4]}")
    _, _, token_b, sid_b = create_approved_seller(f"Store Beta {uuid.uuid4().hex[:4]}")

    headers_a = {"Authorization": f"Bearer {token_a}"}
    headers_b = {"Authorization": f"Bearer {token_b}"}

    # Verify initial counts
    res_a_init = client.get("/api/v1/sellers/me/analytics", headers=headers_a).json()
    res_b_init = client.get("/api/v1/sellers/me/analytics", headers=headers_b).json()
    assert res_a_init["inventory_items_count"] == 0
    assert res_b_init["inventory_items_count"] == 0

    # Seller A creates a product
    prod_res = client.post("/api/v1/products", headers=headers_a, json={
        "product_name": f"Alpha Exclusive Product {uuid.uuid4().hex[:4]}",
        "category": "Electronics",
        "price": 1250.0,
        "stock_quantity": 15
    })
    assert prod_res.status_code == 200

    # Verify Seller A count incremented, Seller B count unchanged
    res_a_after = client.get("/api/v1/sellers/me/analytics", headers=headers_a).json()
    res_b_after = client.get("/api/v1/sellers/me/analytics", headers=headers_b).json()

    assert res_a_after["inventory_items_count"] == 1
    assert res_b_after["inventory_items_count"] == 0

def test_5_adding_valid_orders_updates_only_correct_seller_metrics():
    """Verify placing an order containing a seller's product updates only that seller's metrics."""
    _, _, token_a, sid_a = create_approved_seller(f"Store Gamma {uuid.uuid4().hex[:4]}")
    _, _, token_b, sid_b = create_approved_seller(f"Store Delta {uuid.uuid4().hex[:4]}")

    headers_a = {"Authorization": f"Bearer {token_a}"}
    headers_b = {"Authorization": f"Bearer {token_b}"}

    # Seller A posts product
    prod_res = client.post("/api/v1/products", headers=headers_a, json={
        "product_name": f"Gamma Widget {uuid.uuid4().hex[:4]}",
        "category": "Home & Kitchen",
        "price": 800.0,
        "stock_quantity": 50
    })
    pid_a = prod_res.json()["product_id"]

    # Customer places order for Seller A's product
    _, _, cust_token = create_user_and_token(role="customer")
    order_res = client.post("/api/v1/orders", headers={"Authorization": f"Bearer {cust_token}"}, json={
        "shipping_address": "Test Customer Address",
        "items": [{"product_id": pid_a, "quantity": 2, "unit_price": 800.0}]
    })
    assert order_res.status_code == 200

    # Verify Seller A metrics updated
    res_a = client.get("/api/v1/sellers/me/analytics", headers=headers_a).json()
    assert res_a["total_orders"] == 1
    assert res_a["monthly_gross_sales"] == 1600.0

    # Verify Seller B metrics untouched
    res_b = client.get("/api/v1/sellers/me/analytics", headers=headers_b).json()
    assert res_b["total_orders"] == 0
    assert res_b["monthly_gross_sales"] == 0.0

def test_6_cross_seller_access_prevention():
    """Verify one seller cannot access another seller's analytics, AI advisor, forecast, or RAG insights."""
    _, _, token_a, sid_a = create_approved_seller(f"Seller A Store {uuid.uuid4().hex[:4]}")
    _, _, token_b, sid_b = create_approved_seller(f"Seller B Store {uuid.uuid4().hex[:4]}")

    headers_a = {"Authorization": f"Bearer {token_a}"}

    # Seller A tries to request AI Advisor for Seller B -> 403 Forbidden
    advisor_res = client.post("/api/v1/ai/seller-advisor", headers=headers_a, json={
        "seller_id": sid_b,
        "question": "What are my top products?"
    })
    assert advisor_res.status_code == 403

    # Seller A tries to access Demand Forecast for Seller B -> 403 Forbidden
    forecast_res = client.get(f"/api/v1/ai/demand-forecast/{sid_b}", headers=headers_a)
    assert forecast_res.status_code == 403

    # Seller A tries to query RAG Knowledge for Seller B -> 403 Forbidden
    rag_res = client.post("/api/v1/ai/rag/query", headers=headers_a, json={
        "seller_id": sid_b,
        "query": "What is the return policy?"
    })
    assert rag_res.status_code == 403

def test_7_store_dropdown_endpoint_returns_only_authorized_stores():
    """Verify GET /api/v1/sellers/me/stores returns only authorized storefronts for the authenticated seller."""
    _, _, token_a, sid_a = create_approved_seller(f"Target Store A {uuid.uuid4().hex[:4]}")
    _, _, token_b, sid_b = create_approved_seller(f"Other Store B {uuid.uuid4().hex[:4]}")

    headers_a = {"Authorization": f"Bearer {token_a}"}
    res = client.get("/api/v1/sellers/me/stores", headers=headers_a)
    assert res.status_code == 200
    stores = res.json()

    assert len(stores) == 1
    assert stores[0]["seller_id"] == sid_a
    assert not any(s["seller_id"] == sid_b for s in stores)

def test_8_admin_global_metrics_integrity():
    """Verify admin global metrics endpoint retains full aggregated platform analytics."""
    admin_token = get_admin_token()
    headers = {"Authorization": f"Bearer {admin_token}"}

    res = client.get("/api/v1/admin/metrics", headers=headers)
    assert res.status_code == 200
    data = res.json()

    assert "gmv_total" in data
    assert data["gmv_total"] > 0
    assert "total_orders_processed" in data
    assert data["total_orders_processed"] >= 20000

def test_9_historical_records_preservation():
    """Verify historical customer and order database records remain intact."""
    db = SessionLocal()
    try:
        user_count = db.query(AppUser).count()
        order_count = db.query(Order).count()
        seller_order_count = db.query(SellerOrder).count()
        
        assert user_count >= 100
        assert order_count >= 20000
        assert seller_order_count >= 20000
    finally:
        db.close()
