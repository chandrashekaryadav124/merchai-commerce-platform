from typing import Optional
from pydantic import BaseModel

class SupportTicketCreate(BaseModel):
    order_id: Optional[str] = None
    issue_type: str
    customer_message: str

class SupportTicketUpdate(BaseModel):
    ticket_status: Optional[str] = None
    resolution_guidance: Optional[str] = None

class SupportTicketResponse(BaseModel):
    ticket_id: str
    customer_id: Optional[str] = None
    order_id: Optional[str] = None
    issue_type: Optional[str] = None
    customer_message: Optional[str] = None
    resolution_guidance: Optional[str] = None
    ticket_status: Optional[str] = None
    created_at: Optional[str] = None

    class Config:
        from_attributes = True
