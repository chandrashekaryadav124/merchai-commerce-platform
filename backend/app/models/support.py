from sqlalchemy import Column, String, Text
from app.db.session import Base

class SupportTicket(Base):
    __tablename__ = "support_tickets"

    ticket_id = Column(String(255), primary_key=True)
    customer_id = Column(String(255), nullable=True, index=True)
    order_id = Column(String(255), nullable=True, index=True)
    issue_type = Column(Text, nullable=True)
    customer_message = Column(Text, nullable=True)
    resolution_guidance = Column(Text, nullable=True)
    ticket_status = Column(Text, nullable=True)
    created_at = Column(Text, nullable=True)
    source_type = Column(Text, nullable=True)
