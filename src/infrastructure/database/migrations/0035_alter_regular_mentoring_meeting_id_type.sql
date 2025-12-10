-- Migration: Change meeting_id column type from UUID to VARCHAR
-- Reason: Support both UUID format and provider-specific IDs (e.g., Feishu numeric strings)
-- Date: 2025-12-02

-- Drop the foreign key constraint first if it exists
ALTER TABLE regular_mentoring_sessions DROP CONSTRAINT IF EXISTS regular_mentoring_sessions_meeting_id_meetings_id_fk;

-- Change the column type from UUID to VARCHAR
ALTER TABLE regular_mentoring_sessions 
ALTER COLUMN meeting_id TYPE VARCHAR(255);

-- Add the foreign key back if meetings table still exists
-- Note: This may fail if meeting_id values don't match UUID format in meetings table
-- In that case, comment out the line below
-- ALTER TABLE regular_mentoring_sessions 
-- ADD CONSTRAINT regular_mentoring_sessions_meeting_id_meetings_id_fk 
-- FOREIGN KEY (meeting_id) REFERENCES meetings(id) ON DELETE CASCADE;

