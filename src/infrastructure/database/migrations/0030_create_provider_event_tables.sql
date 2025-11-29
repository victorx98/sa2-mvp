-- Migration: Create provider-specific event tables and rename meeting_events
-- This migration implements the split-table architecture for event storage
-- Date: 2024-11-28

-- =====================================================================
-- Step 1: Create feishu_meeting_events table
-- =====================================================================
CREATE TABLE IF NOT EXISTS feishu_meeting_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Meeting identification
  meeting_id VARCHAR(255) NOT NULL,
  meeting_no VARCHAR(20) NOT NULL,
  event_id VARCHAR(255) NOT NULL,
  
  -- Event type
  event_type VARCHAR(100) NOT NULL,
  
  -- Meeting information
  meeting_topic VARCHAR(255),
  
  -- Event data
  event_data JSONB NOT NULL,
  
  -- Timestamps
  occurred_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Unique constraint on event_id for deduplication
  CONSTRAINT uq_feishu_event_id UNIQUE (event_id)
);

-- Create indexes for feishu_meeting_events
CREATE INDEX idx_feishu_meeting_no ON feishu_meeting_events(meeting_no);
CREATE INDEX idx_feishu_meeting_id ON feishu_meeting_events(meeting_id);
CREATE INDEX idx_feishu_event_type ON feishu_meeting_events(event_type);
CREATE INDEX idx_feishu_occurred_at ON feishu_meeting_events(occurred_at);

-- Add comment
COMMENT ON TABLE feishu_meeting_events IS 'Feishu webhook events archive table. For audit/compliance only - business logic should not query this table.';

-- =====================================================================
-- Step 2: Create zoom_meeting_events table
-- =====================================================================
CREATE TABLE IF NOT EXISTS zoom_meeting_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Meeting identification
  meeting_id VARCHAR(255) NOT NULL,  -- Zoom meeting ID from payload.object.id
  event_id VARCHAR(255) NOT NULL,    -- Zoom event UUID from payload.object.uuid
  
  -- Event type
  event_type VARCHAR(100) NOT NULL,
  
  -- Meeting information
  meeting_topic VARCHAR(255),
  
  -- Event data
  event_data JSONB NOT NULL,
  
  -- Timestamps
  occurred_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Unique constraint on event_id for deduplication
  CONSTRAINT uq_zoom_event_id UNIQUE (event_id)
);

-- Create indexes for zoom_meeting_events
CREATE INDEX idx_zoom_meeting_id ON zoom_meeting_events(meeting_id);
CREATE INDEX idx_zoom_event_type ON zoom_meeting_events(event_type);
CREATE INDEX idx_zoom_occurred_at ON zoom_meeting_events(occurred_at);

-- Add comment
COMMENT ON TABLE zoom_meeting_events IS 'Zoom webhook events archive table. For audit/compliance only - business logic should not query this table.';
COMMENT ON COLUMN zoom_meeting_events.meeting_id IS 'Zoom meeting ID from payload.object.id (e.g., "1234567890")';
COMMENT ON COLUMN zoom_meeting_events.event_id IS 'Zoom event UUID from payload.object.uuid for deduplication (e.g., "4444AAAiAAAAAiAiAiiAii==")';

-- =====================================================================
-- Step 3: Migrate existing data from meeting_events to feishu_meeting_events
-- (Only if meeting_events table exists and has Feishu data)
-- =====================================================================
DO $$
BEGIN
  -- Check if meeting_events table exists
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'meeting_events') THEN
    -- Migrate Feishu events from old meeting_events table
    INSERT INTO feishu_meeting_events (
      id,
      meeting_id,
      meeting_no,
      event_id,
      event_type,
      meeting_topic,
      event_data,
      occurred_at,
      created_at
    )
    SELECT 
      id,
      meeting_id,
      COALESCE(meeting_no, ''),  -- meeting_no might be nullable in old schema
      event_id,
      event_type,
      meeting_topic,
      event_data,
      occurred_at,
      created_at
    FROM meeting_events
    WHERE provider = 'feishu'
    ON CONFLICT (event_id) DO NOTHING;  -- Skip duplicates

    RAISE NOTICE 'Migrated % Feishu events from meeting_events to feishu_meeting_events',
      (SELECT COUNT(*) FROM meeting_events WHERE provider = 'feishu');
  END IF;
END $$;

-- =====================================================================
-- Step 4: Drop old meeting_events table
-- WARNING: Only drop if you're sure all data is migrated!
-- Comment out this section if you want to keep the old table for backup
-- =====================================================================
-- DROP TABLE IF EXISTS meeting_events CASCADE;

-- =====================================================================
-- Step 5: Add comments for documentation
-- =====================================================================
COMMENT ON COLUMN feishu_meeting_events.event_data IS 'Complete raw Feishu webhook payload for audit trail and event replay';
COMMENT ON COLUMN zoom_meeting_events.event_data IS 'Complete raw Zoom webhook payload for audit trail and event replay';

