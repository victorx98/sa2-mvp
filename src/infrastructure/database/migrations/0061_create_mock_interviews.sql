-- Migration: Create mock_interviews table
-- Description: AI-powered mock interview sessions for students

CREATE TABLE IF NOT EXISTS mock_interviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_type VARCHAR(50) NOT NULL DEFAULT 'mock_interview',
  student_user_id UUID NOT NULL,
  created_by_counselor_id UUID,
  title VARCHAR(255) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'scheduled',
  scheduled_at TIMESTAMP NOT NULL,
  schedule_duration INTEGER NOT NULL DEFAULT 60,
  completed_at TIMESTAMP,
  cancelled_at TIMESTAMP,
  deleted_at TIMESTAMP,
  interview_type VARCHAR(50),
  language VARCHAR(10),
  company_name VARCHAR(255),
  job_title VARCHAR(255),
  job_description TEXT,
  resume_text TEXT,
  student_info JSONB DEFAULT '{}',
  interview_questions JSONB DEFAULT '[]',
  interview_instructions TEXT,
  system_instruction TEXT,
  service_type VARCHAR(50),
  ai_summaries JSONB DEFAULT '[]',
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  
  CONSTRAINT mock_interviews_status_check CHECK (status IN ('scheduled', 'completed', 'cancelled', 'deleted'))
);

-- Indexes
CREATE INDEX idx_mock_interview_student_scheduled ON mock_interviews(student_user_id, scheduled_at);
CREATE INDEX idx_mock_interview_status ON mock_interviews(status);
CREATE INDEX idx_mock_interview_created_by_counselor ON mock_interviews(created_by_counselor_id);

-- Comments
COMMENT ON TABLE mock_interviews IS 'AI-powered mock interview sessions';
COMMENT ON COLUMN mock_interviews.schedule_duration IS 'Duration in minutes';
COMMENT ON COLUMN mock_interviews.status IS 'scheduled, completed, cancelled, deleted';

