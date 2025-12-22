-- ============================================
-- Recommendation Letter Types Table
-- ============================================

-- Drop table if exists (to handle schema changes)
DROP TABLE IF EXISTS "recomm_letter_types" CASCADE;

CREATE TABLE "recomm_letter_types" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "type_code" varchar(50) NOT NULL UNIQUE,
  "type_name" varchar(100) NOT NULL,
  "service_type_code" varchar(50) NOT NULL,
  "parent_id" uuid,
  "active" boolean DEFAULT true NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

-- Foreign key to service_types
ALTER TABLE "recomm_letter_types" 
  ADD CONSTRAINT "recomm_letter_types_service_type_code_service_types_code_fk" 
  FOREIGN KEY ("service_type_code") REFERENCES "service_types"("code") 
  ON DELETE NO ACTION ON UPDATE NO ACTION;

-- Self-referencing foreign key for hierarchical structure
ALTER TABLE "recomm_letter_types" ADD CONSTRAINT "recomm_letter_types_parent_id_fk" 
  FOREIGN KEY ("parent_id") REFERENCES "recomm_letter_types"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- Indexes
CREATE INDEX IF NOT EXISTS "idx_recomm_letter_types_type_code" ON "recomm_letter_types" ("type_code");
CREATE INDEX IF NOT EXISTS "idx_recomm_letter_types_service_type_code" ON "recomm_letter_types" ("service_type_code");
CREATE INDEX IF NOT EXISTS "idx_recomm_letter_types_parent_id" ON "recomm_letter_types" ("parent_id");

-- ============================================
-- Seed Data: Insert recommendation letter types
-- ============================================

-- Level 1: Online Package (OnlineLetter service type)
INSERT INTO "recomm_letter_types" ("type_code", "type_name", "service_type_code", "parent_id", "active") 
VALUES ('online_package', '网申推荐信(Package)', 'OnlineLetter', NULL, true);

-- Level 2: Online Package Children
INSERT INTO "recomm_letter_types" ("type_code", "type_name", "service_type_code", "parent_id", "active") 
VALUES 
  ('5_online', '5 Online', 'OnlineLetter', (SELECT id FROM "recomm_letter_types" WHERE type_code = 'online_package'), true),
  ('10_online', '10 Online', 'OnlineLetter', (SELECT id FROM "recomm_letter_types" WHERE type_code = 'online_package'), true),
  ('online_class_package', '班课打包', 'OnlineLetter', (SELECT id FROM "recomm_letter_types" WHERE type_code = 'online_package'), true),
  ('online_class_single_50_20', '班课单课时费+50手签+20网', 'OnlineLetter', (SELECT id FROM "recomm_letter_types" WHERE type_code = 'online_package'), true),
  ('online_class_single_50_50', '班课单课时费+50手签+50网', 'OnlineLetter', (SELECT id FROM "recomm_letter_types" WHERE type_code = 'online_package'), true),
  ('online_class_single_100_50', '班课单课时费+100手签+50网', 'OnlineLetter', (SELECT id FROM "recomm_letter_types" WHERE type_code = 'online_package'), true);

-- Level 1: Paper Package (PaperLetter service type)
INSERT INTO "recomm_letter_types" ("type_code", "type_name", "service_type_code", "parent_id", "active") 
VALUES ('paper_package', '纸质推荐信(Package)', 'PaperLetter', NULL, true);

-- Level 2: Paper Package Children
INSERT INTO "recomm_letter_types" ("type_code", "type_name", "service_type_code", "parent_id", "active") 
VALUES 
  ('pta_5_sessions', 'PTA Package(5 Sessions)', 'PaperLetter', (SELECT id FROM "recomm_letter_types" WHERE type_code = 'paper_package'), true),
  ('paper_class_package', '班课打包', 'PaperLetter', (SELECT id FROM "recomm_letter_types" WHERE type_code = 'paper_package'), true),
  ('paper_class_single_50_20', '班课单课时费+50手签+20网', 'PaperLetter', (SELECT id FROM "recomm_letter_types" WHERE type_code = 'paper_package'), true),
  ('paper_class_single_50_50', '班课单课时费+50手签+50网', 'PaperLetter', (SELECT id FROM "recomm_letter_types" WHERE type_code = 'paper_package'), true),
  ('paper_class_single_100_50', '班课单课时费+100手签+50网', 'PaperLetter', (SELECT id FROM "recomm_letter_types" WHERE type_code = 'paper_package'), true);

-- Level 1: Paper Letter (No children, PaperLetter service type)
INSERT INTO "recomm_letter_types" ("type_code", "type_name", "service_type_code", "parent_id", "active") 
VALUES ('paper_letter', '纸质推荐信', 'PaperLetter', NULL, true);

-- Level 1: Online Letter (No children, OnlineLetter service type)
INSERT INTO "recomm_letter_types" ("type_code", "type_name", "service_type_code", "parent_id", "active") 
VALUES ('online_letter', '网申推荐信', 'OnlineLetter', NULL, true);

