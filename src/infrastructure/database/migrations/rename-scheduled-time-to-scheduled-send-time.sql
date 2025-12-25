-- Migration: Rename scheduled_time to scheduled_send_time in notification_queue table
-- Purpose: Clarify field meaning - this is when notification should be SENT, not when session is scheduled
-- Date: 2025-12-25

-- Rename column
ALTER TABLE notification_queue 
RENAME COLUMN scheduled_time TO scheduled_send_time;

-- Update comment for clarity
COMMENT ON COLUMN notification_queue.scheduled_send_time IS 'When the notification should be sent (e.g., 3 days before session)';

