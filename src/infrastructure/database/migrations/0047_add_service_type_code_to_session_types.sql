-- Drop old CHECK constraint that limits code to 'External' or 'Internal'
ALTER TABLE "session_types" DROP CONSTRAINT IF EXISTS "chk_session_types_code";

-- Add service_type_code field to session_types
ALTER TABLE "session_types" ADD COLUMN "service_type_code" varchar(50);

-- Migrate existing data: set service_type_code from code, then update code to proper values
-- For External -> regular_mentoring
UPDATE "session_types" 
SET "service_type_code" = "code", 
    "code" = 'regular_mentoring'
WHERE "code" = 'External' AND "name" = 'Regular Mentoring';

-- For Internal -> ai_career or regular_mentoring
UPDATE "session_types" 
SET "service_type_code" = "code",
    "code" = CASE 
      WHEN "name" = 'AI Career' THEN 'ai_career'
      WHEN "name" = 'Regular Mentoring' THEN 'regular_mentoring'
      ELSE LOWER(REPLACE("name", ' ', '_'))
    END
WHERE "code" = 'Internal';

-- For Gap Analysis
UPDATE "session_types"
SET "service_type_code" = 'External',
    "code" = 'gap_analysis'
WHERE "name" = 'Gap Analysis' AND "code" = 'External';

-- Set service_type_code to NOT NULL
ALTER TABLE "session_types" ALTER COLUMN "service_type_code" SET NOT NULL;

-- Add foreign key constraint
ALTER TABLE "session_types" ADD CONSTRAINT "session_types_service_type_code_service_types_code_fk" 
  FOREIGN KEY ("service_type_code") REFERENCES "service_types"("code");

-- Add index for service_type_code
CREATE INDEX IF NOT EXISTS "idx_session_types_service_type_code" ON "session_types" ("service_type_code");

-- Add composite unique constraint
ALTER TABLE "session_types" ADD CONSTRAINT "uq_session_types_service_type_code_code" 
  UNIQUE ("service_type_code", "code");

