-- Migration: Alter class_mentors_prices price_per_session to INTEGER
-- Purpose: Change price_per_session from DECIMAL(10,2) to INTEGER for simplified pricing
-- Date: 2025-12-10

-- Alter column type from DECIMAL to INTEGER
ALTER TABLE class_mentors_prices
ALTER COLUMN price_per_session TYPE INTEGER USING (CAST(price_per_session AS INTEGER));

-- Add comment documenting the column purpose
COMMENT ON COLUMN class_mentors_prices.price_per_session IS 'Price per session in integer format (whole currency units)';

