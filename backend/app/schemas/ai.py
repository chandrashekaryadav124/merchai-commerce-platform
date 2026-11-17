from typing import Optional, List, Dict, Any, Literal
from pydantic import BaseModel, Field, field_validator
from app.schemas.products import ProductResponse

VALID_ROLES = {"user", "assistant", "system"}

class ChatMessage(BaseModel):
    role: str = Field(..., description="Message author role: 'user', 'assistant', or 'system'")
    content: str = Field(..., min_length=1, max_length=2000, description="Message text content")

    @field_validator("role")
    @classmethod
    def validate_role(cls, v: str) -> str:
        clean = v.strip().lower()
        if clean not in VALID_ROLES:
            raise ValueError(f"Role must be one of {sorted(VALID_ROLES)}, got '{v}'")
        return clean

    @field_validator("content")
    @classmethod
    def validate_content(cls, v: str) -> str:
        clean = v.strip()
        if not clean:
            raise ValueError("Message content cannot be blank or whitespace only")
        return clean

class ChatConversationRequest(BaseModel):
    messages: List[ChatMessage] = Field(
        ...,
        min_length=1,
        max_length=20,
        description="Conversation message history (maximum 20 messages)"
    )
    session_id: Optional[str] = Field(None, max_length=100, description="Optional client session identifier")
    context: Optional[Dict[str, Any]] = Field(None, description="Optional safe contextual metadata (e.g. active_page)")

class OrderStatusCard(BaseModel):
    order_id: str
    order_date: Optional[str] = None
    order_status: str
    shipping_method: Optional[str] = None
    delivery_city: Optional[str] = None
    final_amount: Optional[float] = None
    recipient_name: Optional[str] = None

class TicketCreatedCard(BaseModel):
    ticket_id: str
    issue_type: str
    status: str
    created_at: str
    message: str

class ChatConversationResponse(BaseModel):
    reply: str
    intent: Literal["product_discovery", "order_tracking", "policy_faq", "support_escalation", "general"]
    suggested_actions: List[str] = []
    recommended_products: List[ProductResponse] = []
    order_status_card: Optional[OrderStatusCard] = None
    ticket_created: Optional[TicketCreatedCard] = None

# Existing legacy schemas for backwards compatibility
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
