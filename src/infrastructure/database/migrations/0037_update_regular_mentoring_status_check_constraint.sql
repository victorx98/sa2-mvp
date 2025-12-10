-- Migration: Update CHECK constraint for regular_mentoring_sessions status column
-- Purpose: Add PENDING_MEETING and MEETING_FAILED status values to support async meeting creation
-- Date: 2025-12-03

-- Drop the old CHECK constraint
ALTER TABLE regular_mentoring_sessions 
DROP CONSTRAINT chk_regular_mentoring_status;

-- Add the new CHECK constraint with all status values
ALTER TABLE regular_mentoring_sessions 
ADD CONSTRAINT chk_regular_mentoring_status 
CHECK (status IN ('pending_meeting', 'scheduled', 'completed', 'cancelled', 'deleted', 'meeting_failed'));

-- Add comment documenting the status values
COMMENT ON CONSTRAINT chk_regular_mentoring_status ON regular_mentoring_sessions IS 
'Status values: pending_meeting (async meeting creation), scheduled (ready for session), completed (session finished), cancelled, deleted, meeting_failed (meeting creation failed)';

