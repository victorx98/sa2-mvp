-- Migration: Add Calendar v5.3 fields
-- Adds session_type, title, scheduled_start_time, metadata fields for enhanced calendar functionality
-- Design: Table-per-Type evolution - session_type replaces legacy 'type' field

-- Phase 0: Update enum types to support new values
-- Add 'completed' to calendar_status enum
ALTER TYPE calendar_status ADD VALUE IF NOT EXISTS 'completed';

-- Create calendar_session_type enum for v5.3
DO $$ BEGIN
  CREATE TYPE calendar_session_type AS ENUM (
    'regular_mentoring',
    'gap_analysis',
    'ai_career',
    'comm_session',
    'class_session'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Phase 1: Add new columns (nullable initially for backward compatibility)
ALTER TABLE "calendar" 
  ADD COLUMN IF NOT EXISTS "session_type" calendar_session_type,
  ADD COLUMN IF NOT EXISTS "title" varchar(255),
  ADD COLUMN IF NOT EXISTS "scheduled_start_time" timestamp with time zone,
  ADD COLUMN IF NOT EXISTS "metadata" jsonb DEFAULT '{}'::jsonb;

-- Phase 2: Populate new fields from existing data
-- scheduled_start_time: Extract from time_range
-- title: Use reason as temporary value (should be updated by application)
-- session_type: Map from legacy 'type' field (cast to enum type)
UPDATE "calendar" 
SET 
  scheduled_start_time = LOWER(time_range),
  title = COALESCE(reason, 'Untitled'),
  session_type = (CASE 
    WHEN type = 'session' THEN 'regular_mentoring'
    WHEN type = 'class_session' THEN 'class_session'
    WHEN type = 'comm_session' THEN 'comm_session'
    ELSE 'regular_mentoring'
  END)::calendar_session_type
WHERE scheduled_start_time IS NULL;

-- Phase 3: Add NOT NULL constraints (after data population)
ALTER TABLE "calendar" 
  ALTER COLUMN "session_type" SET NOT NULL,
  ALTER COLUMN "title" SET NOT NULL,
  ALTER COLUMN "scheduled_start_time" SET NOT NULL;

-- Phase 4: Drop old CHECK constraint for session_type (now using enum type)
ALTER TABLE "calendar" DROP CONSTRAINT IF EXISTS "check_calendar_session_type";

-- Phase 5: Drop old CHECK constraint for status (enum already updated in Phase 0)
ALTER TABLE "calendar" DROP CONSTRAINT IF EXISTS "status_check";
ALTER TABLE "calendar" DROP CONSTRAINT IF EXISTS "check_calendar_status";

-- Phase 6: Create new index for optimized queries
-- idx_calendar_user_scheduled uses the new scheduled_start_time field
CREATE INDEX IF NOT EXISTS "idx_calendar_user_scheduled" 
  ON "calendar"("user_id", "scheduled_start_time" DESC);

-- Phase 7: Drop legacy 'type' column (testing phase - safe to remove)
-- Drop the check constraint first
ALTER TABLE "calendar" DROP CONSTRAINT IF EXISTS "type_check";

-- Drop the legacy type column
ALTER TABLE "calendar" DROP COLUMN IF EXISTS "type";

