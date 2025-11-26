-- Migration: Create session_types table
-- Description: Manages session type metadata configuration (business classification, evaluation templates, billing rules)

CREATE TABLE IF NOT EXISTS session_types (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code VARCHAR(50) NOT NULL UNIQUE,
  name VARCHAR(100) NOT NULL,
  template_id UUID,
  is_billing BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes
CREATE INDEX idx_session_types_code ON session_types(code);
CREATE INDEX idx_session_types_name ON session_types(name);

-- Add CHECK constraint
ALTER TABLE session_types ADD CONSTRAINT chk_session_types_code 
  CHECK (code IN ('External', 'Internal'));

-- Insert initial data
INSERT INTO session_types (id, code, name, template_id, is_billing) VALUES
  -- External mentor sessions (billable)
  ('11111111-1111-1111-1111-111111111111', 'External', 'Regular Mentoring', NULL, TRUE),
  ('22222222-2222-2222-2222-222222222222', 'External', 'Gap Analysis', NULL, TRUE),
  
  -- Internal mentor sessions (non-billable)
  ('33333333-3333-3333-3333-333333333333', 'Internal', 'AI Career', NULL, FALSE),
  ('44444444-4444-4444-4444-444444444444', 'Internal', 'Internal Communication', NULL, FALSE)
ON CONFLICT (code) DO NOTHING;

COMMENT ON TABLE session_types IS 'Session type configuration for business classification and billing rules';
COMMENT ON COLUMN session_types.code IS 'Business classification: External or Internal';
COMMENT ON COLUMN session_types.name IS 'Session type display name';
COMMENT ON COLUMN session_types.template_id IS 'Evaluation template ID for mentor assessments';
COMMENT ON COLUMN session_types.is_billing IS 'Whether this session type triggers billing';


