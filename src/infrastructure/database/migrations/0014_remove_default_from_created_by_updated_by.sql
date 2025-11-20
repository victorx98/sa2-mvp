-- 迁移脚本：移除 student、mentor、counselor 表中 created_by 和 updated_by 字段的默认值
-- 这些字段应该由应用层显式设置，而不是使用随机 UUID

-- 1. 移除 student 表的默认值
ALTER TABLE "student" 
  ALTER COLUMN "created_by" DROP DEFAULT,
  ALTER COLUMN "updated_by" DROP DEFAULT;

-- 2. 移除 mentor 表的默认值
ALTER TABLE "mentor" 
  ALTER COLUMN "created_by" DROP DEFAULT,
  ALTER COLUMN "updated_by" DROP DEFAULT;

-- 3. 移除 counselor 表的默认值
ALTER TABLE "counselor" 
  ALTER COLUMN "created_by" DROP DEFAULT,
  ALTER COLUMN "updated_by" DROP DEFAULT;

