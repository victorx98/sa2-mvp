-- Create comm_sessions table for internal communication sessions
-- Features:
-- - Not billable (not registered to service_references)
-- - Independent lifecycle management
-- - Simplified business logic (no downstream event publishing)
CREATE TABLE IF NOT EXISTS comm_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  meeting_id UUID NOT NULL UNIQUE,
  session_type VARCHAR(50) NOT NULL CHECK (session_type = 'comm_session') DEFAULT 'comm_session',
  student_user_id UUID NOT NULL,
  mentor_user_id UUID,
  counselor_user_id UUID,
  created_by_counselor_id UUID NOT NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  status VARCHAR(20) NOT NULL CHECK (status IN ('scheduled', 'completed', 'cancelled', 'deleted')) DEFAULT 'scheduled',
  scheduled_at TIMESTAMPTZ NOT NULL,
  completed_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  deleted_at TIMESTAMPTZ,
  ai_summaries JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes for efficient querying
-- 1. Index for finding by meeting ID (unique, used by event listener)
CREATE INDEX idx_comm_session_meeting ON comm_sessions(meeting_id);

-- 2. Composite indexes for list queries
-- - Mentor's sessions ordered by scheduled_at DESC
CREATE INDEX idx_comm_session_mentor_scheduled ON comm_sessions(mentor_user_id, scheduled_at DESC);

-- - Student's sessions ordered by scheduled_at DESC
CREATE INDEX idx_comm_session_student_scheduled ON comm_sessions(student_user_id, scheduled_at DESC);

-- 3. Index for status filtering
CREATE INDEX idx_comm_session_status ON comm_sessions(status);

-- 4. Index for created_by_counselor_id (for auditing or analytics)
CREATE INDEX idx_comm_session_created_by_counselor ON comm_sessions(created_by_counselor_id);

