-- =====================================================================
-- AI COMMERCE DISCOVERY & CUSTOMER SUPPORT PLATFORM DATABASE SCHEMA
-- Database: ai_commerce_cleaned
-- MySQL Version: 8.0+
-- =====================================================================

-- 1. APPLICATION & USER AUTHENTICATION
CREATE TABLE IF NOT EXISTS app_users (
    user_id VARCHAR(64) PRIMARY KEY,
    full_name VARCHAR(150) NOT NULL,
    email VARCHAR(254) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    role ENUM('customer', 'seller', 'operations', 'support', 'admin') NOT NULL DEFAULT 'customer',
    is_active TINYINT(1) DEFAULT 1,
    is_demo_account TINYINT(1) DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_user_email (email),
    INDEX idx_user_role (role)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 2. MULTI-SELLER PROFILES
CREATE TABLE IF NOT EXISTS sellers (
    seller_id VARCHAR(64) PRIMARY KEY,
    user_id VARCHAR(64),
    store_name VARCHAR(180) NOT NULL,
    business_description TEXT,
    approval_status ENUM('pending', 'approved', 'rejected', 'suspended') DEFAULT 'approved',
    contact_email VARCHAR(254),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 3. SELLER PRODUCT INVENTORY ASSIGNMENTS
CREATE TABLE IF NOT EXISTS seller_products (
    seller_product_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    seller_id VARCHAR(64) NOT NULL,
    product_id VARCHAR(255) NOT NULL,
    selling_price DECIMAL(12,2) NOT NULL,
    stock_quantity INT DEFAULT 0,
    listing_status ENUM('draft', 'active', 'paused', 'removed') DEFAULT 'active',
    assigned_by VARCHAR(64),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_sp_seller (seller_id),
    INDEX idx_sp_product (product_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 4. CARTS & CART ITEMS
CREATE TABLE IF NOT EXISTS carts (
    cart_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    customer_user_id VARCHAR(64) NOT NULL,
    status ENUM('active', 'checked_out', 'abandoned', 'cleared') DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_cart_customer (customer_user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS cart_items (
    cart_item_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    cart_id BIGINT UNSIGNED NOT NULL,
    seller_product_id BIGINT UNSIGNED NOT NULL,
    quantity INT UNSIGNED NOT NULL DEFAULT 1,
    unit_price DECIMAL(12,2) NOT NULL,
    added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_ci_cart (cart_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 5. AUDIT LOGS FOR REGULATORY & SECURITY AUDITING
CREATE TABLE IF NOT EXISTS audit_logs (
    audit_log_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id VARCHAR(64),
    action VARCHAR(100) NOT NULL,
    entity_type VARCHAR(100) NOT NULL,
    entity_id VARCHAR(255),
    details JSON,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_audit_user (user_id),
    INDEX idx_audit_action (action)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
