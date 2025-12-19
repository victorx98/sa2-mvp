-- ============================================
-- Add service_hold_id to gap_analysis_sessions
-- ============================================

-- Add service_hold_id column
ALTER TABLE gap_analysis_sessions 
  ADD COLUMN service_hold_id UUID;

-- Add index for query performance
CREATE INDEX idx_gap_session_service_hold 
  ON gap_analysis_sessions(service_hold_id);

-- Add comment
COMMENT ON COLUMN gap_analysis_sessions.service_hold_id IS 'Reference to initial booking service hold (soft reference)';

