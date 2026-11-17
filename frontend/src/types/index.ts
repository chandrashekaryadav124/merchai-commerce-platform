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
  gross_sales?: number;
  net_revenue?: number;
  total_payment_amount?: number;
  total_refund_amount?: number;
  platform_commission_est: number;
  active_sellers: number;
  pending_sellers: number;
  suspended_sellers: number;
  total_sellers: number;
  total_products: number;
  active_customers?: number;
  total_orders?: number;
  delivered_orders_count?: number;
  processing_orders_count?: number;
  cancelled_orders_count?: number;
  returned_orders_count?: number;
  failed_orders_count?: number;
  total_orders_processed?: number;
  gmv_net?: number;
  ai_token_usage_today?: number;
  ai_satisfaction_score?: number;
}

export interface SalesTrendPoint {
  date: string;
  revenue: number;
  order_count: number;
}

export interface OrderStatusDistributionItem {
  status: string;
  count: number;
  percentage: number;
}

export interface CategoryPerformanceItem {
  category: string;
  revenue: number;
  units_sold: number;
  product_count: number;
}

export interface TopSellerItem {
  seller_id: string;
  store_name: string;
  store_type?: string;
  order_count: number;
  revenue: number;
}

export interface ActivityLogItem {
  id: number;
  user_id?: string | null;
  user_name?: string | null;
  action: string;
  entity_type: string;
  entity_id?: string | null;
  details?: any;
  created_at: string;
}

export interface RevenueChartPoint {
  day: string;
  revenue: number;
  order_count?: number;
}

export interface SellerTopProduct {
  product_id: string;
  product_name: string;
  category?: string | null;
  units_sold: number;
  total_revenue: number;
  current_stock: number;
}

export interface SellerOrderStatusCount {
  status: string;
  count: number;
  percentage: number;
}

export interface SellerCustomerReview {
  review_id: string;
  order_id?: string | null;
  product_id: string;
  product_name?: string | null;
  rating: number;
  sentiment?: string | null;
  review_text?: string | null;
  review_date?: string | null;
}

export interface SellerAnalytics {
  seller_id: string;
  store_name: string;
  store_type?: string;
  total_sales: number;
  monthly_gross_sales?: number;
  total_orders: number;
  completed_orders: number;
  pending_orders: number;
  total_products: number;
  inventory_items_count?: number;
  active_products: number;
  low_stock_products: number;
  out_of_stock_products: number;
  fulfillment_rate?: number | null;
  fulfillment_rate_display: string;
  store_rating?: number | null;
  total_reviews_count: number;
  revenue_chart: RevenueChartPoint[];
}

export interface OperationsMetrics {
  total_shipments: number;
  delivered_count: number;
  delivered_then_returned_count?: number;
  cancelled_in_transit_count?: number;
  order_placed_count?: number;
  in_transit_count: number;
  pending_count: number;
  delayed_count: number;
  on_time_rate?: number | null;
  avg_delivery_days?: number | null;
  total_inventory_snapshots: number;
  total_inventory_units?: number;
  low_stock_alerts: number;
  out_of_stock_alerts: number;
}

export interface OperationsWarehouseDistributionItem {
  warehouse_city: string;
  shipments_count: number;
  delayed_shipments_count: number;
  delayed_rate: number;
}

export interface OperationsStatusDistributionItem {
  status: string;
  count: number;
  percentage: number;
}

export interface Shipment {
  shipment_id: string;
  order_id?: string | null;
  warehouse_city?: string | null;
  delivery_city?: string | null;
  shipping_method?: string | null;
  dispatch_date?: string | null;
  expected_delivery_date?: string | null;
  actual_delivery_date?: string | null;
  delivery_days?: number | null;
  delivery_status?: string | null;
  delayed_flag?: number | null;
}

export interface InventorySnapshot {
  inventory_snapshot_id: string;
  product_id?: string | null;
  snapshot_date?: string | null;
  warehouse_id?: string | null;
  stock_quantity?: number | null;
  reserved_quantity?: number | null;
  available_quantity?: number | null;
  reorder_level?: number | null;
  inventory_status?: string | null;
}

export interface SupportIssueTypeBreakdownItem {
  issue_type: string;
  count: number;
  percentage: number;
}

export interface SupportMetrics {
  total_tickets: number;
  open_tickets: number;
  in_progress_tickets: number;
  resolved_tickets: number;
  closed_tickets: number;
  high_priority_tickets?: number;
  resolution_rate?: number | null;
  avg_resolution_time?: string;
  issue_type_breakdown: SupportIssueTypeBreakdownItem[];
}

export interface SupportCreationTrendPoint {
  period: string;
  count: number;
}

export interface CustomerCategorySpendingItem {
  category: string;
  amount: number;
  order_count: number;
}

export interface CustomerSpendingTrendPoint {
  month: string;
  spending: number;
  order_count: number;
}

export interface CustomerPaymentMethodStat {
  method: string;
  count: number;
  amount: number;
}

export interface CustomerFinancialOverview {
  total_orders: number;
  total_spending: number;
  total_paid: number;
  pending_payment_amount: number;
  failed_payment_amount: number;
  total_refunded: number;
  total_transactions: number;
  spending_by_category: CustomerCategorySpendingItem[];
  payment_methods: CustomerPaymentMethodStat[];
}

export interface CustomerAccountOrderDetail {
  order_id: string;
  customer_id?: string;
  order_date?: string;
  order_time?: string;
  order_status?: string;
  shipping_method?: string;
  delivery_city?: string;
  delivery_state?: string;
  coupon_code?: string;
  subtotal: number;
  shipping_fee: number;
  tax_amount: number;
  discount_amount: number;
  final_amount: number;
  paid_amount: number;
  refund_amount: number;
  outstanding_amount: number;
  payment_status?: string;
  delivery_status?: string;
  items: Array<{
    order_item_id: string;
    product_id: string;
    product_name?: string;
    quantity: number;
    unit_price: number;
    discount_percentage?: number;
    item_revenue?: number;
    image_url?: string | null;
  }>;
  shipment?: any;
  payment?: any;
}

export interface SellerFinancialAnalytics {
  seller_id: string;
  store_name: string;
  gross_sales: number;
  net_sales: number;
  successfully_paid_amount: number;
  pending_payment_amount: number;
  unpaid_amount?: number;
  refund_deductions: number;
  platform_commission: number;
  seller_payout_status: string;
  payout_note: string;
  average_order_value: number;
  total_orders: number;
  paid_orders_count?: number;
  pending_orders_count?: number;
  delivered_orders_count?: number;
  processing_orders_count?: number;
  cancelled_orders_count?: number;
  fulfillment_rate?: number;
  active_products_count?: number;
  low_stock_products_count?: number;
  refund_rate: number;
}

export interface SellerTransactionItem {
  order_id: string;
  seller_order_id: number;
  order_date: string | null;
  subtotal: number;
  allocated_paid: number;
  allocated_refund: number;
  payment_method: string;
  payment_status: string;
  allocation_percentage: number;
  delivery_status: string;
}

export interface SellerSalesTrendPoint {
  period: string;
  revenue: number;
  order_count: number;
}

export interface SellerCategoryPerformanceItem {
  category: string;
  revenue: number;
  units_sold: number;
}

export interface SellerPaymentMethodDistributionItem {
  payment_method: string;
  order_count: number;
  amount: number;
  percentage: number;
}

export interface AdminFinancialOverview {
  gmv_total: number;
  gross_sales: number;
  collected_payments: number;
  pending_payments: number;
  failed_payments: number;
  refunded_amount: number;
  net_marketplace_revenue: number;
  platform_commission: number;
  seller_settlement_status: string;
  settlement_note: string;
}

export interface PaymentStatusDistributionItem {
  status: string;
  count: number;
  amount: number;
  percentage: number;
}

export interface PlatformGrowthPoint {
  period: string;
  customers: number;
  sellers: number;
}

export interface RecentTransactionItem {
  payment_id: string;
  order_id?: string | null;
  payment_date?: string | null;
  payment_method?: string | null;
  payment_status?: string | null;
  amount_paid: number;
  refund_amount: number;
}

export interface CustomerOrderSummary {
  total_orders: number;
  pending_orders: number;
  shipped_orders: number;
  delivered_orders: number;
  cancelled_orders: number;
  total_spent: number;
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

export type ChatRole = 'user' | 'assistant' | 'system';

export interface OrderStatusCardData {
  order_id: string;
  order_date?: string;
  order_status: string;
  shipping_method?: string;
  delivery_city?: string;
  final_amount?: number;
  recipient_name?: string;
}

export interface TicketCreatedCardData {
  ticket_id: string;
  issue_type: string;
  status: string;
  created_at: string;
  message: string;
}

export interface ChatConversationResponse {
  reply: string;
  intent: 'product_discovery' | 'order_tracking' | 'policy_faq' | 'support_escalation' | 'general';
  suggested_actions?: string[];
  recommended_products?: Product[];
  order_status_card?: OrderStatusCardData | null;
  ticket_created?: TicketCreatedCardData | null;
}

export interface ChatMessage {
  id?: string;
  role: ChatRole;
  content: string;
  timestamp?: string;
  intent?: string;
  recommended_products?: Product[];
  order_status_card?: OrderStatusCardData | null;
  ticket_created?: TicketCreatedCardData | null;
  suggested_actions?: string[];
}

// =====================================================================
// SPRINT 0.3: SELLER PRODUCT CRUD, IMAGES & INVENTORY MANAGEMENT
// =====================================================================

export interface ProductImageItem {
  image_id: string;
  image_url: string;
  image_type: string;
  is_primary: boolean;
}

export interface SellerProductDetail {
  seller_product_id: number;
  seller_id: string;
  product_id: string;
  sku?: string;
  product_name: string;
  description?: string;
  category?: string;
  subcategory?: string;
  brand?: string;
  selling_price: number;
  discount_price?: number | null;
  stock_quantity: number;
  reserved_quantity: number;
  available_to_sell: number;
  low_stock_threshold: number;
  listing_status: string;
  created_at?: string;
  images: ProductImageItem[];
  primary_image_url?: string;
  units_sold: number;
  total_revenue: number;
  rating_average?: number;
  rating_count: number;
}

export interface SellerProductCreatePayload {
  product_name: string;
  category: string;
  subcategory?: string;
  brand?: string;
  selling_price: number;
  discount_price?: number;
  stock_quantity: number;
  sku?: string;
  low_stock_threshold?: number;
  description?: string;
  images?: string[];
  primary_image_index?: number;
  listing_status?: string;
}

export interface SellerProductUpdatePayload {
  product_name?: string;
  category?: string;
  subcategory?: string;
  brand?: string;
  selling_price?: number;
  discount_price?: number;
  stock_quantity?: number;
  sku?: string;
  low_stock_threshold?: number;
  description?: string;
  images?: string[];
  primary_image_index?: number;
  listing_status?: string;
}

export interface ImageUploadResult {
  filename: string;
  url: string;
  success: boolean;
}

export interface InventoryAdjustmentPayload {
  adjustment_type: 'restock' | 'damage' | 'correction' | 'return' | 'audit_reconciliation' | string;
  quantity_change: number;
  adjustment_reason: string;
  order_reference?: string;
}

export interface InventoryAdjustmentResult {
  snapshot_id: string;
  product_id: string;
  sku?: string;
  product_name: string;
  previous_quantity: number;
  quantity_change: number;
  new_quantity: number;
  adjustment_type: string;
  adjustment_reason: string;
  created_at?: string;
}

export interface SellerInventoryItem {
  seller_product_id: number;
  product_id: string;
  sku?: string;
  product_name: string;
  category?: string;
  stock_quantity: number;
  reserved_quantity: number;
  available_to_sell: number;
  low_stock_threshold: number;
  listing_status: string;
  health_status: 'HEALTHY' | 'LOW_STOCK' | 'OUT_OF_STOCK';
  selling_price: number;
  discount_price?: number | null;
  image_url?: string;
}

export interface SellerInventorySummary {
  total_skus: number;
  total_units: number;
  healthy_count: number;
  low_stock_count: number;
  out_of_stock_count: number;
  items: SellerInventoryItem[];
}

export interface InventoryHistoryItem {
  inventory_snapshot_id: string;
  product_id: string;
  product_name?: string;
  sku?: string;
  previous_quantity?: number;
  quantity_change?: number;
  new_quantity?: number;
  adjustment_type?: string;
  adjustment_reason?: string;
  user_id?: string;
  order_reference?: string;
  created_at?: string;
}

// ==========================================
// SPRINT 0.4: ORDER & SHIPMENT TYPES
// ==========================================

export type SellerOrderStatus = 
  | 'PLACED' 
  | 'ACCEPTED' 
  | 'PROCESSING' 
  | 'PACKED' 
  | 'READY_FOR_PICKUP' 
  | 'HANDED_OVER' 
  | 'IN_TRANSIT' 
  | 'DELIVERED' 
  | 'CANCELLED';

export interface SellerOrderItemDetail {
  seller_order_item_id: number;
  product_id: string;
  title: string;
  primary_image?: string | null;
  sku?: string | null;
  quantity: number;
  unit_price: number;
  subtotal: number;
}

export interface SellerOrderHistoryItem {
  history_id: number;
  previous_status?: string | null;
  new_status: string;
  changed_by?: string | null;
  notes?: string | null;
  created_at?: string | null;
}

export interface SellerOrderDetail {
  seller_order_id: number;
  order_id: string;
  seller_id: string;
  seller_store_name?: string | null;
  status: string;
  subtotal: number;
  order_date?: string | null;
  payment_status?: string | null;
  payment_method?: string | null;
  customer_name?: string | null;
  customer_phone_masked?: string | null;
  customer_email_masked?: string | null;
  shipping_address?: string | null;
  delivery_city?: string | null;
  delivery_state?: string | null;
  delivery_pincode?: string | null;
  shipment_id?: string | null;
  shipment_status?: string | null;
  tracking_number?: string | null;
  courier_name?: string | null;
  items: SellerOrderItemDetail[];
  status_history: SellerOrderHistoryItem[];
  created_at?: string | null;
  updated_at?: string | null;
}

export interface SellerOrderStatusUpdateRequest {
  new_status: string;
  notes?: string;
}

export interface CourierPartner {
  courier_id: string;
  name: string;
  code: string;
  contact_phone?: string | null;
  tracking_url_template?: string | null;
  is_active: boolean;
}

export interface ShipmentTrackingEvent {
  event_id: string;
  shipment_id: string;
  status: string;
  location?: string | null;
  notes?: string | null;
  created_at?: string | null;
}

export interface ShipmentDetail {
  shipment_id: string;
  order_id?: string | null;
  seller_order_id?: number | null;
  seller_id?: string | null;
  seller_store_name?: string | null;
  warehouse_city?: string | null;
  delivery_city?: string | null;
  shipping_method?: string | null;
  courier_partner_id?: string | null;
  courier_name?: string | null;
  tracking_number?: string | null;
  tracking_url?: string | null;
  recipient_name?: string | null;
  recipient_phone_masked?: string | null;
  shipping_address?: string | null;
  dispatch_date?: string | null;
  expected_delivery_date?: string | null;
  actual_delivery_date?: string | null;
  delivery_days?: number | null;
  delivery_status?: string | null;
  delayed_flag?: number | null;
  events: ShipmentTrackingEvent[];
  created_at?: string | null;
}

export interface ReadyForPickupItem {
  seller_order_id: number;
  order_id: string;
  seller_id: string;
  seller_store_name: string;
  status: string;
  subtotal: number;
  order_date?: string | null;
  customer_name?: string | null;
  delivery_city?: string | null;
  delivery_state?: string | null;
  items_count: number;
  items_summary: string;
  created_at?: string | null;
}

export interface ShipmentCreatePayload {
  seller_order_id: number;
  courier_partner_id: string;
  warehouse_city?: string;
  shipping_method?: string;
  expected_delivery_days?: number;
  notes?: string;
}

export interface ShipmentStatusUpdatePayload {
  new_status: string;
  location?: string;
  notes?: string;
}

export interface CustomerPackageTracking {
  shipment_id?: string | null;
  seller_order_id: number;
  seller_id: string;
  seller_store_name: string;
  status: string;
  courier_name?: string | null;
  tracking_number?: string | null;
  tracking_url?: string | null;
  warehouse_city?: string | null;
  dispatch_date?: string | null;
  expected_delivery_date?: string | null;
  actual_delivery_date?: string | null;
  events: ShipmentTrackingEvent[];
  items: Array<{
    product_id: string;
    title: string;
    quantity: number;
    unit_price: number;
    image?: string | null;
  }>;
}

export interface CustomerOrderTracking {
  order_id: string;
  order_status: string;
  order_date?: string | null;
  delivery_city?: string | null;
  delivery_state?: string | null;
  recipient_name?: string | null;
  shipping_address?: string | null;
  packages: CustomerPackageTracking[];
}




