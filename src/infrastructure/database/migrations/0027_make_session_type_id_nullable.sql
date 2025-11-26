-- Migration: Make session_type_id nullable in regular_mentoring_sessions
-- Date: 2025-11-26
-- Description: Allow session_type_id to be null until session_types lookup is implemented

-- Step 1: Remove NOT NULL constraint from session_type_id
ALTER TABLE "regular_mentoring_sessions"
  ALTER COLUMN "session_type_id" DROP NOT NULL;

-- Step 2: Add comment
COMMENT ON COLUMN "regular_mentoring_sessions"."session_type_id" IS 
  'Session type ID (FK to session_types.id) - Nullable until session_types lookup is implemented';

