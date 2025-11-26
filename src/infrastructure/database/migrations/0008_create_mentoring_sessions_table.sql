-- Create mentoring_sessions table
-- Migration: 0008_create_mentoring_sessions_table
-- Description: Create business domain table for mentoring sessions
-- References: meetings table (Core Layer)

CREATE TABLE IF NOT EXISTS "mentoring_sessions" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "meeting_id" UUID NOT NULL,
  "student_id" UUID NOT NULL,
  "mentor_id" UUID NOT NULL,
  "status" VARCHAR(20) NOT NULL DEFAULT 'scheduled',
  "service_duration" INTEGER,
  "feedback" TEXT,
  "rating" INTEGER,
  "topic" VARCHAR(255),
  "notes" TEXT,
  "created_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  "updated_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  "deleted_at" TIMESTAMP WITH TIME ZONE,
  
  -- Foreign key to meetings table
  CONSTRAINT "fk_mentoring_meeting" FOREIGN KEY ("meeting_id") REFERENCES "meetings"("id") ON DELETE RESTRICT,
  
  -- Unique constraint: one mentoring session per meeting
  CONSTRAINT "unique_mentoring_meeting_id" UNIQUE ("meeting_id")
);

-- Create indexes for query optimization
CREATE INDEX IF NOT EXISTS "idx_mentoring_student_created_at" ON "mentoring_sessions" ("student_id", "created_at");
CREATE INDEX IF NOT EXISTS "idx_mentoring_mentor_created_at" ON "mentoring_sessions" ("mentor_id", "created_at");
CREATE INDEX IF NOT EXISTS "idx_mentoring_status" ON "mentoring_sessions" ("status");
CREATE INDEX IF NOT EXISTS "idx_mentoring_deleted_at" ON "mentoring_sessions" ("deleted_at");

-- Add comments for documentation
COMMENT ON TABLE "mentoring_sessions" IS 'Business domain table for mentoring sessions, references meetings table via meeting_id FK';
COMMENT ON COLUMN "mentoring_sessions"."meeting_id" IS 'Foreign key to meetings.id (Core Layer), 1:1 relationship';
COMMENT ON COLUMN "mentoring_sessions"."service_duration" IS 'Service duration in seconds (for billing calculations)';
COMMENT ON COLUMN "mentoring_sessions"."rating" IS 'Student rating of the session (1-5)';
COMMENT ON COLUMN "mentoring_sessions"."status" IS 'Business status: scheduled | completed | cancelled | deleted';

