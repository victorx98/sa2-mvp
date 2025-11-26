-- Rollback Migration: Revert meetings table from v4.1 to v4.0
-- Date: 2025-11-24

-- Step 1: Drop new indexes
DROP INDEX IF EXISTS "idx_meeting_reserve_id";
DROP INDEX IF EXISTS "idx_meeting_owner";

-- Step 2: Drop foreign key constraint (if it was added)
ALTER TABLE "meetings"
  DROP CONSTRAINT IF EXISTS "fk_meetings_owner";

-- Step 3: Drop CHECK constraints added in v4.1
ALTER TABLE "meetings"
  DROP CONSTRAINT IF EXISTS "meetings_status_check",
  DROP CONSTRAINT IF EXISTS "meetings_provider_check",
  DROP CONSTRAINT IF EXISTS "meetings_duration_check";

-- Step 4: Revert status from 'cancelled' back to 'expired' (if needed)
UPDATE "meetings"
SET "status" = 'expired'
WHERE "status" = 'cancelled';

-- Step 5: Rename reserve_id back to meeting_id
ALTER TABLE "meetings"
  RENAME COLUMN "reserve_id" TO "meeting_id";

-- Step 6: Drop v4.1 columns
ALTER TABLE "meetings"
  DROP COLUMN IF EXISTS "owner_id";

-- Step 7: Re-add old status constraint (if needed for v4.0)
ALTER TABLE "meetings"
  ADD CONSTRAINT "meetings_status_check"
  CHECK ("status" IN ('scheduled', 'active', 'ended', 'expired'));

