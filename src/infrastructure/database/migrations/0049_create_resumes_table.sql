-- ============================================
-- Resume Domain - Resumes Table
-- ============================================

CREATE TABLE IF NOT EXISTS "resumes" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "student_user_id" uuid NOT NULL,
  "job_title" varchar(200) NOT NULL,
  "file_url" varchar(1000) NOT NULL,
  "file_name" varchar(500) NOT NULL,
  "status" varchar(20) DEFAULT 'uploaded' NOT NULL,
  "final_set_at" timestamp with time zone,
  "mentor_user_id" uuid,
  "billed_at" timestamp with time zone,
  "uploaded_by" uuid NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "resumes_status_check" CHECK (status IN ('uploaded', 'final', 'deleted'))
);

-- Foreign keys
ALTER TABLE "resumes" ADD CONSTRAINT "resumes_student_user_id_user_id_fk" 
  FOREIGN KEY ("student_user_id") REFERENCES "user"("id") ON DELETE cascade ON UPDATE no action;

ALTER TABLE "resumes" ADD CONSTRAINT "resumes_mentor_user_id_user_id_fk" 
  FOREIGN KEY ("mentor_user_id") REFERENCES "user"("id") ON DELETE no action ON UPDATE no action;

ALTER TABLE "resumes" ADD CONSTRAINT "resumes_uploaded_by_user_id_fk" 
  FOREIGN KEY ("uploaded_by") REFERENCES "user"("id") ON DELETE no action ON UPDATE no action;

-- Indexes
CREATE INDEX IF NOT EXISTS "idx_resumes_student_user_id" ON "resumes" ("student_user_id");
CREATE INDEX IF NOT EXISTS "idx_resumes_job_title" ON "resumes" ("job_title");
CREATE INDEX IF NOT EXISTS "idx_resumes_status" ON "resumes" ("status");
CREATE INDEX IF NOT EXISTS "idx_resumes_mentor_user_id" ON "resumes" ("mentor_user_id");
CREATE INDEX IF NOT EXISTS "idx_resumes_student_job_title" ON "resumes" ("student_user_id", "job_title");

-- Unique constraint: Only one billed resume per student per job title
CREATE UNIQUE INDEX IF NOT EXISTS "idx_resumes_unique_billed" 
  ON "resumes"("student_user_id", "job_title") 
  WHERE "mentor_user_id" IS NOT NULL;


