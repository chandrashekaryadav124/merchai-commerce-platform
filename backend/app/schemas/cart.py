from typing import List, Optional
from datetime import datetime
from pydantic import BaseModel, Field

class CartItemAdd(BaseModel):
    product_id: Optional[str] = Field(None, description="Product ID to add to cart")
    seller_product_id: Optional[int] = Field(None, description="Specific SellerProduct ID if known")
    quantity: int = Field(default=1, ge=1, le=100, description="Quantity to add")

class CartItemUpdate(BaseModel):
    quantity: int = Field(..., ge=0, le=100, description="Updated quantity (0 to remove)")

class CartItemResponse(BaseModel):
    cart_item_id: int
    seller_product_id: int
    product_id: str
    product_name: str
    brand: Optional[str] = None
    category: Optional[str] = None
    image_url: Optional[str] = None
    seller_id: str
    store_name: str
    unit_price: float
    quantity: int
    line_total: float
    stock_quantity: int
    is_in_stock: bool
    listing_status: str

    class Config:
        from_attributes = True

class CartResponse(BaseModel):
    cart_id: int
    items: List[CartItemResponse]
    item_count: int
    subtotal: float

    class Config:
        from_attributes = True

class CartMergeRequest(BaseModel):
    items: List[CartItemAdd] = Field(default_factory=list, description="Guest cart items to merge into user cart")
