-- ============================================
-- Add billed_by column to resumes table
-- ============================================

-- Add billed_by column to track who billed the resume
ALTER TABLE "resumes" 
  ADD COLUMN "billed_by" uuid;

-- Add foreign key constraint
ALTER TABLE "resumes" 
  ADD CONSTRAINT "resumes_billed_by_user_id_fk" 
  FOREIGN KEY ("billed_by") REFERENCES "user"("id") 
  ON DELETE NO ACTION ON UPDATE NO ACTION;

-- Add comment for documentation
COMMENT ON COLUMN resumes.billed_by IS 'Counselor who billed the resume';

