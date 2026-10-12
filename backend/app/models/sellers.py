from sqlalchemy import Column, String, Text, DateTime, BigInteger, Integer, Numeric, func
from app.db.session import Base

class Seller(Base):
    __tablename__ = "sellers"

    seller_id = Column(String(64), primary_key=True)
    user_id = Column(String(64), nullable=True)
    store_name = Column(String(180), nullable=False)
    store_type = Column(String(100), nullable=True, default="Other / General Store")
    business_description = Column(Text, nullable=True)
    approval_status = Column(String(50), default="approved")
    contact_email = Column(String(254), nullable=True)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

class SellerProduct(Base):
    __tablename__ = "seller_products"

    seller_product_id = Column(BigInteger, primary_key=True, autoincrement=True)
    seller_id = Column(String(64), nullable=False, index=True)
    product_id = Column(String(255), nullable=False, index=True)
    selling_price = Column(Numeric(12, 2), nullable=False)
    stock_quantity = Column(Integer, default=0)
    listing_status = Column(String(50), default="active")
    assigned_by = Column(String(64), nullable=True)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())
