import sys
import os
from sqlalchemy import text, inspect

# Ensure backend root is on sys.path
sys.path.insert(0, os.path.dirname(__file__))

from app.core.config import settings

def mask_string(val: str, show_prefix: int = 3, show_suffix: int = 6) -> str:
    """Masks a sensitive string, showing only minimal prefix and suffix characters."""
    if not val:
        return "(empty)"
    if len(val) <= show_prefix + show_suffix:
        return "***"
    return f"{val[:show_prefix]}...{val[-show_suffix:]}"

def test_connection():
    print("=====================================================================")
    print("   DATABASE CONNECTIVITY & INTEGRITY DIAGNOSTIC AUDIT")
    print("=====================================================================")

    # Mask sensitive connection metadata
    masked_host = mask_string(settings.MYSQL_HOST, 4, 15) if "aiven" in settings.MYSQL_HOST.lower() else settings.MYSQL_HOST
    masked_user = mask_string(settings.MYSQL_USER, 2, 2)
    masked_db = settings.MYSQL_DB

    print(f"Environment:     {settings.APP_ENV}")
    print(f"Target Database: {masked_db}")
    print(f"Target Host:     {masked_host}")
    print(f"Target Port:     {settings.MYSQL_PORT}")
    print(f"Target User:     {masked_user}")
    print(f"SSL Mode:        {settings.MYSQL_SSL_MODE or 'None (default)'}")
    print(f"SSL CA File:     {'Configured (masked)' if settings.MYSQL_SSL_CA else 'System / Default Trust Store'}")
    print("---------------------------------------------------------------------")

    # Safety check for production host in development environment
    if "aiven" in settings.MYSQL_HOST.lower() and not settings.is_production and not settings.ALLOW_PRODUCTION_DB_ACCESS:
        print("[-] [SAFETY ABORT] Diagnostic check against production cloud database is blocked.")
        print("    APP_ENV is not 'production' and ALLOW_PRODUCTION_DB_ACCESS is not enabled.")
        print("    To run diagnostics against production from an authorized machine, set:")
        print("    ALLOW_PRODUCTION_DB_ACCESS=true")
        sys.exit(1)

    try:
        from app.db.session import engine
        with engine.connect() as conn:
            # 1. Ping / Liveness Check
            ping_res = conn.execute(text("SELECT 1;")).fetchone()
            if not ping_res or ping_res[0] != 1:
                print("[-] [FAILED] Ping query 'SELECT 1;' returned unexpected result.")
                sys.exit(1)
            print("[+] [PASSED] Basic connection ping (SELECT 1;) succeeded.")

            # 2. Database Name Verification
            current_db = conn.execute(text("SELECT DATABASE();")).fetchone()[0]
            print(f"[+] [PASSED] Active database confirmed: '{current_db}'")

            # 3. Table Count Verification
            table_count_res = conn.execute(
                text("SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = DATABASE();")
            ).fetchone()[0]
            print(f"[+] [PASSED] Total tables discovered in schema: {table_count_res} tables")

            # 4. Comprehensive Table Inventory & Row Counts
            expected_tables = [
                'app_users', 'customers', 'products', 'seller_products', 'sellers',
                'carts', 'cart_items', 'orders', 'seller_orders', 'seller_order_items',
                'order_items', 'payments', 'shipments', 'returns', 'inventory_history',
                'product_images', 'audit_logs', 'customer_reviews', 'support_tickets',
                'customer_interactions', 'product_knowledge', 'review_text',
                'marketing_campaigns', 'customer_addresses'
            ]

            print("\n--- Inspecting Table Accessibility & Row Counts ---")
            insp = inspect(engine)
            existing_tables = set(insp.get_table_names())
            
            missing_tables = []
            total_records = 0

            for tbl in expected_tables:
                if tbl in existing_tables:
                    cnt = conn.execute(text(f"SELECT COUNT(*) FROM `{tbl}`;")).fetchone()[0]
                    total_records += cnt
                    print(f"  * {tbl:24s}: {cnt:7d} rows  [OK]")
                else:
                    print(f"  * {tbl:24s}: MISSING   [WARNING]")
                    missing_tables.append(tbl)

            print("---------------------------------------------------------------------")
            print(f"Total Accessible Records across audited tables: {total_records:,} rows")

            if missing_tables:
                print(f"[!] [WARNING] The following expected tables were not found: {missing_tables}")
            else:
                print("[+] [PASSED] All 24 application and historical dataset tables verified accessible!")

            # 5. Spot-check historical order record retention
            if 'orders' in existing_tables:
                order_cnt = conn.execute(text("SELECT COUNT(*) FROM `orders`;")).fetchone()[0]
                if order_cnt >= 20000:
                    print(f"[+] [PASSED] Historical orders preserved: {order_cnt:,} records verified.")
                else:
                    print(f"[!] [NOTICE] Historical orders table has {order_cnt:,} records (expected ~20,000+).")

    except Exception as e:
        print("\n[-] [ERROR] Could not connect to the database:")
        # Sanitize exception message so password or connection string is never echoed
        err_type = type(e).__name__
        err_str = str(e)
        if "@" in err_str and ":" in err_str:
            err_str = "Connection refused or authentication failed (credentials masked for security)."
        print(f"   Error summary: {err_type}: {err_str}")
        print("\nTroubleshooting tips:")
        print("  1. Verify your local MySQL service is running (e.g. host 127.0.0.1:3306).")
        print("  2. Verify credentials in your local .env file.")
        print("  3. Ensure APP_ENV and database settings are properly configured.")
        sys.exit(1)

    print("=====================================================================")
    print("   STATUS: DATABASE VERIFICATION SUCCESSFUL")
    print("=====================================================================")

if __name__ == "__main__":
    test_connection()
