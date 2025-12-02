-- Create classes table
CREATE TABLE IF NOT EXISTS classes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  type VARCHAR(20) NOT NULL CHECK (type IN ('session', 'enroll')),
  status VARCHAR(20) NOT NULL CHECK (status IN ('Active', 'Inactive')) DEFAULT 'Active',
  start_date TIMESTAMPTZ NOT NULL,
  end_date TIMESTAMPTZ NOT NULL,
  description TEXT,
  total_sessions INTEGER NOT NULL CHECK (total_sessions >= 0) DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes for classes
CREATE INDEX idx_class_type ON classes(type);
CREATE INDEX idx_class_status ON classes(status);
CREATE INDEX idx_class_start_date ON classes(start_date DESC);

-- Add constraint for date validation
ALTER TABLE classes ADD CONSTRAINT check_class_dates CHECK (end_date > start_date);

-- Create class_mentors_prices table
CREATE TABLE IF NOT EXISTS class_mentors_prices (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  class_id UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  mentor_user_id UUID NOT NULL,
  price_per_session DECIMAL(10, 2) NOT NULL CHECK (price_per_session >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (class_id, mentor_user_id)
);

-- Create indexes for class_mentors_prices
CREATE INDEX idx_class_mentors_class ON class_mentors_prices(class_id);
CREATE INDEX idx_class_mentors_mentor ON class_mentors_prices(mentor_user_id);

-- Create class_students table
CREATE TABLE IF NOT EXISTS class_students (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  class_id UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  student_user_id UUID NOT NULL,
  enrolled_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (class_id, student_user_id)
);

-- Create indexes for class_students
CREATE INDEX idx_class_students_class ON class_students(class_id);
CREATE INDEX idx_class_students_student ON class_students(student_user_id);

-- Create class_counselors table
CREATE TABLE IF NOT EXISTS class_counselors (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  class_id UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  counselor_user_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (class_id, counselor_user_id)
);

-- Create indexes for class_counselors
CREATE INDEX idx_class_counselors_class ON class_counselors(class_id);
CREATE INDEX idx_class_counselors_counselor ON class_counselors(counselor_user_id);

-- Create class_sessions table
CREATE TABLE IF NOT EXISTS class_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  class_id UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  meeting_id UUID UNIQUE,
  session_type VARCHAR(50) NOT NULL CHECK (session_type = 'class_session') DEFAULT 'class_session',
  mentor_user_id UUID NOT NULL,
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

-- Create indexes for class_sessions
CREATE INDEX idx_class_session_class ON class_sessions(class_id);
CREATE INDEX idx_class_session_meeting ON class_sessions(meeting_id);
CREATE INDEX idx_class_session_mentor ON class_sessions(mentor_user_id);
CREATE INDEX idx_class_session_status ON class_sessions(status);
CREATE INDEX idx_class_session_scheduled ON class_sessions(scheduled_at DESC);

-- Add foreign key constraint for mentor validation (导师必须是该班级已注册的导师之一)
ALTER TABLE class_sessions 
ADD CONSTRAINT fk_class_session_mentor_in_class 
FOREIGN KEY (class_id, mentor_user_id) 
REFERENCES class_mentors_prices(class_id, mentor_user_id);

-- Create service_references table (if not exists)
CREATE TABLE IF NOT EXISTS service_references (
  id UUID PRIMARY KEY,
  service_type VARCHAR(50) NOT NULL CHECK (service_type IN ('regular_mentoring', 'gap_analysis', 'ai_career', 'comm_session', 'class_session', 'resume', 'recommendation_letter')),
  student_user_id UUID,
  provider_user_id UUID NOT NULL,
  consumed_units DECIMAL(10, 2) NOT NULL CHECK (consumed_units > 0),
  unit_type VARCHAR(20) NOT NULL CHECK (unit_type IN ('hour', 'count')),
  completed_time TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes for service_references
CREATE INDEX IF NOT EXISTS idx_service_ref_type ON service_references(service_type);
CREATE INDEX IF NOT EXISTS idx_service_ref_student ON service_references(student_user_id, completed_time DESC);
CREATE INDEX IF NOT EXISTS idx_service_ref_provider ON service_references(provider_user_id, completed_time DESC);
CREATE INDEX IF NOT EXISTS idx_service_ref_completed_time ON service_references(completed_time);

