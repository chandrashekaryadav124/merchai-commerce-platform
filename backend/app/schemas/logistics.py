from typing import Optional, List, Any
from pydantic import BaseModel

class CourierPartnerResponse(BaseModel):
    courier_id: str
    name: str
    code: str
    contact_phone: Optional[str] = None
    tracking_url_template: Optional[str] = None
    is_active: bool

    class Config:
        from_attributes = True

class ShipmentTrackingEventItem(BaseModel):
    event_id: str
    shipment_id: str
    status: str
    location: Optional[str] = None
    notes: Optional[str] = None
    created_at: Optional[str] = None

    class Config:
        from_attributes = True

class TrackingEventCreateRequest(BaseModel):
    status: str
    location: Optional[str] = None
    notes: Optional[str] = None

class ShipmentCreateRequest(BaseModel):
    seller_order_id: int
    courier_partner_id: str
    warehouse_city: Optional[str] = "Bengaluru Hub"
    shipping_method: Optional[str] = "Standard Express"
    expected_delivery_days: Optional[int] = 3
    notes: Optional[str] = None

class ShipmentStatusUpdateRequest(BaseModel):
    new_status: str
    location: Optional[str] = None
    notes: Optional[str] = None

class ShipmentDetailResponse(BaseModel):
    shipment_id: str
    order_id: Optional[str] = None
    seller_order_id: Optional[int] = None
    seller_id: Optional[str] = None
    seller_store_name: Optional[str] = None
    warehouse_city: Optional[str] = None
    delivery_city: Optional[str] = None
    shipping_method: Optional[str] = None
    courier_partner_id: Optional[str] = None
    courier_name: Optional[str] = None
    tracking_number: Optional[str] = None
    tracking_url: Optional[str] = None
    recipient_name: Optional[str] = None
    recipient_phone_masked: Optional[str] = None
    shipping_address: Optional[str] = None
    dispatch_date: Optional[str] = None
    expected_delivery_date: Optional[str] = None
    actual_delivery_date: Optional[str] = None
    delivery_days: Optional[float] = None
    delivery_status: Optional[str] = None
    delayed_flag: Optional[int] = None
    events: List[ShipmentTrackingEventItem] = []
    created_at: Optional[str] = None

    class Config:
        from_attributes = True

class ReadyForPickupItemResponse(BaseModel):
    seller_order_id: int
    order_id: str
    seller_id: str
    seller_store_name: str
    status: str
    subtotal: float
    order_date: Optional[str] = None
    customer_name: Optional[str] = None
    delivery_city: Optional[str] = None
    delivery_state: Optional[str] = None
    items_count: int
    items_summary: str
    created_at: Optional[str] = None

class CustomerPackageTrackingResponse(BaseModel):
    shipment_id: Optional[str] = None
    seller_order_id: int
    seller_id: str
    seller_store_name: str
    status: str
    courier_name: Optional[str] = None
    tracking_number: Optional[str] = None
    tracking_url: Optional[str] = None
    warehouse_city: Optional[str] = None
    dispatch_date: Optional[str] = None
    expected_delivery_date: Optional[str] = None
    actual_delivery_date: Optional[str] = None
    events: List[ShipmentTrackingEventItem] = []
    items: List[Any] = []

class CustomerOrderTrackingResponse(BaseModel):
    order_id: str
    order_status: str
    order_date: Optional[str] = None
    delivery_city: Optional[str] = None
    delivery_state: Optional[str] = None
    recipient_name: Optional[str] = None
    shipping_address: Optional[str] = None
    packages: List[CustomerPackageTrackingResponse] = []

