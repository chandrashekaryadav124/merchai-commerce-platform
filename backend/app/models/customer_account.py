from sqlalchemy import Column, String, Text, Float, BigInteger, Integer, Boolean, ForeignKey, DateTime, func
from sqlalchemy.orm import relationship
from app.db.session import Base

class CustomerProfile(Base):
    __tablename__ = "customers"

    customer_id = Column(String(255), primary_key=True)
    app_user_id = Column(String(64), ForeignKey("app_users.user_id"), nullable=True, unique=True, index=True)
    
    app_user = relationship("AppUser", foreign_keys=[app_user_id])
    customer_signup_date = Column(Text, nullable=True)
    gender = Column(Text, nullable=True)
    age = Column(Float, nullable=True)
    age_group = Column(Text, nullable=True)
    state = Column(Text, nullable=True)
    city = Column(Text, nullable=True)
    pincode_prefix = Column(BigInteger, nullable=True)
    customer_segment = Column(Text, nullable=True)
    preferred_device = Column(Text, nullable=True)
    preferred_payment_method = Column(Text, nullable=True)
    acquisition_channel = Column(Text, nullable=True)
    total_orders = Column(BigInteger, nullable=True)
    total_spend = Column(Float, nullable=True)
    last_order_date = Column(Text, nullable=True)
    average_order_value = Column(Float, nullable=True)
    customer_status = Column(Text, nullable=True)
    loyalty_tier = Column(Text, nullable=True)
    calculated_aov = Column(Float, nullable=True)
    aov_difference = Column(Float, nullable=True)

class Payment(Base):
    __tablename__ = "payments"

    payment_id = Column(String(255), primary_key=True)
    order_id = Column(String(255), nullable=True, index=True)
    payment_date = Column(Text, nullable=True)
    payment_method = Column(Text, nullable=True)
    payment_status = Column(Text, nullable=True)
    amount_paid = Column(Float, nullable=True)
    transaction_fee = Column(Float, nullable=True)
    refund_amount = Column(Float, nullable=True)

class OrderReturn(Base):
    __tablename__ = "returns"

    return_id = Column(String(255), primary_key=True)
    order_id = Column(String(255), nullable=True, index=True)
    customer_id = Column(String(255), nullable=True, index=True)
    product_id = Column(String(255), nullable=True)
    return_date = Column(Text, nullable=True)
    return_reason = Column(Text, nullable=True)
    refund_amount = Column(Float, nullable=True)
    return_status = Column(Text, nullable=True)

class CustomerReview(Base):
    __tablename__ = "customer_reviews"

    review_id = Column(String(255), primary_key=True)
    order_id = Column(String(255), nullable=True, index=True)
    customer_id = Column(String(255), nullable=True, index=True)
    product_id = Column(String(255), nullable=True)
    review_date = Column(Text, nullable=True)
    rating = Column(BigInteger, nullable=True)
    review_sentiment = Column(Text, nullable=True)
    verified_purchase = Column(Boolean, nullable=True)

class ReviewText(Base):
    __tablename__ = "review_text"

    review_id = Column(String(255), primary_key=True)
    order_id = Column(String(255), nullable=True)
    customer_id = Column(String(255), nullable=True, index=True)
    product_id = Column(String(255), nullable=True)
    review_date = Column(Text, nullable=True)
    rating = Column(BigInteger, nullable=True)
    review_title = Column(Text, nullable=True)
    review_text = Column(Text, nullable=True)
    review_sentiment = Column(Text, nullable=True)
    verified_purchase = Column(Boolean, nullable=True)
    text_source = Column(Text, nullable=True)
    nlp_ready = Column(Boolean, nullable=True)

class CustomerAddress(Base):
    __tablename__ = "customer_addresses"

    address_id = Column(BigInteger, primary_key=True, autoincrement=True)
    user_id = Column(String(64), ForeignKey("app_users.user_id"), nullable=False, index=True)
    recipient_name = Column(String(150), nullable=False)
    phone_number = Column(String(20), nullable=False)
    address_line1 = Column(String(255), nullable=False)
    address_line2 = Column(String(255), nullable=True)
    city = Column(String(100), nullable=False)
    state = Column(String(100), nullable=False)
    postal_code = Column(String(10), nullable=False)
    country = Column(String(50), nullable=False, default="India")
    is_default = Column(Boolean, default=False)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

