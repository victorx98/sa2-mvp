-- 迁移脚本：为 user、student、mentor、counselor 表添加 created_by 和 updated_by 字段
-- 如果字段已存在，则确保类型正确；如果不存在，则添加字段

-- 1. 处理 user 表
DO $$ 
BEGIN
    -- 添加 created_by 字段（如果不存在）
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'user' 
        AND column_name = 'created_by'
    ) THEN
        ALTER TABLE "user" ADD COLUMN "created_by" uuid;
    END IF;
    
    -- 添加 updated_by 字段（如果不存在）
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'user' 
        AND column_name = 'updated_by'
    ) THEN
        ALTER TABLE "user" ADD COLUMN "updated_by" uuid;
    END IF;
    
    -- 确保 created_by 字段类型为 uuid（如果存在但类型不对）
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'user' 
        AND column_name = 'created_by' 
        AND data_type != 'uuid'
    ) THEN
        -- 删除外键约束（如果存在）
        ALTER TABLE "user" DROP CONSTRAINT IF EXISTS "user_created_by_user_id_fk";
        -- 转换类型
        ALTER TABLE "user" ALTER COLUMN "created_by" TYPE uuid USING "created_by"::uuid;
    END IF;
    
    -- 确保 updated_by 字段类型为 uuid（如果存在但类型不对）
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'user' 
        AND column_name = 'updated_by' 
        AND data_type != 'uuid'
    ) THEN
        -- 删除外键约束（如果存在）
        ALTER TABLE "user" DROP CONSTRAINT IF EXISTS "user_updated_by_user_id_fk";
        -- 转换类型
        ALTER TABLE "user" ALTER COLUMN "updated_by" TYPE uuid USING "updated_by"::uuid;
    END IF;
END $$;

-- 清理 user 表中无效的外键引用
UPDATE "user" SET "created_by" = NULL 
WHERE "created_by" IS NOT NULL 
AND NOT EXISTS (SELECT 1 FROM "user" u WHERE u.id = "user"."created_by");

UPDATE "user" SET "updated_by" = NULL 
WHERE "updated_by" IS NOT NULL 
AND NOT EXISTS (SELECT 1 FROM "user" u WHERE u.id = "user"."updated_by");

-- 添加 user 表的外键约束（如果不存在）
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'user_created_by_user_id_fk' 
        AND conrelid = 'user'::regclass
    ) THEN
        ALTER TABLE "user" 
        ADD CONSTRAINT "user_created_by_user_id_fk" 
        FOREIGN KEY ("created_by") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'user_updated_by_user_id_fk' 
        AND conrelid = 'user'::regclass
    ) THEN
        ALTER TABLE "user" 
        ADD CONSTRAINT "user_updated_by_user_id_fk" 
        FOREIGN KEY ("updated_by") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;

-- 2. 处理 student 表
DO $$ 
BEGIN
    -- 添加 created_by 字段（如果不存在）
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'student' 
        AND column_name = 'created_by'
    ) THEN
        ALTER TABLE "student" ADD COLUMN "created_by" uuid;
    END IF;
    
    -- 添加 updated_by 字段（如果不存在）
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'student' 
        AND column_name = 'updated_by'
    ) THEN
        ALTER TABLE "student" ADD COLUMN "updated_by" uuid;
    END IF;
    
    -- 确保 created_by 字段类型为 uuid（如果存在但类型不对）
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'student' 
        AND column_name = 'created_by' 
        AND data_type != 'uuid'
    ) THEN
        -- 删除外键约束（如果存在）
        ALTER TABLE "student" DROP CONSTRAINT IF EXISTS "student_created_by_user_id_fk";
        -- 转换类型
        ALTER TABLE "student" ALTER COLUMN "created_by" TYPE uuid USING "created_by"::uuid;
    END IF;
    
    -- 确保 updated_by 字段类型为 uuid（如果存在但类型不对）
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'student' 
        AND column_name = 'updated_by' 
        AND data_type != 'uuid'
    ) THEN
        -- 删除外键约束（如果存在）
        ALTER TABLE "student" DROP CONSTRAINT IF EXISTS "student_updated_by_user_id_fk";
        -- 转换类型
        ALTER TABLE "student" ALTER COLUMN "updated_by" TYPE uuid USING "updated_by"::uuid;
    END IF;
END $$;

-- 清理 student 表中无效的外键引用
UPDATE "student" SET "created_by" = NULL 
WHERE "created_by" IS NOT NULL 
AND NOT EXISTS (SELECT 1 FROM "user" u WHERE u.id = "student"."created_by");

UPDATE "student" SET "updated_by" = NULL 
WHERE "updated_by" IS NOT NULL 
AND NOT EXISTS (SELECT 1 FROM "user" u WHERE u.id = "student"."updated_by");

-- 添加 student 表的外键约束（如果不存在）
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'student_created_by_user_id_fk' 
        AND conrelid = 'student'::regclass
    ) THEN
        ALTER TABLE "student" 
        ADD CONSTRAINT "student_created_by_user_id_fk" 
        FOREIGN KEY ("created_by") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'student_updated_by_user_id_fk' 
        AND conrelid = 'student'::regclass
    ) THEN
        ALTER TABLE "student" 
        ADD CONSTRAINT "student_updated_by_user_id_fk" 
        FOREIGN KEY ("updated_by") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;

-- 3. 处理 mentor 表
DO $$ 
BEGIN
    -- 添加 created_by 字段（如果不存在）
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'mentor' 
        AND column_name = 'created_by'
    ) THEN
        ALTER TABLE "mentor" ADD COLUMN "created_by" uuid;
    END IF;
    
    -- 添加 updated_by 字段（如果不存在）
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'mentor' 
        AND column_name = 'updated_by'
    ) THEN
        ALTER TABLE "mentor" ADD COLUMN "updated_by" uuid;
    END IF;
    
    -- 确保 created_by 字段类型为 uuid（如果存在但类型不对）
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'mentor' 
        AND column_name = 'created_by' 
        AND data_type != 'uuid'
    ) THEN
        -- 删除外键约束（如果存在）
        ALTER TABLE "mentor" DROP CONSTRAINT IF EXISTS "mentor_created_by_user_id_fk";
        -- 转换类型
        ALTER TABLE "mentor" ALTER COLUMN "created_by" TYPE uuid USING "created_by"::uuid;
    END IF;
    
    -- 确保 updated_by 字段类型为 uuid（如果存在但类型不对）
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'mentor' 
        AND column_name = 'updated_by' 
        AND data_type != 'uuid'
    ) THEN
        -- 删除外键约束（如果存在）
        ALTER TABLE "mentor" DROP CONSTRAINT IF EXISTS "mentor_updated_by_user_id_fk";
        -- 转换类型
        ALTER TABLE "mentor" ALTER COLUMN "updated_by" TYPE uuid USING "updated_by"::uuid;
    END IF;
END $$;

-- 清理 mentor 表中无效的外键引用
UPDATE "mentor" SET "created_by" = NULL 
WHERE "created_by" IS NOT NULL 
AND NOT EXISTS (SELECT 1 FROM "user" u WHERE u.id = "mentor"."created_by");

UPDATE "mentor" SET "updated_by" = NULL 
WHERE "updated_by" IS NOT NULL 
AND NOT EXISTS (SELECT 1 FROM "user" u WHERE u.id = "mentor"."updated_by");

-- 添加 mentor 表的外键约束（如果不存在）
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'mentor_created_by_user_id_fk' 
        AND conrelid = 'mentor'::regclass
    ) THEN
        ALTER TABLE "mentor" 
        ADD CONSTRAINT "mentor_created_by_user_id_fk" 
        FOREIGN KEY ("created_by") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'mentor_updated_by_user_id_fk' 
        AND conrelid = 'mentor'::regclass
    ) THEN
        ALTER TABLE "mentor" 
        ADD CONSTRAINT "mentor_updated_by_user_id_fk" 
        FOREIGN KEY ("updated_by") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;

-- 4. 处理 counselor 表
DO $$ 
BEGIN
    -- 添加 created_by 字段（如果不存在）
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'counselor' 
        AND column_name = 'created_by'
    ) THEN
        ALTER TABLE "counselor" ADD COLUMN "created_by" uuid;
    END IF;
    
    -- 添加 updated_by 字段（如果不存在）
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'counselor' 
        AND column_name = 'updated_by'
    ) THEN
        ALTER TABLE "counselor" ADD COLUMN "updated_by" uuid;
    END IF;
    
    -- 确保 created_by 字段类型为 uuid（如果存在但类型不对）
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'counselor' 
        AND column_name = 'created_by' 
        AND data_type != 'uuid'
    ) THEN
        -- 删除外键约束（如果存在）
        ALTER TABLE "counselor" DROP CONSTRAINT IF EXISTS "counselor_created_by_user_id_fk";
        -- 转换类型
        ALTER TABLE "counselor" ALTER COLUMN "created_by" TYPE uuid USING "created_by"::uuid;
    END IF;
    
    -- 确保 updated_by 字段类型为 uuid（如果存在但类型不对）
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'counselor' 
        AND column_name = 'updated_by' 
        AND data_type != 'uuid'
    ) THEN
        -- 删除外键约束（如果存在）
        ALTER TABLE "counselor" DROP CONSTRAINT IF EXISTS "counselor_updated_by_user_id_fk";
        -- 转换类型
        ALTER TABLE "counselor" ALTER COLUMN "updated_by" TYPE uuid USING "updated_by"::uuid;
    END IF;
END $$;

-- 清理 counselor 表中无效的外键引用
UPDATE "counselor" SET "created_by" = NULL 
WHERE "created_by" IS NOT NULL 
AND NOT EXISTS (SELECT 1 FROM "user" u WHERE u.id = "counselor"."created_by");

UPDATE "counselor" SET "updated_by" = NULL 
WHERE "updated_by" IS NOT NULL 
AND NOT EXISTS (SELECT 1 FROM "user" u WHERE u.id = "counselor"."updated_by");

-- 添加 counselor 表的外键约束（如果不存在）
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'counselor_created_by_user_id_fk' 
        AND conrelid = 'counselor'::regclass
    ) THEN
        ALTER TABLE "counselor" 
        ADD CONSTRAINT "counselor_created_by_user_id_fk" 
        FOREIGN KEY ("created_by") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'counselor_updated_by_user_id_fk' 
        AND conrelid = 'counselor'::regclass
    ) THEN
        ALTER TABLE "counselor" 
        ADD CONSTRAINT "counselor_updated_by_user_id_fk" 
        FOREIGN KEY ("updated_by") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;

