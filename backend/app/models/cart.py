from sqlalchemy import Column, BigInteger, String, Integer, Numeric, DateTime, func
from app.db.session import Base

class Cart(Base):
    __tablename__ = "carts"

    cart_id = Column(BigInteger, primary_key=True, autoincrement=True)
    customer_user_id = Column(String(64), nullable=False, index=True)
    status = Column(String(50), default="active")
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

class CartItem(Base):
    __tablename__ = "cart_items"

    cart_item_id = Column(BigInteger, primary_key=True, autoincrement=True)
    cart_id = Column(BigInteger, nullable=False, index=True)
    seller_product_id = Column(BigInteger, nullable=False)
    quantity = Column(Integer, nullable=False, default=1)
    unit_price = Column(Numeric(12, 2), nullable=False)
    added_at = Column(DateTime, server_default=func.now())
