from typing import List, Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from pydantic import BaseModel
from app.db.session import get_db
from app.models.logistics import Shipment, InventoryHistory
from app.core.deps import RoleChecker
from app.models.users import AppUser

router = APIRouter()

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

@router.get("/shipments", response_model=List[ShipmentResponse])
def get_operations_shipments(
    status_filter: Optional[str] = None,
    limit: int = Query(default=50, le=200),
    current_user: AppUser = Depends(RoleChecker(["operations", "admin"])),
    db: Session = Depends(get_db)
):
    query = db.query(Shipment)
    if status_filter:
        query = query.filter(Shipment.delivery_status == status_filter)
    return query.limit(limit).all()

@router.get("/inventory", response_model=List[InventoryHistoryResponse])
def get_operations_inventory(
    limit: int = Query(default=50, le=200),
    current_user: AppUser = Depends(RoleChecker(["operations", "admin"])),
    db: Session = Depends(get_db)
):
    return db.query(InventoryHistory).limit(limit).all()
