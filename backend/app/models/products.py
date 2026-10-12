from sqlalchemy import Column, String, Text, Float, BigInteger, Boolean, DateTime
from app.db.session import Base

class Product(Base):
    __tablename__ = "products"

    product_id = Column(String(255), primary_key=True)
    product_name = Column(Text, nullable=False)
    category = Column(Text, nullable=True)
    subcategory = Column(Text, nullable=True)
    brand = Column(Text, nullable=True)
    price = Column(Float, nullable=True)
    cost_price = Column(Float, nullable=True)
    discount_range = Column(Text, nullable=True)
    rating_average = Column(Float, nullable=True)
    rating_count = Column(BigInteger, nullable=True)
    stock_quantity = Column(BigInteger, nullable=True)
    product_launch_date = Column(Text, nullable=True)
    product_type = Column(Text, nullable=True)
    return_rate_baseline = Column(Float, nullable=True)

class ProductImage(Base):
    __tablename__ = "product_images"

    image_id = Column(String(255), primary_key=True)
    product_id = Column(String(255), nullable=True)
    image_path = Column(Text, nullable=True)
    image_type = Column(Text, nullable=True)
    category = Column(Text, nullable=True)
    subcategory = Column(Text, nullable=True)
    brand = Column(Text, nullable=True)
    variant = Column(BigInteger, nullable=True)
    source_type = Column(Text, nullable=True)
    cv_ready = Column(Boolean, nullable=True)

class ProductKnowledge(Base):
    __tablename__ = "product_knowledge"

    knowledge_id = Column(String(255), primary_key=True)
    product_id = Column(String(255), nullable=True)
    product_name = Column(Text, nullable=True)
    category = Column(Text, nullable=True)
    subcategory = Column(Text, nullable=True)
    brand = Column(Text, nullable=True)
    knowledge_type = Column(Text, nullable=True)
    title = Column(Text, nullable=True)
    content = Column(Text, nullable=True)
    source_type = Column(Text, nullable=True)
    source_reference = Column(Text, nullable=True)
    last_updated = Column(Text, nullable=True)
