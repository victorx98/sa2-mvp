-- Migration: Create regular_mentoring_sessions table
-- Description: Manages regular mentoring session business information and lifecycle

CREATE TABLE IF NOT EXISTS regular_mentoring_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  meeting_id UUID NOT NULL UNIQUE,
  session_type VARCHAR(50) NOT NULL DEFAULT 'regular_mentoring',
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
  CONSTRAINT fk_regular_mentoring_meeting FOREIGN KEY (meeting_id) REFERENCES meetings(id) ON DELETE CASCADE,
  CONSTRAINT fk_regular_mentoring_session_type FOREIGN KEY (session_type_id) REFERENCES session_types(id),
  CONSTRAINT fk_regular_mentoring_student FOREIGN KEY (student_user_id) REFERENCES "user"(id),
  CONSTRAINT fk_regular_mentoring_mentor FOREIGN KEY (mentor_user_id) REFERENCES "user"(id),
  CONSTRAINT fk_regular_mentoring_counselor FOREIGN KEY (created_by_counselor_id) REFERENCES "user"(id),
  
  -- CHECK constraints
  CONSTRAINT chk_regular_mentoring_session_type CHECK (session_type IN ('regular_mentoring', 'gap_analysis', 'ai_career', 'comm_session', 'class_session')),
  CONSTRAINT chk_regular_mentoring_status CHECK (status IN ('scheduled', 'completed', 'cancelled', 'deleted'))
);

-- Create indexes
CREATE INDEX idx_regular_session_meeting ON regular_mentoring_sessions(meeting_id);
CREATE INDEX idx_regular_session_type ON regular_mentoring_sessions(session_type);
CREATE INDEX idx_regular_session_type_id ON regular_mentoring_sessions(session_type_id);
CREATE INDEX idx_regular_session_status ON regular_mentoring_sessions(status);
CREATE INDEX idx_regular_session_mentor_scheduled ON regular_mentoring_sessions(mentor_user_id, scheduled_at DESC);
CREATE INDEX idx_regular_session_student_scheduled ON regular_mentoring_sessions(student_user_id, scheduled_at DESC);

COMMENT ON TABLE regular_mentoring_sessions IS 'Regular mentoring session business information and lifecycle';
COMMENT ON COLUMN regular_mentoring_sessions.session_type IS 'Technical identifier for session subtype';
COMMENT ON COLUMN regular_mentoring_sessions.session_type_id IS 'FK to session_types for business configuration';
COMMENT ON COLUMN regular_mentoring_sessions.status IS 'Session lifecycle status';
COMMENT ON COLUMN regular_mentoring_sessions.deleted_at IS 'Soft delete timestamp';


