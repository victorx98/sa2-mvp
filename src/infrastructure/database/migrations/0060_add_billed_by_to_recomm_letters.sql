-- ============================================
-- Add billed_by column to recomm_letters table
-- ============================================

-- Add billed_by column to track who billed the recommendation letter
ALTER TABLE "recomm_letters" 
  ADD COLUMN "billed_by" uuid;

-- Add foreign key constraint
ALTER TABLE "recomm_letters" 
  ADD CONSTRAINT "recomm_letters_billed_by_user_id_fk" 
  FOREIGN KEY ("billed_by") REFERENCES "user"("id") 
  ON DELETE NO ACTION ON UPDATE NO ACTION;

-- Add comment for documentation
COMMENT ON COLUMN recomm_letters.billed_by IS 'Counselor who billed the recommendation letter';

