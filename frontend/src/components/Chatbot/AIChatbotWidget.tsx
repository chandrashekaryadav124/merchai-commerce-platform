import React, { useState, useEffect, useRef } from 'react';
import type { User, Product, ChatMessage, UserRole } from '../../types';
import { sendAIChatMessage } from '../../services/api';
import {
  Sparkles,
  X,
  Minus,
  RotateCcw,
  Send,
  Bot,
  User as UserIcon,
  Package,
  Truck,
  LifeBuoy,
  Check,
  AlertCircle,
  LogIn,
  ShoppingCart,
  Star,
  ChevronRight,
  Maximize2
} from 'lucide-react';

interface AIChatbotWidgetProps {
  isOpen: boolean;
  onToggle: () => void;
  currentUser: User | null;
  onOpenAuth: () => void;
  onAddToCart: (product: Product, quantity?: number) => void;
  onOpenCart?: () => void;
  currentRole?: UserRole;
}

const INITIAL_MESSAGES: ChatMessage[] = [
  {
    role: 'assistant',
    content:
      "Hello! I'm MerchAI's Discovery & Support Copilot.\n\nI can help you:\n• Discover authentic products (e.g. 'find organic cashews under ₹500')\n• Track your orders and verify shipment progress\n• Check platform return, refund, and shipping SLAs\n• Raise a formal support ticket with our customer care desk\n\nWhat would you like to explore today?",
    suggested_actions: [
      'Find organic snacks under ₹500',
      'Where is my order?',
      'What is your return policy?',
      'Raise a support ticket'
    ]
  }
];

export function AIChatbotWidget({
  isOpen,
  onToggle,
  currentUser,
  onOpenAuth,
  onAddToCart,
  onOpenCart,
  currentRole = 'CUSTOMER'
}: AIChatbotWidgetProps) {
  // Authoritative role check: Customer shopping assistant is restricted to customer role (or guest on customer storefront)
  const isAuthorizedRole = !currentUser || (currentUser.role && currentUser.role.toLowerCase() === 'customer');
  if (!isAuthorizedRole || currentRole !== 'CUSTOMER') {
    return null;
  }

  const [messages, setMessages] = useState<ChatMessage[]>(INITIAL_MESSAGES);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isMinimized, setIsMinimized] = useState(false);
  const [addedIds, setAddedIds] = useState<Set<string>>(new Set());

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const prevUserIdRef = useRef<string | null>(currentUser?.user_id || null);

  // Clear active conversation and state whenever authenticated user changes (login, logout, switch account)
  useEffect(() => {
    const currentId = currentUser?.user_id || null;
    if (prevUserIdRef.current !== currentId) {
      prevUserIdRef.current = currentId;
      setMessages(INITIAL_MESSAGES);
      setInput('');
      setError(null);
      setAddedIds(new Set());
    }
  }, [currentUser?.user_id]);

  // Auto-scroll to latest message
  useEffect(() => {
    if (isOpen && !isMinimized) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, loading, isOpen, isMinimized]);

  // Focus input on open
  useEffect(() => {
    if (isOpen && !isMinimized) {
      setTimeout(() => inputRef.current?.focus(), 150);
    }
  }, [isOpen, isMinimized]);

  const handleSendMessage = async (textToSend?: string) => {
    const rawContent = (textToSend ?? input).trim();
    if (!rawContent || loading) return;

    setError(null);
    setInput('');

    const userMsg: ChatMessage = {
      role: 'user',
      content: rawContent,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    const nextMessages = [...messages, userMsg];
    setMessages(nextMessages);
    setLoading(true);

    try {
      const response = await sendAIChatMessage(
        nextMessages,
        currentUser?.user_id ? `user_${currentUser.user_id}` : undefined,
        { active_role: currentRole }
      );

      const assistantMsg: ChatMessage = {
        role: 'assistant',
        content: response.reply,
        intent: response.intent,
        recommended_products: response.recommended_products,
        order_status_card: response.order_status_card,
        ticket_created: response.ticket_created,
        suggested_actions: response.suggested_actions,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };

      setMessages(prev => [...prev, assistantMsg]);
    } catch (err: any) {
      setError(err.message || 'Unable to connect to AI assistant. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleResetChat = () => {
    setMessages(INITIAL_MESSAGES);
    setError(null);
    setInput('');
  };

  const handleCardAddToCart = (product: Product) => {
    if (!currentUser) {
      onOpenAuth();
      return;
    }
    if (currentUser.role?.toLowerCase() !== 'customer') {
      alert(`Role restriction: Only customer accounts can add products to cart and place orders.`);
      return;
    }
    const pId = product.product_id || product.id || '';
    onAddToCart(product, 1);
    setAddedIds(prev => new Set(prev).add(pId));
    setTimeout(() => {
      setAddedIds(prev => {
        const next = new Set(prev);
        next.delete(pId);
        return next;
      });
    }, 2500);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // 1. FLOATING LAUNCHER BUTTON (When widget is closed)
  if (!isOpen) {
    return (
      <button
        onClick={onToggle}
        className="fixed bottom-6 right-6 z-40 flex items-center space-x-2.5 px-4 py-3 bg-[#14213D] hover:bg-[#0B132B] text-white rounded-full shadow-2xl border border-[#FCA311]/40 transition-all transform hover:scale-105 active:scale-95 cursor-pointer group animate-fade-in"
        title="Open MerchAI Assistant"
        aria-label="Open AI Assistant"
      >
        <div className="relative">
          <div className="w-8 h-8 rounded-full bg-[#FCA311] flex items-center justify-center text-[#14213D] shadow-inner">
            <Sparkles className="w-4 h-4 animate-pulse" />
          </div>
          <span className="absolute -top-1 -right-1 w-3 h-3 bg-emerald-500 rounded-full border-2 border-[#14213D]" />
        </div>
        <div className="text-left hidden sm:block">
          <p className="text-xs font-bold leading-tight font-['Space_Grotesk'] text-white">
            Merch<span className="text-[#FCA311]">AI</span> Copilot
          </p>
          <p className="text-[10px] text-[#DCEAF0]/80">Discovery & Support</p>
        </div>
      </button>
    );
  }

  // 2. MINIMIZED STATE BAR
  if (isMinimized) {
    return (
      <div className="fixed bottom-6 right-6 z-50 flex items-center justify-between w-72 bg-[#14213D] text-white p-3 rounded-2xl shadow-2xl border border-[#233554] cursor-pointer animate-fade-in">
        <div className="flex items-center space-x-2.5" onClick={() => setIsMinimized(false)}>
          <div className="w-6 h-6 rounded-lg bg-[#FCA311] flex items-center justify-center text-[#14213D]">
            <Sparkles className="w-3.5 h-3.5" />
          </div>
          <span className="text-xs font-bold font-['Space_Grotesk']">MerchAI Copilot</span>
        </div>
        <div className="flex items-center space-x-1">
          <button
            onClick={() => setIsMinimized(false)}
            className="p-1 hover:bg-white/10 rounded-lg text-[#DCEAF0] transition"
            title="Expand"
          >
            <Maximize2 className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={onToggle}
            className="p-1 hover:bg-white/10 rounded-lg text-[#DCEAF0] transition"
            title="Close"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    );
  }

  // 3. FULL CHAT PANEL
  return (
    <div className="fixed bottom-4 sm:bottom-6 right-3 sm:right-6 z-50 w-[94vw] sm:w-[440px] md:w-[460px] h-[600px] max-h-[85vh] flex flex-col bg-white rounded-3xl shadow-2xl border border-[#DCEAF0] overflow-hidden animate-slide-up">
      
      {/* HEADER */}
      <div className="flex items-center justify-between px-5 py-4 bg-[#14213D] text-white border-b border-[#233554] shrink-0">
        <div className="flex items-center space-x-3">
          <div className="relative">
            <div className="w-9 h-9 rounded-xl bg-[#FCA311] flex items-center justify-center text-[#14213D] shadow-md">
              <Bot className="w-5 h-5" />
            </div>
            <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-400 rounded-full border-2 border-[#14213D]" />
          </div>
          <div>
            <div className="flex items-center space-x-1.5">
              <h3 className="font-bold text-sm text-white font-['Space_Grotesk'] tracking-tight">
                Merch<span className="text-[#FCA311]">AI</span> Copilot
              </h3>
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-white/10 text-[#DCEAF0] font-mono font-semibold">
                v1.0
              </span>
            </div>
            <p className="text-[11px] text-[#DCEAF0]/80">Product Discovery & Customer Care</p>
          </div>
        </div>

        {/* Action icons */}
        <div className="flex items-center space-x-1 text-[#DCEAF0]">
          <button
            onClick={handleResetChat}
            className="p-1.5 hover:bg-white/10 rounded-xl transition cursor-pointer"
            title="Clear Chat History"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
          <button
            onClick={() => setIsMinimized(true)}
            className="p-1.5 hover:bg-white/10 rounded-xl transition cursor-pointer"
            title="Minimize"
          >
            <Minus className="w-4 h-4" />
          </button>
          <button
            onClick={onToggle}
            className="p-1.5 hover:bg-white/10 rounded-xl transition cursor-pointer"
            title="Close Assistant"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* ERROR BANNER */}
      {error && (
        <div className="px-4 py-2.5 bg-red-50 border-b border-red-200 text-[#B42318] text-xs flex items-center justify-between shrink-0">
          <div className="flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-[#B42318]" />
            <span className="truncate">{error}</span>
          </div>
          <button
            onClick={() => setError(null)}
            className="text-xs font-bold hover:underline shrink-0 ml-2"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* MESSAGES SCROLL CONTAINER */}
      <div className="flex-1 p-4 overflow-y-auto space-y-4 bg-[#F5F1E8]/35">
        {messages.map((msg, idx) => {
          const isUser = msg.role === 'user';

          return (
            <div
              key={msg.id || idx}
              className={`flex flex-col ${isUser ? 'items-end' : 'items-start'} space-y-1.5`}
            >
              {/* Message Bubble */}
              <div className="flex items-start space-x-2 max-w-[88%]">
                {!isUser && (
                  <div className="w-6 h-6 rounded-lg bg-[#567C8D] flex items-center justify-center text-white shrink-0 mt-1 shadow-2xs">
                    <Sparkles className="w-3.5 h-3.5 text-[#FCA311]" />
                  </div>
                )}

                <div
                  className={`p-3.5 rounded-2xl text-xs leading-relaxed whitespace-pre-wrap shadow-xs ${
                    isUser
                      ? 'bg-[#14213D] text-white rounded-tr-xs'
                      : 'bg-white text-[#1F2937] border border-[#DCEAF0] rounded-tl-xs'
                  }`}
                >
                  <p>{msg.content}</p>

                  {/* Inline Sign-in prompt for restricted intents */}
                  {!isUser && !currentUser && (msg.content.includes('sign in') || msg.intent === 'order_tracking') && (
                    <div className="mt-2.5 pt-2 border-t border-[#DCEAF0]/60 flex items-center justify-between">
                      <span className="text-[11px] text-[#667085]">Account required:</span>
                      <button
                        onClick={onOpenAuth}
                        className="px-3 py-1 bg-[#14213D] hover:bg-[#0B132B] text-white rounded-lg text-[11px] font-bold transition flex items-center space-x-1 cursor-pointer"
                      >
                        <LogIn className="w-3 h-3 text-[#FCA311]" />
                        <span>Sign In</span>
                      </button>
                    </div>
                  )}
                </div>

                {isUser && (
                  <div className="w-6 h-6 rounded-lg bg-[#14213D] flex items-center justify-center text-[#FCA311] shrink-0 mt-1 shadow-2xs">
                    <UserIcon className="w-3.5 h-3.5" />
                  </div>
                )}
              </div>

              {/* Timestamp */}
              {msg.timestamp && (
                <span className="text-[10px] text-[#667085] px-8">
                  {msg.timestamp}
                </span>
              )}

              {/* CARD ATTACHMENT 1: ORDER STATUS CARD */}
              {!isUser && msg.order_status_card && (
                <div className="w-full max-w-[92%] ml-8 p-3.5 bg-white border border-[#567C8D]/30 rounded-2xl space-y-2 shadow-xs">
                  <div className="flex items-center justify-between border-b border-[#DCEAF0] pb-2">
                    <div className="flex items-center space-x-1.5">
                      <Truck className="w-4 h-4 text-[#567C8D]" />
                      <span className="font-mono text-xs font-bold text-[#14213D]">
                        {msg.order_status_card.order_id}
                      </span>
                    </div>
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        msg.order_status_card.order_status.toLowerCase() === 'delivered'
                          ? 'bg-emerald-50 text-[#15803D] border border-emerald-200'
                          : msg.order_status_card.order_status.toLowerCase() === 'shipped'
                          ? 'bg-sky-50 text-sky-700 border border-sky-200'
                          : 'bg-amber-50 text-amber-700 border border-amber-200'
                      }`}
                    >
                      {msg.order_status_card.order_status}
                    </span>
                  </div>

                  <div className="text-[11px] text-[#1F2937] space-y-1">
                    {msg.order_status_card.delivery_city && (
                      <p className="text-[#667085]">
                        Destination:{' '}
                        <span className="font-semibold text-[#14213D]">
                          {msg.order_status_card.delivery_city}
                        </span>
                      </p>
                    )}
                    {msg.order_status_card.shipping_method && (
                      <p className="text-[#667085]">
                        Method:{' '}
                        <span className="font-semibold text-[#14213D]">
                          {msg.order_status_card.shipping_method}
                        </span>
                      </p>
                    )}
                    {msg.order_status_card.final_amount && (
                      <p className="text-[#667085]">
                        Amount Paid:{' '}
                        <span className="font-bold text-[#14213D]">
                          ₹{msg.order_status_card.final_amount.toLocaleString('en-IN')}
                        </span>
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* CARD ATTACHMENT 2: SUPPORT TICKET CARD */}
              {!isUser && msg.ticket_created && (
                <div className="w-full max-w-[92%] ml-8 p-3.5 bg-amber-50/60 border border-amber-200 rounded-2xl space-y-2 shadow-xs">
                  <div className="flex items-center justify-between border-b border-amber-200/60 pb-2">
                    <div className="flex items-center space-x-1.5">
                      <LifeBuoy className="w-4 h-4 text-amber-700" />
                      <span className="font-mono text-xs font-bold text-[#14213D]">
                        {msg.ticket_created.ticket_id}
                      </span>
                    </div>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
                      {msg.ticket_created.status}
                    </span>
                  </div>
                  <div className="text-[11px] text-[#1F2937] space-y-1">
                    <p className="text-[#667085]">
                      Category:{' '}
                      <span className="font-semibold text-[#14213D] capitalize">
                        {msg.ticket_created.issue_type.replace(/_/g, ' ')}
                      </span>
                    </p>
                    <p className="text-[#667085]">
                      Created:{' '}
                      <span className="font-mono text-[#14213D]">
                        {msg.ticket_created.created_at}
                      </span>
                    </p>
                  </div>
                </div>
              )}

              {/* CARD ATTACHMENT 3: PRODUCT RECOMMENDATION CARDS */}
              {!isUser && msg.recommended_products && msg.recommended_products.length > 0 && (
                <div className="w-full max-w-[94%] ml-8 space-y-2 pt-1">
                  <p className="text-[11px] font-bold text-[#567C8D] uppercase tracking-wider flex items-center space-x-1">
                    <Package className="w-3.5 h-3.5" />
                    <span>Marketplace Recommendations ({msg.recommended_products.length})</span>
                  </p>

                  <div className="grid grid-cols-1 gap-2">
                    {msg.recommended_products.map((prod) => {
                      const prodId = prod.product_id || prod.id || '';
                      const isAdded = addedIds.has(prodId);
                      const displayPrice = prod.price ?? prod.selling_price ?? 0;
                      const hasThumb = prod.image_url || (prod.images && prod.images.length > 0);
                      const thumbSrc = prod.image_url || (prod.images ? prod.images[0] : null);

                      return (
                        <div
                          key={prodId}
                          className="p-2.5 bg-white border border-[#DCEAF0] rounded-2xl flex items-center justify-between gap-3 shadow-2xs hover:border-[#567C8D]/40 transition"
                        >
                          {/* Left: Thumbnail & Details */}
                          <div className="flex items-center space-x-2.5 min-w-0 flex-1">
                            {hasThumb && thumbSrc ? (
                              <img
                                src={thumbSrc}
                                alt={prod.product_name}
                                className="w-11 h-11 rounded-xl object-cover border border-[#DCEAF0] shrink-0"
                                onError={(e) => {
                                  // Fallback to placeholder icon on image load failure
                                  (e.target as HTMLElement).style.display = 'none';
                                }}
                              />
                            ) : (
                              <div className="w-11 h-11 rounded-xl bg-[#FAF9F6] border border-[#DCEAF0] flex items-center justify-center text-[#567C8D] shrink-0">
                                <Package className="w-5 h-5 text-[#567C8D]/60" />
                              </div>
                            )}

                            <div className="min-w-0 flex-1">
                              <p className="font-bold text-xs text-[#14213D] truncate">
                                {prod.product_name}
                              </p>
                              <div className="flex items-center space-x-2 text-[10px] text-[#667085] mt-0.5">
                                <span className="font-medium text-[#567C8D] truncate">
                                  {prod.store_name || prod.brand || 'Verified Seller'}
                                </span>
                                {(prod.rating_average || prod.rating_avg) && (
                                  <span className="flex items-center text-amber-600 font-bold shrink-0">
                                    <Star className="w-2.5 h-2.5 fill-amber-500 mr-0.5" />
                                    {(prod.rating_average || prod.rating_avg)?.toFixed(1)}
                                  </span>
                                )}
                              </div>
                              <p className="font-extrabold text-xs text-[#14213D] mt-0.5">
                                ₹{displayPrice.toLocaleString('en-IN')}
                              </p>
                            </div>
                          </div>

                          {/* Right: Add to Cart button */}
                          <button
                            onClick={() => handleCardAddToCart(prod)}
                            disabled={isAdded}
                            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center space-x-1 shrink-0 cursor-pointer shadow-2xs ${
                              isAdded
                                ? 'bg-emerald-600 text-white'
                                : 'bg-[#14213D] hover:bg-[#0B132B] text-white active:scale-95'
                            }`}
                            title="Add item to your cart"
                          >
                            {isAdded ? (
                              <>
                                <Check className="w-3.5 h-3.5" />
                                <span>Added</span>
                              </>
                            ) : (
                              <>
                                <ShoppingCart className="w-3.5 h-3.5 text-[#FCA311]" />
                                <span>+ Add</span>
                              </>
                            )}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* CARD ATTACHMENT 4: SUGGESTED ACTIONS PILLS */}
              {!isUser && msg.suggested_actions && msg.suggested_actions.length > 0 && (
                <div className="flex flex-wrap gap-1.5 ml-8 pt-1">
                  {msg.suggested_actions.map((act, i) => {
                    if (act.toLowerCase() === 'view cart' && onOpenCart) {
                      return (
                        <button
                          key={i}
                          onClick={onOpenCart}
                          className="px-2.5 py-1 bg-white hover:bg-[#DCEAF0] border border-[#DCEAF0] text-[#14213D] rounded-full text-[11px] font-semibold transition flex items-center space-x-1 cursor-pointer shadow-3xs"
                        >
                          <ShoppingCart className="w-3 h-3 text-[#567C8D]" />
                          <span>View Cart</span>
                        </button>
                      );
                    }

                    return (
                      <button
                        key={i}
                        onClick={() => handleSendMessage(act)}
                        className="px-2.5 py-1 bg-white hover:bg-[#FAF9F6] border border-[#DCEAF0] text-[#14213D] rounded-full text-[11px] font-medium transition flex items-center space-x-1 cursor-pointer shadow-3xs"
                      >
                        <span>{act}</span>
                        <ChevronRight className="w-2.5 h-2.5 text-[#667085]" />
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}

        {/* LOADING INDICATOR */}
        {loading && (
          <div className="flex items-start space-x-2">
            <div className="w-6 h-6 rounded-lg bg-[#567C8D] flex items-center justify-center text-white shrink-0 mt-1 shadow-2xs">
              <Sparkles className="w-3.5 h-3.5 text-[#FCA311] animate-pulse" />
            </div>
            <div className="p-3.5 bg-white border border-[#DCEAF0] rounded-2xl rounded-tl-xs shadow-xs">
              <div className="flex items-center space-x-2">
                <div className="flex space-x-1">
                  <div className="w-2 h-2 bg-[#567C8D] rounded-full animate-bounce [animation-delay:-0.3s]" />
                  <div className="w-2 h-2 bg-[#567C8D] rounded-full animate-bounce [animation-delay:-0.15s]" />
                  <div className="w-2 h-2 bg-[#567C8D] rounded-full animate-bounce" />
                </div>
                <span className="text-[11px] text-[#667085] font-medium">
                  MerchAI is checking catalog & policies...
                </span>
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* INPUT FORM */}
      <div className="p-3 bg-white border-t border-[#DCEAF0] shrink-0">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSendMessage();
          }}
          className="flex items-center space-x-2"
        >
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            maxLength={2000}
            placeholder="Ask anything: products, orders, returns..."
            disabled={loading}
            className="flex-1 bg-[#FAF9F6] border border-[#DCEAF0] rounded-xl px-3.5 py-2.5 text-xs text-[#1F2937] placeholder-[#667085] focus:outline-none focus:border-[#567C8D] focus:ring-1 focus:ring-[#567C8D] transition"
          />

          <button
            type="submit"
            disabled={loading || !input.trim()}
            className="p-2.5 bg-[#14213D] hover:bg-[#0B132B] disabled:bg-[#DCEAF0] text-white disabled:text-[#667085] rounded-xl transition shadow-xs flex items-center justify-center cursor-pointer disabled:cursor-not-allowed"
            title="Send Message"
          >
            <Send className="w-4 h-4 text-[#FCA311]" />
          </button>
        </form>

        <div className="flex items-center justify-between text-[10px] text-[#667085] px-1 pt-1.5">
          <span>Press Enter to send</span>
          <span className="font-mono">{input.length}/2000</span>
        </div>
      </div>
    </div>
  );
}
