from sqlalchemy import Column, String, Text, Float, BigInteger, DateTime, Numeric, Integer, func
from app.db.session import Base

class Order(Base):
    __tablename__ = "orders"

    order_id = Column(String(255), primary_key=True)
    customer_id = Column(String(255), nullable=True, index=True)
    order_date = Column(Text, nullable=True)
    order_time = Column(Text, nullable=True)
    order_status = Column(Text, nullable=True)
    shipping_method = Column(Text, nullable=True)
    delivery_city = Column(Text, nullable=True)
    delivery_state = Column(Text, nullable=True)
    coupon_code = Column(Text, nullable=True)
    discount_percentage = Column(Float, nullable=True)
    marketing_channel = Column(Text, nullable=True)
    subtotal = Column(Float, nullable=True)
    shipping_fee = Column(Float, nullable=True)
    tax_amount = Column(Float, nullable=True)
    final_amount = Column(Float, nullable=True)
    campaign_id = Column(Text, nullable=True)
    shipping_address = Column(Text, nullable=True)
    delivery_pincode = Column(String(10), nullable=True)
    recipient_name = Column(String(150), nullable=True)
    recipient_phone = Column(String(20), nullable=True)
    idempotency_key = Column(String(100), nullable=True, index=True)

class OrderItem(Base):
    __tablename__ = "order_items"

    order_item_id = Column(String(255), primary_key=True)
    order_id = Column(String(255), nullable=True, index=True)
    product_id = Column(String(255), nullable=True, index=True)
    quantity = Column(BigInteger, nullable=True)
    unit_price = Column(Float, nullable=True)
    discount_percentage = Column(Float, nullable=True)
    item_revenue = Column(Float, nullable=True)
    item_cost = Column(Float, nullable=True)
    profit = Column(Float, nullable=True)

class SellerOrder(Base):
    __tablename__ = "seller_orders"

    seller_order_id = Column(BigInteger, primary_key=True, autoincrement=True)
    order_id = Column(String(255), nullable=False, index=True)
    seller_id = Column(String(64), nullable=False, index=True)
    status = Column(String(50), default="pending")
    subtotal = Column(Numeric(12, 2), nullable=True)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

class SellerOrderItem(Base):
    __tablename__ = "seller_order_items"

    seller_order_item_id = Column(BigInteger, primary_key=True, autoincrement=True)
    seller_order_id = Column(BigInteger, nullable=False, index=True)
    order_item_id = Column(String(255), nullable=False)
    product_id = Column(String(255), nullable=False)
    quantity = Column(Integer, nullable=False)
    unit_price = Column(Numeric(12, 2), nullable=False)
    created_at = Column(DateTime, server_default=func.now())
