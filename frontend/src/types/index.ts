export type UserRole = 'CUSTOMER' | 'SELLER' | 'OPERATIONS' | 'SUPPORT' | 'ADMIN';

export interface User {
  user_id: string;
  full_name: string;
  email: string;
  role: UserRole;
  is_active: boolean;
  is_demo_account?: boolean;
}

export interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
}

export interface Category {
  id: number;
  name: string;
  slug: string;
  icon: string;
  attributes_schema?: string;
}

export interface Store {
  id: string;
  seller_id: string;
  store_name: string;
  store_type?: string;
  slug: string;
  description: string;
  logo_url?: string;
  banner_url?: string;
  address?: string;
  city?: string;
  state?: string;
  postal_code?: string;
  rating_avg?: number;
  rating_count?: number;
  is_active?: number;
}

export interface Review {
  rating: number;
  comment: string;
  created_at: string;
  reviewer: string;
}

export interface SimilarRecommendation {
  product_id: string;
  name: string;
  base_price: number;
  rating_avg: number;
  image: string | null;
  similarity_score: number;
}

export interface Product {
  id?: string;
  product_id: string;
  name?: string;
  product_name: string;
  category?: string;
  subcategory?: string;
  brand?: string;
  price?: number;
  base_price?: number;
  selling_price?: number;
  discount_price?: number;
  cost_price?: number;
  discount_range?: string;
  rating_average?: number;
  rating_avg?: number;
  rating_count?: number;
  stock_quantity?: number;
  product_launch_date?: string;
  product_type?: string;
  image_url?: string;
  images?: string[];
  description?: string;
  store_id?: string;
  store_name?: string;
  attributes?: Record<string, any>;
  reviews?: Review[];
  similar_recommendations?: SimilarRecommendation[];
}

export interface SupportTicket {
  ticket_id: string;
  customer_id?: string;
  order_id?: string;
  issue_type?: string;
  customer_message?: string;
  resolution_guidance?: string;
  ticket_status?: string;
  created_at?: string;
}

export interface CartItem {
  product: Product;
  quantity: number;
}

export interface AIListingResponse {
  title?: string;
  generated_title?: string;
  category?: string;
  description?: string;
  short_description?: string;
  features?: string[];
  tags?: string[];
  seo_tags?: string[];
  suggested_price?: number;
  key_highlights?: string[];
}

export interface AIShoppingAssistantResponse {
  summary?: string;
  assistant_response?: string;
  intent?: string;
  recommended_filters?: {
    max_price?: number;
    location?: string;
    min_rating?: number;
  };
  suggested_cart?: {
    product_id: string;
    name: string;
    store_name: string;
    price: number;
    quantity: number;
    image: string | null;
    rating: number;
  }[];
  total_price?: number;
  ai_advice?: string;
}

export interface AISellerAdvisorResponse {
  seller_id: string;
  question: string;
  answer?: string;
  advice_response?: string;
  actionable_steps?: string[];
  data_source?: string;
  verified_metrics?: {
    store_name: string;
    gross_revenue: number;
    total_orders: number;
    low_stock_count: number;
    critical_forecast_alerts: number;
  };
}

export interface DemandForecastItem {
  sku: string;
  product_id?: string;
  product_name: string;
  current_stock: number;
  predicted_7d_demand?: number;
  forecast_7d?: number;
  recommended_reorder?: number;
  estimated_days_of_supply?: number;
  stockout_risk?: string;
  risk_level?: string;
  recommendation?: string;
}

export interface RAGQueryResponse {
  seller_id: string;
  query: string;
  retrieved_context?: string[];
  citation?: string;
  response?: string;
  answer?: string;
}

export interface AdminMetrics {
  gmv_total: number;
  gmv_net: number;
  platform_commission_est: number;
  active_sellers: number;
  pending_sellers: number;
  suspended_sellers: number;
  total_sellers: number;
  total_products: number;
  total_orders_processed: number;
  delivered_orders_count: number;
  cancelled_orders_count: number;
  returned_orders_count: number;
  failed_orders_count: number;
  ai_token_usage_today: number;
  ai_satisfaction_score: number;
}

export interface FraudAlert {
  id: string;
  entity: string;
  risk_type: string;
  risk_score: number;
  risk_level: string;
  details: string;
  recommended_action: string;
}

export interface CustomerAddress {
  address_id: number;
  user_id: string;
  recipient_name: string;
  phone_number: string;
  address_line1: string;
  address_line2?: string | null;
  city: string;
  state: string;
  postal_code: string;
  country: string;
  is_default: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface DBCartItem {
  cart_item_id: number;
  seller_product_id: number;
  product_id: string;
  product_name: string;
  brand?: string | null;
  category?: string | null;
  image_url?: string | null;
  seller_id: string;
  store_name: string;
  unit_price: number;
  quantity: number;
  line_total: number;
  stock_quantity: number;
  is_in_stock: boolean;
  listing_status: string;
}

export interface DBCart {
  cart_id: number;
  items: DBCartItem[];
  item_count: number;
  subtotal: number;
}

export interface CheckoutSummary {
  cart_id: number;
  items: DBCartItem[];
  item_count: number;
  merchandise_subtotal: number;
  shipping_fee: number;
  shipping_fee_basis: string;
  tax_amount: number;
  tax_rate: number;
  tax_basis: string;
  final_total: number;
  is_checkout_eligible: boolean;
  validation_messages: string[];
}

export interface OrderPlacementPayload {
  address_id?: number;
  recipient_name?: string;
  recipient_phone?: string;
  address_line1?: string;
  address_line2?: string;
  city?: string;
  state?: string;
  postal_code?: string;
  payment_method?: string;
  idempotency_key?: string;
}

