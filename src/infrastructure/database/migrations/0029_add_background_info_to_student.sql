-- Add background_info column to student table
ALTER TABLE "student"
  ADD COLUMN IF NOT EXISTS "background_info" text;
