-- Rollback Migration: Remove Calendar v5.3 fields
-- This script reverts the changes made by 0018_add_calendar_v5_3_fields.sql
-- Use only if you need to roll back to the previous version

-- Drop the new index
DROP INDEX IF EXISTS "idx_calendar_user_scheduled";

-- Drop the session_type CHECK constraint
ALTER TABLE "calendar" DROP CONSTRAINT IF EXISTS "check_calendar_session_type";

-- Restore old status CHECK constraint (without 'completed')
ALTER TABLE "calendar" DROP CONSTRAINT IF EXISTS "check_calendar_status";
ALTER TABLE "calendar"
ADD CONSTRAINT "check_calendar_status"
CHECK (status IN ('booked', 'cancelled'));

-- Drop the new columns
ALTER TABLE "calendar" 
  DROP COLUMN IF EXISTS "session_type",
  DROP COLUMN IF EXISTS "title",
  DROP COLUMN IF EXISTS "scheduled_start_time",
  DROP COLUMN IF EXISTS "metadata";

-- Note: This rollback script should only be used in development/staging environments
-- Production rollback requires careful data backup and validation

