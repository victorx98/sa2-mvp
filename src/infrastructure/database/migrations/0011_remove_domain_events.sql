-- Drop domain_events table and related indexes
-- This migration removes the Outbox pattern implementation
-- as we've moved to direct event publishing via EventEmitter

-- Drop the domain_events table
DROP TABLE IF EXISTS "domain_events";

-- Note: Indexes are automatically dropped when the table is dropped
-- No additional cleanup needed