-- Migration: Add feishu_calendar_event_id to session tables
-- Date: 2025-12-24
-- Description: Store Feishu calendar event ID for calendar updates and cancellations

-- Add feishu_calendar_event_id to regular_mentoring_sessions
ALTER TABLE regular_mentoring_sessions 
  ADD COLUMN IF NOT EXISTS feishu_calendar_event_id VARCHAR(255);

-- Add feishu_calendar_event_id to ai_career_sessions
ALTER TABLE ai_career_sessions 
  ADD COLUMN IF NOT EXISTS feishu_calendar_event_id VARCHAR(255);

-- Add feishu_calendar_event_id to gap_analysis_sessions
ALTER TABLE gap_analysis_sessions 
  ADD COLUMN IF NOT EXISTS feishu_calendar_event_id VARCHAR(255);

-- Add feishu_calendar_event_id to class_sessions
ALTER TABLE class_sessions 
  ADD COLUMN IF NOT EXISTS feishu_calendar_event_id VARCHAR(255);

-- Add feishu_calendar_event_id to comm_sessions
ALTER TABLE comm_sessions 
  ADD COLUMN IF NOT EXISTS feishu_calendar_event_id VARCHAR(255);

-- Add comments
COMMENT ON COLUMN regular_mentoring_sessions.feishu_calendar_event_id IS 'Feishu calendar event ID for external calendar integration';
COMMENT ON COLUMN ai_career_sessions.feishu_calendar_event_id IS 'Feishu calendar event ID for external calendar integration';
COMMENT ON COLUMN gap_analysis_sessions.feishu_calendar_event_id IS 'Feishu calendar event ID for external calendar integration';
COMMENT ON COLUMN class_sessions.feishu_calendar_event_id IS 'Feishu calendar event ID for external calendar integration';
COMMENT ON COLUMN comm_sessions.feishu_calendar_event_id IS 'Feishu calendar event ID for external calendar integration';

