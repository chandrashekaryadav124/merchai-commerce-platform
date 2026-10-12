from sqlalchemy import Column, String, Text, Float, BigInteger
from app.db.session import Base

class Shipment(Base):
    __tablename__ = "shipments"

    shipment_id = Column(String(255), primary_key=True)
    order_id = Column(String(255), nullable=True, index=True)
    warehouse_city = Column(Text, nullable=True)
    delivery_city = Column(Text, nullable=True)
    shipping_method = Column(Text, nullable=True)
    dispatch_date = Column(Text, nullable=True)
    expected_delivery_date = Column(Text, nullable=True)
    actual_delivery_date = Column(Text, nullable=True)
    delivery_days = Column(Float, nullable=True)
    delivery_status = Column(Text, nullable=True)
    delayed_flag = Column(BigInteger, nullable=True)
    delivery_days_validation = Column(Text, nullable=True)

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
