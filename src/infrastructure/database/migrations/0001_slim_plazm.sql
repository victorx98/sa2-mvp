-- Enable btree_gist extension for EXCLUDE constraint with enums
CREATE EXTENSION IF NOT EXISTS btree_gist;--> statement-breakpoint
CREATE TYPE "public"."resource_type" AS ENUM('mentor', 'student', 'room');--> statement-breakpoint
CREATE TYPE "public"."slot_status" AS ENUM('occupied', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."slot_type" AS ENUM('session', 'blocked');--> statement-breakpoint
CREATE TABLE "calendar_slots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"resource_type" "resource_type" NOT NULL,
	"resource_id" uuid NOT NULL,
	"time_range" "tstzrange" NOT NULL,
	"duration_minutes" integer NOT NULL,
	"session_id" uuid,
	"slot_type" "slot_type" NOT NULL,
	"status" "slot_status" DEFAULT 'occupied' NOT NULL,
	"reason" varchar(255),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "idx_calendar_resource" ON "calendar_slots" USING btree ("resource_type","resource_id","status");--> statement-breakpoint
CREATE INDEX "idx_calendar_session" ON "calendar_slots" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "idx_calendar_time_range" ON "calendar_slots" USING GIST ("time_range");--> statement-breakpoint
ALTER TABLE "calendar_slots" ADD CONSTRAINT "calendar_slots_no_overlap" EXCLUDE USING GIST ("resource_type" WITH =, "resource_id" WITH =, "time_range" WITH &&) WHERE ("status" = 'occupied');