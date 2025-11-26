-- Migration: Create service_references table
-- Description: Records all completed services (Immutable, Shared Primary Key)

CREATE TABLE IF NOT EXISTS service_references (
  id UUID PRIMARY KEY, -- Shared primary key from business tables
  service_type VARCHAR(50) NOT NULL,
  student_user_id UUID NOT NULL,
  provider_user_id UUID NOT NULL,
  consumed_units DECIMAL(10, 2) NOT NULL,
  unit_type VARCHAR(20) NOT NULL,
  completed_time TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Foreign keys
  CONSTRAINT fk_service_ref_student FOREIGN KEY (student_user_id) REFERENCES "user"(id),
  CONSTRAINT fk_service_ref_provider FOREIGN KEY (provider_user_id) REFERENCES "user"(id),
  
  -- CHECK constraints
  CONSTRAINT chk_service_ref_type CHECK (service_type IN (
    'regular_mentoring',
    'gap_analysis',
    'ai_career',
    'comm_session',
    'class_session',
    'resume',
    'recommendation_letter'
  )),
  CONSTRAINT chk_service_ref_unit_type CHECK (unit_type IN ('hour', 'count')),
  CONSTRAINT chk_service_ref_consumed_units CHECK (consumed_units > 0)
);

-- Create indexes
CREATE INDEX idx_service_ref_type ON service_references(service_type);
CREATE INDEX idx_service_ref_student ON service_references(student_user_id, completed_time DESC);
CREATE INDEX idx_service_ref_provider ON service_references(provider_user_id, completed_time DESC);
CREATE INDEX idx_service_ref_completed_time ON service_references(completed_time);

COMMENT ON TABLE service_references IS 'Immutable record of all completed services for billing and contract tracking';
COMMENT ON COLUMN service_references.id IS 'Shared primary key from business tables (e.g., session ID)';
COMMENT ON COLUMN service_references.service_type IS 'Type of service completed';
COMMENT ON COLUMN service_references.consumed_units IS 'Quantity consumed (hours or count)';
COMMENT ON COLUMN service_references.unit_type IS 'Unit of measurement: hour or count';


