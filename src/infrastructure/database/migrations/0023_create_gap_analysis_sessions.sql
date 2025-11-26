-- Migration: Create gap_analysis_sessions table
-- Description: Manages gap analysis session business information and lifecycle

CREATE TABLE IF NOT EXISTS gap_analysis_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  meeting_id UUID NOT NULL UNIQUE,
  session_type VARCHAR(50) NOT NULL DEFAULT 'gap_analysis',
  session_type_id UUID NOT NULL,
  student_user_id UUID NOT NULL,
  mentor_user_id UUID NOT NULL,
  created_by_counselor_id UUID,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  status VARCHAR(20) NOT NULL DEFAULT 'scheduled',
  scheduled_at TIMESTAMPTZ NOT NULL,
  completed_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  deleted_at TIMESTAMPTZ,
  ai_summaries JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Foreign keys
  CONSTRAINT fk_gap_analysis_meeting FOREIGN KEY (meeting_id) REFERENCES meetings(id) ON DELETE CASCADE,
  CONSTRAINT fk_gap_analysis_session_type FOREIGN KEY (session_type_id) REFERENCES session_types(id),
  CONSTRAINT fk_gap_analysis_student FOREIGN KEY (student_user_id) REFERENCES "user"(id),
  CONSTRAINT fk_gap_analysis_mentor FOREIGN KEY (mentor_user_id) REFERENCES "user"(id),
  CONSTRAINT fk_gap_analysis_counselor FOREIGN KEY (created_by_counselor_id) REFERENCES "user"(id),
  
  -- CHECK constraints
  CONSTRAINT chk_gap_analysis_session_type CHECK (session_type IN ('regular_mentoring', 'gap_analysis', 'ai_career', 'comm_session', 'class_session')),
  CONSTRAINT chk_gap_analysis_status CHECK (status IN ('scheduled', 'completed', 'cancelled', 'deleted'))
);

-- Create indexes
CREATE INDEX idx_gap_session_meeting ON gap_analysis_sessions(meeting_id);
CREATE INDEX idx_gap_session_type ON gap_analysis_sessions(session_type);
CREATE INDEX idx_gap_session_type_id ON gap_analysis_sessions(session_type_id);
CREATE INDEX idx_gap_session_status ON gap_analysis_sessions(status);
CREATE INDEX idx_gap_session_mentor_scheduled ON gap_analysis_sessions(mentor_user_id, scheduled_at DESC);
CREATE INDEX idx_gap_session_student_scheduled ON gap_analysis_sessions(student_user_id, scheduled_at DESC);

COMMENT ON TABLE gap_analysis_sessions IS 'Gap analysis session business information and lifecycle';
COMMENT ON COLUMN gap_analysis_sessions.ai_summaries IS 'AI-generated session summaries';


