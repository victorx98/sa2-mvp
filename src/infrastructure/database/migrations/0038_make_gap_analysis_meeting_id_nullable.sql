-- Migration: Make meeting_id nullable in gap_analysis_sessions table
-- Purpose: Support async meeting creation flow for gap analysis sessions
-- Date: 2025-12-03

ALTER TABLE gap_analysis_sessions
  ALTER COLUMN meeting_id DROP NOT NULL;

-- Add comment documenting the change
COMMENT ON COLUMN gap_analysis_sessions.meeting_id IS 'Foreign key to meetings table. Nullable during async meeting creation flow (PENDING_MEETING status).';

