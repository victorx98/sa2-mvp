-- 迁移脚本：修复 counselor 表的唯一约束，从部分唯一索引改为完整唯一约束
-- 以支持 ON CONFLICT 操作

-- 1. 删除现有的部分唯一索引
DROP INDEX IF EXISTS "counselor_user_id_unique";

-- 2. 创建完整的唯一约束（支持 ON CONFLICT）
-- 由于表中没有 NULL 值和重复数据，可以安全地创建完整唯一约束
CREATE UNIQUE INDEX "counselor_user_id_unique" ON "counselor"("user_id");

