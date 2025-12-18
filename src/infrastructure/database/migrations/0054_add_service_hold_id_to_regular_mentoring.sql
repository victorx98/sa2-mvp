-- 只保留索引，删除外键约束
ALTER TABLE regular_mentoring_sessions 
  ADD COLUMN service_hold_id UUID;

CREATE INDEX idx_regular_session_service_hold 
  ON regular_mentoring_sessions(service_hold_id);

COMMENT ON COLUMN regular_mentoring_sessions.service_hold_id IS 'Reference to initial booking service hold (soft reference)';