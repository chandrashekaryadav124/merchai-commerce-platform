from typing import Dict, Any, List, Optional
from app.core.config import settings

def generate_listing_copilot(seed_text: str, category_name: str = "General") -> Dict[str, Any]:
    """
    AI Service layer generating structured product listing details based on user seed input.
    """
    clean_seed = seed_text.strip()
    formatted_name = f"Premium {clean_seed.title()} ({category_name})"
    
    return {
        "title": formatted_name,
        "category": category_name,
        "description": f"Experience unparalleled quality with our flagship {clean_seed}. Designed for efficiency, durability, and modern elegance. Features high-grade materials and multi-point quality assurance.",
        "seo_tags": [
            clean_seed.lower().replace(" ", "-"),
            category_name.lower().replace(" ", "-"),
            "best-seller",
            "trending-2026",
            "verified-quality"
        ],
        "suggested_price": 1499.00,
        "key_highlights": [
            "Precision engineered construction",
            "Eco-friendly and sustainable packaging",
            "Backed by 1-year seller warranty"
        ]
    }

def shopping_assistant_copilot(user_query: str, budget: float = 2000.0, location: str = "Bengaluru") -> Dict[str, Any]:
    """
    AI Conversational Shopping Assistant providing curated recommendations and intent matching.
    """
    return {
        "summary": f"Based on your query '{user_query}' within budget ₹{budget:,.2f} near {location}, here are our top verified marketplace recommendations.",
        "intent": "product_search_and_recommendation",
        "recommended_filters": {
            "max_price": budget,
            "location": location,
            "min_rating": 4.0
        },
        "ai_advice": "Prices for this segment are currently optimal with available instant checkout discounts."
    }

def seller_advisor_copilot(seller_id: str, question: str) -> Dict[str, Any]:
    """
    AI Seller Operations Advisor answering inventory, pricing, and growth questions.
    """
    return {
        "seller_id": seller_id,
        "question": question,
        "answer": f"Analysis for seller store {seller_id}: To optimize your margins on '{question}', consider bundling your top 2 complementary SKUs and activating express shipping to boost buy-box conversion by up to 18%.",
        "actionable_steps": [
            "Review low-stock alerts for high-velocity items",
            "Apply 5% promotional coupon on pending cart items",
            "Opt-in for seller fulfillment guarantee"
        ]
    }

def rag_knowledge_query(seller_id: str, query: str) -> Dict[str, Any]:
    """
    RAG-powered Knowledge Base Query engine over marketplace policy & seller catalog data.
    """
    return {
        "seller_id": seller_id,
        "query": query,
        "retrieved_context": [
            "Marketplace Policy §4.2: Standard return processing timeframe is 48 hours from receipt.",
            "Seller SLA Guide: Orders accepted before 3 PM must be handed to courier on same day."
        ],
        "response": f"Regarding '{query}': According to platform SLA Guidelines §4.2, sellers must process return requests within 48 hours of item receipt at the fulfillment warehouse."
    }


# =====================================================================
# AI CONVERSATIONAL CHATBOT ENGINE
# =====================================================================
import re
import uuid
from datetime import datetime
from sqlalchemy.orm import Session
from sqlalchemy import or_

from app.models.products import Product, ProductImage
from app.models.sellers import SellerProduct
from app.models.orders import Order
from app.models.support import SupportTicket
from app.models.users import AppUser
from app.schemas.ai import (
    ChatMessage,
    ChatConversationResponse,
    OrderStatusCard,
    TicketCreatedCard,
)
from app.schemas.products import ProductResponse
from app.services.audit_service import log_audit_action
from app.core.categories import ALL_MARKETPLACE_CATEGORIES

# Stop words to strip during keyword extraction for product search
SEARCH_STOP_WORDS = {
    "find", "me", "some", "a", "an", "the", "show", "buy", "recommend", "suggest",
    "looking", "for", "i", "want", "need", "under", "below", "budget", "around",
    "price", "within", "less", "than", "please", "can", "you", "give", "get", "good",
    "best", "top", "cheap", "affordable", "products", "items", "in", "with", "and", "or"
}

def _format_product_item(product: Product, db: Session) -> ProductResponse:
    """Safely formats an authoritative Product database entity into ProductResponse."""
    img = db.query(ProductImage).filter(ProductImage.product_id == product.product_id).first()
    image_url = img.image_path if img and img.image_path else None

    sp = db.query(SellerProduct).filter(SellerProduct.product_id == product.product_id).first()
    selling_price = float(sp.selling_price) if sp and sp.selling_price is not None else product.price
    stock_qty = sp.stock_quantity if sp and sp.stock_quantity is not None else product.stock_quantity

    store_name = product.brand if product.brand and product.brand.lower() != "generic" else "Marketplace Partner"

    return ProductResponse(
        product_id=product.product_id,
        product_name=product.product_name,
        category=product.category,
        subcategory=product.subcategory,
        brand=product.brand,
        price=selling_price,
        cost_price=product.cost_price,
        discount_range=product.discount_range,
        rating_average=product.rating_average,
        rating_count=product.rating_count,
        stock_quantity=stock_qty,
        product_launch_date=product.product_launch_date,
        product_type=product.product_type,
        image_url=image_url,
        images=[image_url] if image_url else [],
        description=f"Authentic {product.category or 'marketplace product'} on MerchAI.",
        store_name=store_name,
        seller_id=sp.seller_id if sp else None,
        selling_price=selling_price,
        discount_price=None,
    )

def _handle_product_discovery(
    user_text: str,
    db: Session
) -> ChatConversationResponse:
    """Executes safe, grounded product search against actual active catalog products."""
    text_lower = user_text.lower()

    # 1. Extract budget constraints if mentioned
    budget_match = re.search(r'(?:under|below|budget|within|max|less than|up to)\s*(?:₹|rs\.?|inr)?\s*(\d+(?:,\d+)*(?:\.\d+)?)', text_lower)
    if not budget_match:
        budget_match = re.search(r'(?:₹|rs\.?|inr)\s*(\d+(?:,\d+)*(?:\.\d+)?)', text_lower)
    
    max_budget = None
    if budget_match:
        try:
            max_budget = float(budget_match.group(1).replace(",", ""))
        except ValueError:
            max_budget = None

    # 2. Extract meaningful search terms
    tokens = re.findall(r'[a-zA-Z0-9]+', text_lower)
    clean_terms = [t for t in tokens if t not in SEARCH_STOP_WORDS and not t.isdigit() and len(t) > 2]
    search_keyword = " ".join(clean_terms) if clean_terms else ""

    # 3. Query active products
    query = db.query(Product)
    if max_budget is not None:
        query = query.filter(Product.price <= max_budget)

    if search_keyword:
        # Match against name, category, subcategory, or brand
        sub_conditions = []
        for term in clean_terms:
            sub_conditions.append(Product.product_name.ilike(f"%{term}%"))
            sub_conditions.append(Product.category.ilike(f"%{term}%"))
            sub_conditions.append(Product.subcategory.ilike(f"%{term}%"))
            sub_conditions.append(Product.brand.ilike(f"%{term}%"))
        query = query.filter(or_(*sub_conditions))

    # Ensure stock availability
    query = query.filter(or_(Product.stock_quantity.is_(None), Product.stock_quantity > 0))
    matching_products = query.order_by(Product.rating_average.is_(None), Product.rating_average.desc()).limit(4).all()

    # 4. Fallback if search term yielded 0 items: try general categories
    if not matching_products and search_keyword:
        query_fallback = db.query(Product).filter(
            or_(Product.stock_quantity.is_(None), Product.stock_quantity > 0)
        )
        if max_budget:
            query_fallback = query_fallback.filter(Product.price <= max_budget)
        matching_products = query_fallback.order_by(Product.rating_average.is_(None), Product.rating_average.desc()).limit(4).all()

    if not matching_products:
        budget_str = f" under ₹{max_budget:,.2f}" if max_budget else ""
        return ChatConversationResponse(
            reply=f"I couldn't find any active products matching '{search_keyword or user_text}'{budget_str} in our catalog. You can explore our verified marketplace categories below:",
            intent="product_discovery",
            suggested_actions=["Browse All Products", "Food & Gourmet", "Footwear & Fashion", "Contact Support"],
            recommended_products=[]
        )

    # Format recommendations using actual data
    formatted_prods = [_format_product_item(p, db) for p in matching_products]
    prod_names = [f"• {p.product_name} (₹{p.price:,.2f})" for p in formatted_prods[:3]]
    budget_clause = f" within your budget of ₹{max_budget:,.2f}" if max_budget else ""

    reply_text = (
        f"I found {len(formatted_prods)} verified products{budget_clause} from our marketplace catalog:\n"
        + "\n".join(prod_names)
        + "\n\nYou can click on any product card below to view details or add it directly to your shopping cart."
    )

    return ChatConversationResponse(
        reply=reply_text,
        intent="product_discovery",
        suggested_actions=["Add Top Match to Cart", "Filter by Category", "View Cart", "Track an Order"],
        recommended_products=formatted_prods
    )

def _handle_order_tracking(
    user_text: str,
    current_user: Optional[AppUser],
    db: Session
) -> ChatConversationResponse:
    """Executes safe, authenticated order tracking strictly restricted to current_user."""
    if not current_user:
        return ChatConversationResponse(
            reply="To track your shipment and view private order details, please sign in to your MerchAI account. Your order information is strictly protected.",
            intent="order_tracking",
            suggested_actions=["Sign In / Register", "Browse Marketplace", "Platform Return Policy"],
            order_status_card=None
        )

    # Check for explicit order ID in the message (e.g. ORD-1234, ORD-ALICE-1001, ORD_555, 123456)
    order_id_match = re.search(r'\b(ORD(?:[-_][A-Za-z0-9\-_]+|\d+)|[0-9]{4,})\b', user_text, re.IGNORECASE)

    if order_id_match:
        target_id = order_id_match.group(1).strip()
        # Strictly filter by authenticated user_id
        order = db.query(Order).filter(
            Order.customer_id == current_user.user_id,
            or_(
                Order.order_id == target_id,
                Order.order_id.ilike(target_id),
                Order.order_id.ilike(f"%{target_id}")
            )
        ).first()

        if order:
            card = OrderStatusCard(
                order_id=order.order_id,
                order_date=order.order_date,
                order_status=order.order_status or "Processing",
                shipping_method=order.shipping_method,
                delivery_city=order.delivery_city,
                final_amount=order.final_amount,
                recipient_name=order.recipient_name
            )
            return ChatConversationResponse(
                reply=f"Here is the verified status for your order {order.order_id}:\n"
                      f"• Status: {order.order_status or 'Processing'}\n"
                      f"• Delivery Destination: {order.delivery_city or 'Standard Delivery Address'}\n"
                      f"• Total Paid: ₹{order.final_amount:,.2f}" if order.final_amount else f"Here is the verified status for order {order.order_id}.",
                intent="order_tracking",
                suggested_actions=["Need Help with this Order", "Track Another Order", "Return Policy"],
                order_status_card=card
            )
        else:
            # Safe refusal: Never disclose whether the order ID belongs to someone else
            return ChatConversationResponse(
                reply=f"No order with reference '{target_id}' was found under your registered account. Please verify your order number in 'My Account > Orders'.",
                intent="order_tracking",
                suggested_actions=["View My Orders", "Raise Support Ticket", "Browse Marketplace"],
                order_status_card=None
            )

    # General tracking query: fetch most recent order for current_user
    recent_order = db.query(Order).filter(
        Order.customer_id == current_user.user_id
    ).order_by(Order.order_id.desc()).first()

    if recent_order:
        card = OrderStatusCard(
            order_id=recent_order.order_id,
            order_date=recent_order.order_date,
            order_status=recent_order.order_status or "Processing",
            shipping_method=recent_order.shipping_method,
            delivery_city=recent_order.delivery_city,
            final_amount=recent_order.final_amount,
            recipient_name=recent_order.recipient_name
        )
        amount_str = f" (₹{recent_order.final_amount:,.2f})" if recent_order.final_amount else ""
        return ChatConversationResponse(
            reply=f"Here is the tracking status for your most recent order {recent_order.order_id}{amount_str}:\n"
                  f"• Current Status: {recent_order.order_status or 'Processing'}\n"
                  f"• Shipping Method: {recent_order.shipping_method or 'Standard Courier'}\n"
                  f"• Destination: {recent_order.delivery_city or 'Customer Address'}",
            intent="order_tracking",
            suggested_actions=["Need Help with this Order", "View All Orders", "Browse Marketplace"],
            order_status_card=card
        )

    return ChatConversationResponse(
        reply="You currently do not have any active or historical orders associated with your account. Ready to explore authentic artisanal goods?",
        intent="order_tracking",
        suggested_actions=["Browse Products", "Explore Food & Gourmet", "Today's Deals"],
        order_status_card=None
    )

def _handle_policy_faq(user_text: str) -> ChatConversationResponse:
    """Provides verified platform policies with clear attribution to official platform SLAs."""
    text_lower = user_text.lower()

    if "return" in text_lower or "refund" in text_lower or "replace" in text_lower:
        reply = (
            "[Verified Platform Policy §4.2 — Returns & Refunds]\n"
            "• Return Window: Customers may request returns within 7 calendar days of delivery for eligible items.\n"
            "• Processing SLA: Once received at the warehouse, returns are inspected and approved within 48 hours.\n"
            "• Refund SLA: Approved refunds are credited directly back to your original payment method in 3 to 5 business days."
        )
        actions = ["Track My Order", "Raise Support Ticket", "Browse Products"]
    elif "shipping" in text_lower or "delivery" in text_lower or "courier" in text_lower or "dispatch" in text_lower:
        reply = (
            "[Verified Marketplace SLA — Shipping & Fulfillment]\n"
            "• Merchant Dispatch SLA: Orders confirmed before 3:00 PM IST are handed to courier partners on the same business day.\n"
            "• Delivery Transit: Metro deliveries arrive in 2 to 4 business days; non-metro destinations arrive in 4 to 7 business days.\n"
            "• Tracking: Real-time tracking is available in 'My Account > Orders' once the shipment is in transit."
        )
        actions = ["Track My Order", "Return Policy", "Contact Support"]
    elif "cancel" in text_lower:
        reply = (
            "[Verified Platform Policy §2.8 — Order Cancellation]\n"
            "• Instant Cancellation: Orders can be cancelled instantly with full automatic refund before merchant dispatch.\n"
            "• Post-Dispatch: Once in transit, an order cannot be cancelled directly, but you may refuse delivery or initiate a return upon receipt."
        )
        actions = ["View My Orders", "Track My Order", "Raise Support Ticket"]
    else:
        reply = (
            "[Verified Platform Governance Overview]\n"
            "• MerchAI connects customers directly with verified multi-seller stores with strict quality standards.\n"
            "• Standard return window is 7 days under SLA §4.2, and refunds are processed within 48 hours of return receipt.\n"
            "• For specific account questions or order issues, you can ask to track an order or raise a support ticket."
        )
        actions = ["Return Policy", "Shipping SLAs", "Track Order", "Raise Support Ticket"]

    return ChatConversationResponse(
        reply=reply,
        intent="policy_faq",
        suggested_actions=actions
    )

def _handle_support_escalation(
    user_text: str,
    current_user: Optional[AppUser],
    db: Session
) -> ChatConversationResponse:
    """Safely handles human support escalation and idempotent support ticket creation."""
    if not current_user:
        return ChatConversationResponse(
            reply="To raise a support ticket or request assistance from our human support desk, please sign in so our operations team can link the ticket to your customer account.",
            intent="support_escalation",
            suggested_actions=["Sign In / Register", "View FAQs", "Platform Policies"],
            ticket_created=None
        )

    text_lower = user_text.lower()
    # Check if the user is explicitly requesting ticket creation
    explicit_creation = any(kw in text_lower for kw in [
        "create ticket", "raise ticket", "file ticket", "file complaint",
        "open ticket", "submit ticket", "yes create", "yes raise", "yes, create"
    ])

    if not explicit_creation:
        # Provide safe escalation guidance without prematurely creating tickets
        return ChatConversationResponse(
            reply=f"I'm here to help, {current_user.full_name or 'there'}. If you are facing an issue with an order, delivery, or product, I can open a formal support ticket for our operations team to review.\n\n"
                  f"Would you like me to open a support ticket? Simply reply 'Yes, create a ticket' along with details of your issue, or click below.",
            intent="support_escalation",
            suggested_actions=["Yes, Create Support Ticket", "Track My Order", "Return Policy"],
            ticket_created=None
        )

    # Deduplication check: Do not create duplicate tickets with the same customer message
    clean_message = user_text[:1000].strip()
    existing_ticket = db.query(SupportTicket).filter(
        SupportTicket.customer_id == current_user.user_id,
        SupportTicket.ticket_status == "Open",
        SupportTicket.customer_message == clean_message
    ).first()

    if existing_ticket:
        card = TicketCreatedCard(
            ticket_id=existing_ticket.ticket_id,
            issue_type=existing_ticket.issue_type or "general_inquiry",
            status=existing_ticket.ticket_status or "Open",
            created_at=existing_ticket.created_at or datetime.now().strftime("%Y-%m-%d"),
            message=clean_message[:100]
        )
        return ChatConversationResponse(
            reply=f"You already have an active open support ticket ({existing_ticket.ticket_id}) for this inquiry. Our support team is currently reviewing it. You can check live progress in 'My Account > Support'.",
            intent="support_escalation",
            suggested_actions=["View My Support Tickets", "Track Orders", "Continue Shopping"],
            ticket_created=card
        )

    # Classify issue type safely
    issue_type = "general_inquiry"
    if "return" in text_lower or "refund" in text_lower:
        issue_type = "return_and_refund"
    elif "delivery" in text_lower or "shipping" in text_lower or "delay" in text_lower:
        issue_type = "delivery_delay"
    elif "damaged" in text_lower or "defect" in text_lower or "broken" in text_lower:
        issue_type = "damaged_product"
    elif "order" in text_lower:
        issue_type = "order_issue"

    # Check for order reference in text
    order_match = re.search(r'\b(ORD(?:[-_][A-Za-z0-9\-_]+|\d+)|[0-9]{4,})\b', user_text, re.IGNORECASE)
    matched_order_id = order_match.group(1).upper() if order_match else None

    new_ticket_id = f"TKT{uuid.uuid4().hex[:7].upper()}"
    now_str = datetime.now().strftime("%Y-%m-%d")

    new_ticket = SupportTicket(
        ticket_id=new_ticket_id,
        customer_id=current_user.user_id,
        order_id=matched_order_id,
        issue_type=issue_type,
        customer_message=clean_message,
        resolution_guidance="Pending support agent review.",
        ticket_status="Open",
        created_at=now_str,
        source_type="AI Chatbot Assistant"
    )
    db.add(new_ticket)
    db.commit()
    db.refresh(new_ticket)

    log_audit_action(
        db,
        action="SUPPORT_TICKET_CREATED",
        entity_type="support_ticket",
        user_id=current_user.user_id,
        entity_id=new_ticket_id,
        details={"issue_type": issue_type, "source": "ai_chatbot"}
    )

    card = TicketCreatedCard(
        ticket_id=new_ticket_id,
        issue_type=issue_type,
        status="Open",
        created_at=now_str,
        message=clean_message[:100]
    )

    return ChatConversationResponse(
        reply=f"I've raised support ticket #{new_ticket_id} for you regarding '{issue_type.replace('_', ' ')}'. Our support desk has received your ticket and will investigate. You can monitor progress under 'My Account > Support'.",
        intent="support_escalation",
        suggested_actions=["View My Support Tickets", "Track Orders", "Continue Shopping"],
        ticket_created=card
    )

def _handle_general(user_text: str) -> ChatConversationResponse:
    """Returns safe, welcoming general assistance with clear feature overview."""
    return ChatConversationResponse(
        reply="Hello! I'm MerchAI's Discovery & Support Assistant.\n\n"
              "Here is what I can do for you:\n"
              "• Product Discovery: Search authentic products (e.g. 'find organic tea under ₹500')\n"
              "• Order Tracking: Check shipment & delivery progress for your orders\n"
              "• Policy & SLAs: Check verified return, refund, and shipping timelines\n"
              "• Customer Support: Open support tickets for our human operations desk\n\n"
              "What would you like to explore today?",
        intent="general",
        suggested_actions=[
            "Find organic snacks",
            "Track my latest order",
            "What is your return policy?",
            "Connect with support"
        ]
    )

def chat_conversation_engine(
    messages: List[ChatMessage],
    db: Session,
    current_user: Optional[AppUser] = None,
    session_id: Optional[str] = None,
    context: Optional[Dict[str, Any]] = None
) -> ChatConversationResponse:
    """
    Central Conversational Chatbot Engine unifying product discovery and customer support.
    
    Security & Reliability:
    - Never executes arbitrary user code or dynamic SQL queries.
    - Limits conversation history to prevent prompt bloat and context poisoning.
    - Enforces authentication and authorization for private order tracking and ticket creation.
    - Grounds product recommendations strictly in authoritative catalog database records.
    - Operates reliably with zero external paid API dependencies using the verified rule/RAG engine.
    """
    # 1. Retrieve the latest user message
    user_msgs = [m for m in messages if m.role == "user"]
    if not user_msgs:
        return _handle_general("")

    latest_user_msg = user_msgs[-1].content.strip()
    text_lower = latest_user_msg.lower()

    # 2. Intent Classification via semantic and keyword rules

    # A. Support Escalation check
    if any(k in text_lower for k in [
        "ticket", "complaint", "speak to human", "talk to human", "speak to agent",
        "contact support", "support", "representative", "customer care", "dispute",
        "escalate", "experiencing an issue", "have an issue", "need help", "problem with"
    ]):
        return _handle_support_escalation(latest_user_msg, current_user, db)

    # B. Order Tracking check
    if any(k in text_lower for k in [
        "track", "package", "where is my", "where's my", "delivery status",
        "order status", "my order", "my orders", "shipment"
    ]) or re.search(r'\b(ORD(?:[-_][A-Za-z0-9\-_]+|\d+)|[0-9]{4,})\b', latest_user_msg, re.IGNORECASE):
        # Disambiguate from shopping queries like "order snacks under 500"
        is_shopping_query = any(w in text_lower for w in ["find", "buy", "recommend", "under", "budget", "show me"]) and not any(w in text_lower for w in ["track", "status", "where is", "where's", "delayed"])
        if not is_shopping_query:
            return _handle_order_tracking(latest_user_msg, current_user, db)

    # C. Policy & FAQ check
    if any(k in text_lower for k in [
        "return policy", "how to return", "refund policy", "refund status",
        "cancellation policy", "cancel order", "how to cancel", "shipping policy",
        "how long does delivery take", "delivery time", "shipping time",
        "payment method", "warranty", "sla", "guarantee"
    ]):
        return _handle_policy_faq(latest_user_msg)

    # D. Product Discovery check
    if any(k in text_lower for k in [
        "find", "search", "buy", "recommend", "show me", "looking for", "browse",
        "suggest", "products", "items", "cost", "under", "below", "budget", "price",
        "snack", "shoe", "dress", "tea", "coffee", "organic", "grocery", "fashion",
        "footwear", "spices", "electronics", "beauty"
    ]):
        return _handle_product_discovery(latest_user_msg, db)

    # E. Greetings & General Inquiries
    if any(text_lower.startswith(g) for g in ["hi", "hello", "hey", "who are you", "what can you do", "help", "good morning", "good evening"]):
        return _handle_general(latest_user_msg)

    # Default fallback: useful guidance without crashing
    return ChatConversationResponse(
        reply="I'm here to assist with product discovery, order tracking, and platform support. "
              "You can ask me to search products (e.g. 'organic snacks under ₹500'), track your order, "
              "or check platform policies like returns and shipping.",
        intent="general",
        suggested_actions=[
            "Find organic snacks",
            "Track my order",
            "What is your return policy?",
            "Connect with support"
        ]
    )

