-- Migration: Fix class_sessions status CHECK constraint
-- Purpose: Correctly update the constraint to allow pending_meeting status
-- Date: 2025-12-10

-- Drop the old constraint (original name from 0033 migration)
ALTER TABLE class_sessions 
DROP CONSTRAINT IF EXISTS class_sessions_status_check;

-- Add new constraint with correct status values
ALTER TABLE class_sessions 
ADD CONSTRAINT class_sessions_status_check 
CHECK (status IN ('pending_meeting', 'scheduled', 'completed', 'cancelled', 'deleted', 'meeting_failed'));

-- Add comment documenting the status values
COMMENT ON COLUMN class_sessions.status IS 
'Status values: pending_meeting (async meeting creation), scheduled (ready for session), completed (session finished), cancelled, deleted, meeting_failed (meeting creation failed)';

