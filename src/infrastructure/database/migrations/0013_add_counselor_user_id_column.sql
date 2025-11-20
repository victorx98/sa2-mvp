-- 迁移脚本：为 counselor 表添加 user_id 列和唯一约束

-- 1. 添加 user_id 列（如果不存在）
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'counselor' 
        AND column_name = 'user_id'
    ) THEN
        ALTER TABLE "counselor" ADD COLUMN "user_id" uuid;
    END IF;
END $$;

-- 2. 添加外键约束（如果不存在）
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'counselor_user_id_user_id_fk' 
        AND conrelid = 'counselor'::regclass
    ) THEN
        ALTER TABLE "counselor" 
        ADD CONSTRAINT "counselor_user_id_user_id_fk" 
        FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

-- 3. 设置 user_id 为 NOT NULL（在数据迁移完成后）
-- 注意：如果表中已有数据，需要先填充 user_id 值，然后再设置 NOT NULL
-- 这里先不设置 NOT NULL，让应用层处理数据迁移

-- 4. 添加唯一约束
DO $$ 
BEGIN
    -- 检查是否已存在唯一约束
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes 
        WHERE tablename = 'counselor' 
        AND indexname = 'counselor_user_id_unique'
    ) THEN
        -- 检查是否有重复数据（排除 NULL 值）
        IF EXISTS (
            SELECT user_id, COUNT(*) 
            FROM counselor 
            WHERE user_id IS NOT NULL
            GROUP BY user_id 
            HAVING COUNT(*) > 1
        ) THEN
            RAISE EXCEPTION 'Cannot add unique constraint: duplicate user_id values exist in counselor table';
        END IF;
        
        -- 创建唯一索引（等同于唯一约束）
        -- 使用 WHERE user_id IS NOT NULL 允许多个 NULL 值
        CREATE UNIQUE INDEX IF NOT EXISTS "counselor_user_id_unique" 
        ON "counselor"("user_id") 
        WHERE "user_id" IS NOT NULL;
    END IF;
END $$;

