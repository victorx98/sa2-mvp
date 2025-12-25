-- Migration: Drop old columns from notification_queue table
-- Date: 2025-12-24
-- Description: Remove deprecated recipient, template, and data columns after migration to new schema

-- Drop old columns that are no longer used
ALTER TABLE notification_queue 
  DROP COLUMN IF EXISTS recipient,
  DROP COLUMN IF EXISTS template,
  DROP COLUMN IF EXISTS data;

-- Add NOT NULL constraints to new columns (if not already set)
ALTER TABLE notification_queue 
  ALTER COLUMN recipients SET NOT NULL,
  ALTER COLUMN subject SET NOT NULL,
  ALTER COLUMN content SET NOT NULL;

-- Verification query (run manually to check)
-- SELECT column_name, data_type, is_nullable 
-- FROM information_schema.columns 
-- WHERE table_name = 'notification_queue' 
-- ORDER BY ordinal_position;

