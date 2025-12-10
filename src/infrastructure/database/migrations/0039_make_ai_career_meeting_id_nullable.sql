-- Migration: Make meeting_id nullable in ai_career_sessions table
-- Purpose: Support async meeting creation flow for AI career sessions
-- Date: 2025-12-03

ALTER TABLE ai_career_sessions
  ALTER COLUMN meeting_id DROP NOT NULL;

-- Add comment documenting the change
COMMENT ON COLUMN ai_career_sessions.meeting_id IS 'Foreign key to meetings table. Nullable during async meeting creation flow (PENDING_MEETING status).';

