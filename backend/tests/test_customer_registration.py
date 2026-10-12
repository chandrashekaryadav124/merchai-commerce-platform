import sys
import os
import uuid
from datetime import datetime

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from fastapi.testclient import TestClient
from sqlalchemy import text
from app.main import app
from app.db.session import SessionLocal

client = TestClient(app)

def test_1_successful_customer_registration():
    unique_email = f"test_reg_{uuid.uuid4().hex[:6]}@example.com"
    payload = {
        "full_name": "Jane Tester",
        "email": unique_email,
        "password": "SecurePassword123!",
        "role": "customer",
        "gender": "Female",
        "age": 29,
        "state": "Karnataka",
        "city": "Bengaluru",
        "pincode_prefix": 560,
        "preferred_device": "Mobile App",
        "preferred_payment_method": "UPI"
    }

    res = client.post("/api/v1/auth/register", json=payload)
    assert res.status_code == 201, f"Registration failed: {res.text}"
    
    data = res.json()
    assert "user_id" in data
    assert data["email"] == unique_email
    assert data["full_name"] == "Jane Tester"
    assert data["role"] == "customer"
    assert "password" not in data
    assert "password_hash" not in data

    # Direct DB inspection
    db = SessionLocal()
    try:
        user_rec = db.execute(
            text("SELECT user_id, email, password_hash FROM app_users WHERE email = :email;"),
            {"email": unique_email}
        ).fetchone()
        assert user_rec is not None
        assert user_rec._mapping["password_hash"].startswith("$2b$")
        assert user_rec._mapping["password_hash"] != "SecurePassword123!"

        cust_rec = db.execute(
            text("SELECT customer_id, app_user_id, gender, age, city, state, total_orders, total_spend FROM customers WHERE app_user_id = :uid;"),
            {"uid": user_rec._mapping["user_id"]}
        ).fetchone()
        assert cust_rec is not None
        assert cust_rec._mapping["app_user_id"] == user_rec._mapping["user_id"]
        assert cust_rec._mapping["gender"] == "Female"
        assert cust_rec._mapping["age"] == 29.0
        assert cust_rec._mapping["city"] == "Bengaluru"
        assert cust_rec._mapping["total_orders"] == 0
        assert cust_rec._mapping["total_spend"] == 0.0
    finally:
        db.close()

def test_2_duplicate_email_rejected():
    unique_email = f"dup_test_{uuid.uuid4().hex[:6]}@example.com"
    payload = {
        "full_name": "First User",
        "email": unique_email,
        "password": "Password123!",
        "role": "customer"
    }
    
    res1 = client.post("/api/v1/auth/register", json=payload)
    assert res1.status_code == 201

    res2 = client.post("/api/v1/auth/register", json=payload)
    assert res2.status_code == 400
    assert "already exists" in res2.json()["detail"].lower()

def test_3_invalid_form_data_rejected():
    # Short password
    res1 = client.post("/api/v1/auth/register", json={
        "full_name": "Short Pass",
        "email": f"invalid_{uuid.uuid4().hex[:4]}@example.com",
        "password": "123"
    })
    assert res1.status_code == 400

    # Invalid email
    res2 = client.post("/api/v1/auth/register", json={
        "full_name": "Bad Email",
        "email": "not-an-email",
        "password": "ValidPassword123"
    })
    assert res2.status_code == 400

    # Invalid age
    res3 = client.post("/api/v1/auth/register", json={
        "full_name": "Bad Age",
        "email": f"badage_{uuid.uuid4().hex[:4]}@example.com",
        "password": "ValidPassword123",
        "age": 150
    })
    assert res3.status_code == 400

def test_4_historical_customer_records_intact():
    db = SessionLocal()
    try:
        cnt = db.execute(text("SELECT COUNT(*) FROM customers;")).fetchone()[0]
        assert cnt >= 20000, f"Expected at least 20000 customer records, found {cnt}"
        
        hist_null_app_user = db.execute(text("SELECT COUNT(*) FROM customers WHERE app_user_id IS NULL;")).fetchone()[0]
        assert hist_null_app_user >= 20000, f"Historical records should have NULL app_user_id"
    finally:
        db.close()

def test_5_new_customer_login_and_scoped_data():
    email = f"scoped_{uuid.uuid4().hex[:6]}@example.com"
    pwd = "MySecretPassword123!"

    # Register
    reg_res = client.post("/api/v1/auth/register", json={
        "full_name": "Scoped Customer",
        "email": email,
        "password": pwd,
        "city": "Mysuru",
        "state": "Karnataka"
    })
    assert reg_res.status_code == 201

    # Login
    login_res = client.post("/api/v1/auth/login", json={"email": email, "password": pwd})
    assert login_res.status_code == 200
    token = login_res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # Fetch Profile
    prof_res = client.get("/api/v1/customer/account/profile", headers=headers)
    assert prof_res.status_code == 200
    prof_data = prof_res.json()
    assert prof_data["email"] == email
    assert prof_data["total_orders"] == 0
    assert prof_data["total_spend"] == 0.0
    assert prof_data["loyalty_tier"] == "Bronze"

    # Fetch Orders (should be 0 orders for new account)
    ord_res = client.get("/api/v1/customer/account/orders", headers=headers)
    assert ord_res.status_code == 200
    assert ord_res.json()["total"] == 0
