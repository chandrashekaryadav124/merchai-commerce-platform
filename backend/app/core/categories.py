"""
Centralized Store Types and Product Categories Mapping & Validation.
Provides unified definition for seller onboarding store types, permitted category lists,
and server-side authorization checks.
"""
from typing import List, Dict, Optional

# The 10 official Store Types / Business Categories
VALID_STORE_TYPES: List[str] = [
    "Fashion & Footwear",
    "Electronics & Mobiles",
    "Grocery & Daily Essentials",
    "Home & Kitchen",
    "Beauty & Personal Care",
    "Health & Wellness",
    "Books & Stationery",
    "Sports, Toys & Baby Products",
    "Automotive & Accessories",
    "Other / General Store",
]

DEFAULT_STORE_TYPE = "Other / General Store"

# All existing base categories supported in the live marketplace database
ALL_MARKETPLACE_CATEGORIES: List[str] = [
    "Grocery",
    "Fashion",
    "Footwear",
    "Home & Kitchen",
    "Beauty",
    "Sports",
    "Appliances",
    "Bags",
    "Furniture",
    "Books",
    "Mobile Accessories",
    "Office Supplies",
    "Electronics",
    "Health & Wellness",
    "Stationery",
    "Toys",
    "Personal Care",
    "Watches",
    "Pet Supplies",
    "Baby Care",
    "Automotive Accessories",
    "Musical Instruments",
]

# Store Type -> Permitted Product Categories (reconciled with database categories + proposed business aliases)
STORE_TYPE_CATEGORIES: Dict[str, List[str]] = {
    "Fashion & Footwear": [
        "Footwear",
        "Shoes",
        "Sandals",
        "Clothing",
        "Fashion Accessories",
        "Fashion",
        "Bags",
        "Watches"
    ],
    "Electronics & Mobiles": [
        "Electronics",
        "Mobiles",
        "Computers",
        "Audio",
        "Electronic Accessories",
        "Mobile Accessories",
        "Appliances"
    ],
    "Grocery & Daily Essentials": [
        "Fruits & Vegetables",
        "Groceries",
        "Beverages",
        "Household Essentials",
        "Grocery",
        "Pet Supplies"
    ],
    "Home & Kitchen": [
        "Furniture",
        "Kitchenware",
        "Home Decor",
        "Appliances",
        "Home & Kitchen"
    ],
    "Beauty & Personal Care": [
        "Skincare",
        "Haircare",
        "Makeup",
        "Personal Care",
        "Beauty"
    ],
    "Health & Wellness": [
        "Wellness Products",
        "Fitness Accessories",
        "Personal Care",
        "Health & Wellness",
        "Sports"
    ],
    "Books & Stationery": [
        "Books",
        "Notebooks",
        "Pens",
        "Office Supplies",
        "Stationery"
    ],
    "Sports, Toys & Baby Products": [
        "Sports Equipment",
        "Toys",
        "Baby Products",
        "Sports",
        "Baby Care"
    ],
    "Automotive & Accessories": [
        "Automotive Parts",
        "Car Accessories",
        "Bike Accessories",
        "Automotive Accessories"
    ],
    "Other / General Store": ALL_MARKETPLACE_CATEGORIES
}

def normalize_store_type(store_type: Optional[str]) -> str:
    """Returns verified store type or falls back to DEFAULT_STORE_TYPE."""
    if not store_type or not store_type.strip():
        return DEFAULT_STORE_TYPE
    clean = store_type.strip()
    for valid in VALID_STORE_TYPES:
        if valid.lower() == clean.lower():
            return valid
    return DEFAULT_STORE_TYPE

def get_permitted_categories(store_type: Optional[str]) -> List[str]:
    """Returns list of allowed product categories for the given store type."""
    norm = normalize_store_type(store_type)
    return STORE_TYPE_CATEGORIES.get(norm, ALL_MARKETPLACE_CATEGORIES)

def is_category_permitted(category: str, store_type: Optional[str]) -> bool:
    """Validates whether a product category is permitted for the given store type."""
    if not category or not category.strip():
        return False
    clean_cat = category.strip().lower()
    allowed = [c.lower() for c in get_permitted_categories(store_type)]
    return clean_cat in allowed
