-- WARNING: This drops all Juhnios Rold database objects managed by migration 001.

DROP VIEW IF EXISTS v_revenue_by_month;
DROP VIEW IF EXISTS v_product_stats;
DROP VIEW IF EXISTS v_order_summary;

DROP TRIGGER IF EXISTS trg_pro_requests_updated_at ON pro_requests;
DROP TRIGGER IF EXISTS trg_orders_updated_at ON orders;
DROP TRIGGER IF EXISTS trg_products_updated_at ON products;
DROP TRIGGER IF EXISTS trg_users_updated_at ON users;

DROP FUNCTION IF EXISTS update_updated_at_column();

DROP TABLE IF EXISTS inventory_movements;
DROP TABLE IF EXISTS payments;
DROP TABLE IF EXISTS addresses;
DROP TABLE IF EXISTS saved_products;
DROP TABLE IF EXISTS refresh_tokens;
DROP TABLE IF EXISTS pro_requests;
DROP TABLE IF EXISTS order_items;
DROP TABLE IF EXISTS orders;
DROP TABLE IF EXISTS products;
DROP TABLE IF EXISTS users;

DROP TYPE IF EXISTS inventory_movement_type;
DROP TYPE IF EXISTS business_type;
DROP TYPE IF EXISTS pro_status;
DROP TYPE IF EXISTS payment_status;
DROP TYPE IF EXISTS order_status;
DROP TYPE IF EXISTS product_category;
DROP TYPE IF EXISTS user_role;
