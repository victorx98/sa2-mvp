-- Fix: Rename calendar_user_type column to user_type to match schema
-- This migration fixes the column name mismatch in the calendar table

DO $$
BEGIN
  -- Check if the old column name exists
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_name = 'calendar' AND column_name = 'calendar_user_type') THEN
    -- Rename the column to match the schema
    ALTER TABLE "calendar" RENAME COLUMN "calendar_user_type" TO "user_type";
    RAISE NOTICE 'Column calendar_user_type renamed to user_type';
  ELSE
    RAISE NOTICE 'Column calendar_user_type does not exist, skipping';
  END IF;
END $$;
