from typing import Optional, List
from pydantic import BaseModel

class ProductResponse(BaseModel):
    product_id: str
    product_name: str
    category: Optional[str] = None
    subcategory: Optional[str] = None
    brand: Optional[str] = None
    price: Optional[float] = None
    cost_price: Optional[float] = None
    discount_range: Optional[str] = None
    rating_average: Optional[float] = None
    rating_count: Optional[int] = None
    stock_quantity: Optional[int] = None
    product_launch_date: Optional[str] = None
    product_type: Optional[str] = None
    image_url: Optional[str] = None
    images: List[str] = []
    description: Optional[str] = None
    store_name: Optional[str] = None
    seller_id: Optional[str] = None
    selling_price: Optional[float] = None
    discount_price: Optional[float] = None

    class Config:
        from_attributes = True

class ProductCreate(BaseModel):
    product_name: str
    category: str
    subcategory: Optional[str] = "General"
    brand: Optional[str] = None
    price: float
    cost_price: Optional[float] = 0.0
    stock_quantity: int = 100
    description: Optional[str] = None
    image_url: Optional[str] = None

class ProductUpdate(BaseModel):
    product_name: Optional[str] = None
    category: Optional[str] = None
    subcategory: Optional[str] = None
    brand: Optional[str] = None
    price: Optional[float] = None
    cost_price: Optional[float] = None
    stock_quantity: Optional[int] = None
    description: Optional[str] = None
    image_url: Optional[str] = None

class ProductListResponse(BaseModel):
    total: int
    items: List[ProductResponse]
