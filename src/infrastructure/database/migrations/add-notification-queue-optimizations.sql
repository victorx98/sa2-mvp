-- Migration: Optimize notification_queue table for regular mentoring notifications
-- Date: 2025-12-24
-- Description: Add reminder_type enum, change recipient to recipients (jsonb), add subject and content fields

-- Step 1: Create reminder_type enum
CREATE TYPE reminder_type AS ENUM ('three_days', 'one_day', 'three_hours');

-- Step 2: Add new columns (nullable first for migration)
ALTER TABLE notification_queue
  ADD COLUMN IF NOT EXISTS recipients jsonb,
  ADD COLUMN IF NOT EXISTS subject varchar(255),
  ADD COLUMN IF NOT EXISTS content jsonb,
  ADD COLUMN IF NOT EXISTS reminder_type reminder_type;

-- Step 3: Migrate existing data (if any)
-- Convert single recipient to recipients jsonb format
UPDATE notification_queue
SET recipients = jsonb_build_object('email', recipient)
WHERE recipients IS NULL AND recipient IS NOT NULL;

-- Step 4: Drop old columns (after data migration)
-- Note: Uncomment these lines after verifying data migration
-- ALTER TABLE notification_queue DROP COLUMN IF EXISTS recipient;
-- ALTER TABLE notification_queue DROP COLUMN IF EXISTS template;
-- ALTER TABLE notification_queue DROP COLUMN IF EXISTS data;

-- Step 5: Add NOT NULL constraints to new columns
-- Note: Uncomment these lines after data migration and backfilling
-- ALTER TABLE notification_queue ALTER COLUMN recipients SET NOT NULL;
-- ALTER TABLE notification_queue ALTER COLUMN subject SET NOT NULL;
-- ALTER TABLE notification_queue ALTER COLUMN content SET NOT NULL;

-- Step 6: Create index for efficient query
CREATE INDEX IF NOT EXISTS idx_notification_queue_pending 
  ON notification_queue(status, scheduled_time) 
  WHERE status = 'pending';

-- Step 7: Create index for session_id lookups
CREATE INDEX IF NOT EXISTS idx_notification_queue_session_id 
  ON notification_queue(session_id);

COMMENT ON TABLE notification_queue IS 'Notification queue for scheduled reminders and notifications';
COMMENT ON COLUMN notification_queue.recipients IS 'Multiple recipients in JSON format: {counselor: "c@x.com", mentor: "m@x.com", student: "s@x.com"}';
COMMENT ON COLUMN notification_queue.subject IS 'Email subject line';
COMMENT ON COLUMN notification_queue.content IS 'Email content in JSON format: {html: "...", text: "..."}';
COMMENT ON COLUMN notification_queue.reminder_type IS 'Type of reminder: three_days, one_day, or three_hours before session';

