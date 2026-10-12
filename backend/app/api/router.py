from fastapi import APIRouter
from app.api.v1.endpoints import (
    health,
    auth,
    products,
    sellers,
    orders,
    support,
    analytics,
    admin,
    operations,
    customer_account,
    ai,
    address,
    cart,
    checkout
)

api_router = APIRouter()

# Health checks
api_router.include_router(health.router)

# Feature endpoints under /api/v1
api_router.include_router(auth.router, prefix="/api/v1/auth", tags=["Authentication"])
api_router.include_router(customer_account.router, prefix="/api/v1/customer/account", tags=["Customer My Account"])
api_router.include_router(address.router, prefix="/api/v1/customer/addresses", tags=["Customer Delivery Addresses"])
api_router.include_router(cart.router, prefix="/api/v1/cart", tags=["Shopping Cart"])
api_router.include_router(checkout.router, prefix="/api/v1/checkout", tags=["Checkout & Order Placement"])
api_router.include_router(products.router, prefix="/api/v1/products", tags=["Products"])
api_router.include_router(sellers.router, prefix="/api/v1/sellers", tags=["Sellers"])
api_router.include_router(orders.router, prefix="/api/v1/orders", tags=["Orders"])
api_router.include_router(support.router, prefix="/api/v1/support", tags=["Support"])
api_router.include_router(analytics.router, prefix="/api/v1", tags=["Analytics"])
api_router.include_router(admin.router, prefix="/api/v1/admin", tags=["Admin Governance"])
api_router.include_router(operations.router, prefix="/api/v1/operations", tags=["Operations Logistics"])
api_router.include_router(ai.router, prefix="/api/v1/ai", tags=["AI Copilot Services"])

