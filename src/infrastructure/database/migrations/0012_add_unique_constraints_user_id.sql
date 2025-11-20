-- 迁移脚本：为 student、mentor、counselor 表的 user_id 列添加唯一约束
-- 支持 ON CONFLICT 操作

-- 1. 为 student 表添加唯一约束
DO $$ 
BEGIN
    -- 检查是否已存在唯一约束
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'student_user_id_unique' 
        AND conrelid = 'student'::regclass
    ) THEN
        -- 检查是否有重复数据
        IF EXISTS (
            SELECT user_id, COUNT(*) 
            FROM student 
            GROUP BY user_id 
            HAVING COUNT(*) > 1
        ) THEN
            RAISE EXCEPTION 'Cannot add unique constraint: duplicate user_id values exist in student table';
        END IF;
        
        -- 创建唯一索引（等同于唯一约束）
        CREATE UNIQUE INDEX IF NOT EXISTS "student_user_id_unique" ON "student"("user_id");
    END IF;
END $$;

-- 2. 为 mentor 表添加唯一约束
DO $$ 
BEGIN
    -- 检查是否已存在唯一约束
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'mentor_user_id_unique' 
        AND conrelid = 'mentor'::regclass
    ) THEN
        -- 检查是否有重复数据
        IF EXISTS (
            SELECT user_id, COUNT(*) 
            FROM mentor 
            GROUP BY user_id 
            HAVING COUNT(*) > 1
        ) THEN
            RAISE EXCEPTION 'Cannot add unique constraint: duplicate user_id values exist in mentor table';
        END IF;
        
        -- 创建唯一索引（等同于唯一约束）
        CREATE UNIQUE INDEX IF NOT EXISTS "mentor_user_id_unique" ON "mentor"("user_id");
    END IF;
END $$;

-- 注意：counselor 表目前没有 user_id 列，需要先添加该列才能创建唯一约束
-- 如果 counselor 表需要 user_id 列，请先执行添加列的 migration

