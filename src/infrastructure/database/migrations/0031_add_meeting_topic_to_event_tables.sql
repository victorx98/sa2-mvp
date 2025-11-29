-- Migration: Add meeting_topic field to event tables
-- This migration adds meeting_topic field to both feishu_meeting_events and zoom_meeting_events
-- Date: 2024-11-28

-- =====================================================================
-- Step 1: Add meeting_topic to feishu_meeting_events (if table exists)
-- =====================================================================
DO $$
BEGIN
  -- Check if feishu_meeting_events table exists
  IF EXISTS (
    SELECT FROM information_schema.tables 
    WHERE table_name = 'feishu_meeting_events'
  ) THEN
    -- Check if meeting_topic column doesn't exist yet
    IF NOT EXISTS (
      SELECT FROM information_schema.columns 
      WHERE table_name = 'feishu_meeting_events' 
      AND column_name = 'meeting_topic'
    ) THEN
      ALTER TABLE feishu_meeting_events 
      ADD COLUMN meeting_topic VARCHAR(255);
      
      RAISE NOTICE 'Added meeting_topic column to feishu_meeting_events';
    ELSE
      RAISE NOTICE 'meeting_topic column already exists in feishu_meeting_events';
    END IF;
  ELSE
    RAISE NOTICE 'feishu_meeting_events table does not exist, skipping';
  END IF;
END $$;

-- =====================================================================
-- Step 2: Add meeting_topic to zoom_meeting_events (if table exists)
-- =====================================================================
DO $$
BEGIN
  -- Check if zoom_meeting_events table exists
  IF EXISTS (
    SELECT FROM information_schema.tables 
    WHERE table_name = 'zoom_meeting_events'
  ) THEN
    -- Check if meeting_topic column doesn't exist yet
    IF NOT EXISTS (
      SELECT FROM information_schema.columns 
      WHERE table_name = 'zoom_meeting_events' 
      AND column_name = 'meeting_topic'
    ) THEN
      ALTER TABLE zoom_meeting_events 
      ADD COLUMN meeting_topic VARCHAR(255);
      
      RAISE NOTICE 'Added meeting_topic column to zoom_meeting_events';
    ELSE
      RAISE NOTICE 'meeting_topic column already exists in zoom_meeting_events';
    END IF;
  ELSE
    RAISE NOTICE 'zoom_meeting_events table does not exist, skipping';
  END IF;
END $$;

-- =====================================================================
-- Step 3: Backfill meeting_topic from event_data JSONB (optional)
-- =====================================================================
-- Uncomment below if you want to backfill existing data

-- -- Backfill Feishu events
-- UPDATE feishu_meeting_events
-- SET meeting_topic = event_data->'event'->'meeting'->>'topic'
-- WHERE meeting_topic IS NULL
--   AND event_data->'event'->'meeting'->>'topic' IS NOT NULL;

-- -- Backfill Zoom events
-- UPDATE zoom_meeting_events
-- SET meeting_topic = event_data->'payload'->'object'->>'topic'
-- WHERE meeting_topic IS NULL
--   AND event_data->'payload'->'object'->>'topic' IS NOT NULL;

-- =====================================================================
-- Step 4: Add comments
-- =====================================================================
COMMENT ON COLUMN feishu_meeting_events.meeting_topic IS 'Meeting topic/title extracted from Feishu event for easier querying';
COMMENT ON COLUMN zoom_meeting_events.meeting_topic IS 'Meeting topic/title extracted from Zoom event for easier querying';

