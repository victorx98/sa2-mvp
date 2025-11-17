-- 迁移脚本：将id和外键id字段从varchar改为uuid
-- 注意：此脚本需要按顺序执行，因为存在外键依赖关系

-- 1. 修改 user 表
-- 1.1 删除 user 表上可能存在的自引用外键约束（如果存在）
DO $$ 
BEGIN
    -- 删除 created_by 的外键约束（如果存在）
    IF EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname LIKE '%user_created_by%' 
        AND conrelid = 'user'::regclass
    ) THEN
        ALTER TABLE "user" DROP CONSTRAINT IF EXISTS "user_created_by_user_id_fk";
    END IF;
    
    -- 删除 updated_by 的外键约束（如果存在）
    IF EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname LIKE '%user_updated_by%' 
        AND conrelid = 'user'::regclass
    ) THEN
        ALTER TABLE "user" DROP CONSTRAINT IF EXISTS "user_updated_by_user_id_fk";
    END IF;
END $$;

-- 1.2 清理空字符串数据（仅在字段为varchar时执行）
DO $$ 
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'user' 
        AND column_name = 'created_by' 
        AND data_type = 'character varying'
    ) THEN
        UPDATE "user" SET "created_by" = NULL WHERE "created_by" = '';
    END IF;
    
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'user' 
        AND column_name = 'updated_by' 
        AND data_type = 'character varying'
    ) THEN
        UPDATE "user" SET "updated_by" = NULL WHERE "updated_by" = '';
    END IF;
END $$;

-- 1.3 修改 user 表的字段类型（仅在字段不是uuid时执行）
DO $$ 
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'user' 
        AND column_name = 'id' 
        AND data_type != 'uuid'
    ) THEN
        ALTER TABLE "user" ALTER COLUMN "id" TYPE uuid USING "id"::uuid;
    END IF;
    
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'user' 
        AND column_name = 'created_by' 
        AND data_type != 'uuid'
    ) THEN
        ALTER TABLE "user" ALTER COLUMN "created_by" TYPE uuid USING "created_by"::uuid;
    END IF;
    
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'user' 
        AND column_name = 'updated_by' 
        AND data_type != 'uuid'
    ) THEN
        ALTER TABLE "user" ALTER COLUMN "updated_by" TYPE uuid USING "updated_by"::uuid;
    END IF;
END $$;

-- 1.4 重新添加 user 表的自引用外键约束
ALTER TABLE "user" 
    ADD CONSTRAINT "user_created_by_user_id_fk" 
    FOREIGN KEY ("created_by") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "user" 
    ADD CONSTRAINT "user_updated_by_user_id_fk" 
    FOREIGN KEY ("updated_by") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- 2. 修改 student 表
-- 2.1 删除 student 表的外键约束
DO $$ 
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname LIKE '%student_user_id%' 
        AND conrelid = 'student'::regclass
    ) THEN
        ALTER TABLE "student" DROP CONSTRAINT IF EXISTS "student_user_id_user_id_fk";
    END IF;
    
    IF EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname LIKE '%student_created_by%' 
        AND conrelid = 'student'::regclass
    ) THEN
        ALTER TABLE "student" DROP CONSTRAINT IF EXISTS "student_created_by_user_id_fk";
    END IF;
    
    IF EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname LIKE '%student_updated_by%' 
        AND conrelid = 'student'::regclass
    ) THEN
        ALTER TABLE "student" DROP CONSTRAINT IF EXISTS "student_updated_by_user_id_fk";
    END IF;
END $$;

-- 2.2 清理空字符串数据（仅在字段为varchar时执行）
DO $$ 
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'student' 
        AND column_name = 'user_id' 
        AND data_type = 'character varying'
    ) THEN
        UPDATE "student" SET "user_id" = NULL WHERE "user_id" = '';
    END IF;
    
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'student' 
        AND column_name = 'created_by' 
        AND data_type = 'character varying'
    ) THEN
        UPDATE "student" SET "created_by" = NULL WHERE "created_by" = '';
    END IF;
    
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'student' 
        AND column_name = 'updated_by' 
        AND data_type = 'character varying'
    ) THEN
        UPDATE "student" SET "updated_by" = NULL WHERE "updated_by" = '';
    END IF;
END $$;

-- 2.3 修改 student 表的字段类型
ALTER TABLE "student" 
    ALTER COLUMN "id" TYPE uuid USING "id"::uuid,
    ALTER COLUMN "user_id" TYPE uuid USING "user_id"::uuid,
    ALTER COLUMN "created_by" TYPE uuid USING "created_by"::uuid,
    ALTER COLUMN "updated_by" TYPE uuid USING "updated_by"::uuid;

-- 2.4 重新添加 student 表的外键约束
ALTER TABLE "student" 
    ADD CONSTRAINT "student_user_id_user_id_fk" 
    FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "student" 
    ADD CONSTRAINT "student_created_by_user_id_fk" 
    FOREIGN KEY ("created_by") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "student" 
    ADD CONSTRAINT "student_updated_by_user_id_fk" 
    FOREIGN KEY ("updated_by") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- 3. 修改 mentor 表
-- 3.1 删除 mentor 表的外键约束
DO $$ 
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname LIKE '%mentor_user_id%' 
        AND conrelid = 'mentor'::regclass
    ) THEN
        ALTER TABLE "mentor" DROP CONSTRAINT IF EXISTS "mentor_user_id_user_id_fk";
    END IF;
    
    IF EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname LIKE '%mentor_created_by%' 
        AND conrelid = 'mentor'::regclass
    ) THEN
        ALTER TABLE "mentor" DROP CONSTRAINT IF EXISTS "mentor_created_by_user_id_fk";
    END IF;
    
    IF EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname LIKE '%mentor_updated_by%' 
        AND conrelid = 'mentor'::regclass
    ) THEN
        ALTER TABLE "mentor" DROP CONSTRAINT IF EXISTS "mentor_updated_by_user_id_fk";
    END IF;
END $$;

-- 3.2 清理空字符串数据（仅在字段为varchar时执行）
DO $$ 
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'mentor' 
        AND column_name = 'user_id' 
        AND data_type = 'character varying'
    ) THEN
        UPDATE "mentor" SET "user_id" = NULL WHERE "user_id" = '';
    END IF;
    
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'mentor' 
        AND column_name = 'created_by' 
        AND data_type = 'character varying'
    ) THEN
        UPDATE "mentor" SET "created_by" = NULL WHERE "created_by" = '';
    END IF;
    
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'mentor' 
        AND column_name = 'updated_by' 
        AND data_type = 'character varying'
    ) THEN
        UPDATE "mentor" SET "updated_by" = NULL WHERE "updated_by" = '';
    END IF;
END $$;

-- 3.3 修改 mentor 表的字段类型
ALTER TABLE "mentor" 
    ALTER COLUMN "id" TYPE uuid USING "id"::uuid,
    ALTER COLUMN "user_id" TYPE uuid USING "user_id"::uuid,
    ALTER COLUMN "created_by" TYPE uuid USING "created_by"::uuid,
    ALTER COLUMN "updated_by" TYPE uuid USING "updated_by"::uuid;

-- 3.4 重新添加 mentor 表的外键约束
ALTER TABLE "mentor" 
    ADD CONSTRAINT "mentor_user_id_user_id_fk" 
    FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "mentor" 
    ADD CONSTRAINT "mentor_created_by_user_id_fk" 
    FOREIGN KEY ("created_by") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "mentor" 
    ADD CONSTRAINT "mentor_updated_by_user_id_fk" 
    FOREIGN KEY ("updated_by") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- 4. 修改 student_mentor 表
-- 4.1 删除 student_mentor 表的外键约束
DO $$ 
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname LIKE '%student_mentor_student_id%' 
        AND conrelid = 'student_mentor'::regclass
    ) THEN
        ALTER TABLE "student_mentor" DROP CONSTRAINT IF EXISTS "student_mentor_student_id_student_id_fk";
    END IF;
    
    IF EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname LIKE '%student_mentor_mentor_id%' 
        AND conrelid = 'student_mentor'::regclass
    ) THEN
        ALTER TABLE "student_mentor" DROP CONSTRAINT IF EXISTS "student_mentor_mentor_id_mentor_id_fk";
    END IF;
    
    IF EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname LIKE '%student_mentor_created_by%' 
        AND conrelid = 'student_mentor'::regclass
    ) THEN
        ALTER TABLE "student_mentor" DROP CONSTRAINT IF EXISTS "student_mentor_created_by_user_id_fk";
    END IF;
    
    IF EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname LIKE '%student_mentor_updated_by%' 
        AND conrelid = 'student_mentor'::regclass
    ) THEN
        ALTER TABLE "student_mentor" DROP CONSTRAINT IF EXISTS "student_mentor_updated_by_user_id_fk";
    END IF;
END $$;

-- 4.2 清理空字符串数据（仅在字段为varchar时执行）
DO $$ 
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'student_mentor' 
        AND column_name = 'student_id' 
        AND data_type = 'character varying'
    ) THEN
        UPDATE "student_mentor" SET "student_id" = NULL WHERE "student_id" = '';
    END IF;
    
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'student_mentor' 
        AND column_name = 'mentor_id' 
        AND data_type = 'character varying'
    ) THEN
        UPDATE "student_mentor" SET "mentor_id" = NULL WHERE "mentor_id" = '';
    END IF;
    
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'student_mentor' 
        AND column_name = 'created_by' 
        AND data_type = 'character varying'
    ) THEN
        UPDATE "student_mentor" SET "created_by" = NULL WHERE "created_by" = '';
    END IF;
    
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'student_mentor' 
        AND column_name = 'updated_by' 
        AND data_type = 'character varying'
    ) THEN
        UPDATE "student_mentor" SET "updated_by" = NULL WHERE "updated_by" = '';
    END IF;
END $$;

-- 4.3 修改 student_mentor 表的字段类型
ALTER TABLE "student_mentor" 
    ALTER COLUMN "id" TYPE uuid USING "id"::uuid,
    ALTER COLUMN "student_id" TYPE uuid USING "student_id"::uuid,
    ALTER COLUMN "mentor_id" TYPE uuid USING "mentor_id"::uuid,
    ALTER COLUMN "created_by" TYPE uuid USING "created_by"::uuid,
    ALTER COLUMN "updated_by" TYPE uuid USING "updated_by"::uuid;

-- 4.4 重新添加 student_mentor 表的外键约束
ALTER TABLE "student_mentor" 
    ADD CONSTRAINT "student_mentor_student_id_student_id_fk" 
    FOREIGN KEY ("student_id") REFERENCES "student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "student_mentor" 
    ADD CONSTRAINT "student_mentor_mentor_id_mentor_id_fk" 
    FOREIGN KEY ("mentor_id") REFERENCES "mentor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "student_mentor" 
    ADD CONSTRAINT "student_mentor_created_by_user_id_fk" 
    FOREIGN KEY ("created_by") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "student_mentor" 
    ADD CONSTRAINT "student_mentor_updated_by_user_id_fk" 
    FOREIGN KEY ("updated_by") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- 5. 修改 counselor 表（需要在 student_counselor 之前修改，因为 student_counselor 引用了它）
-- 5.1 删除 counselor 表的外键约束
DO $$ 
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname LIKE '%counselor_user_id%' 
        AND conrelid = 'counselor'::regclass
    ) THEN
        ALTER TABLE "counselor" DROP CONSTRAINT IF EXISTS "counselor_user_id_user_id_fk";
    END IF;
    
    IF EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname LIKE '%counselor_created_by%' 
        AND conrelid = 'counselor'::regclass
    ) THEN
        ALTER TABLE "counselor" DROP CONSTRAINT IF EXISTS "counselor_created_by_user_id_fk";
    END IF;
    
    IF EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname LIKE '%counselor_updated_by%' 
        AND conrelid = 'counselor'::regclass
    ) THEN
        ALTER TABLE "counselor" DROP CONSTRAINT IF EXISTS "counselor_updated_by_user_id_fk";
    END IF;
END $$;

-- 5.2 清理空字符串数据（仅在字段为varchar时执行）
DO $$ 
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'counselor' 
        AND column_name = 'user_id' 
        AND data_type = 'character varying'
    ) THEN
        UPDATE "counselor" SET "user_id" = NULL WHERE "user_id" = '';
    END IF;
    
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'counselor' 
        AND column_name = 'created_by' 
        AND data_type = 'character varying'
    ) THEN
        UPDATE "counselor" SET "created_by" = NULL WHERE "created_by" = '';
    END IF;
    
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'counselor' 
        AND column_name = 'updated_by' 
        AND data_type = 'character varying'
    ) THEN
        UPDATE "counselor" SET "updated_by" = NULL WHERE "updated_by" = '';
    END IF;
END $$;

-- 5.3 修改 counselor 表的字段类型
ALTER TABLE "counselor" 
    ALTER COLUMN "id" TYPE uuid USING "id"::uuid,
    ALTER COLUMN "user_id" TYPE uuid USING "user_id"::uuid,
    ALTER COLUMN "created_by" TYPE uuid USING "created_by"::uuid,
    ALTER COLUMN "updated_by" TYPE uuid USING "updated_by"::uuid;

-- 5.4 重新添加 counselor 表的外键约束
ALTER TABLE "counselor" 
    ADD CONSTRAINT "counselor_user_id_user_id_fk" 
    FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "counselor" 
    ADD CONSTRAINT "counselor_created_by_user_id_fk" 
    FOREIGN KEY ("created_by") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "counselor" 
    ADD CONSTRAINT "counselor_updated_by_user_id_fk" 
    FOREIGN KEY ("updated_by") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- 6. 修改 student_counselor 表
-- 6.1 删除 student_counselor 表的外键约束
DO $$ 
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname LIKE '%student_counselor_student_id%' 
        AND conrelid = 'student_counselor'::regclass
    ) THEN
        ALTER TABLE "student_counselor" DROP CONSTRAINT IF EXISTS "student_counselor_student_id_student_id_fk";
    END IF;
    
    IF EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname LIKE '%student_counselor_counselor_id%' 
        AND conrelid = 'student_counselor'::regclass
    ) THEN
        ALTER TABLE "student_counselor" DROP CONSTRAINT IF EXISTS "student_counselor_counselor_id_counselor_id_fk";
    END IF;
    
    IF EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname LIKE '%student_counselor_created_by%' 
        AND conrelid = 'student_counselor'::regclass
    ) THEN
        ALTER TABLE "student_counselor" DROP CONSTRAINT IF EXISTS "student_counselor_created_by_user_id_fk";
    END IF;
    
    IF EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname LIKE '%student_counselor_updated_by%' 
        AND conrelid = 'student_counselor'::regclass
    ) THEN
        ALTER TABLE "student_counselor" DROP CONSTRAINT IF EXISTS "student_counselor_updated_by_user_id_fk";
    END IF;
END $$;

-- 6.2 清理空字符串数据（仅在字段为varchar时执行）
DO $$ 
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'student_counselor' 
        AND column_name = 'student_id' 
        AND data_type = 'character varying'
    ) THEN
        UPDATE "student_counselor" SET "student_id" = NULL WHERE "student_id" = '';
    END IF;
    
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'student_counselor' 
        AND column_name = 'counselor_id' 
        AND data_type = 'character varying'
    ) THEN
        UPDATE "student_counselor" SET "counselor_id" = NULL WHERE "counselor_id" = '';
    END IF;
    
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'student_counselor' 
        AND column_name = 'created_by' 
        AND data_type = 'character varying'
    ) THEN
        UPDATE "student_counselor" SET "created_by" = NULL WHERE "created_by" = '';
    END IF;
    
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'student_counselor' 
        AND column_name = 'updated_by' 
        AND data_type = 'character varying'
    ) THEN
        UPDATE "student_counselor" SET "updated_by" = NULL WHERE "updated_by" = '';
    END IF;
END $$;

-- 6.3 修改 student_counselor 表的字段类型
ALTER TABLE "student_counselor" 
    ALTER COLUMN "id" TYPE uuid USING "id"::uuid,
    ALTER COLUMN "student_id" TYPE uuid USING "student_id"::uuid,
    ALTER COLUMN "counselor_id" TYPE uuid USING "counselor_id"::uuid,
    ALTER COLUMN "created_by" TYPE uuid USING "created_by"::uuid,
    ALTER COLUMN "updated_by" TYPE uuid USING "updated_by"::uuid;

-- 6.4 重新添加 student_counselor 表的外键约束
ALTER TABLE "student_counselor" 
    ADD CONSTRAINT "student_counselor_student_id_student_id_fk" 
    FOREIGN KEY ("student_id") REFERENCES "student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "student_counselor" 
    ADD CONSTRAINT "student_counselor_counselor_id_counselor_id_fk" 
    FOREIGN KEY ("counselor_id") REFERENCES "counselor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "student_counselor" 
    ADD CONSTRAINT "student_counselor_created_by_user_id_fk" 
    FOREIGN KEY ("created_by") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "student_counselor" 
    ADD CONSTRAINT "student_counselor_updated_by_user_id_fk" 
    FOREIGN KEY ("updated_by") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

