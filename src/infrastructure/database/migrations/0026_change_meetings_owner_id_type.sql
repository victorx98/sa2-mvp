-- Migration: Change meetings.owner_id from uuid to varchar
-- Date: 2025-11-26
-- Description: Feishu owner_id is a string (ou_xxx format), not UUID

-- Step 1: Drop the existing index
DROP INDEX IF EXISTS "idx_meeting_owner";

-- Step 2: Change column type from uuid to varchar(255)
ALTER TABLE "meetings"
  ALTER COLUMN "owner_id" TYPE varchar(255) USING "owner_id"::text;

-- Step 3: Recreate index
CREATE INDEX IF NOT EXISTS "idx_meeting_owner" ON "meetings"("owner_id");

-- Step 4: Add column comment
COMMENT ON COLUMN "meetings"."owner_id" IS 
  'Meeting owner ID - Feishu open_id/union_id format (ou_xxx), not UUID';

