-- Migration: Update meetings table to v4.1
-- Date: 2025-11-25
-- Changes:
-- 1. Remove meeting_id field (replaced by reserve_id following Feishu API naming)
-- 2. Make reserve_id NOT NULL (Feishu reserve_id, Zoom meeting_id)
-- 3. Add owner_id field (meeting owner, usually mentor)
-- 4. Remove auto_record field (passed to provider, not saved in DB)
-- 5. Update status enum: replace 'expired' with 'cancelled'
-- 6. Add new indexes for reserve_id and owner_id

-- Step 1: Drop old reserve_id if it exists (clean slate)
ALTER TABLE "meetings"
  DROP COLUMN IF EXISTS "reserve_id";

-- Step 2: Add owner_id field
ALTER TABLE "meetings"
  ADD COLUMN IF NOT EXISTS "owner_id" uuid;

-- Step 3: Rename meeting_id to reserve_id (preserve existing data)
-- This is the cleanest approach - direct rename
ALTER TABLE "meetings"
  RENAME COLUMN "meeting_id" TO "reserve_id";

-- Step 4: Ensure reserve_id is NOT NULL (should already be, but make it explicit)
ALTER TABLE "meetings"
  ALTER COLUMN "reserve_id" SET NOT NULL;

-- Step 5: Drop auto_record field if it exists (not needed in v4.1)
ALTER TABLE "meetings"
  DROP COLUMN IF EXISTS "auto_record";

-- Step 7: Update status enum
-- First, update any existing 'expired' status to 'cancelled'
UPDATE "meetings" 
SET "status" = 'cancelled' 
WHERE "status" = 'expired';

-- Add CHECK constraint for new status values
ALTER TABLE "meetings" 
  DROP CONSTRAINT IF EXISTS "meetings_status_check";

ALTER TABLE "meetings"
  ADD CONSTRAINT "meetings_status_check" 
  CHECK ("status" IN ('scheduled', 'active', 'ended', 'cancelled'));

-- Step 8: Add CHECK constraint for meeting_provider
ALTER TABLE "meetings"
  DROP CONSTRAINT IF EXISTS "meetings_provider_check";

ALTER TABLE "meetings"
  ADD CONSTRAINT "meetings_provider_check"
  CHECK ("meeting_provider" IN ('feishu', 'zoom'));

-- Step 9: Add CHECK constraint for schedule_duration
ALTER TABLE "meetings"
  DROP CONSTRAINT IF EXISTS "meetings_duration_check";

ALTER TABLE "meetings"
  ADD CONSTRAINT "meetings_duration_check"
  CHECK ("schedule_duration" >= 30 AND "schedule_duration" <= 180);

-- Step 11: Create new indexes
CREATE INDEX IF NOT EXISTS "idx_meeting_reserve_id" ON "meetings"("reserve_id");
CREATE INDEX IF NOT EXISTS "idx_meeting_owner" ON "meetings"("owner_id");

-- Step 12: Add foreign key constraint for owner_id (assuming users table exists)
-- Uncomment if users table is ready
-- ALTER TABLE "meetings"
--   ADD CONSTRAINT "fk_meetings_owner"
--   FOREIGN KEY ("owner_id") REFERENCES "users"("id")
--   ON DELETE SET NULL;

-- Step 13: Add comments to table
COMMENT ON TABLE "meetings" IS 'Core Meeting Module v4.1 - Manages third-party video conference resources';
COMMENT ON COLUMN "meetings"."reserve_id" IS 'Reserve ID - Feishu reserve_id or Zoom meeting_id (for update/cancel)';
COMMENT ON COLUMN "meetings"."owner_id" IS 'Meeting owner ID (usually mentor)';
COMMENT ON COLUMN "meetings"."status" IS 'Meeting status: scheduled, active, ended, cancelled';

