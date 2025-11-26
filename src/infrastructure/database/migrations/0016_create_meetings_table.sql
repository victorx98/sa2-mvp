-- Create meetings table
-- This is the Core Meeting Layer that manages physical meeting resources
-- Design: Table-per-Type pattern where meetings stores technical/lifecycle attributes
-- and downstream domain tables (mentoring_sessions, etc.) store business attributes

CREATE TABLE IF NOT EXISTS "meetings" (
  -- Primary key
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Meeting identification
  -- meeting_no can be reused over time (7+ days), so we use (meeting_no, provider, schedule_start_time) for uniqueness
  "meeting_no" varchar(20) NOT NULL,
  "meeting_provider" varchar(20) NOT NULL, -- 'feishu' | 'zoom'
  "meeting_id" varchar(255) NOT NULL, -- Third-party platform meeting ID

  -- Meeting details
  "topic" varchar(255) NOT NULL, -- Meeting topic/title
  "meeting_url" text NOT NULL, -- Meeting join URL

  -- Scheduled time
  -- schedule_start_time is critical for deduplication queries
  "schedule_start_time" timestamp with time zone NOT NULL,
  "schedule_duration" integer NOT NULL, -- Duration in minutes

  -- Lifecycle status
  "status" varchar(20) NOT NULL DEFAULT 'scheduled', -- 'scheduled' | 'active' | 'ended' | 'expired'

  -- Actual duration (calculated after meeting ends)
  "actual_duration" integer, -- Duration in seconds

  -- Meeting time segments (JSONB array of {start, end} objects)
  -- Stores actual time periods when the meeting was active
  "meeting_time_list" jsonb DEFAULT '[]'::jsonb,

  -- Recording
  "recording_url" text, -- Recording URL (if available)

  -- Delayed detection fields
  -- Used for handling delayed meeting completion detection
  "last_meeting_ended_timestamp" timestamp with time zone, -- Last meeting.ended event timestamp
  "pending_task_id" varchar(255), -- Pending delayed task ID

  -- Event tracking
  "event_type" varchar(100), -- Last processed event type

  -- Timestamps
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,

  -- Unique constraint: meeting_no + provider + schedule_start_time
  -- This ensures we can distinguish between reused meeting numbers
  CONSTRAINT "unique_meeting_no_provider_time" UNIQUE("meeting_no", "meeting_provider", "schedule_start_time")
);

-- Index for Webhook reverse lookup: WHERE meeting_no = ? AND created_at > (NOW() - 7 DAYS)
-- This supports efficient lookups when webhooks arrive with only meeting_no
CREATE INDEX IF NOT EXISTS "idx_meeting_no_created_at" ON "meetings"("meeting_no", "created_at");

-- Index for status queries
-- Enables efficient filtering by meeting status
CREATE INDEX IF NOT EXISTS "idx_meeting_status" ON "meetings"("status");

-- Index for schedule_start_time (for deduplication queries)
-- Supports efficient time-based queries and deduplication logic
CREATE INDEX IF NOT EXISTS "idx_schedule_start_time" ON "meetings"("schedule_start_time");

