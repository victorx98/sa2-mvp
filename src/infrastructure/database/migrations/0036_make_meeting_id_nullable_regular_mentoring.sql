-- Migration: Make meeting_id nullable in regular_mentoring_sessions table
-- Purpose: Support async meeting creation flow where session is created before meeting
-- Date: 2025-12-03

ALTER TABLE regular_mentoring_sessions
  ALTER COLUMN meeting_id DROP NOT NULL;

-- Add comment documenting the change
COMMENT ON COLUMN regular_mentoring_sessions.meeting_id IS 'Foreign key to meetings table. Nullable during async meeting creation flow (PENDING_MEETING status).';

