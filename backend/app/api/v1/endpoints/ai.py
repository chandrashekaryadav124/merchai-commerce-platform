from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from app.services.genai_service import (
    generate_listing_copilot,
    shopping_assistant_copilot,
    seller_advisor_copilot,
    rag_knowledge_query
)
from app.services.ml_service import get_demand_forecast

router = APIRouter()

class GenerateListingReq(BaseModel):
    seed_text: str
    category_name: Optional[str] = "Food & Gourmet"

class ShoppingAssistantReq(BaseModel):
    user_query: str
    budget: Optional[float] = 2000.0
    location: Optional[str] = "Bengaluru"

class SellerAdvisorReq(BaseModel):
    seller_id: str
    question: str

class RAGQueryReq(BaseModel):
    seller_id: str
    query: str

@router.post("/generate-listing")
def generate_listing_endpoint(req: GenerateListingReq):
    if not req.seed_text:
        raise HTTPException(status_code=400, detail="Seed text is required.")
    return generate_listing_copilot(req.seed_text, req.category_name or "General")

@router.post("/shopping-assistant")
def shopping_assistant_endpoint(req: ShoppingAssistantReq):
    if not req.user_query:
        raise HTTPException(status_code=400, detail="User query is required.")
    return shopping_assistant_copilot(req.user_query, req.budget or 2000.0, req.location or "Bengaluru")

from sqlalchemy.orm import Session
from app.db.session import get_db
from app.core.deps import get_current_user
from app.models.users import AppUser
from app.models.sellers import Seller

@router.post("/seller-advisor")
def seller_advisor_endpoint(
    req: SellerAdvisorReq,
    current_user: AppUser = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if current_user.role == "seller":
        seller = db.query(Seller).filter(Seller.user_id == current_user.user_id).first()
        if not seller or seller.seller_id != req.seller_id:
            raise HTTPException(status_code=403, detail="Access denied: Sellers can only request AI advisor insights for their own storefront.")
    return seller_advisor_copilot(req.seller_id, req.question)

@router.get("/demand-forecast/{store_id}")
def demand_forecast_endpoint(
    store_id: str,
    current_user: AppUser = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if current_user.role == "seller":
        seller = db.query(Seller).filter(Seller.user_id == current_user.user_id).first()
        if not seller or seller.seller_id != store_id:
            raise HTTPException(status_code=403, detail="Access denied: Sellers can only view demand forecasting for their own storefront.")
    return get_demand_forecast(store_id)

@router.post("/rag/query")
def rag_query_endpoint(
    req: RAGQueryReq,
    current_user: AppUser = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if current_user.role == "seller":
        seller = db.query(Seller).filter(Seller.user_id == current_user.user_id).first()
        if not seller or seller.seller_id != req.seller_id:
            raise HTTPException(status_code=403, detail="Access denied: Sellers can only query RAG knowledge for their own storefront.")
    return rag_knowledge_query(req.seller_id, req.query)

