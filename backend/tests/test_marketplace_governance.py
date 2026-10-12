import uuid
from fastapi.testclient import TestClient
from app.main import app
from app.db.session import SessionLocal
from app.models.users import AppUser
from app.models.sellers import Seller, SellerProduct
from app.core.security import get_password_hash, create_access_token

client = TestClient(app)

def create_test_user_and_token(role: str = "customer", is_active: bool = True):
    db = SessionLocal()
    uid = f"TST-{uuid.uuid4().hex[:8].upper()}"
    email = f"test_{uuid.uuid4().hex[:6]}@example.com"
    user = AppUser(
        user_id=uid,
        full_name=f"Test {role.title()}",
        email=email,
        password_hash=get_password_hash("Password123!"),
        role=role,
        is_active=is_active,
        is_demo_account=False
    )
    db.add(user)
    db.commit()
    token = create_access_token(subject=uid, role=role)
    db.close()
    return uid, email, token

def test_account_deactivation_blocks_api_access():
    uid, email, token = create_test_user_and_token(role="customer", is_active=False)
    headers = {"Authorization": f"Bearer {token}"}
    res = client.get("/api/v1/auth/me", headers=headers)
    assert res.status_code == 403, f"Expected 403 for deactivated user, got {res.status_code}"
    assert "deactivated" in res.json().get("detail", "").lower()

def test_seller_suspension_blocks_selling_functions():
    uid, email, token = create_test_user_and_token(role="seller", is_active=True)
    db = SessionLocal()
    sid = f"SEL-{uuid.uuid4().hex[:6].upper()}"
    store_name = f"Suspended Store {uuid.uuid4().hex[:6]}"
    seller = Seller(
        seller_id=sid,
        user_id=uid,
        store_name=store_name,
        approval_status="suspended",
        contact_email=email
    )
    db.add(seller)
    db.commit()
    db.close()

    headers = {"Authorization": f"Bearer {token}"}
    
    # 1. GET /sellers/me allowed for suspended seller (to view status/appeal)
    res_me = client.get("/api/v1/sellers/me", headers=headers)
    assert res_me.status_code == 200, f"Expected 200 for /sellers/me, got {res_me.status_code}"
    assert res_me.json()["approval_status"] == "suspended"

    # 2. POST /products blocked for suspended seller
    res_prod = client.post(
        "/api/v1/products",
        headers=headers,
        json={"product_name": "Test Item", "category": "General", "price": 999.0, "stock_quantity": 10}
    )
    assert res_prod.status_code == 403, f"Expected 403 for suspended seller product creation, got {res_prod.status_code}"

    # 3. GET /orders/seller blocked for suspended seller
    res_ord = client.get("/api/v1/orders/seller", headers=headers)
    assert res_ord.status_code == 403, f"Expected 403 for suspended seller order access, got {res_ord.status_code}"

def test_pending_seller_blocks_selling_access():
    uid, email, token = create_test_user_and_token(role="customer", is_active=True)
    db = SessionLocal()
    sid = f"SEL-{uuid.uuid4().hex[:6].upper()}"
    store_name = f"Pending Store {uuid.uuid4().hex[:6]}"
    seller = Seller(
        seller_id=sid,
        user_id=uid,
        store_name=store_name,
        approval_status="pending",
        contact_email=email
    )
    db.add(seller)
    db.commit()
    db.close()

    headers = {"Authorization": f"Bearer {token}"}

    # Attempt product creation while seller application is pending
    res = client.post(
        "/api/v1/products",
        headers=headers,
        json={"product_name": "Unapproved Item", "category": "General", "price": 499.0, "stock_quantity": 5}
    )
    assert res.status_code == 403, f"Expected 403 for pending seller, got {res.status_code}"

def test_approved_seller_selling_access():
    uid, email, token = create_test_user_and_token(role="seller", is_active=True)
    db = SessionLocal()
    sid = f"SEL-{uuid.uuid4().hex[:6].upper()}"
    store_name = f"Approved Active Store {uuid.uuid4().hex[:6]}"
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

    headers = {"Authorization": f"Bearer {token}"}

    # Product creation should succeed
    res = client.post(
        "/api/v1/products",
        headers=headers,
        json={"product_name": "Approved Product A", "category": "Fashion", "price": 1299.0, "stock_quantity": 25}
    )
    assert res.status_code == 200, f"Expected 200 for approved seller, got {res.status_code}: {res.text}"
    data = res.json()
    assert data["product_name"] == "Approved Product A"

def test_duplicate_seller_application_prevention():
    uid, email, token = create_test_user_and_token(role="seller", is_active=True)
    db = SessionLocal()
    sid = f"SEL-{uuid.uuid4().hex[:6].upper()}"
    store_name = f"Existing Merchant Store {uuid.uuid4().hex[:6]}"
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

    headers = {"Authorization": f"Bearer {token}"}
    res = client.post(
        "/api/v1/sellers/apply",
        headers=headers,
        json={"store_name": f"Duplicate Attempt Store {uuid.uuid4().hex[:6]}"}
    )
    assert res.status_code == 400, f"Expected 400 for duplicate application, got {res.status_code}"
    assert "already approved" in res.json().get("detail", "").lower()

def test_admin_only_governance_operations():
    # Customer trying to call admin governance endpoints
    _, _, cust_token = create_test_user_and_token(role="customer", is_active=True)
    cust_headers = {"Authorization": f"Bearer {cust_token}"}

    res1 = client.patch(
        "/api/v1/admin/sellers/SEL-001/approval",
        headers=cust_headers,
        json={"approval_status": "suspended"}
    )
    assert res1.status_code == 403, f"Expected 403 for non-admin seller status update, got {res1.status_code}"

    res2 = client.patch(
        "/api/v1/admin/users/USR-001/status",
        headers=cust_headers,
        json={"is_active": False}
    )
    assert res2.status_code == 403, f"Expected 403 for non-admin user status update, got {res2.status_code}"

def test_customer_store_application_submission_and_invalid_data():
    uid, email, token = create_test_user_and_token(role="customer", is_active=True)
    headers = {"Authorization": f"Bearer {token}"}

    # 1. Short store name rejected
    res1 = client.post(
        "/api/v1/sellers/apply",
        headers=headers,
        json={"store_name": "A"}
    )
    assert res1.status_code == 400, f"Expected 400 for short store name, got {res1.status_code}"

    # 2. Valid store application succeeds
    target_name = f"Horizon Electronics {uuid.uuid4().hex[:6]}"
    res2 = client.post(
        "/api/v1/sellers/apply",
        headers=headers,
        json={
            "store_name": target_name,
            "business_description": "Consumer gadget store",
            "contact_email": email,
            "contact_phone": "+91 9988776655",
            "business_address": "Bengaluru"
        }
    )
    assert res2.status_code == 201, f"Expected 201 for valid application, got {res2.status_code}: {res2.text}"
    data = res2.json()
    assert data["approval_status"] == "pending"
    assert data["store_name"] == target_name

def test_admin_approval_elevates_role_consistently():
    # 1. Create customer and pending seller application
    uid, email, cust_token = create_test_user_and_token(role="customer", is_active=True)
    cust_headers = {"Authorization": f"Bearer {cust_token}"}
    target_name = f"Store For Admin Approval {uuid.uuid4().hex[:6]}"
    res_app = client.post(
        "/api/v1/sellers/apply",
        headers=cust_headers,
        json={"store_name": target_name}
    )
    seller_id = res_app.json()["seller_id"]

    # 2. Admin approves application
    admin_uid, admin_email, admin_token = create_test_user_and_token(role="admin", is_active=True)
    admin_headers = {"Authorization": f"Bearer {admin_token}"}
    res_approve = client.patch(
        f"/api/v1/admin/sellers/{seller_id}/approval",
        headers=admin_headers,
        json={"approval_status": "approved"}
    )
    assert res_approve.status_code == 200, f"Expected 200 for admin approval, got {res_approve.status_code}"
    assert res_approve.json()["approval_status"] == "approved"

    # 3. Verify user role was elevated to 'seller'
    db = SessionLocal()
    user = db.query(AppUser).filter(AppUser.user_id == uid).first()
    assert user.role == "seller", f"Expected user role to be 'seller', got '{user.role}'"
    db.close()
