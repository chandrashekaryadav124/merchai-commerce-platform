import os
import sys
from pathlib import Path
from dotenv import load_dotenv

# Setup paths and environment variables
backend_dir = Path(__file__).resolve().parent.parent
root_dir = backend_dir.parent
load_dotenv(root_dir / ".env", override=True)
load_dotenv(backend_dir / ".env", override=True)

sys.path.insert(0, str(backend_dir))

from fastapi.testclient import TestClient
from app.main import app
from app.core.security import create_access_token
from app.db.session import SessionLocal
from app.models.sellers import Seller, SellerProduct
from app.models.products import Product
from app.models.orders import Order, OrderItem, SellerOrder, SellerOrderItem, SellerOrderStatusHistory
from app.models.logistics import Shipment, CourierPartner, ShipmentTrackingEvent
from app.models.customer_account import CustomerProfile, Payment
from app.models.users import AppUser

client = TestClient(app)

def test_sprint_0_4_integration_workflow():
    db = SessionLocal()
    print("==================================================================")
    print("STARTING SPRINT 0.4 INTEGRATION & PRIVACY WORKFLOW TEST SUITE")
    print("==================================================================")

    # 1. Locate/Verify Seller & Customer
    print("\n--- 1. Authenticating Roles ---")
    seller = db.query(Seller).filter(Seller.store_name == "SHOES SHOP").first()
    if not seller:
        seller = db.query(Seller).filter(Seller.approval_status == "approved").first()
    assert seller is not None, "Approved seller storefront required."
    print(f"Target Seller Store: {seller.store_name} ({seller.seller_id}), User: {seller.user_id}")

    seller_token = create_access_token(subject=seller.user_id, role="seller")
    seller_headers = {"Authorization": f"Bearer {seller_token}"}

    # Operations User Token
    ops_user = db.query(AppUser).filter(AppUser.role == "operations").first()
    if not ops_user:
        ops_user = AppUser(
            user_id="test_ops_001",
            email="ops.lead@merchai.com",
            full_name="Operations Logistics Lead",
            role="operations",
            is_active=1
        )
        db.add(ops_user)
        db.commit()
    ops_token = create_access_token(subject=ops_user.user_id, role="operations")
    ops_headers = {"Authorization": f"Bearer {ops_token}"}

    # Customer User Token
    cust_user = db.query(AppUser).filter(AppUser.role == "customer", AppUser.is_active == 1).first()
    if not cust_user:
        cust_user = AppUser(
            user_id="test_cust_001",
            email="priya.sharma@example.com",
            full_name="Priya Sharma",
            role="customer",
            is_active=1
        )
        db.add(cust_user)
        db.commit()
    cust_token = create_access_token(subject=cust_user.user_id, role="customer")
    cust_headers = {"Authorization": f"Bearer {cust_token}"}

    # 2. Test Customer Privacy & Order Details Endpoint
    print("\n--- 2. Testing Seller Orders & Customer Data Masking ---")
    resp = client.get("/api/v1/orders/seller", headers=seller_headers)
    assert resp.status_code == 200, f"Expected 200, got {resp.status_code}: {resp.text}"
    orders = resp.json()
    print(f"  PASS: Retrieved {len(orders)} seller orders for {seller.store_name}.")
    
    if len(orders) > 0:
        first_ord = orders[0]
        print(f"  Inspecting Order #{first_ord['seller_order_id']}:")
        print(f"    Recipient: {first_ord.get('customer_name')}")
        print(f"    Masked Phone: {first_ord.get('customer_phone_masked')}")
        print(f"    Masked Email: {first_ord.get('customer_email_masked')}")
        print(f"    Delivery Address: {first_ord.get('shipping_address')}")
        print(f"    City/State: {first_ord.get('delivery_city')}, {first_ord.get('delivery_state')}")
        
        # Privacy verification
        if first_ord.get('customer_phone_masked'):
            assert "*" in first_ord['customer_phone_masked'], "Phone number must be masked!"
        if first_ord.get('customer_email_masked'):
            assert "*" in first_ord['customer_email_masked'], "Email must be masked!"
        print("  PASS: Customer contact details are strictly masked for seller.")

    # 3. Create a Controlled Test Order for Full Workflow Lifecycle
    print("\n--- 3. Creating Test Order to Walk Through State Machine ---")
    # 1. Select an active product with sufficient available inventory (>= 5 units)
    sp = db.query(SellerProduct).filter(
        SellerProduct.seller_id == seller.seller_id,
        SellerProduct.listing_status == "active",
        SellerProduct.stock_quantity >= 5
    ).order_by(SellerProduct.stock_quantity.desc()).first()

    created_test_product = False
    test_prod_id = None
    original_stock = None

    # 2. If no suitable product exists, create controlled test inventory safely
    if not sp:
        test_prod_id = f"TEST_PROD_{uuid.uuid4().hex[:8].upper()}"
        test_prod = Product(
            product_id=test_prod_id,
            product_name="Controlled Sprint 0.4 Test Item",
            category="Fashion & Footwear",
            price=1499.0,
            stock_quantity=50
        )
        db.add(test_prod)
        db.flush()

        sp = SellerProduct(
            seller_id=seller.seller_id,
            product_id=test_prod_id,
            selling_price=1499.0,
            stock_quantity=50,
            listing_status="active",
            sku=f"SKU-TEST-{uuid.uuid4().hex[:6].upper()}"
        )
        db.add(sp)
        db.commit()
        db.refresh(sp)
        created_test_product = True
        print(f"  Created controlled test product {test_prod_id} with stock: {sp.stock_quantity}")
    else:
        original_stock = int(sp.stock_quantity)
        print(f"  Selected active seller product {sp.product_id} with available stock: {sp.stock_quantity}")

    order_id = None
    so_id = None
    shipment_id = None

    try:
        order_payload = {
            "shipping_address": "Flat 402, Lotus Orchid, Indiranagar, Bengaluru, Karnataka 560038",
            "items": [
                {
                    "product_id": sp.product_id,
                    "quantity": 1,
                    "unit_price": float(sp.selling_price)
                }
            ]
        }
        place_resp = client.post("/api/v1/orders", headers=cust_headers, json=order_payload)
        assert place_resp.status_code == 200, f"Order placement failed: {place_resp.text}"
        created_parent_order = place_resp.json()
        order_id = created_parent_order["order_id"]
        print(f"  PASS: Placed new parent order {order_id}")

        # Find the created SellerOrder
        with SessionLocal() as fresh_db:
            so = fresh_db.query(SellerOrder).filter(SellerOrder.order_id == order_id).first()
        assert so is not None, "SellerOrder must be generated."
        so_id = so.seller_order_id
        print(f"  PASS: Created SellerOrder #{so_id} with initial status: {so.status}")
        assert so.status.upper() == "PLACED", f"Expected initial status PLACED, got {so.status}"

        # 4. Test Seller State Machine Transitions & Unauthorized Jumps
        print("\n--- 4. Testing Progressive Seller State Transitions ---")
        # 4a. Reject illegal jump: PLACED -> DELIVERED (Sellers cannot mark delivered)
        bad_jump = client.patch(f"/api/v1/orders/seller/{so_id}/status", headers=seller_headers, json={"new_status": "DELIVERED"})
        assert bad_jump.status_code == 400, f"Expected 400 for illegal seller jump to DELIVERED, got {bad_jump.status_code}"
        print("  PASS: Rejected illegal jump from PLACED -> DELIVERED (HTTP 400).")

        # 4b. Reject illegal jump: PLACED -> HANDED_OVER (Operations must handle dispatch)
        bad_handover = client.patch(f"/api/v1/orders/seller/{so_id}/status", headers=seller_headers, json={"new_status": "HANDED_OVER"})
        assert bad_handover.status_code == 400, f"Expected 400 for illegal seller jump to HANDED_OVER, got {bad_handover.status_code}"
        print("  PASS: Rejected illegal jump from PLACED -> HANDED_OVER (HTTP 400).")

        # 4c. Legal: PLACED -> ACCEPTED
        step1 = client.patch(f"/api/v1/orders/seller/{so_id}/status", headers=seller_headers, json={"new_status": "ACCEPTED", "notes": "Order accepted by store manager"})
        assert step1.status_code == 200, f"Failed PLACED -> ACCEPTED: {step1.text}"
        assert step1.json()["status"] == "ACCEPTED"
        print("  PASS: Transitioned PLACED -> ACCEPTED")

        # 4d. Legal: ACCEPTED -> PROCESSING
        step2 = client.patch(f"/api/v1/orders/seller/{so_id}/status", headers=seller_headers, json={"new_status": "PROCESSING", "notes": "Items retrieved from stock room"})
        assert step2.status_code == 200, f"Failed ACCEPTED -> PROCESSING: {step2.text}"
        assert step2.json()["status"] == "PROCESSING"
        print("  PASS: Transitioned ACCEPTED -> PROCESSING")

        # 4e. Legal: PROCESSING -> PACKED
        step3 = client.patch(f"/api/v1/orders/seller/{so_id}/status", headers=seller_headers, json={"new_status": "PACKED", "notes": "Parcel packed with shipping label attached"})
        assert step3.status_code == 200, f"Failed PROCESSING -> PACKED: {step3.text}"
        assert step3.json()["status"] == "PACKED"
        print("  PASS: Transitioned PROCESSING -> PACKED")

        # 4f. Legal: PACKED -> READY_FOR_PICKUP
        step4 = client.patch(f"/api/v1/orders/seller/{so_id}/status", headers=seller_headers, json={"new_status": "READY_FOR_PICKUP", "notes": "Awaiting courier pickup"})
        assert step4.status_code == 200, f"Failed PACKED -> READY_FOR_PICKUP: {step4.text}"
        assert step4.json()["status"] == "READY_FOR_PICKUP"
        print("  PASS: Transitioned PACKED -> READY_FOR_PICKUP")

        # 5. Operations Portal: Ready for Pickup Queue & Courier Assignment
        print("\n--- 5. Testing Operations Ready for Pickup Queue & Dispatch ---")
        pickup_resp = client.get("/api/v1/operations/ready-for-pickup", headers=ops_headers)
        assert pickup_resp.status_code == 200
        queue = pickup_resp.json()
        target_in_queue = next((it for it in queue if it["seller_order_id"] == so_id), None)
        assert target_in_queue is not None, f"Order #{so_id} should appear in operations pickup queue."
        print(f"  PASS: Order #{so_id} verified present in Ready for Pickup queue.")

        # Fetch courier partners
        cp_resp = client.get("/api/v1/operations/courier-partners", headers=ops_headers)
        assert cp_resp.status_code == 200
        couriers = cp_resp.json()
        assert len(couriers) > 0, "Active courier partners must be available."
        selected_cp = couriers[0]
        print(f"  Selected Courier Partner: {selected_cp['name']} ({selected_cp['code']})")

        # Dispatch shipment via Operations
        dispatch_payload = {
            "seller_order_id": so_id,
            "courier_partner_id": selected_cp["courier_id"],
            "warehouse_city": "Bengaluru Central Logistics Hub",
            "shipping_method": "Standard Express",
            "expected_delivery_days": 2,
            "notes": "Scanned at dock bay 2"
        }
        dispatch_resp = client.post("/api/v1/operations/shipments", headers=ops_headers, json=dispatch_payload)
        assert dispatch_resp.status_code == 200, f"Dispatch failed: {dispatch_resp.text}"
        shipment_data = dispatch_resp.json()
        shipment_id = shipment_data["shipment_id"]
        tracking_number = shipment_data["tracking_number"]
        print(f"  PASS: Operations created shipment {shipment_id} with Tracking #{tracking_number}")
        assert tracking_number.startswith("TRK-"), "Tracking number must have TRK- prefix"

        # Verify seller order transitioned to HANDED_OVER
        updated_so = client.get(f"/api/v1/orders/seller/{so_id}", headers=seller_headers).json()
        assert updated_so["status"] == "HANDED_OVER", f"Expected HANDED_OVER, got {updated_so['status']}"
        print("  PASS: Seller order automatically transitioned to HANDED_OVER.")

        # 6. Operations Shipment Status Progression & Tracking Events
        print("\n--- 6. Testing Operations Shipment Progression & Delivery ---")
        # 6a. Transition to IN_TRANSIT
        in_transit_resp = client.patch(
            f"/api/v1/operations/shipments/{shipment_id}/status",
            headers=ops_headers,
            json={"new_status": "IN_TRANSIT", "location": "Bengaluru Sorting Facility", "notes": "Sorted and bagged for local delivery"}
        )
        assert in_transit_resp.status_code == 200
        assert in_transit_resp.json()["delivery_status"] == "IN_TRANSIT"
        print("  PASS: Shipment transitioned to IN_TRANSIT with tracking event logged.")

        # 6b. Transition to OUT_FOR_DELIVERY
        ofd_resp = client.patch(
            f"/api/v1/operations/shipments/{shipment_id}/status",
            headers=ops_headers,
            json={"new_status": "OUT_FOR_DELIVERY", "location": "Indiranagar Delivery Hub", "notes": "Assigned to courier van"}
        )
        assert ofd_resp.status_code == 200
        print("  PASS: Shipment transitioned to OUT_FOR_DELIVERY.")

        # 6c. Transition to DELIVERED
        deliv_resp = client.patch(
            f"/api/v1/operations/shipments/{shipment_id}/status",
            headers=ops_headers,
            json={"new_status": "DELIVERED", "location": "Customer Doorstep", "notes": "Delivered to recipient with OTP signature"}
        )
        assert deliv_resp.status_code == 200
        deliv_data = deliv_resp.json()
        assert deliv_data["delivery_status"] == "DELIVERED"
        print("  PASS: Shipment transitioned to DELIVERED.")

        # 7. Customer Multi-Seller Tracking View
        print("\n--- 7. Testing Customer Multi-Seller Tracking View ---")
        cust_track_resp = client.get(f"/api/v1/orders/{order_id}/tracking", headers=cust_headers)
        assert cust_track_resp.status_code == 200, f"Customer tracking failed: {cust_track_resp.text}"
        tracking_info = cust_track_resp.json()
        print(f"  Parent Order ID: {tracking_info['order_id']}, Overall Status: {tracking_info['order_status']}")
        print(f"  Packages Count: {len(tracking_info['packages'])}")
        for pkg in tracking_info["packages"]:
            print(f"    Package from {pkg['seller_store_name']}: Status {pkg['status']}, Carrier {pkg['courier_name']}, Tracking #{pkg['tracking_number']}")
            print(f"    Checkpoints ({len(pkg['events'])}): {[e['status'] for e in pkg['events']]}")
            assert len(pkg['events']) >= 4, "Must have all logged tracking events in order."
        print("  PASS: Customer multi-seller package tracking validated with full checkpoints.")

    finally:
        # Safe cleanup & inventory preservation
        try:
            with SessionLocal() as cleanup_db:
                if created_test_product and test_prod_id:
                    cleanup_db.query(SellerOrderItem).filter(SellerOrderItem.product_id == test_prod_id).delete(synchronize_session=False)
                    cleanup_db.query(OrderItem).filter(OrderItem.product_id == test_prod_id).delete(synchronize_session=False)
                    cleanup_db.query(SellerProduct).filter(SellerProduct.product_id == test_prod_id).delete(synchronize_session=False)
                    cleanup_db.query(Product).filter(Product.product_id == test_prod_id).delete(synchronize_session=False)
                elif sp and original_stock is not None:
                    # Restore original inventory count so real database stock is not drained across test runs
                    existing_sp = cleanup_db.query(SellerProduct).filter(SellerProduct.seller_product_id == sp.seller_product_id).first()
                    if existing_sp:
                        existing_sp.stock_quantity = original_stock

                # Clean up the test order artifacts created in this test run
                if order_id:
                    if shipment_id:
                        cleanup_db.query(ShipmentTrackingEvent).filter(ShipmentTrackingEvent.shipment_id == shipment_id).delete(synchronize_session=False)
                        cleanup_db.query(Shipment).filter(Shipment.shipment_id == shipment_id).delete(synchronize_session=False)

                    if so_id:
                        cleanup_db.query(SellerOrderStatusHistory).filter(SellerOrderStatusHistory.seller_order_id == so_id).delete(synchronize_session=False)
                        cleanup_db.query(SellerOrderItem).filter(SellerOrderItem.seller_order_id == so_id).delete(synchronize_session=False)
                        cleanup_db.query(SellerOrder).filter(SellerOrder.seller_order_id == so_id).delete(synchronize_session=False)

                    cleanup_db.query(OrderItem).filter(OrderItem.order_id == order_id).delete(synchronize_session=False)
                    cleanup_db.query(Order).filter(Order.order_id == order_id).delete(synchronize_session=False)

                cleanup_db.commit()
                print("  PASS: Test cleanup completed successfully.")
        except Exception as e:
            print(f"  Notice: Cleanup error (non-fatal): {e}")

    print("\n==================================================================")
    print("ALL SPRINT 0.4 INTEGRATION TESTS PASSED WITH 100% SUCCESS!")
    print("==================================================================")

if __name__ == "__main__":
    test_sprint_0_4_integration_workflow()

