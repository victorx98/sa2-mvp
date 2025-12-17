-- ============================================
-- Add description column to resumes table
-- ============================================

-- Add description column
ALTER TABLE resumes 
  ADD COLUMN description VARCHAR(1000);

-- Add comment
COMMENT ON COLUMN resumes.description IS 'Description for operations like set final, billing, etc.';

