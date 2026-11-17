import re
import uuid
from typing import List, Optional
from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, Query, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import func, or_
from pydantic import BaseModel
from app.db.session import get_db
from app.models.logistics import Shipment, InventoryHistory, CourierPartner, ShipmentTrackingEvent
from app.models.orders import Order, SellerOrder, SellerOrderItem, SellerOrderStatusHistory
from app.models.sellers import Seller
from app.models.products import Product
from app.core.deps import RoleChecker
from app.models.users import AppUser
from app.services.audit_service import log_audit_action
from app.schemas.logistics import (
    CourierPartnerResponse,
    ShipmentCreateRequest,
    ShipmentStatusUpdateRequest,
    TrackingEventCreateRequest,
    ShipmentDetailResponse,
    ShipmentTrackingEventItem,
    ReadyForPickupItemResponse
)

router = APIRouter()

def mask_phone_number(phone: Optional[str]) -> Optional[str]:
    if not phone:
        return None
    cleaned = re.sub(r"[^\d+]", "", str(phone))
    if len(cleaned) < 5:
        return "****"
    return f"{cleaned[:3]}****{cleaned[-3:]}"

def build_shipment_detail(db: Session, shp: Shipment) -> ShipmentDetailResponse:
    seller = db.query(Seller).filter(Seller.seller_id == shp.seller_id).first() if shp.seller_id else None

    events = db.query(ShipmentTrackingEvent).filter(
        ShipmentTrackingEvent.shipment_id == shp.shipment_id
    ).order_by(ShipmentTrackingEvent.created_at.asc()).all()

    tracking_url = None
    if shp.courier_partner_id and shp.tracking_number:
        cp = db.query(CourierPartner).filter(CourierPartner.courier_id == shp.courier_partner_id).first()
        if cp and cp.tracking_url_template:
            tracking_url = cp.tracking_url_template.replace("{tracking_number}", shp.tracking_number)

    return ShipmentDetailResponse(
        shipment_id=shp.shipment_id,
        order_id=shp.order_id,
        seller_order_id=shp.seller_order_id,
        seller_id=shp.seller_id,
        seller_store_name=seller.store_name if seller else None,
        warehouse_city=shp.warehouse_city,
        delivery_city=shp.delivery_city,
        shipping_method=shp.shipping_method,
        courier_partner_id=shp.courier_partner_id,
        courier_name=shp.courier_name,
        tracking_number=shp.tracking_number,
        tracking_url=tracking_url,
        recipient_name=shp.recipient_name,
        recipient_phone_masked=mask_phone_number(shp.recipient_phone),
        shipping_address=shp.shipping_address,
        dispatch_date=shp.dispatch_date,
        expected_delivery_date=shp.expected_delivery_date,
        actual_delivery_date=shp.actual_delivery_date,
        delivery_days=shp.delivery_days,
        delivery_status=shp.delivery_status,
        delayed_flag=shp.delayed_flag,
        events=[
            ShipmentTrackingEventItem(
                event_id=ev.event_id,
                shipment_id=ev.shipment_id,
                status=ev.status,
                location=ev.location,
                notes=ev.notes,
                created_at=str(ev.created_at) if ev.created_at else None
            )
            for ev in events
        ],
        created_at=str(shp.created_at) if hasattr(shp, "created_at") and shp.created_at else None
    )

class ShipmentResponse(BaseModel):
    shipment_id: str
    order_id: Optional[str] = None
    warehouse_city: Optional[str] = None
    delivery_city: Optional[str] = None
    shipping_method: Optional[str] = None
    dispatch_date: Optional[str] = None
    expected_delivery_date: Optional[str] = None
    actual_delivery_date: Optional[str] = None
    delivery_days: Optional[float] = None
    delivery_status: Optional[str] = None
    delayed_flag: Optional[int] = None

    class Config:
        from_attributes = True

class InventoryHistoryResponse(BaseModel):
    inventory_snapshot_id: str
    product_id: Optional[str] = None
    snapshot_date: Optional[str] = None
    warehouse_id: Optional[str] = None
    stock_quantity: Optional[int] = None
    reserved_quantity: Optional[int] = None
    available_quantity: Optional[int] = None
    reorder_level: Optional[int] = None
    inventory_status: Optional[str] = None

    class Config:
        from_attributes = True

class OperationsMetricsResponse(BaseModel):
    total_shipments: int
    delivered_count: int
    delivered_then_returned_count: int
    cancelled_in_transit_count: int
    order_placed_count: int
    in_transit_count: int
    pending_count: int
    delayed_count: int
    on_time_rate: Optional[float] = None
    avg_delivery_days: Optional[float] = None
    total_inventory_snapshots: int
    total_inventory_units: int
    low_stock_alerts: int
    out_of_stock_alerts: int

class OperationsWarehouseDistributionItem(BaseModel):
    warehouse_city: str
    shipments_count: int
    delayed_shipments_count: int
    delayed_rate: float

class OperationsStatusDistributionItem(BaseModel):
    status: str
    count: int
    percentage: float

@router.get("/metrics", response_model=OperationsMetricsResponse)
def get_operations_metrics(
    current_user: AppUser = Depends(RoleChecker(["operations", "admin"])),
    db: Session = Depends(get_db)
):
    total_shipments = db.query(func.count(Shipment.shipment_id)).scalar() or 0
    delivered_count = db.query(func.count(Shipment.shipment_id)).filter(
        func.lower(Shipment.delivery_status) == "delivered"
    ).scalar() or 0
    del_returned_count = db.query(func.count(Shipment.shipment_id)).filter(
        func.lower(Shipment.delivery_status) == "delivered then returned"
    ).scalar() or 0
    cancelled_transit = db.query(func.count(Shipment.shipment_id)).filter(
        func.lower(Shipment.delivery_status) == "cancelled in transit"
    ).scalar() or 0
    order_placed_cnt = db.query(func.count(Shipment.shipment_id)).filter(
        func.lower(Shipment.delivery_status) == "order placed"
    ).scalar() or 0
    delayed_count = db.query(func.count(Shipment.shipment_id)).filter(
        or_(Shipment.delayed_flag == 1, func.lower(Shipment.delivery_status) == "delayed")
    ).scalar() or 0

    avg_del_days = db.query(func.avg(Shipment.delivery_days)).filter(
        Shipment.delivery_days.isnot(None)
    ).scalar()
    avg_delivery_days = round(float(avg_del_days), 1) if avg_del_days is not None else None

    on_time_rate = None
    if total_shipments > 0:
        on_time_rate = round(((total_shipments - delayed_count) / total_shipments) * 100.0, 1)

    total_inv = db.query(func.count(InventoryHistory.inventory_snapshot_id)).scalar() or 0
    total_units = db.query(func.coalesce(func.sum(InventoryHistory.available_quantity), 0)).scalar() or 0
    low_stock = db.query(func.count(InventoryHistory.inventory_snapshot_id)).filter(
        InventoryHistory.available_quantity <= InventoryHistory.reorder_level,
        InventoryHistory.available_quantity > 0
    ).scalar() or 0
    out_of_stock = db.query(func.count(InventoryHistory.inventory_snapshot_id)).filter(
        InventoryHistory.available_quantity == 0
    ).scalar() or 0

    return OperationsMetricsResponse(
        total_shipments=int(total_shipments),
        delivered_count=int(delivered_count),
        delivered_then_returned_count=int(del_returned_count),
        cancelled_in_transit_count=int(cancelled_transit),
        order_placed_count=int(order_placed_cnt),
        in_transit_count=int(cancelled_transit),
        pending_count=int(order_placed_cnt),
        delayed_count=int(delayed_count),
        on_time_rate=on_time_rate,
        avg_delivery_days=avg_delivery_days,
        total_inventory_snapshots=int(total_inv),
        total_inventory_units=int(total_units),
        low_stock_alerts=int(low_stock),
        out_of_stock_alerts=int(out_of_stock)
    )

@router.get("/warehouse-distribution", response_model=List[OperationsWarehouseDistributionItem])
def get_operations_warehouse_distribution(
    current_user: AppUser = Depends(RoleChecker(["operations", "admin"])),
    db: Session = Depends(get_db)
):
    results = db.query(
        Shipment.warehouse_city.label("city"),
        func.count(Shipment.shipment_id).label("total"),
        func.sum(func.case((Shipment.delayed_flag == 1, 1), else_=0)).label("delayed")
    ).filter(
        Shipment.warehouse_city.isnot(None),
        Shipment.warehouse_city != ""
    ).group_by(
        Shipment.warehouse_city
    ).all()

    items = []
    for r in results:
        tot = int(r.total or 0)
        del_cnt = int(r.delayed or 0)
        rate = round((del_cnt / tot) * 100.0, 1) if tot > 0 else 0.0
        items.append(OperationsWarehouseDistributionItem(
            warehouse_city=r.city or "Unknown",
            shipments_count=tot,
            delayed_shipments_count=del_cnt,
            delayed_rate=rate
        ))
    return sorted(items, key=lambda x: x.shipments_count, reverse=True)

@router.get("/delayed-shipments", response_model=List[ShipmentResponse])
def get_operations_delayed_shipments(
    limit: int = Query(default=50, le=100),
    current_user: AppUser = Depends(RoleChecker(["operations", "admin"])),
    db: Session = Depends(get_db)
):
    delayed = db.query(Shipment).filter(
        Shipment.delayed_flag == 1
    ).order_by(
        Shipment.delivery_days.desc()
    ).limit(limit).all()
    return delayed

@router.get("/status-distribution", response_model=List[OperationsStatusDistributionItem])
def get_operations_status_distribution(
    current_user: AppUser = Depends(RoleChecker(["operations", "admin"])),
    db: Session = Depends(get_db)
):
    total = db.query(func.count(Shipment.shipment_id)).scalar() or 0
    if total == 0:
        return []

    results = db.query(
        Shipment.delivery_status.label("status"),
        func.count(Shipment.shipment_id).label("count")
    ).group_by(Shipment.delivery_status).all()

    items = []
    for r in results:
        status_name = r.status or "Unknown"
        cnt = int(r.count)
        pct = round((cnt / total) * 100.0, 1)
        items.append(OperationsStatusDistributionItem(
            status=status_name,
            count=cnt,
            percentage=pct
        ))
    return items

@router.get("/courier-partners", response_model=List[CourierPartnerResponse])
def get_courier_partners(
    current_user: AppUser = Depends(RoleChecker(["operations", "admin"])),
    db: Session = Depends(get_db)
):
    couriers = db.query(CourierPartner).filter(CourierPartner.is_active == 1).order_by(CourierPartner.name.asc()).all()
    return [
        CourierPartnerResponse(
            courier_id=cp.courier_id,
            name=cp.name,
            code=cp.code,
            contact_phone=cp.contact_phone,
            tracking_url_template=cp.tracking_url_template,
            is_active=bool(cp.is_active)
        )
        for cp in couriers
    ]

@router.get("/ready-for-pickup", response_model=List[ReadyForPickupItemResponse])
def get_ready_for_pickup_queue(
    search: Optional[str] = None,
    limit: int = Query(default=50, le=100),
    offset: int = Query(default=0, ge=0),
    current_user: AppUser = Depends(RoleChecker(["operations", "admin"])),
    db: Session = Depends(get_db)
):
    query = db.query(SellerOrder).filter(SellerOrder.status.ilike("READY_FOR_PICKUP"))

    if search and search.strip():
        term = f"%{search.strip()}%"
        matched_order_ids = [r[0] for r in db.query(Order.order_id).filter(
            Order.order_id.ilike(term) | Order.recipient_name.ilike(term) | Order.delivery_city.ilike(term)
        ).all()]
        query = query.filter(SellerOrder.order_id.in_(matched_order_ids))

    seller_orders = query.order_by(SellerOrder.updated_at.desc()).offset(offset).limit(limit).all()

    items = []
    for so in seller_orders:
        seller = db.query(Seller).filter(Seller.seller_id == so.seller_id).first()
        order = db.query(Order).filter(Order.order_id == so.order_id).first()
        so_items = db.query(SellerOrderItem).filter(SellerOrderItem.seller_order_id == so.seller_order_id).all()

        item_names = []
        for it in so_items[:2]:
            prod = db.query(Product).filter(Product.product_id == it.product_id).first()
            if prod:
                item_names.append(f"{prod.product_name} (x{it.quantity})")
            else:
                item_names.append(f"Item {it.product_id} (x{it.quantity})")
        if len(so_items) > 2:
            item_names.append(f"+{len(so_items) - 2} more")

        items.append(ReadyForPickupItemResponse(
            seller_order_id=so.seller_order_id,
            order_id=so.order_id,
            seller_id=so.seller_id,
            seller_store_name=seller.store_name if seller else so.seller_id,
            status=so.status,
            subtotal=float(so.subtotal or 0.0),
            order_date=order.order_date if order else None,
            customer_name=order.recipient_name if order else "Customer",
            delivery_city=order.delivery_city if order else None,
            delivery_state=order.delivery_state if order else None,
            items_count=len(so_items),
            items_summary=", ".join(item_names) if item_names else "No items listed",
            created_at=str(so.created_at) if so.created_at else None
        ))
    return items

@router.post("/shipments", response_model=ShipmentDetailResponse)
def create_operations_shipment(
    payload: ShipmentCreateRequest,
    current_user: AppUser = Depends(RoleChecker(["operations", "admin"])),
    db: Session = Depends(get_db)
):
    so = db.query(SellerOrder).filter(SellerOrder.seller_order_id == payload.seller_order_id).with_for_update().first()
    if not so:
        raise HTTPException(status_code=404, detail="Seller order not found.")

    courier = db.query(CourierPartner).filter(CourierPartner.courier_id == payload.courier_partner_id).first()
    if not courier:
        raise HTTPException(status_code=404, detail="Courier partner not found.")

    order = db.query(Order).filter(Order.order_id == so.order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Parent customer order not found.")

    # Check if a shipment already exists for this seller order
    existing_shp = db.query(Shipment).filter(Shipment.seller_order_id == so.seller_order_id).first()
    if existing_shp:
        raise HTTPException(status_code=400, detail="A shipment is already assigned to this seller order.")

    now = datetime.now()
    tracking_number = f"TRK-{courier.code}-{uuid.uuid4().hex[:6].upper()}"
    shipment_id = f"SHP-{uuid.uuid4().hex[:8].upper()}"
    exp_days = payload.expected_delivery_days or 3
    exp_delivery_date = (now + timedelta(days=exp_days)).strftime("%Y-%m-%d")

    shipment = Shipment(
        shipment_id=shipment_id,
        order_id=so.order_id,
        seller_order_id=so.seller_order_id,
        seller_id=so.seller_id,
        warehouse_city=payload.warehouse_city or "Central Fulfillment Hub",
        delivery_city=order.delivery_city or "Customer City",
        shipping_method=payload.shipping_method or "Standard Surface",
        courier_partner_id=courier.courier_id,
        courier_name=courier.name,
        tracking_number=tracking_number,
        recipient_name=order.recipient_name,
        recipient_phone=order.recipient_phone,
        shipping_address=order.shipping_address,
        dispatch_date=now.strftime("%Y-%m-%d"),
        expected_delivery_date=exp_delivery_date,
        delivery_status="READY_FOR_PICKUP",
        delivery_days=float(exp_days),
        delayed_flag=0
    )
    db.add(shipment)

    # Initial tracking event
    init_event = ShipmentTrackingEvent(
        event_id=f"EVT-{uuid.uuid4().hex[:8]}",
        shipment_id=shipment_id,
        status="READY_FOR_PICKUP",
        location=payload.warehouse_city or "Bengaluru Hub",
        notes=payload.notes or f"Shipment generated and assigned to {courier.name} with tracking number {tracking_number}."
    )
    db.add(init_event)

    # Transition seller order to HANDED_OVER
    prev_status = so.status
    so.status = "HANDED_OVER"
    so.updated_at = now

    db.add(SellerOrderStatusHistory(
        seller_order_id=so.seller_order_id,
        previous_status=prev_status,
        new_status="HANDED_OVER",
        changed_by=f"OPERATIONS:{current_user.user_id}",
        notes=f"Shipment {shipment_id} dispatched via {courier.name} (TRK: {tracking_number})."
    ))

    db.commit()
    db.refresh(shipment)

    log_audit_action(
        db,
        action="OPERATIONS_SHIPMENT_CREATED",
        entity_type="shipment",
        user_id=current_user.user_id,
        entity_id=shipment_id,
        details={
            "seller_order_id": so.seller_order_id,
            "tracking_number": tracking_number,
            "courier": courier.name
        }
    )

    return build_shipment_detail(db, shipment)

@router.get("/shipments/{shipment_id}", response_model=ShipmentDetailResponse)
def get_single_operations_shipment(
    shipment_id: str,
    current_user: AppUser = Depends(RoleChecker(["operations", "admin"])),
    db: Session = Depends(get_db)
):
    shp = db.query(Shipment).filter(Shipment.shipment_id == shipment_id).first()
    if not shp:
        raise HTTPException(status_code=404, detail="Shipment not found.")
    return build_shipment_detail(db, shp)

@router.patch("/shipments/{shipment_id}/status", response_model=ShipmentDetailResponse)
def update_operations_shipment_status(
    shipment_id: str,
    payload: ShipmentStatusUpdateRequest,
    current_user: AppUser = Depends(RoleChecker(["operations", "admin"])),
    db: Session = Depends(get_db)
):
    shp = db.query(Shipment).filter(Shipment.shipment_id == shipment_id).with_for_update().first()
    if not shp:
        raise HTTPException(status_code=404, detail="Shipment not found.")

    target_status = payload.new_status.strip().upper()
    now = datetime.now()

    shp.delivery_status = target_status
    shp.updated_at = now

    if target_status == "DELIVERED":
        shp.actual_delivery_date = now.strftime("%Y-%m-%d")
        shp.delayed_flag = 0

    # Add tracking event
    evt = ShipmentTrackingEvent(
        event_id=f"EVT-{uuid.uuid4().hex[:8]}",
        shipment_id=shp.shipment_id,
        status=target_status,
        location=payload.location or shp.delivery_city or "In Transit",
        notes=payload.notes or f"Shipment marked {target_status}"
    )
    db.add(evt)

    # Sync seller order if linked
    if shp.seller_order_id:
        so = db.query(SellerOrder).filter(SellerOrder.seller_order_id == shp.seller_order_id).with_for_update().first()
        if so:
            prev_status = so.status
            if target_status == "DELIVERED":
                so.status = "DELIVERED"
            elif target_status in ["IN_TRANSIT", "OUT_FOR_DELIVERY"]:
                so.status = "IN_TRANSIT"
            so.updated_at = now

            db.add(SellerOrderStatusHistory(
                seller_order_id=so.seller_order_id,
                previous_status=prev_status,
                new_status=so.status,
                changed_by=f"OPERATIONS:{current_user.user_id}",
                notes=payload.notes or f"Carrier scan status: {target_status}"
            ))

    # Check if all seller orders for parent order are delivered
    if target_status == "DELIVERED" and shp.order_id:
        all_so = db.query(SellerOrder).filter(SellerOrder.order_id == shp.order_id).all()
        if all_so and all(s.status.upper() == "DELIVERED" for s in all_so):
            parent_order = db.query(Order).filter(Order.order_id == shp.order_id).first()
            if parent_order:
                parent_order.order_status = "Delivered"

    db.commit()
    db.refresh(shp)

    log_audit_action(
        db,
        action="SHIPMENT_STATUS_UPDATED",
        entity_type="shipment",
        user_id=current_user.user_id,
        entity_id=shipment_id,
        details={"status": target_status, "location": payload.location}
    )

    return build_shipment_detail(db, shp)

@router.post("/shipments/{shipment_id}/events", response_model=ShipmentDetailResponse)
def add_shipment_tracking_event(
    shipment_id: str,
    payload: TrackingEventCreateRequest,
    current_user: AppUser = Depends(RoleChecker(["operations", "admin"])),
    db: Session = Depends(get_db)
):
    shp = db.query(Shipment).filter(Shipment.shipment_id == shipment_id).first()
    if not shp:
        raise HTTPException(status_code=404, detail="Shipment not found.")

    evt = ShipmentTrackingEvent(
        event_id=f"EVT-{uuid.uuid4().hex[:8]}",
        shipment_id=shp.shipment_id,
        status=payload.status.upper(),
        location=payload.location,
        notes=payload.notes
    )
    db.add(evt)
    db.commit()
    db.refresh(shp)

    return build_shipment_detail(db, shp)

@router.get("/shipments", response_model=List[ShipmentResponse])
def get_operations_shipments(
    status_filter: Optional[str] = None,
    search: Optional[str] = None,
    delayed_only: bool = False,
    limit: int = Query(default=50, le=200),
    offset: int = Query(default=0, ge=0),
    current_user: AppUser = Depends(RoleChecker(["operations", "admin"])),
    db: Session = Depends(get_db)
):
    query = db.query(Shipment)
    if status_filter and status_filter.lower() != "all":
        query = query.filter(Shipment.delivery_status == status_filter)
    if delayed_only:
        query = query.filter(or_(Shipment.delayed_flag == 1, func.lower(Shipment.delivery_status) == "delayed"))
    if search and search.strip():
        term = f"%{search.strip()}%"
        query = query.filter(
            or_(
                Shipment.shipment_id.ilike(term),
                Shipment.order_id.ilike(term),
                Shipment.tracking_number.ilike(term),
                Shipment.delivery_city.ilike(term),
                Shipment.warehouse_city.ilike(term)
            )
        )
    return query.offset(offset).limit(limit).all()

@router.get("/inventory", response_model=List[InventoryHistoryResponse])
def get_operations_inventory(
    search: Optional[str] = None,
    low_stock_only: bool = False,
    limit: int = Query(default=50, le=200),
    offset: int = Query(default=0, ge=0),
    current_user: AppUser = Depends(RoleChecker(["operations", "admin"])),
    db: Session = Depends(get_db)
):
    query = db.query(InventoryHistory)
    if low_stock_only:
        query = query.filter(InventoryHistory.available_quantity <= InventoryHistory.reorder_level)
    if search and search.strip():
        term = f"%{search.strip()}%"
        query = query.filter(
            or_(
                InventoryHistory.product_id.ilike(term),
                InventoryHistory.warehouse_id.ilike(term)
            )
        )
    return query.offset(offset).limit(limit).all()
