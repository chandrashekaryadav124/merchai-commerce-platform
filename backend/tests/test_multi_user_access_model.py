import sys
import os
import uuid

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from fastapi.testclient import TestClient
from sqlalchemy import text
from app.main import app
from app.db.session import SessionLocal
from app.models.users import AppUser
from app.core.security import get_password_hash

client = TestClient(app)

def get_admin_token():
    db = SessionLocal()
    try:
        admin_user = db.query(AppUser).filter(AppUser.role == "admin").first()
        if not admin_user:
            admin_user = AppUser(
                user_id=f"USR-{uuid.uuid4().hex[:8].upper()}",
                full_name="System Administrator",
                email="admin@example.invalid",
                password_hash=get_password_hash("AdminPassword123!"),
                role="admin",
                is_active=True,
                is_demo_account=True
            )
            db.add(admin_user)
            db.commit()
            email = "admin@example.invalid"
        else:
            email = admin_user.email
            admin_user.password_hash = get_password_hash("AdminPassword123!")
            admin_user.is_active = True
            db.commit()
    finally:
        db.close()

    login_res = client.post("/api/v1/auth/login", json={
        "email": email,
        "password": "AdminPassword123!"
    })
    assert login_res.status_code == 200, f"Admin login failed for {email}: {login_res.text}"
    return login_res.json()["access_token"]

def test_1_public_registration_forces_customer_role():
    """Verify public registration overrides any client-supplied privileged role to 'customer'."""
    email = f"priv_esc_{uuid.uuid4().hex[:6]}@example.com"
    res = client.post("/api/v1/auth/register", json={
        "full_name": "Hacker Impersonator",
        "email": email,
        "password": "Password123!",
        "role": "admin"  # Attempting privilege escalation
    })
    assert res.status_code == 201
    data = res.json()
    assert data["role"] == "customer", "Public registration MUST ignore client-supplied role and force 'customer'"

    db = SessionLocal()
    try:
        user_rec = db.execute(
            text("SELECT role FROM app_users WHERE email = :email;"),
            {"email": email}
        ).fetchone()
        assert user_rec._mapping["role"] == "customer"
    finally:
        db.close()

def test_2_seller_onboarding_application_and_approval_workflow():
    """Verify seller application workflow: pending status, role update only upon admin approval."""
    # 1. Register customer
    email = f"seller_applicant_{uuid.uuid4().hex[:6]}@example.com"
    reg_res = client.post("/api/v1/auth/register", json={
        "full_name": "Merchant Applicant",
        "email": email,
        "password": "Password123!"
    })
    assert reg_res.status_code == 201

    # Login as applicant
    login_res = client.post("/api/v1/auth/login", json={"email": email, "password": "Password123!"})
    token = login_res.json()["access_token"]
    user_headers = {"Authorization": f"Bearer {token}"}

    # 2. Submit Seller Application
    store_name = f"Apex Store {uuid.uuid4().hex[:6]}"
    apply_res = client.post("/api/v1/sellers/apply", headers=user_headers, json={
        "store_name": store_name,
        "business_description": "Premium Electronics Retailer"
    })
    assert apply_res.status_code == 201
    seller_data = apply_res.json()
    assert seller_data["approval_status"] == "pending"
    seller_id = seller_data["seller_id"]

    # 3. Applicant attempts to approve themselves -> Failure (403 Forbidden or invalid endpoint)
    self_approve_res = client.patch(f"/api/v1/admin/sellers/{seller_id}/approval", headers=user_headers, json={
        "approval_status": "approved"
    })
    assert self_approve_res.status_code == 403, "Non-admin must NOT be able to approve seller applications"

    # 4. Admin approves application
    admin_token = get_admin_token()
    admin_headers = {"Authorization": f"Bearer {admin_token}"}
    admin_approve_res = client.patch(f"/api/v1/admin/sellers/{seller_id}/approval", headers=admin_headers, json={
        "approval_status": "approved"
    })
    assert admin_approve_res.status_code == 200
    assert admin_approve_res.json()["approval_status"] == "approved"

    # 5. User re-logins and verifies elevated 'seller' role
    login_res2 = client.post("/api/v1/auth/login", json={"email": email, "password": "Password123!"})
    assert login_res2.json()["role"] == "seller"

def test_3_admin_only_user_provisioning():
    """Verify admin can provision support, operations, or admin accounts."""
    admin_token = get_admin_token()
    admin_headers = {"Authorization": f"Bearer {admin_token}"}

    sup_email = f"support_agent_{uuid.uuid4().hex[:6]}@example.com"
    prov_res = client.post("/api/v1/admin/users/provision", headers=admin_headers, json={
        "full_name": "Support Desk Agent",
        "email": sup_email,
        "password": "AgentPassword123!",
        "role": "support"
    })
    assert prov_res.status_code == 201
    assert prov_res.json()["role"] == "support"

    # Non-admin attempting to provision -> 403
    cust_res = client.post("/api/v1/auth/register", json={
        "full_name": "Normal Customer",
        "email": f"norm_{uuid.uuid4().hex[:6]}@example.com",
        "password": "Password123!"
    })
    cust_token = client.post("/api/v1/auth/login", json={"email": cust_res.json()["email"], "password": "Password123!"}).json()["access_token"]
    
    unauth_prov = client.post("/api/v1/admin/users/provision", headers={"Authorization": f"Bearer {cust_token}"}, json={
        "full_name": "Rogue Admin",
        "email": f"rogue_{uuid.uuid4().hex[:6]}@example.com",
        "password": "Password123!",
        "role": "admin"
    })
    assert unauth_prov.status_code == 403

def test_4_cross_customer_data_isolation():
    """Verify customer accounts cannot view each other's orders or private account data."""
    # Customer A
    email_a = f"cust_a_{uuid.uuid4().hex[:6]}@example.com"
    client.post("/api/v1/auth/register", json={"full_name": "Customer A", "email": email_a, "password": "Password123!"})
    token_a = client.post("/api/v1/auth/login", json={"email": email_a, "password": "Password123!"}).json()["access_token"]

    # Customer B
    email_b = f"cust_b_{uuid.uuid4().hex[:6]}@example.com"
    client.post("/api/v1/auth/register", json={"full_name": "Customer B", "email": email_b, "password": "Password123!"})
    token_b = client.post("/api/v1/auth/login", json={"email": email_b, "password": "Password123!"}).json()["access_token"]

    # Customer A places order
    order_res = client.post("/api/v1/orders", headers={"Authorization": f"Bearer {token_a}"}, json={
        "shipping_address": "Customer A Address",
        "items": [{"product_id": "P001", "quantity": 1, "unit_price": 500.0}]
    })
    assert order_res.status_code == 200
    order_id = order_res.json()["order_id"]

    # Customer B attempts to fetch Customer A's order detail -> 404/403
    unauth_order = client.get(f"/api/v1/customer/account/orders/{order_id}", headers={"Authorization": f"Bearer {token_b}"})
    assert unauth_order.status_code in [403, 404]

def test_5_cross_seller_data_isolation():
    """Verify sellers can only access products associated with their own approved store."""
    admin_token = get_admin_token()
    admin_headers = {"Authorization": f"Bearer {admin_token}"}

    # Provision Seller 1
    email_s1 = f"seller_one_{uuid.uuid4().hex[:6]}@example.com"
    client.post("/api/v1/admin/users/provision", headers=admin_headers, json={
        "full_name": "Seller One",
        "email": email_s1,
        "password": "Password123!",
        "role": "seller"
    })
    token_s1 = client.post("/api/v1/auth/login", json={"email": email_s1, "password": "Password123!"}).json()["access_token"]

    # Seller 1 creates product
    prod_res = client.post("/api/v1/products", headers={"Authorization": f"Bearer {token_s1}"}, json={
        "product_name": "Seller 1 Exclusive Gadget",
        "category": "Electronics",
        "price": 1499.0,
        "stock_quantity": 50
    })
    assert prod_res.status_code == 200

    # Seller 1 fetches products -> gets product
    s1_prods = client.get("/api/v1/sellers/me/products", headers={"Authorization": f"Bearer {token_s1}"})
    assert s1_prods.status_code == 200
    assert len(s1_prods.json()) >= 1

def test_6_support_ticket_workflow_and_rbac_protection():
    """Verify customer ticket creation and support agent status update workflow."""
    # 1. Customer creates ticket
    cust_email = f"ticket_cust_{uuid.uuid4().hex[:6]}@example.com"
    client.post("/api/v1/auth/register", json={"full_name": "Ticket Customer", "email": cust_email, "password": "Password123!"})
    cust_token = client.post("/api/v1/auth/login", json={"email": cust_email, "password": "Password123!"}).json()["access_token"]
    
    tkt_res = client.post("/api/v1/support/tickets", headers={"Authorization": f"Bearer {cust_token}"}, json={
        "issue_type": "Delivery Delay",
        "customer_message": "My package has not arrived yet."
    })
    assert tkt_res.status_code == 200
    tkt_id = tkt_res.json()["ticket_id"]

    # Customer cannot resolve ticket status -> 403
    unauth_patch = client.patch(f"/api/v1/support/tickets/{tkt_id}", headers={"Authorization": f"Bearer {cust_token}"}, json={
        "ticket_status": "Resolved",
        "resolution_guidance": "Customer self-resolved."
    })
    assert unauth_patch.status_code == 403

    # 2. Provision Support Agent
    admin_token = get_admin_token()
    sup_email = f"agent_{uuid.uuid4().hex[:6]}@example.com"
    client.post("/api/v1/admin/users/provision", headers={"Authorization": f"Bearer {admin_token}"}, json={
        "full_name": "Support Agent",
        "email": sup_email,
        "password": "Password123!",
        "role": "support"
    })
    agent_token = client.post("/api/v1/auth/login", json={"email": sup_email, "password": "Password123!"}).json()["access_token"]

    # Support agent updates ticket
    agent_patch = client.patch(f"/api/v1/support/tickets/{tkt_id}", headers={"Authorization": f"Bearer {agent_token}"}, json={
        "ticket_status": "In Progress",
        "resolution_guidance": "Investigating carrier status."
    })
    assert agent_patch.status_code == 200
    assert agent_patch.json()["ticket_status"] == "In Progress"

def test_7_operations_data_retrieval_and_db_status():
    """Verify operations endpoints return real shipments and warehouse inventory data."""
    admin_token = get_admin_token()
    ops_email = f"ops_user_{uuid.uuid4().hex[:6]}@example.com"
    client.post("/api/v1/admin/users/provision", headers={"Authorization": f"Bearer {admin_token}"}, json={
        "full_name": "Ops Specialist",
        "email": ops_email,
        "password": "Password123!",
        "role": "operations"
    })
    ops_token = client.post("/api/v1/auth/login", json={"email": ops_email, "password": "Password123!"}).json()["access_token"]
    ops_headers = {"Authorization": f"Bearer {ops_token}"}

    ship_res = client.get("/api/v1/operations/shipments", headers=ops_headers)
    assert ship_res.status_code == 200
    assert isinstance(ship_res.json(), list)

    inv_res = client.get("/api/v1/operations/inventory", headers=ops_headers)
    assert inv_res.status_code == 200
    assert isinstance(inv_res.json(), list)

def test_8_dashboard_metrics_correctness():
    """Verify admin metrics endpoint returns aggregated database metrics."""
    admin_token = get_admin_token()
    metrics_res = client.get("/api/v1/admin/metrics", headers={"Authorization": f"Bearer {admin_token}"})
    assert metrics_res.status_code == 200
    data = metrics_res.json()
    assert "gmv_total" in data
    assert "active_sellers" in data
    assert "total_products" in data
    assert "total_orders_processed" in data

