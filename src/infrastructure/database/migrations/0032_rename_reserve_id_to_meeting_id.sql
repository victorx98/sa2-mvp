-- Migration: Rename reserve_id to meeting_id
-- Reason: Unify naming convention - both Feishu and Zoom use meeting_id in their event webhooks
-- Date: 2025-11-29

-- Step 1: Rename the column
ALTER TABLE meetings 
  RENAME COLUMN reserve_id TO meeting_id;

-- Step 2: Rename the index
DROP INDEX IF EXISTS idx_meeting_reserve_id;
CREATE INDEX idx_meeting_meeting_id ON meetings(meeting_id);

-- Step 3: Update comments (PostgreSQL 11+)
COMMENT ON COLUMN meetings.meeting_id IS 'Meeting ID from provider (Feishu reserve.id, Zoom meeting id) - used for provider API calls and event mapping';

