-- Add performance indexes for Catalog Domain tables
-- Migration: 0001_add_catalog_indexes
-- Created: 2025-11-05
-- Description: Add missing indexes for services, service_packages, and products tables

-- ===============================================
-- Services table indexes
-- ===============================================

-- Index for code lookup (unique constraint already exists, but index improves performance)
CREATE INDEX IF NOT EXISTS idx_services_code ON services(code);

-- Index for service_type lookup (unique constraint already exists, but index improves performance)
CREATE INDEX IF NOT EXISTS idx_services_service_type ON services(service_type);

-- Index for status filtering (frequently queried)
CREATE INDEX IF NOT EXISTS idx_services_status ON services(status);

-- Index for billing_mode filtering
CREATE INDEX IF NOT EXISTS idx_services_billing_mode ON services(billing_mode);

-- Index for created_at sorting (used in search with default sort)
CREATE INDEX IF NOT EXISTS idx_services_created_at ON services(created_at DESC);

-- ===============================================
-- Service Packages table indexes
-- ===============================================

-- Index for code lookup (unique constraint already exists, but index improves performance)
CREATE INDEX IF NOT EXISTS idx_service_packages_code ON service_packages(code);

-- Index for status filtering (frequently queried)
CREATE INDEX IF NOT EXISTS idx_service_packages_status ON service_packages(status);

-- Index for created_at sorting
CREATE INDEX IF NOT EXISTS idx_service_packages_created_at ON service_packages(created_at DESC);

-- ===============================================
-- Service Package Items table indexes
-- ===============================================

-- Index for package_id lookup (frequently joined)
CREATE INDEX IF NOT EXISTS idx_service_package_items_package_id ON service_package_items(package_id);

-- Index for service_id lookup (used in reference checking)
CREATE INDEX IF NOT EXISTS idx_service_package_items_service_id ON service_package_items(service_id);

-- Composite index for checking duplicates
CREATE INDEX IF NOT EXISTS idx_service_package_items_package_service ON service_package_items(package_id, service_id);

-- ===============================================
-- Products table indexes
-- ===============================================

-- Index for code lookup (unique constraint already exists, but index improves performance)
CREATE INDEX IF NOT EXISTS idx_products_code ON products(code);

-- Index for status filtering (frequently queried)
CREATE INDEX IF NOT EXISTS idx_products_status ON products(status);

-- Index for sort_order (default sorting field)
CREATE INDEX IF NOT EXISTS idx_products_sort_order ON products(sort_order ASC);

-- Index for published_at (filtering published products)
CREATE INDEX IF NOT EXISTS idx_products_published_at ON products(published_at DESC);

-- Index for created_at sorting
CREATE INDEX IF NOT EXISTS idx_products_created_at ON products(created_at DESC);

-- Partial index for scheduled publish (only for draft status)
CREATE INDEX IF NOT EXISTS idx_products_scheduled_publish
ON products(scheduled_publish_at)
WHERE status = 'draft';

-- Composite index for active products sorting (common query pattern)
CREATE INDEX IF NOT EXISTS idx_products_status_sort_order
ON products(status, sort_order ASC)
WHERE status = 'active';

-- ===============================================
-- Product Items table indexes
-- ===============================================

-- Index for product_id lookup (frequently joined)
CREATE INDEX IF NOT EXISTS idx_product_items_product_id ON product_items(product_id);

-- Index for reference_id lookup (used in reference checking)
CREATE INDEX IF NOT EXISTS idx_product_items_reference_id ON product_items(reference_id);

-- Composite index for checking duplicates and references
CREATE INDEX IF NOT EXISTS idx_product_items_product_type_ref
ON product_items(product_id, type, reference_id);

-- Index for type and reference_id (used in validateProductItems)
CREATE INDEX IF NOT EXISTS idx_product_items_type_reference
ON product_items(type, reference_id);

-- ===============================================
-- Add check constraints (mentioned in schema comments)
-- ===============================================

-- Ensure price is positive
ALTER TABLE products
ADD CONSTRAINT IF NOT EXISTS chk_price_positive
CHECK (price::numeric > 0);

-- Ensure validity_days is positive if not NULL
ALTER TABLE products
ADD CONSTRAINT IF NOT EXISTS chk_validity_days_positive
CHECK (validity_days IS NULL OR validity_days > 0);

-- Ensure quantity is positive for service_package_items
ALTER TABLE service_package_items
ADD CONSTRAINT IF NOT EXISTS chk_package_item_quantity_positive
CHECK (quantity > 0);

-- Ensure quantity is positive for product_items
ALTER TABLE product_items
ADD CONSTRAINT IF NOT EXISTS chk_product_item_quantity_positive
CHECK (quantity > 0);
