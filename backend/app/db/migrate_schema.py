import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", ".."))

from sqlalchemy import text
from app.db.session import engine

def apply_migrations():
    """
    Safely applies database migrations required for customer registration integration.
    Adds `app_user_id` foreign key column to `customers` table if not already present.
    """
    with engine.connect() as conn:
        # Check if app_user_id column exists in customers table
        check_col_sql = text("""
            SELECT COLUMN_NAME
            FROM INFORMATION_SCHEMA.COLUMNS
            WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'customers' AND COLUMN_NAME = 'app_user_id';
        """)
        res = conn.execute(check_col_sql).fetchone()
        
        if not res:
            print("Adding 'app_user_id' column and FK constraint to 'customers' table...")
            
            # Step 1: Add app_user_id column as VARCHAR(64) NULL
            conn.execute(text("ALTER TABLE customers ADD COLUMN app_user_id VARCHAR(64) NULL AFTER customer_id;"))
            
            # Step 2: Add UNIQUE index on app_user_id
            conn.execute(text("ALTER TABLE customers ADD UNIQUE INDEX idx_customers_app_user_id (app_user_id);"))
            
            # Step 3: Add Foreign Key constraint to app_users(user_id)
            conn.execute(text("""
                ALTER TABLE customers
                ADD CONSTRAINT fk_customers_app_user
                FOREIGN KEY (app_user_id) REFERENCES app_users(user_id)
                ON DELETE SET NULL;
            """))
            conn.commit()
            print("Migration successful: 'app_user_id' column, UNIQUE index, and FK constraint added.")
        else:
            print("'app_user_id' column already exists in 'customers' table. Migration skipped.")

        # Check if store_type column exists in sellers table
        check_seller_col_sql = text("""
            SELECT COLUMN_NAME
            FROM INFORMATION_SCHEMA.COLUMNS
            WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'sellers' AND COLUMN_NAME = 'store_type';
        """)
        seller_col_res = conn.execute(check_seller_col_sql).fetchone()

        if not seller_col_res:
            print("Adding 'store_type' column to 'sellers' table...")
            conn.execute(text("""
                ALTER TABLE sellers 
                ADD COLUMN store_type VARCHAR(100) NULL DEFAULT 'Other / General Store' 
                AFTER store_name;
            """))
            # Populate default for existing records safely
            conn.execute(text("UPDATE sellers SET store_type = 'Other / General Store' WHERE store_type IS NULL;"))
            # Reconcile SHOES SHOP store type to Fashion & Footwear for verified demonstration
            conn.execute(text("UPDATE sellers SET store_type = 'Fashion & Footwear' WHERE store_name = 'SHOES SHOP';"))
            conn.commit()
            print("Migration successful: 'store_type' column added to 'sellers' table.")
        else:
            print("'store_type' column already exists in 'sellers' table. Ensuring defaults are populated...")
            conn.execute(text("UPDATE sellers SET store_type = 'Other / General Store' WHERE store_type IS NULL;"))
            conn.execute(text("UPDATE sellers SET store_type = 'Fashion & Footwear' WHERE store_name = 'SHOES SHOP' AND (store_type IS NULL OR store_type = 'Other / General Store');"))
            conn.commit()
        # Check if customer_addresses table exists
        check_addr_table_sql = text("""
            SELECT TABLE_NAME 
            FROM INFORMATION_SCHEMA.TABLES 
            WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'customer_addresses';
        """)
        addr_res = conn.execute(check_addr_table_sql).fetchone()
        if not addr_res:
            print("Creating 'customer_addresses' table...")
            conn.execute(text("""
                CREATE TABLE customer_addresses (
                    address_id BIGINT AUTO_INCREMENT PRIMARY KEY,
                    user_id VARCHAR(64) NOT NULL,
                    recipient_name VARCHAR(150) NOT NULL,
                    phone_number VARCHAR(20) NOT NULL,
                    address_line1 VARCHAR(255) NOT NULL,
                    address_line2 VARCHAR(255) NULL,
                    city VARCHAR(100) NOT NULL,
                    state VARCHAR(100) NOT NULL,
                    postal_code VARCHAR(10) NOT NULL,
                    country VARCHAR(50) NOT NULL DEFAULT 'India',
                    is_default BOOLEAN NOT NULL DEFAULT FALSE,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                    INDEX idx_cust_addr_user (user_id),
                    CONSTRAINT fk_cust_addr_user FOREIGN KEY (user_id) REFERENCES app_users(user_id) ON DELETE CASCADE
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
            """))
            conn.commit()
            print("Migration successful: 'customer_addresses' table created.")
        else:
            print("'customer_addresses' table already exists. Migration skipped.")

        # Check and add immutable address snapshot & idempotency columns to orders table
        orders_cols_to_add = [
            ("shipping_address", "TEXT NULL"),
            ("delivery_pincode", "VARCHAR(10) NULL"),
            ("recipient_name", "VARCHAR(150) NULL"),
            ("recipient_phone", "VARCHAR(20) NULL"),
            ("idempotency_key", "VARCHAR(100) NULL")
        ]
        for col_name, col_def in orders_cols_to_add:
            check_order_col = text(f"""
                SELECT COLUMN_NAME
                FROM INFORMATION_SCHEMA.COLUMNS
                WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'orders' AND COLUMN_NAME = '{col_name}';
            """)
            if not conn.execute(check_order_col).fetchone():
                print(f"Adding '{col_name}' column to 'orders' table...")
                conn.execute(text(f"ALTER TABLE orders ADD COLUMN {col_name} {col_def};"))
                conn.commit()
                print(f"Added column '{col_name}' to 'orders'.")

        # Check index on idempotency_key
        check_idx_sql = text("""
            SELECT INDEX_NAME 
            FROM INFORMATION_SCHEMA.STATISTICS 
            WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'orders' AND INDEX_NAME = 'idx_orders_idempotency';
        """)
        if not conn.execute(check_idx_sql).fetchone():
            conn.execute(text("ALTER TABLE orders ADD INDEX idx_orders_idempotency (idempotency_key);"))
            conn.commit()
            print("Added index 'idx_orders_idempotency' on orders(idempotency_key).")

if __name__ == "__main__":
    apply_migrations()
