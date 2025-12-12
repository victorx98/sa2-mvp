-- Add service_type to session tables
ALTER TABLE regular_mentoring_sessions ADD COLUMN service_type VARCHAR(50);
ALTER TABLE gap_analysis_sessions ADD COLUMN service_type VARCHAR(50);
ALTER TABLE ai_career_sessions ADD COLUMN service_type VARCHAR(50);
ALTER TABLE class_sessions ADD COLUMN service_type VARCHAR(50);

-- Add title to service_references
ALTER TABLE service_references ADD COLUMN title VARCHAR(255);

-- Add indexes for service_type
CREATE INDEX idx_regular_session_service_type ON regular_mentoring_sessions(service_type);
CREATE INDEX idx_gap_session_service_type ON gap_analysis_sessions(service_type);
CREATE INDEX idx_ai_career_session_service_type ON ai_career_sessions(service_type);
CREATE INDEX idx_class_session_service_type ON class_sessions(service_type);

-- Drop the CHECK constraint on service_type (allow any business-level service type)
ALTER TABLE service_references DROP CONSTRAINT IF EXISTS chk_service_ref_type;

