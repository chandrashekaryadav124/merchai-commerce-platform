import os
import sys
import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from fastapi.testclient import TestClient

# Ensure backend root is on sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.db.session import Base, get_db
from app.core.deps import get_optional_current_user
from app.models.products import Product, ProductImage
from app.models.sellers import SellerProduct
from sqlalchemy.pool import StaticPool
from app.models.orders import Order
from app.models.support import SupportTicket
from app.models.users import AppUser
from app.models.audit import AuditLog
from app.main import app

# Create dedicated in-memory SQLite engine for fast, isolated testing using StaticPool
engine_test = create_engine(
    "sqlite:///:memory:",
    connect_args={"check_same_thread": False},
    poolclass=StaticPool
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine_test)

Base.metadata.create_all(bind=engine_test)

@pytest.fixture(scope="module")
def db_session():
    """Provides a fresh isolated in-memory database session populated with mock catalog & order records."""
    Base.metadata.create_all(bind=engine_test)
    db = TestingSessionLocal()
    try:
        # 1. Seed test user
        test_user = AppUser(
            user_id="USR_TEST_01",
            full_name="Chandra Yadav",
            email="chandra@example.com",
            password_hash="mock_hash",
            role="customer",
            is_active=True
        )
        other_user = AppUser(
            user_id="USR_OTHER_99",
            full_name="Other Customer",
            email="other@example.com",
            password_hash="mock_hash",
            role="customer",
            is_active=True
        )
        db.add_all([test_user, other_user])
        db.commit()

        # 2. Seed test products
        p1 = Product(
            product_id="PROD_SNACK_01",
            product_name="Organic Roasted Cashews 250g",
            category="Grocery",
            subcategory="Dry Fruits",
            brand="Royal Farm",
            price=450.0,
            cost_price=300.0,
            stock_quantity=50,
            rating_average=4.8,
            rating_count=120
        )
        p2 = Product(
            product_id="PROD_SHOE_01",
            product_name="Handcrafted Leather Loafers",
            category="Footwear",
            subcategory="Men Footwear",
            brand="Artisan Craft",
            price=2400.0,
            cost_price=1600.0,
            stock_quantity=15,
            rating_average=4.6,
            rating_count=45
        )
        db.add_all([p1, p2])
        db.commit()

        # 3. Seed orders
        o_own = Order(
            order_id="ORD-1001",
            customer_id="USR_TEST_01",
            order_date="2026-10-25",
            order_status="Shipped",
            shipping_method="Express Courier",
            delivery_city="Bengaluru",
            final_amount=1450.0,
            recipient_name="Chandra Yadav"
        )
        o_other = Order(
            order_id="ORD-9999",
            customer_id="USR_OTHER_99",
            order_date="2026-10-20",
            order_status="Delivered",
            shipping_method="Standard Delivery",
            delivery_city="Mumbai",
            final_amount=3200.0,
            recipient_name="Other Person"
        )
        db.add_all([o_own, o_other])
        db.commit()

        yield db
    finally:
        db.close()
        Base.metadata.drop_all(bind=engine_test)

@pytest.fixture
def client(db_session):
    """FastAPI TestClient with overridden get_db dependency pointing to the in-memory test database."""
    def override_get_db():
        yield db_session

    app.dependency_overrides[get_db] = override_get_db
    app.dependency_overrides[get_optional_current_user] = lambda: None
    yield TestClient(app)
    app.dependency_overrides.clear()



# =====================================================================
# TEST CASES
# =====================================================================

def test_chat_schema_validation_success(client):
    """Verify standard chat request returns expected response schema and general greeting."""
    res = client.post("/api/v1/ai/chat", json={
        "messages": [{"role": "user", "content": "Hello MerchAI!"}]
    })
    assert res.status_code == 200
    data = res.json()
    assert "reply" in data
    assert data["intent"] == "general"
    assert isinstance(data["suggested_actions"], list)
    assert len(data["suggested_actions"]) > 0


def test_chat_schema_validation_invalid_role(client):
    """Verify invalid message roles are rejected with 422 Unprocessable Entity."""
    res = client.post("/api/v1/ai/chat", json={
        "messages": [{"role": "unauthorized_role", "content": "Hello!"}]
    })
    assert res.status_code == 422


def test_chat_schema_validation_blank_content(client):
    """Verify whitespace-only messages are rejected with 422."""
    res = client.post("/api/v1/ai/chat", json={
        "messages": [{"role": "user", "content": "   "}]
    })
    assert res.status_code == 422


def test_chat_schema_validation_oversized_history(client):
    """Verify conversations exceeding maximum 20 messages are safely rejected."""
    oversized = [{"role": "user", "content": f"Message {i}"} for i in range(25)]
    res = client.post("/api/v1/ai/chat", json={"messages": oversized})
    assert res.status_code == 422


def test_policy_faq_returns_verified_policy(client):
    """Verify policy questions return verified SLAs with clear policy citation."""
    res = client.post("/api/v1/ai/chat", json={
        "messages": [{"role": "user", "content": "What is your return policy and refund window?"}]
    })
    assert res.status_code == 200
    data = res.json()
    assert data["intent"] == "policy_faq"
    assert "[Verified Platform Policy §4.2" in data["reply"]
    assert "7 calendar days" in data["reply"]


def test_product_discovery_queries_actual_products(client):
    """Verify product discovery queries real catalog database and never invents products."""
    res = client.post("/api/v1/ai/chat", json={
        "messages": [{"role": "user", "content": "Find organic snacks under 500"}]
    })
    assert res.status_code == 200
    data = res.json()
    assert data["intent"] == "product_discovery"
    assert len(data["recommended_products"]) > 0
    top_prod = data["recommended_products"][0]
    assert top_prod["product_id"] == "PROD_SNACK_01"
    assert top_prod["price"] == 450.0
    assert "Organic Roasted Cashews" in data["reply"]


def test_product_discovery_no_match_honest_reply(client):
    """Verify uncatalogued items return an honest refusal without hallucinations."""
    res = client.post("/api/v1/ai/chat", json={
        "messages": [{"role": "user", "content": "Find diamonds under 100"}]
    })
    assert res.status_code == 200
    data = res.json()
    assert data["intent"] == "product_discovery"
    assert "couldn't find any active products" in data["reply"].lower()


def test_guest_order_tracking_restricted(client):
    """Verify unauthenticated guests are prevented from accessing private order tracking."""
    res = client.post("/api/v1/ai/chat", json={
        "messages": [{"role": "user", "content": "Where is my order ORD-1001?"}]
    })
    assert res.status_code == 200
    data = res.json()
    assert data["intent"] == "order_tracking"
    assert "sign in" in data["reply"].lower()
    assert data["order_status_card"] is None


def test_authenticated_order_tracking_own_order(client, db_session):
    """Verify authenticated user can track their own verified order."""
    user = db_session.query(AppUser).filter(AppUser.user_id == "USR_TEST_01").first()
    app.dependency_overrides[get_optional_current_user] = lambda: user

    res = client.post("/api/v1/ai/chat", json={
        "messages": [{"role": "user", "content": "Track my order ORD-1001"}]
    })
    assert res.status_code == 200
    data = res.json()
    assert data["intent"] == "order_tracking"
    assert data["order_status_card"] is not None
    assert data["order_status_card"]["order_id"] == "ORD-1001"
    assert data["order_status_card"]["order_status"] == "Shipped"
    assert data["order_status_card"]["delivery_city"] == "Bengaluru"


def test_authenticated_order_tracking_cross_tenant_isolation(client, db_session):
    """Verify user is blocked from viewing orders belonging to another customer."""
    user = db_session.query(AppUser).filter(AppUser.user_id == "USR_TEST_01").first()
    app.dependency_overrides[get_optional_current_user] = lambda: user

    # User attempts to query ORD-9999 (which belongs to USR_OTHER_99)
    res = client.post("/api/v1/ai/chat", json={
        "messages": [{"role": "user", "content": "Where is order ORD-9999?"}]
    })
    assert res.status_code == 200
    data = res.json()
    assert data["intent"] == "order_tracking"
    assert data["order_status_card"] is None
    assert "no order with reference 'ord-9999' was found" in data["reply"].lower()


def test_support_escalation_guidance_vs_explicit_creation(client, db_session):
    """Verify support guidance is provided without creating accidental tickets, and explicit creation creates a ticket."""
    user = db_session.query(AppUser).filter(AppUser.user_id == "USR_TEST_01").first()
    app.dependency_overrides[get_optional_current_user] = lambda: user

    # 1. Non-explicit grievance: safe guidance without ticket creation
    res_guidance = client.post("/api/v1/ai/chat", json={
        "messages": [{"role": "user", "content": "I am experiencing an issue with my delivery courier"}]
    })
    assert res_guidance.status_code == 200
    data_g = res_guidance.json()
    assert data_g["intent"] == "support_escalation"
    assert data_g["ticket_created"] is None
    assert "would you like me to open a support ticket" in data_g["reply"].lower()

    # 2. Explicit ticket creation request
    res_create = client.post("/api/v1/ai/chat", json={
        "messages": [{"role": "user", "content": "Yes, create a ticket for delivery delay of order ORD-1001"}]
    })
    assert res_create.status_code == 200
    data_c = res_create.json()
    assert data_c["intent"] == "support_escalation"
    assert data_c["ticket_created"] is not None
    created_id = data_c["ticket_created"]["ticket_id"]
    assert created_id.startswith("TKT")

    # 3. Duplicate prevention: Repeating identical request should return existing ticket
    res_dup = client.post("/api/v1/ai/chat", json={
        "messages": [{"role": "user", "content": "Yes, create a ticket for delivery delay of order ORD-1001"}]
    })
    assert res_dup.status_code == 200
    data_d = res_dup.json()
    assert data_d["ticket_created"]["ticket_id"] == created_id
    assert "already have an active open support ticket" in data_d["reply"].lower()


def test_guest_support_escalation_requires_auth(client):
    """Verify unauthenticated guest cannot create support tickets."""
    app.dependency_overrides[get_optional_current_user] = lambda: None
    res = client.post("/api/v1/ai/chat", json={
        "messages": [{"role": "user", "content": "Please create ticket for my damaged item"}]
    })
    assert res.status_code == 200
    data = res.json()
    assert data["intent"] == "support_escalation"
    assert "sign in" in data["reply"].lower()
    assert data["ticket_created"] is None
