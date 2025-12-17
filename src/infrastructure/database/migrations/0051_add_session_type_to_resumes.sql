-- ============================================
-- Add session_type column to resumes table
-- ============================================

-- Add session_type column
ALTER TABLE resumes 
  ADD COLUMN session_type VARCHAR(50);

-- Set default value for existing records (optional, adjust as needed)
UPDATE resumes 
  SET session_type = 'Resume' 
  WHERE session_type IS NULL;

-- Make column NOT NULL after setting defaults
ALTER TABLE resumes 
  ALTER COLUMN session_type SET NOT NULL;

-- Add index for session_type
CREATE INDEX IF NOT EXISTS idx_resumes_session_type ON resumes(session_type);

-- Add comment
COMMENT ON COLUMN resumes.session_type IS 'Session type for billing service reference (e.g., regular_mentoring, gap_analysis)';

