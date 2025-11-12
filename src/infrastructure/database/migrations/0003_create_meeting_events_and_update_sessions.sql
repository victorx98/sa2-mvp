-- Session Domain and Meeting Providers Module update
-- 1. Remove meeting_id field from sessions table (only exists after meeting starts in webhook)
-- 2. Create meeting_events table for storing all webhook events

-- =================================================================================
-- Remove meeting_id column from sessions table
-- =================================================================================

-- Drop the index on meeting_id
DROP INDEX IF EXISTS idx_session_meeting;

-- Remove the meeting_id column
ALTER TABLE sessions DROP COLUMN IF EXISTS meeting_id;

-- =================================================================================
-- Update indexes for sessions table
-- =================================================================================

-- Create index on meeting_no as the key field for webhook event lookup
CREATE INDEX IF NOT EXISTS idx_session_meeting_no ON sessions(meeting_no);

-- Update comment for meeting_no
COMMENT ON COLUMN sessions.meeting_no IS 'Feishu meeting number (9 digits) - key field for webhook event association. meeting_id is stored in meeting_events table after meeting starts.';

-- =================================================================================
-- Create meeting_events table for storing webhook events
-- =================================================================================

-- Meeting event table for tracking all Feishu/Zoom webhook events
-- Generic event store used by all session types (session, comm_session, class_session)
-- Domains query by meeting_no to identify their events
CREATE TABLE IF NOT EXISTS meeting_events (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,

  -- Meeting identification
  meeting_id VARCHAR(255) NOT NULL,                    -- Feishu/Zoom meeting ID
  event_id VARCHAR(255) NOT NULL UNIQUE,             -- Unique event ID for deduplication

  -- Event source and type
  provider VARCHAR(20) NOT NULL,                      -- 'feishu' | 'zoom'
  event_type VARCHAR(100) NOT NULL,                   -- Event type (e.g., vc.meeting.join_meeting_v1)

  -- Operator information
  operator_id VARCHAR(255),                           -- User ID who triggered the event
  operator_role INTEGER,                              -- 1 = host, 2 = participant

  -- Meeting information (extracted from event)
  meeting_no VARCHAR(20),                             -- Feishu meeting number (Feishu only)
  meeting_topic VARCHAR(255),                         -- Meeting topic/title
  meeting_start_time TIMESTAMPTZ,                     -- Meeting start time
  meeting_end_time TIMESTAMPTZ,                       -- Meeting end time

  -- Event data
  event_data JSONB NOT NULL,                          -- Complete raw webhook payload for audit trail

  -- Event occurrence time (from webhook header.create_time)
  occurred_at TIMESTAMPTZ NOT NULL,

  -- Record creation time
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- =================================================================================
-- Create indexes for meeting_events table
-- =================================================================================

-- Index for meeting_no lookups (key query pattern for domains)
CREATE INDEX IF NOT EXISTS idx_meeting_no ON meeting_events(meeting_no);

-- Event type index for filtering by event type
CREATE INDEX IF NOT EXISTS idx_meeting_event_type ON meeting_events(event_type, provider);

-- Index for looking up all events of a meeting
CREATE INDEX IF NOT EXISTS idx_meeting_event_lookup ON meeting_events(meeting_id, event_type);

-- Index for operator-based queries
CREATE INDEX IF NOT EXISTS idx_meeting_event_operator ON meeting_events(operator_id, occurred_at);

-- Index for time-based queries
CREATE INDEX IF NOT EXISTS idx_meeting_event_time ON meeting_events(occurred_at DESC);

-- Unique constraint on event_id for deduplication
CREATE UNIQUE INDEX IF NOT EXISTS uq_meeting_event_id ON meeting_events(event_id);

-- =================================================================================
-- Add comments for documentation
-- =================================================================================

COMMENT ON TABLE meeting_events IS 'Meeting event table for tracking all Feishu/Zoom webhook events. Generic event store used by all session types (session, comm_session, class_session). Domains query by meeting_no to identify their events.';
COMMENT ON COLUMN meeting_events.meeting_id IS 'Feishu/Zoom meeting ID';
COMMENT ON COLUMN meeting_events.event_id IS 'Unique event ID for deduplication';
COMMENT ON COLUMN meeting_events.meeting_no IS 'Feishu meeting number (9 digits) - key field for webhook event association';
COMMENT ON COLUMN meeting_events.event_data IS 'Complete raw webhook payload for audit trail';

