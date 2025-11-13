-- IMPORTANT: Execute this in 2 separate batches in Supabase SQL Editor
-- ================================================================

-- BATCH 1: Add new enum value FIRST (execute this alone, then run BATCH 2)
ALTER TYPE "public"."calendar_type" ADD VALUE IF NOT EXISTS 'comm_session';

-- ================================================================
-- BATCH 2: Execute the following AFTER BATCH 1 is committed
-- ================================================================

-- Step 2: Rename column
ALTER TABLE "calendar" RENAME COLUMN "calendar_user_type" TO "user_type";

-- Step 3: Drop existing constraints before altering columns
ALTER TABLE "calendar" DROP CONSTRAINT IF EXISTS "user_type_check";
ALTER TABLE "calendar" DROP CONSTRAINT IF EXISTS "type_check";

-- Step 4: Drop old index before altering the column
DROP INDEX IF EXISTS "idx_calendar_user";

-- Step 5: Alter user_id column type to uuid
ALTER TABLE "calendar" ALTER COLUMN "user_id" SET DATA TYPE uuid;

-- Step 6: Recreate index with new column name
CREATE INDEX IF NOT EXISTS "idx_calendar_user" ON "calendar" USING btree ("user_id","user_type");

-- Step 7: Recreate constraints with updated enum values
ALTER TABLE "calendar" ADD CONSTRAINT "user_type_check" CHECK (user_type IN ('mentor', 'student', 'counselor'));

ALTER TABLE "calendar" ADD CONSTRAINT "type_check" CHECK (type IN ('session', 'class_session', 'comm_session'));