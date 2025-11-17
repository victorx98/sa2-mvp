-- 创建 role 表
CREATE TABLE IF NOT EXISTS "role" (
  "id" varchar(32) PRIMARY KEY,
  "cn_name" varchar(64) NOT NULL,
  "desc" varchar(128),
  "status" varchar(32) NOT NULL,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);

-- 创建 user_relationships 表
CREATE TABLE IF NOT EXISTS "user_relationships" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "from_user_id" uuid NOT NULL REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "to_user_id" uuid NOT NULL REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "relation_type" varchar(64) NOT NULL,
  "status" varchar(32) NOT NULL,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);

-- 创建 user_roles 表
CREATE TABLE IF NOT EXISTS "user_roles" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" uuid NOT NULL REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "role_id" varchar(32) NOT NULL REFERENCES "role"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "status" varchar(32) NOT NULL,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);

-- 创建触发器函数用于自动更新 updated_at 字段
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 为 role 表创建触发器
DROP TRIGGER IF EXISTS update_role_updated_at ON "role";
CREATE TRIGGER update_role_updated_at
  BEFORE UPDATE ON "role"
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- 为 user_relationships 表创建触发器
DROP TRIGGER IF EXISTS update_user_relationships_updated_at ON "user_relationships";
CREATE TRIGGER update_user_relationships_updated_at
  BEFORE UPDATE ON "user_relationships"
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- 为 user_roles 表创建触发器
DROP TRIGGER IF EXISTS update_user_roles_updated_at ON "user_roles";
CREATE TRIGGER update_user_roles_updated_at
  BEFORE UPDATE ON "user_roles"
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- 创建索引以提高查询性能
CREATE INDEX IF NOT EXISTS "idx_user_relationships_from_user_id" ON "user_relationships"("from_user_id");
CREATE INDEX IF NOT EXISTS "idx_user_relationships_to_user_id" ON "user_relationships"("to_user_id");
CREATE INDEX IF NOT EXISTS "idx_user_relationships_relation_type" ON "user_relationships"("relation_type");
CREATE INDEX IF NOT EXISTS "idx_user_roles_user_id" ON "user_roles"("user_id");
CREATE INDEX IF NOT EXISTS "idx_user_roles_role_id" ON "user_roles"("role_id");

