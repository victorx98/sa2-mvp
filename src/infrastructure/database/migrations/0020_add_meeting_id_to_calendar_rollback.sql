-- Rollback Migration: Remove meeting_id from calendar table
-- Date: 2025-11-25
-- Version: v4.1

-- Step 1: Drop index
DROP INDEX IF EXISTS "idx_calendar_meeting";

-- Step 2: Drop column
ALTER TABLE "calendar"
  DROP COLUMN IF EXISTS "meeting_id";

