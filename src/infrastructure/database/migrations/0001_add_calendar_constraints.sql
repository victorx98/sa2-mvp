-- 创建 GIST 索引（✅ 可以创建）
CREATE INDEX IF NOT EXISTS "idx_calendar_timerange" ON "calendar" USING GIST ("user_id", "time_range");

-- 添加 EXCLUDE 约束（✅ 可以创建）
ALTER TABLE "calendar"
  ADD CONSTRAINT "calendar_no_overlap"
  EXCLUDE USING GIST (
    "user_id" WITH =,
    "time_range" WITH &&
  ) WHERE ("status" = 'booked');

-- 暂时跳过 fk_calendar_user（❌ 类型不匹配）
-- 等 user.id 改为 UUID 后，再添加这个外键

-- 可以创建的外键
ALTER TABLE "calendar"
  ADD CONSTRAINT "fk_calendar_session"
  FOREIGN KEY ("session_id") REFERENCES "sessions" ("id") ON DELETE SET NULL
  NOT VALID;

ALTER TABLE "calendar" VALIDATE CONSTRAINT "fk_calendar_session";