-- ============================================
-- Recommendation Letters Table
-- ============================================

CREATE TABLE IF NOT EXISTS "recomm_letters" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "student_user_id" uuid NOT NULL,
  "letter_type_id" uuid NOT NULL,
  "package_type_id" uuid,
  "service_type" varchar(50) NOT NULL,
  "description" varchar(1000),
  "file_url" varchar(1000) NOT NULL,
  "file_name" varchar(500) NOT NULL,
  "status" varchar(20) NOT NULL CHECK ("status" IN ('uploaded', 'deleted')),
  "mentor_user_id" uuid,
  "billed_at" timestamp with time zone,
  "uploaded_by" uuid NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

-- Foreign keys
ALTER TABLE "recomm_letters" 
  ADD CONSTRAINT "recomm_letters_student_user_id_user_id_fk" 
  FOREIGN KEY ("student_user_id") REFERENCES "user"("id") 
  ON DELETE NO ACTION ON UPDATE NO ACTION;

ALTER TABLE "recomm_letters" 
  ADD CONSTRAINT "recomm_letters_letter_type_id_recomm_letter_types_id_fk" 
  FOREIGN KEY ("letter_type_id") REFERENCES "recomm_letter_types"("id") 
  ON DELETE NO ACTION ON UPDATE NO ACTION;

ALTER TABLE "recomm_letters" 
  ADD CONSTRAINT "recomm_letters_package_type_id_recomm_letter_types_id_fk" 
  FOREIGN KEY ("package_type_id") REFERENCES "recomm_letter_types"("id") 
  ON DELETE NO ACTION ON UPDATE NO ACTION;

ALTER TABLE "recomm_letters" 
  ADD CONSTRAINT "recomm_letters_mentor_user_id_user_id_fk" 
  FOREIGN KEY ("mentor_user_id") REFERENCES "user"("id") 
  ON DELETE NO ACTION ON UPDATE NO ACTION;

ALTER TABLE "recomm_letters" 
  ADD CONSTRAINT "recomm_letters_uploaded_by_user_id_fk" 
  FOREIGN KEY ("uploaded_by") REFERENCES "user"("id") 
  ON DELETE NO ACTION ON UPDATE NO ACTION;

-- Indexes
CREATE INDEX IF NOT EXISTS "idx_recomm_letters_student_user_id" ON "recomm_letters" ("student_user_id");
CREATE INDEX IF NOT EXISTS "idx_recomm_letters_letter_type_id" ON "recomm_letters" ("letter_type_id");
CREATE INDEX IF NOT EXISTS "idx_recomm_letters_service_type" ON "recomm_letters" ("service_type");
CREATE INDEX IF NOT EXISTS "idx_recomm_letters_status" ON "recomm_letters" ("status");
CREATE INDEX IF NOT EXISTS "idx_recomm_letters_mentor_user_id" ON "recomm_letters" ("mentor_user_id");

