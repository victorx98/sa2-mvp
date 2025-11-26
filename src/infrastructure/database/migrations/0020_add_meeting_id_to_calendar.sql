-- Migration: Add meeting_id to calendar table
-- Date: 2025-11-25
-- Version: v4.1
-- Description: Add meeting_id field to enable direct event-driven updates from Meeting module

-- Step 1: Add meeting_id column (nullable)
ALTER TABLE "calendar"
  ADD COLUMN IF NOT EXISTS "meeting_id" uuid;

-- Step 2: Create index for meeting_id
-- This index is crucial for efficient updates when meeting completes
CREATE INDEX IF NOT EXISTS "idx_calendar_meeting" 
  ON "calendar"("meeting_id");

-- Step 3: Add column comment
COMMENT ON COLUMN "calendar"."meeting_id" IS 
  'Meeting ID (FK to meetings.id) - v4.1. Used for event-driven status updates when meeting completes.';

-- Note: We don't add a foreign key constraint to allow soft references
-- This provides flexibility and avoids cascading issues

