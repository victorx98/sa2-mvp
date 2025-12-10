-- Migration: Update class_sessions CHECK constraint for async meeting creation
-- Purpose: Add PENDING_MEETING and MEETING_FAILED status values
-- Date: 2025-12-03

-- Update CHECK constraint for status values
ALTER TABLE class_sessions 
DROP CONSTRAINT IF EXISTS chk_class_session_status;

ALTER TABLE class_sessions 
ADD CONSTRAINT chk_class_session_status 
CHECK (status IN ('pending_meeting', 'scheduled', 'completed', 'cancelled', 'deleted', 'meeting_failed'));

-- Add comment documenting the status values
COMMENT ON CONSTRAINT chk_class_session_status ON class_sessions IS 
'Status values: pending_meeting (async meeting creation), scheduled (ready for session), completed (session finished), cancelled, deleted, meeting_failed (meeting creation failed)';

