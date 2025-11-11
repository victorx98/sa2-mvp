-- 启用扩展
CREATE EXTENSION IF NOT EXISTS btree_gist;
--> statement-breakpoint
-- 安全创建 ENUM 类型（如果不存在）
DO $$ BEGIN
  CREATE TYPE "public"."calendar_status" AS ENUM('booked', 'cancelled');
EXCEPTION WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  CREATE TYPE "public"."calendar_type" AS ENUM('session', 'class_session');
EXCEPTION WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  CREATE TYPE "public"."calendar_user_type" AS ENUM('mentor', 'student', 'counselor');
EXCEPTION WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "calendar" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"user_type" "calendar_user_type" NOT NULL,
	"time_range" "tstzrange" NOT NULL,
	"duration_minutes" integer NOT NULL,
	"session_id" uuid,
	"type" "calendar_type" NOT NULL,
	"status" "calendar_status" DEFAULT 'booked' NOT NULL,
	"reason" varchar(255),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_type_check" CHECK (user_type IN ('mentor', 'student', 'counselor')),
	CONSTRAINT "type_check" CHECK (type IN ('session', 'class_session')),
	CONSTRAINT "status_check" CHECK (status IN ('booked', 'cancelled')),
	CONSTRAINT "duration_check" CHECK (duration_minutes >= 30 AND duration_minutes <= 180)
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_calendar_user" ON "calendar" USING btree ("user_id","user_type");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_calendar_session" ON "calendar" USING btree ("session_id");