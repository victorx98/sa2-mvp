-- ============================================
-- Add service_hold_id to ai_career_sessions
-- ============================================

-- Add service_hold_id column
ALTER TABLE ai_career_sessions 
  ADD COLUMN service_hold_id UUID;

-- Add index for query performance
CREATE INDEX idx_ai_career_session_service_hold 
  ON ai_career_sessions(service_hold_id);

-- Add comment
COMMENT ON COLUMN ai_career_sessions.service_hold_id IS 'Reference to initial booking service hold (soft reference)';

