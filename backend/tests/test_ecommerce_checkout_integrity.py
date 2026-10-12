import sys
import os
import uuid
import pytest
from decimal import Decimal
from fastapi.testclient import TestClient
from sqlalchemy import text

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.main import app
from app.db.session import SessionLocal
from app.models.sellers import SellerProduct, Seller
from app.models.products import Product
from app.models.orders import Order, OrderItem, SellerOrder
from app.models.cart import Cart, CartItem
from app.models.customer_account import CustomerAddress

client = TestClient(app)

def create_test_customer(name: str = "Test Customer"):
    uid = uuid.uuid4().hex[:6]
    email = f"cust_{uid}@test.local"
    pwd = "SecurePassword123!"
    reg_res = client.post("/api/v1/auth/register", json={
        "full_name": name,
        "email": email,
        "password": pwd,
        "role": "customer",
        "city": "Bengaluru",
        "state": "Karnataka"
    })
    assert reg_res.status_code == 201, f"Register failed: {reg_res.text}"
    user_id = reg_res.json()["user_id"]

    login_res = client.post("/api/v1/auth/login", json={"email": email, "password": pwd})
    assert login_res.status_code == 200, f"Login failed: {login_res.text}"
    token = login_res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}
    return user_id, headers, email

def get_or_create_test_products():
    db = SessionLocal()
    try:
        # Find active seller products
        sps = db.query(SellerProduct).filter(
            SellerProduct.listing_status == "active",
            SellerProduct.stock_quantity > 10
        ).limit(2).all()
        assert len(sps) >= 2, "Need at least 2 active seller products in DB"
        sp1_id = sps[0].seller_product_id
        sp2_id = sps[1].seller_product_id
        sp1_price = float(sps[0].selling_price)
        sp2_price = float(sps[1].selling_price)
        return (sp1_id, sps[0].product_id, sp1_price, sps[0].seller_id), (sp2_id, sps[1].product_id, sp2_price, sps[1].seller_id)
    finally:
        db.close()

# TEST 1: Customer A cannot access Customer B's saved addresses
def test_1_customer_address_isolation():
    _, headers_a, _ = create_test_customer("Customer Alpha")
    _, headers_b, _ = create_test_customer("Customer Beta")

    # Customer A creates an address
    addr_payload = {
        "recipient_name": "Alpha Recipient",
        "phone_number": "9876543210",
        "address_line1": "100 MG Road",
        "city": "Bengaluru",
        "state": "Karnataka",
        "postal_code": "560001",
        "is_default": True
    }
    create_res = client.post("/api/v1/customer/addresses", json=addr_payload, headers=headers_a)
    assert create_res.status_code == 201
    addr_id = create_res.json()["address_id"]

    # Customer B attempts to view Customer A's address
    view_res = client.get(f"/api/v1/customer/addresses/{addr_id}", headers=headers_b)
    assert view_res.status_code in (403, 404), f"Customer B should not view Customer A's address: {view_res.status_code}"

    # Customer B attempts to update Customer A's address
    upd_res = client.put(f"/api/v1/customer/addresses/{addr_id}", json={"city": "Hacked City"}, headers=headers_b)
    assert upd_res.status_code in (403, 404)

    # Customer B attempts to delete Customer A's address
    del_res = client.delete(f"/api/v1/customer/addresses/{addr_id}", headers=headers_b)
    assert del_res.status_code in (403, 404)

# TEST 2: Customer A cannot access Customer B's cart
def test_2_cart_isolation():
    _, headers_a, _ = create_test_customer("Cart User A")
    _, headers_b, _ = create_test_customer("Cart User B")
    (sp1_id, prod1_id, _, _), _ = get_or_create_test_products()

    # Customer A adds item to cart
    add_res = client.post("/api/v1/cart/items", json={"seller_product_id": sp1_id, "quantity": 2}, headers=headers_a)
    assert add_res.status_code == 201
    cart_a = add_res.json()
    assert cart_a["item_count"] == 2

    # Customer B checks cart (must be empty)
    cart_b_res = client.get("/api/v1/cart", headers=headers_b)
    assert cart_b_res.status_code == 200
    cart_b = cart_b_res.json()
    assert cart_b["item_count"] == 0
    assert len(cart_b["items"]) == 0

# TEST 3: A client cannot manipulate product prices (server-side price resolution is authoritative)
def test_3_client_cannot_manipulate_prices():
    _, headers, _ = create_test_customer("Price Test User")
    (sp1_id, _, real_price, _), _ = get_or_create_test_products()

    # Add item to cart
    add_res = client.post("/api/v1/cart/items", json={"seller_product_id": sp1_id, "quantity": 1}, headers=headers)
    assert add_res.status_code == 201
    item = add_res.json()["items"][0]
    assert item["unit_price"] == real_price, f"Server must resolve real DB price {real_price}, got {item['unit_price']}"

# TEST 4: A client cannot manipulate order totals
def test_4_client_cannot_manipulate_order_totals():
    _, headers, _ = create_test_customer("Totals User")
    (sp1_id, _, real_price, _), _ = get_or_create_test_products()

    client.post("/api/v1/cart/items", json={"seller_product_id": sp1_id, "quantity": 1}, headers=headers)

    summary_res = client.get("/api/v1/checkout/summary", headers=headers)
    assert summary_res.status_code == 200
    summary = summary_res.json()

    expected_subtotal = round(real_price * 1, 2)
    expected_shipping = 0.0 if expected_subtotal >= 1000.0 else 49.0
    expected_tax = round(expected_subtotal * 0.05, 2)
    expected_total = round(expected_subtotal + expected_shipping + expected_tax, 2)

    assert summary["merchandise_subtotal"] == expected_subtotal
    assert summary["shipping_fee"] == expected_shipping
    assert summary["tax_amount"] == expected_tax
    assert summary["final_total"] == expected_total

# TEST 5: A customer cannot place an order using another customer's address
def test_5_cannot_use_another_customers_address():
    _, headers_a, _ = create_test_customer("Customer Address Owner")
    _, headers_b, _ = create_test_customer("Customer Attacker")
    (sp1_id, _, _, _), _ = get_or_create_test_products()

    # Customer A creates address
    addr_res = client.post("/api/v1/customer/addresses", json={
        "recipient_name": "Owner",
        "phone_number": "9876543210",
        "address_line1": "Owner Street",
        "city": "Bengaluru",
        "state": "Karnataka",
        "postal_code": "560001"
    }, headers=headers_a)
    assert addr_res.status_code == 201
    addr_id_a = addr_res.json()["address_id"]

    # Customer B adds item to cart and attempts to order with Customer A's address_id
    client.post("/api/v1/cart/items", json={"seller_product_id": sp1_id, "quantity": 1}, headers=headers_b)
    order_res = client.post("/api/v1/checkout/place-order", json={"address_id": addr_id_a}, headers=headers_b)
    assert order_res.status_code in (400, 403, 404), f"Should reject using another customer's address: {order_res.status_code}"

# TEST 6: Checkout rejects insufficient stock
def test_6_checkout_rejects_insufficient_stock():
    _, headers, _ = create_test_customer("Stock Test User")
    db = SessionLocal()
    try:
        # Create a product with strictly 2 units in stock
        sp = db.query(SellerProduct).filter(SellerProduct.listing_status == "active", SellerProduct.stock_quantity == 2).first()
        if not sp:
            sp = db.query(SellerProduct).filter(SellerProduct.listing_status == "active").first()
            sp.stock_quantity = 2
            db.commit()
            db.refresh(sp)
        test_sp_id = sp.seller_product_id
    finally:
        db.close()

    # Attempting to add 5 units when only 2 exist should be rejected
    res = client.post("/api/v1/cart/items", json={"seller_product_id": test_sp_id, "quantity": 5}, headers=headers)
    assert res.status_code == 400
    assert "insufficient" in res.json()["detail"].lower()

# TEST 7: Invalid or inactive listings cannot be purchased
def test_7_inactive_listing_rejected():
    _, headers, _ = create_test_customer("Inactive Test User")
    db = SessionLocal()
    try:
        # Create a paused listing
        sp = db.query(SellerProduct).filter(SellerProduct.listing_status.in_(["paused", "draft", "removed"])).first()
        if not sp:
            sp = db.query(SellerProduct).first()
            sp.listing_status = "paused"
            db.commit()
            db.refresh(sp)
        inactive_sp_id = sp.seller_product_id
    finally:
        db.close()

    res = client.post("/api/v1/cart/items", json={"seller_product_id": inactive_sp_id, "quantity": 1}, headers=headers)
    assert res.status_code == 400
    assert "unavailable" in res.json()["detail"].lower() or "paused" in res.json()["detail"].lower() or "inactive" in res.json()["detail"].lower()

# TEST 8: Failed order creation does not partially update inventory or clear the cart
def test_8_failed_order_rollback_integrity():
    _, headers, _ = create_test_customer("Rollback User")
    (sp1_id, _, _, _), _ = get_or_create_test_products()

    # Add 1 unit
    client.post("/api/v1/cart/items", json={"seller_product_id": sp1_id, "quantity": 1}, headers=headers)

    db = SessionLocal()
    initial_stock = 0
    try:
        sp = db.query(SellerProduct).filter(SellerProduct.seller_product_id == sp1_id).first()
        initial_stock = sp.stock_quantity
    finally:
        db.close()

    # Try placing order with invalid address (missing required fields)
    bad_order_res = client.post("/api/v1/checkout/place-order", json={"address_id": 999999999}, headers=headers)
    assert bad_order_res.status_code in (400, 404)

    # Cart should STILL contain the item
    cart_res = client.get("/api/v1/cart", headers=headers)
    assert cart_res.json()["item_count"] == 1

    # Stock should remain unchanged
    db = SessionLocal()
    try:
        sp = db.query(SellerProduct).filter(SellerProduct.seller_product_id == sp1_id).first()
        assert sp.stock_quantity == initial_stock, "Stock should not change on failed order placement"
    finally:
        db.close()

# TEST 9: Retried requests do not create duplicate orders (idempotency key protection)
def test_9_idempotency_prevents_duplicate_orders():
    _, headers, _ = create_test_customer("Idempotent User")
    (sp1_id, _, _, _), _ = get_or_create_test_products()

    # Add address
    addr_res = client.post("/api/v1/customer/addresses", json={
        "recipient_name": "Idempotent Buyer",
        "phone_number": "9876543210",
        "address_line1": "45 MG Road",
        "city": "Bengaluru",
        "state": "Karnataka",
        "postal_code": "560001"
    }, headers=headers)
    addr_id = addr_res.json()["address_id"]

    # Add item to cart
    client.post("/api/v1/cart/items", json={"seller_product_id": sp1_id, "quantity": 1}, headers=headers)

    idem_key = f"IDEM-{uuid.uuid4().hex}"
    req_payload = {"address_id": addr_id, "idempotency_key": idem_key}

    # 1st attempt: places order
    res1 = client.post("/api/v1/checkout/place-order", json=req_payload, headers=headers)
    assert res1.status_code == 201
    order_id_1 = res1.json()["order_id"]

    # 2nd attempt with same idempotency key (e.g. network retry): returns SAME order without duplicate creation
    res2 = client.post("/api/v1/checkout/place-order", json=req_payload, headers=headers)
    assert res2.status_code in (200, 201)
    order_id_2 = res2.json()["order_id"]

    assert order_id_1 == order_id_2, "Idempotency retry must return existing order ID, not create a new one"

# TEST 10: Multi-seller order associations are correct in a multi-seller cart
def test_10_multi_seller_order_associations():
    _, headers, _ = create_test_customer("Multi Seller Buyer")
    db = SessionLocal()
    try:
        # Find 2 active items from distinct sellers
        sps = db.execute(text("""
            SELECT sp1.seller_product_id as sp1_id, sp2.seller_product_id as sp2_id,
                   sp1.seller_id as s1_id, sp2.seller_id as s2_id
            FROM seller_products sp1
            JOIN seller_products sp2 ON sp1.seller_id != sp2.seller_id
            WHERE sp1.listing_status = 'active' AND sp2.listing_status = 'active'
              AND sp1.stock_quantity > 2 AND sp2.stock_quantity > 2
            LIMIT 1;
        """)).fetchone()
        assert sps is not None, "Need items from 2 different sellers"
        sp1_id, sp2_id, s1_id, s2_id = sps[0], sps[1], sps[2], sps[3]
    finally:
        db.close()

    # Add address
    addr_res = client.post("/api/v1/customer/addresses", json={
        "recipient_name": "Multi Buyer",
        "phone_number": "9123456789",
        "address_line1": "77 Brigade Road",
        "city": "Bengaluru",
        "state": "Karnataka",
        "postal_code": "560025"
    }, headers=headers)
    addr_id = addr_res.json()["address_id"]

    # Add both items to cart
    client.post("/api/v1/cart/items", json={"seller_product_id": sp1_id, "quantity": 1}, headers=headers)
    client.post("/api/v1/cart/items", json={"seller_product_id": sp2_id, "quantity": 1}, headers=headers)

    # Place order
    order_res = client.post("/api/v1/checkout/place-order", json={"address_id": addr_id}, headers=headers)
    assert order_res.status_code == 201
    order_id = order_res.json()["order_id"]

    # Check seller orders in DB
    db = SessionLocal()
    try:
        seller_orders = db.query(SellerOrder).filter(SellerOrder.order_id == order_id).all()
        assert len(seller_orders) == 2, f"Expected 2 seller orders for 2 distinct sellers, got {len(seller_orders)}"
        found_sellers = {so.seller_id for so in seller_orders}
        assert s1_id in found_sellers
        assert s2_id in found_sellers
    finally:
        db.close()

# TEST 11: Checkout fee derived from real policy (₹0 if >= ₹1000, ₹49 if < ₹1000)
def test_11_checkout_fee_policy():
    _, headers, _ = create_test_customer("Fee Policy User")
    (sp1_id, _, price, _), _ = get_or_create_test_products()

    # Clear cart first
    client.delete("/api/v1/cart", headers=headers)

    # Empty cart summary
    empty_summary = client.get("/api/v1/checkout/summary", headers=headers).json()
    assert empty_summary["shipping_fee"] == 0.0

    # Add 1 item
    client.post("/api/v1/cart/items", json={"seller_product_id": sp1_id, "quantity": 1}, headers=headers)
    summary_1 = client.get("/api/v1/checkout/summary", headers=headers).json()

    if summary_1["merchandise_subtotal"] >= 1000.0:
        assert summary_1["shipping_fee"] == 0.0
    else:
        assert summary_1["shipping_fee"] == 49.0
        assert "49" in summary_1["shipping_fee_basis"]

# TEST 12: Customer order history is properly scoped
def test_12_customer_order_history_scoped():
    _, headers_a, _ = create_test_customer("Order Scope A")
    _, headers_b, _ = create_test_customer("Order Scope B")
    (sp1_id, _, _, _), _ = get_or_create_test_products()

    # Customer A creates an address and places order
    addr_res = client.post("/api/v1/customer/addresses", json={
        "recipient_name": "Alice Customer", "phone_number": "9000000000",
        "address_line1": "Street A", "city": "Bengaluru",
        "state": "Karnataka", "postal_code": "560001"
    }, headers=headers_a)
    assert addr_res.status_code == 201
    addr_id = addr_res.json()["address_id"]

    client.post("/api/v1/cart/items", json={"seller_product_id": sp1_id, "quantity": 1}, headers=headers_a)
    order_a = client.post("/api/v1/checkout/place-order", json={"address_id": addr_id}, headers=headers_a).json()
    order_id_a = order_a["order_id"]

    # Customer B checks orders (must NOT include Customer A's order)
    orders_b = client.get("/api/v1/customer/account/orders", headers=headers_b).json()
    b_order_ids = [o["order_id"] for o in orders_b.get("items", [])]
    assert order_id_a not in b_order_ids

    # Customer B attempts to get Customer A's order details directly
    detail_res = client.get(f"/api/v1/customer/account/orders/{order_id_a}", headers=headers_b)
    assert detail_res.status_code in (403, 404)

# TEST 13: Existing historical customer and order records remain unchanged
def test_13_historical_records_intact():
    db = SessionLocal()
    try:
        cust_cnt = db.execute(text("SELECT COUNT(*) FROM customers;")).fetchone()[0]
        ord_cnt = db.execute(text("SELECT COUNT(*) FROM orders;")).fetchone()[0]
        assert cust_cnt >= 20000, f"Expected >= 20000 customers, got {cust_cnt}"
        assert ord_cnt >= 20000, f"Expected >= 20000 orders, got {ord_cnt}"
    finally:
        db.close()

# TEST 14: Missing optional fields produce honest fallbacks
def test_14_missing_fields_honest_fallbacks():
    _, headers, _ = create_test_customer("Honest Fallbacks User")

    # Fetch profile without legacy historical mapping
    prof = client.get("/api/v1/customer/account/profile", headers=headers).json()
    assert prof["gender"] in ("Not Specified", None, "Female", "Male", "Other")

    # Saved addresses must be empty list, not a fabricated address
    addrs = client.get("/api/v1/customer/addresses", headers=headers).json()
    assert len(addrs) == 0

# TEST 15: Product prices remain consistent across marketplace, cart, checkout, and persisted order
def test_15_price_consistency_end_to_end():
    _, headers, _ = create_test_customer("End to End Price User")
    (sp1_id, prod_id, real_price, _), _ = get_or_create_test_products()

    # 1. Check marketplace product detail
    prod_res = client.get(f"/api/v1/products/{prod_id}")
    assert prod_res.status_code == 200

    # 2. Add to cart
    cart_res = client.post("/api/v1/cart/items", json={"seller_product_id": sp1_id, "quantity": 1}, headers=headers)
    assert cart_res.status_code == 201
    cart_unit_price = cart_res.json()["items"][0]["unit_price"]
    assert cart_unit_price == real_price

    # 3. Check checkout summary
    summary_res = client.get("/api/v1/checkout/summary", headers=headers)
    assert summary_res.status_code == 200
    checkout_unit_price = summary_res.json()["items"][0]["unit_price"]
    assert checkout_unit_price == real_price

    # 4. Place order
    addr_res = client.post("/api/v1/customer/addresses", json={
        "recipient_name": "Price Checker",
        "phone_number": "9876543210",
        "address_line1": "Price Ave",
        "city": "Bengaluru",
        "state": "Karnataka",
        "postal_code": "560001"
    }, headers=headers)
    addr_id = addr_res.json()["address_id"]

    order_res = client.post("/api/v1/checkout/place-order", json={"address_id": addr_id}, headers=headers)
    assert order_res.status_code == 201
    persisted_item_price = order_res.json()["items"][0]["unit_price"]
    assert persisted_item_price == real_price

# TEST 16: Address PIN code validation enforces 6-digit Indian PIN code
def test_16_address_pincode_validation():
    _, headers, _ = create_test_customer("Pincode Validation User")

    # Invalid: 5 digits
    res1 = client.post("/api/v1/customer/addresses", json={
        "recipient_name": "Test", "phone_number": "9876543210",
        "address_line1": "Street", "city": "Bengaluru",
        "state": "Karnataka", "postal_code": "56000"
    }, headers=headers)
    assert res1.status_code in (400, 422)

    # Invalid: letters
    res2 = client.post("/api/v1/customer/addresses", json={
        "recipient_name": "Test", "phone_number": "9876543210",
        "address_line1": "Street", "city": "Bengaluru",
        "state": "Karnataka", "postal_code": "56000A"
    }, headers=headers)
    assert res2.status_code in (400, 422)

    # Valid: 6 digits starting with 1-9
    res3 = client.post("/api/v1/customer/addresses", json={
        "recipient_name": "Test", "phone_number": "9876543210",
        "address_line1": "Street", "city": "Bengaluru",
        "state": "Karnataka", "postal_code": "560001"
    }, headers=headers)
    assert res3.status_code == 201
    assert res3.json()["postal_code"] == "560001"

# TEST 17: Address CRUD operations: add, edit, delete, set default
def test_17_address_crud_workflow():
    _, headers, _ = create_test_customer("CRUD User")

    # 1. Add Address 1 (becomes default automatically)
    res1 = client.post("/api/v1/customer/addresses", json={
        "recipient_name": "Home Address", "phone_number": "9876543210",
        "address_line1": "1st Main Road", "city": "Bengaluru",
        "state": "Karnataka", "postal_code": "560001"
    }, headers=headers)
    assert res1.status_code == 201
    addr1 = res1.json()
    assert addr1["is_default"] is True
    addr1_id = addr1["address_id"]

    # 2. Add Address 2 (not default)
    res2 = client.post("/api/v1/customer/addresses", json={
        "recipient_name": "Office Address", "phone_number": "9876543211",
        "address_line1": "2nd Cross Tech Park", "city": "Bengaluru",
        "state": "Karnataka", "postal_code": "560066",
        "is_default": False
    }, headers=headers)
    assert res2.status_code == 201
    addr2 = res2.json()
    assert addr2["is_default"] is False
    addr2_id = addr2["address_id"]

    # 3. List addresses
    list_res = client.get("/api/v1/customer/addresses", headers=headers)
    assert list_res.status_code == 200
    assert len(list_res.json()) == 2

    # 4. Set Address 2 as default
    def_res = client.patch(f"/api/v1/customer/addresses/{addr2_id}/default", headers=headers)
    assert def_res.status_code == 200
    assert def_res.json()["is_default"] is True

    # Address 1 should now not be default
    addr1_check = client.get(f"/api/v1/customer/addresses/{addr1_id}", headers=headers).json()
    assert addr1_check["is_default"] is False

    # 5. Edit Address 2
    edit_res = client.put(f"/api/v1/customer/addresses/{addr2_id}", json={
        "recipient_name": "Office Tech Park Updated"
    }, headers=headers)
    assert edit_res.status_code == 200
    assert edit_res.json()["recipient_name"] == "Office Tech Park Updated"

    # 6. Delete Address 1
    del_res = client.delete(f"/api/v1/customer/addresses/{addr1_id}", headers=headers)
    assert del_res.status_code == 204

    # List should now have 1 address
    remaining = client.get("/api/v1/customer/addresses", headers=headers).json()
    assert len(remaining) == 1
    assert remaining[0]["address_id"] == addr2_id
