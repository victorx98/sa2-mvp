-- Migration: Update calendar CHECK constraint for mock_interview
-- Description: Add mock_interview to the session_type CHECK constraint
-- Prerequisites: 0062_add_mock_interview_to_calendar_session_type.sql must be run first

-- Update the CHECK constraint to include mock_interview
ALTER TABLE calendar DROP CONSTRAINT IF EXISTS check_calendar_session_type;

ALTER TABLE calendar ADD CONSTRAINT check_calendar_session_type 
  CHECK (session_type IN ('regular_mentoring', 'gap_analysis', 'ai_career', 'comm_session', 'class_session', 'mock_interview'));

-- Add comment for documentation
COMMENT ON TYPE calendar_session_type IS 'Session types: regular_mentoring, gap_analysis, ai_career, comm_session, class_session, mock_interview';

