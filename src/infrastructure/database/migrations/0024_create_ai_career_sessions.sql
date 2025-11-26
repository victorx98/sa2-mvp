-- Migration: Create ai_career_sessions table
-- Description: Manages AI career assessment session business information and lifecycle

CREATE TABLE IF NOT EXISTS ai_career_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  meeting_id UUID NOT NULL UNIQUE,
  session_type VARCHAR(50) NOT NULL DEFAULT 'ai_career',
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
  CONSTRAINT fk_ai_career_meeting FOREIGN KEY (meeting_id) REFERENCES meetings(id) ON DELETE CASCADE,
  CONSTRAINT fk_ai_career_session_type FOREIGN KEY (session_type_id) REFERENCES session_types(id),
  CONSTRAINT fk_ai_career_student FOREIGN KEY (student_user_id) REFERENCES "user"(id),
  CONSTRAINT fk_ai_career_mentor FOREIGN KEY (mentor_user_id) REFERENCES "user"(id),
  CONSTRAINT fk_ai_career_counselor FOREIGN KEY (created_by_counselor_id) REFERENCES "user"(id),
  
  -- CHECK constraints
  CONSTRAINT chk_ai_career_session_type CHECK (session_type IN ('regular_mentoring', 'gap_analysis', 'ai_career', 'comm_session', 'class_session')),
  CONSTRAINT chk_ai_career_status CHECK (status IN ('scheduled', 'completed', 'cancelled', 'deleted'))
);

-- Create indexes
CREATE INDEX idx_ai_career_session_meeting ON ai_career_sessions(meeting_id);
CREATE INDEX idx_ai_career_session_type ON ai_career_sessions(session_type);
CREATE INDEX idx_ai_career_session_type_id ON ai_career_sessions(session_type_id);
CREATE INDEX idx_ai_career_session_status ON ai_career_sessions(status);
CREATE INDEX idx_ai_career_session_mentor_scheduled ON ai_career_sessions(mentor_user_id, scheduled_at DESC);
CREATE INDEX idx_ai_career_session_student_scheduled ON ai_career_sessions(student_user_id, scheduled_at DESC);

COMMENT ON TABLE ai_career_sessions IS 'AI career assessment session business information and lifecycle';
COMMENT ON COLUMN ai_career_sessions.ai_summaries IS 'AI-generated career assessment summaries';


