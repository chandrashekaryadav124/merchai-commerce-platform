import json
from sqlalchemy import text, inspect
from app.db.session import engine

insp = inspect(engine)
tables = [
    'app_users', 'customers', 'products', 'seller_products', 'sellers',
    'carts', 'cart_items', 'orders', 'seller_orders', 'seller_order_items',
    'order_items', 'payments', 'shipments', 'returns', 'inventory_history',
    'product_images', 'audit_logs', 'customer_reviews', 'support_tickets'
]

with engine.connect() as conn:
    print("=== PHASE 1: DATABASE AUDIT ===")
    for t in tables:
        if not insp.has_table(t):
            print(f"TABLE {t}: DOES NOT EXIST")
            continue
        cols = insp.get_columns(t)
        pk = insp.get_pk_constraint(t)
        fks = insp.get_foreign_keys(t)
        count = conn.execute(text(f"SELECT COUNT(*) FROM `{t}`;")).fetchone()[0]
        pk_cols = pk.get('constrained_columns', []) if pk else []
        fk_cols = [f.get('constrained_columns', []) for f in fks] if fks else []
        print(f"Table: {t:20s} | Rows: {count:7d} | PK: {pk_cols} | FKs: {fk_cols}")

    print("\n=== RELATIONSHIP RECONCILIATION QUERIES ===")
    # 1. Customers <-> app_users
    orphan_customers = conn.execute(text("""
        SELECT COUNT(*) FROM customers c 
        LEFT JOIN app_users u ON c.app_user_id = u.user_id 
        WHERE c.app_user_id IS NOT NULL AND u.user_id IS NULL;
    """)).fetchone()[0]
    unlinked_customers = conn.execute(text("SELECT COUNT(*) FROM customers WHERE app_user_id IS NULL;")).fetchone()[0]
    total_customers = conn.execute(text("SELECT COUNT(*) FROM customers;")).fetchone()[0]
    total_users = conn.execute(text("SELECT COUNT(*) FROM app_users;")).fetchone()[0]
    print(f"Customers: total={total_customers}, unlinked_from_users={unlinked_customers}, orphan_app_user_id={orphan_customers}")

    # 2. Seller <-> app_users
    unlinked_sellers = conn.execute(text("SELECT COUNT(*) FROM sellers WHERE user_id IS NULL;")).fetchone()[0]
    orphan_seller_users = conn.execute(text("""
        SELECT COUNT(*) FROM sellers s 
        LEFT JOIN app_users u ON s.user_id = u.user_id 
        WHERE s.user_id IS NOT NULL AND u.user_id IS NULL;
    """)).fetchone()[0]
    print(f"Sellers: unlinked_users={unlinked_sellers}, orphan_user_id={orphan_seller_users}")

    # 3. SellerProducts <-> Products & Sellers
    orphan_sp_prod = conn.execute(text("""
        SELECT COUNT(*) FROM seller_products sp 
        LEFT JOIN products p ON sp.product_id = p.product_id 
        WHERE p.product_id IS NULL;
    """)).fetchone()[0]
    orphan_sp_seller = conn.execute(text("""
        SELECT COUNT(*) FROM seller_products sp 
        LEFT JOIN sellers s ON sp.seller_id = s.seller_id 
        WHERE s.seller_id IS NULL;
    """)).fetchone()[0]
    print(f"SellerProducts: orphan_prod={orphan_sp_prod}, orphan_seller={orphan_sp_seller}")

    # 4. Products price & stock anomalies
    invalid_price_prods = conn.execute(text("SELECT COUNT(*) FROM products WHERE price IS NULL OR price <= 0;")).fetchone()[0]
    invalid_stock_prods = conn.execute(text("SELECT COUNT(*) FROM products WHERE stock_quantity IS NULL OR stock_quantity < 0;")).fetchone()[0]
    print(f"Products: invalid_prices={invalid_price_prods}, invalid_stock={invalid_stock_prods}")

    # 5. SellerProducts price & stock anomalies
    invalid_price_sp = conn.execute(text("SELECT COUNT(*) FROM seller_products WHERE selling_price IS NULL OR selling_price <= 0;")).fetchone()[0]
    invalid_stock_sp = conn.execute(text("SELECT COUNT(*) FROM seller_products WHERE stock_quantity IS NULL OR stock_quantity < 0;")).fetchone()[0]
    print(f"SellerProducts: invalid_prices={invalid_price_sp}, invalid_stock={invalid_stock_sp}")

    # 6. Orders <-> Customers
    orphan_order_cust = conn.execute(text("""
        SELECT COUNT(*) FROM orders o 
        LEFT JOIN customers c ON o.customer_id = c.customer_id 
        WHERE o.customer_id IS NOT NULL AND c.customer_id IS NULL;
    """)).fetchone()[0]
    null_order_cust = conn.execute(text("SELECT COUNT(*) FROM orders WHERE customer_id IS NULL;")).fetchone()[0]
    print(f"Orders: null_customer_id={null_order_cust}, orphan_customer_id={orphan_order_cust}")

    # 7. OrderItems <-> Orders & Products
    orphan_items_order = conn.execute(text("""
        SELECT COUNT(*) FROM order_items oi 
        LEFT JOIN orders o ON oi.order_id = o.order_id 
        WHERE o.order_id IS NULL;
    """)).fetchone()[0]
    orphan_items_prod = conn.execute(text("""
        SELECT COUNT(*) FROM order_items oi 
        LEFT JOIN products p ON oi.product_id = p.product_id 
        WHERE p.product_id IS NULL;
    """)).fetchone()[0]
    print(f"OrderItems: orphan_orders={orphan_items_order}, orphan_products={orphan_items_prod}")

    # 8. Order totals consistency (reconciling subtotal + shipping_fee + tax_amount vs final_amount)
    inconsistent_order_totals = conn.execute(text("""
        SELECT COUNT(*) FROM orders 
        WHERE subtotal IS NOT NULL AND final_amount IS NOT NULL 
        AND ABS(ROUND(COALESCE(subtotal,0) + COALESCE(shipping_fee,0) + COALESCE(tax_amount,0) - final_amount, 2)) > 1.0;
    """)).fetchone()[0]
    print(f"Orders with inconsistent subtotal/fee/tax vs final_amount: {inconsistent_order_totals}")

    # 9. Order Items sum vs Order subtotal
    inconsistent_subtotals = conn.execute(text("""
        SELECT COUNT(*) FROM (
            SELECT o.order_id, o.subtotal, SUM(oi.item_revenue) as items_sum
            FROM orders o
            JOIN order_items oi ON o.order_id = oi.order_id
            WHERE o.subtotal IS NOT NULL
            GROUP BY o.order_id, o.subtotal
            HAVING ABS(ROUND(o.subtotal - SUM(oi.item_revenue), 2)) > 1.0
        ) as inc;
    """)).fetchone()[0]
    print(f"Orders where items_sum != order.subtotal: {inconsistent_subtotals}")

    # 10. Payments <-> Orders
    orphan_payments = conn.execute(text("""
        SELECT COUNT(*) FROM payments p 
        LEFT JOIN orders o ON p.order_id = o.order_id 
        WHERE p.order_id IS NOT NULL AND o.order_id IS NULL;
    """)).fetchone()[0]
    print(f"Payments: orphan_order_id={orphan_payments}")

    # 11. Shipments <-> Orders
    orphan_shipments = conn.execute(text("""
        SELECT COUNT(*) FROM shipments s 
        LEFT JOIN orders o ON s.order_id = o.order_id 
        WHERE s.order_id IS NOT NULL AND o.order_id IS NULL;
    """)).fetchone()[0]
    print(f"Shipments: orphan_order_id={orphan_shipments}")

    # 12. Returns <-> Orders
    orphan_returns = conn.execute(text("""
        SELECT COUNT(*) FROM returns r 
        LEFT JOIN orders o ON r.order_id = o.order_id 
        WHERE r.order_id IS NOT NULL AND o.order_id IS NULL;
    """)).fetchone()[0]
    print(f"Returns: orphan_order_id={orphan_returns}")

    # 13. Carts & Cart Items
    cart_cnt = conn.execute(text("SELECT COUNT(*) FROM carts;")).fetchone()[0]
    cart_items_cnt = conn.execute(text("SELECT COUNT(*) FROM cart_items;")).fetchone()[0]
    orphan_cart_items = conn.execute(text("""
        SELECT COUNT(*) FROM cart_items ci 
        LEFT JOIN carts c ON ci.cart_id = c.cart_id 
        WHERE c.cart_id IS NULL;
    """)).fetchone()[0]
    print(f"Carts: {cart_cnt}, CartItems: {cart_items_cnt}, orphan_cart_items={orphan_cart_items}")

    # 14. Seller Orders & Seller Order Items
    so_cnt = conn.execute(text("SELECT COUNT(*) FROM seller_orders;")).fetchone()[0]
    soi_cnt = conn.execute(text("SELECT COUNT(*) FROM seller_order_items;")).fetchone()[0]
    print(f"SellerOrders: {so_cnt}, SellerOrderItems: {soi_cnt}")

    # 15. Check existing order statuses and payment statuses in DB
    order_statuses = conn.execute(text("SELECT order_status, COUNT(*) FROM orders GROUP BY order_status;")).fetchall()
    print(f"Order statuses: {[(r[0], r[1]) for r in order_statuses]}")
    payment_statuses = conn.execute(text("SELECT payment_status, COUNT(*) FROM payments GROUP BY payment_status;")).fetchall()
    print(f"Payment statuses: {[(r[0], r[1]) for r in payment_statuses]}")
