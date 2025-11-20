-- Session Meeting Time Tracking Refactor
-- Remove old time tracking fields and introduce new meeting_time_list and actual_service_duration
-- Support multi-segment sessions with accurate service duration calculation

-- =================================================================================
-- Drop old columns from sessions table
-- =================================================================================

-- Drop old time tracking columns
ALTER TABLE sessions DROP COLUMN IF EXISTS actual_start_time;
ALTER TABLE sessions DROP COLUMN IF EXISTS actual_end_time;
ALTER TABLE sessions DROP COLUMN IF EXISTS mentor_total_duration_seconds;
ALTER TABLE sessions DROP COLUMN IF EXISTS student_total_duration_seconds;
ALTER TABLE sessions DROP COLUMN IF EXISTS effective_tutoring_duration_seconds;
ALTER TABLE sessions DROP COLUMN IF EXISTS mentor_join_count;
ALTER TABLE sessions DROP COLUMN IF EXISTS student_join_count;

-- =================================================================================
-- Add new columns for meeting time tracking
-- =================================================================================

-- Add meeting_time_list column (array of meeting time segments for multi-segment sessions)
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS meeting_time_list JSONB DEFAULT '[]';

-- Add actual_service_duration column (total service duration in minutes)
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS actual_service_duration INTEGER;

-- =================================================================================
-- Add comments for documentation
-- =================================================================================

COMMENT ON COLUMN sessions.meeting_time_list IS 'Array of meeting time segments. Each segment contains startTime and endTime. Supports multi-segment sessions where mentor/student disconnects and reconnects.';
COMMENT ON COLUMN sessions.actual_service_duration IS 'Actual service duration in minutes, calculated as the sum of all meeting time segments. Reflects real tutoring time delivered.';

