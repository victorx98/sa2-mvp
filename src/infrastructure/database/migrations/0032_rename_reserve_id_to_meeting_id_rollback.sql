-- Rollback Migration: Rename meeting_id back to reserve_id
-- Date: 2025-11-29

-- Step 1: Rename the index back
DROP INDEX IF EXISTS idx_meeting_meeting_id;
CREATE INDEX idx_meeting_reserve_id ON meetings(reserve_id);

-- Step 2: Rename the column back
ALTER TABLE meetings 
  RENAME COLUMN meeting_id TO reserve_id;

-- Step 3: Update comments
COMMENT ON COLUMN meetings.reserve_id IS 'Reserve ID (Feishu reserve_id, Zoom meeting_id)';

