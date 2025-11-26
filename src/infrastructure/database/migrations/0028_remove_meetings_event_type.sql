-- Remove event_type column from meetings table
-- This field is redundant as meeting state can be inferred from status, pendingTaskId, and other fields
-- Event history is already tracked in meeting_events table

-- Drop the column
ALTER TABLE "meetings"
  DROP COLUMN IF EXISTS "event_type";

-- Add comment explaining the removal
COMMENT ON TABLE "meetings" IS 
  'Meeting records table - stores current state only. Event history is tracked in meeting_events table.';

