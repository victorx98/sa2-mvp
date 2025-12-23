-- Migration: Add mock_interview to calendar_session_type enum
-- Description: Extend calendar session types to support mock interview scheduling
-- Note: Split into separate transaction to avoid enum transaction issues in PostgreSQL

-- Step 1: Add the new type to the enum
ALTER TYPE calendar_session_type ADD VALUE 'mock_interview' AFTER 'class_session';

-- Note: The CHECK constraint update must be done in a separate migration
-- due to PostgreSQL's restriction on using new enum values in the same transaction

