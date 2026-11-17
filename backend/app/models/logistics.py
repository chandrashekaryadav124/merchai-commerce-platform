from sqlalchemy import Column, String, Text, Float, BigInteger, DateTime, func
from app.db.session import Base

class Shipment(Base):
    __tablename__ = "shipments"

    shipment_id = Column(String(255), primary_key=True)
    order_id = Column(String(255), nullable=True, index=True)
    seller_order_id = Column(BigInteger, nullable=True, index=True)
    seller_id = Column(String(64), nullable=True, index=True)
    warehouse_city = Column(Text, nullable=True)
    delivery_city = Column(Text, nullable=True)
    shipping_method = Column(Text, nullable=True)
    courier_partner_id = Column(String(64), nullable=True)
    courier_name = Column(String(100), nullable=True)
    tracking_number = Column(String(100), nullable=True, index=True)
    recipient_name = Column(String(150), nullable=True)
    recipient_phone = Column(String(20), nullable=True)
    shipping_address = Column(Text, nullable=True)
    dispatch_date = Column(Text, nullable=True)
    expected_delivery_date = Column(Text, nullable=True)
    actual_delivery_date = Column(Text, nullable=True)
    delivery_days = Column(Float, nullable=True)
    delivery_status = Column(Text, nullable=True)
    delayed_flag = Column(BigInteger, nullable=True)
    delivery_days_validation = Column(Text, nullable=True)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

class CourierPartner(Base):
    __tablename__ = "courier_partners"

    courier_id = Column(String(64), primary_key=True)
    name = Column(String(100), nullable=False)
    code = Column(String(50), nullable=False, unique=True)
    contact_phone = Column(String(20), nullable=True)
    tracking_url_template = Column(String(255), nullable=True)
    is_active = Column(BigInteger, default=1)
    created_at = Column(DateTime, server_default=func.now())

class ShipmentTrackingEvent(Base):
    __tablename__ = "shipment_tracking_events"

    event_id = Column(String(64), primary_key=True)
    shipment_id = Column(String(100), nullable=False, index=True)
    status = Column(String(50), nullable=False)
    location = Column(String(100), nullable=True)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, server_default=func.now())

class InventoryHistory(Base):
    __tablename__ = "inventory_history"

    inventory_snapshot_id = Column(String(255), primary_key=True)
    product_id = Column(String(255), nullable=True, index=True)
    snapshot_date = Column(Text, nullable=True)
    warehouse_id = Column(Text, nullable=True)
    stock_quantity = Column(BigInteger, nullable=True)
    reserved_quantity = Column(BigInteger, nullable=True)
    available_quantity = Column(BigInteger, nullable=True)
    reorder_level = Column(BigInteger, nullable=True)
    inventory_status = Column(Text, nullable=True)
    source_type = Column(Text, nullable=True)
    seller_id = Column(String(64), nullable=True, index=True)
    previous_quantity = Column(BigInteger, nullable=True)
    quantity_change = Column(BigInteger, nullable=True)
    new_quantity = Column(BigInteger, nullable=True)
    adjustment_type = Column(String(50), nullable=True)
    adjustment_reason = Column(Text, nullable=True)
    user_id = Column(String(64), nullable=True)
    order_reference = Column(String(255), nullable=True)
    created_at = Column(DateTime, server_default=func.now())
