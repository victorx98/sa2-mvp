-- Migration: Update comm_sessions for async meeting creation support
-- Purpose: Make meeting_id nullable and update CHECK constraint
-- Date: 2025-12-03

-- Make meeting_id nullable
ALTER TABLE comm_sessions
  ALTER COLUMN meeting_id DROP NOT NULL;

-- Drop all possible existing CHECK constraints (both old and drizzle-generated)
ALTER TABLE comm_sessions 
DROP CONSTRAINT IF EXISTS chk_comm_session_status;

ALTER TABLE comm_sessions 
DROP CONSTRAINT IF EXISTS comm_sessions_status_check;

-- Add new CHECK constraint with explicit name
ALTER TABLE comm_sessions 
ADD CONSTRAINT comm_sessions_status_check 
CHECK (status IN ('pending_meeting', 'scheduled', 'completed', 'cancelled', 'deleted', 'meeting_failed'));

-- Add comment
COMMENT ON COLUMN comm_sessions.meeting_id IS 'Foreign key to meetings table. Nullable during async meeting creation flow (PENDING_MEETING status).';
