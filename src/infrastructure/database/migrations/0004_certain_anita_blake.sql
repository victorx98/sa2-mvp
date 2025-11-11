-- Migration: Calendar Slots Schema Updates
-- This migration creates calendar_user_type enum and modifies the calendar_slots table structure

-- ====================
-- Enums
-- ====================

-- Create calendar_user_type enum with idempotent guard
DO $$ BEGIN
  CREATE TYPE "public"."calendar_user_type" AS ENUM('mentor', 'student', 'counselor');
EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint

-- ====================
-- Enum Migrations for Existing Columns
-- ====================

-- Migrate slot_status enum to new values
ALTER TABLE "calendar_slots" ALTER COLUMN "slot_status" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "calendar_slots" ALTER COLUMN "slot_status" SET DEFAULT 'booked'::text;--> statement-breakpoint
DROP TYPE "public"."slot_status";--> statement-breakpoint
CREATE TYPE "public"."slot_status" AS ENUM('booked', 'cancelled');--> statement-breakpoint
ALTER TABLE "calendar_slots" ALTER COLUMN "slot_status" SET DEFAULT 'booked'::"public"."slot_status";--> statement-breakpoint
ALTER TABLE "calendar_slots" ALTER COLUMN "slot_status" SET DATA TYPE "public"."slot_status" USING "slot_status"::"public"."slot_status";--> statement-breakpoint

-- Migrate slot_type enum to new values
ALTER TABLE "calendar_slots" ALTER COLUMN "slot_type" SET DATA TYPE text;--> statement-breakpoint
DROP TYPE "public"."slot_type";--> statement-breakpoint
CREATE TYPE "public"."slot_type" AS ENUM('session', 'class_session');--> statement-breakpoint
ALTER TABLE "calendar_slots" ALTER COLUMN "slot_type" SET DATA TYPE "public"."slot_type" USING "slot_type"::"public"."slot_type";--> statement-breakpoint

-- ====================
-- Calendar Slots Table Modifications
-- ====================

-- Drop old index on resource_based queries
DROP INDEX "idx_calendar_resource";--> statement-breakpoint

-- Add new columns for user-based calendar structure
ALTER TABLE "calendar_slots" ADD COLUMN "user_id" uuid NOT NULL;--> statement-breakpoint
ALTER TABLE "calendar_slots" ADD COLUMN "calendar_user_type" "calendar_user_type" NOT NULL;--> statement-breakpoint
ALTER TABLE "calendar_slots" ADD COLUMN "slot_status" "slot_status" DEFAULT 'booked' NOT NULL;--> statement-breakpoint

-- Create new index for user-based queries
CREATE INDEX "idx_calendar_user" ON "calendar_slots" USING btree ("user_id","calendar_user_type");--> statement-breakpoint

-- ====================
-- Column Cleanup
-- ====================

-- Drop old resource-based columns
ALTER TABLE "calendar_slots" DROP COLUMN "resource_type";--> statement-breakpoint
ALTER TABLE "calendar_slots" DROP COLUMN "resource_id";--> statement-breakpoint
ALTER TABLE "calendar_slots" DROP COLUMN "status";--> statement-breakpoint

-- Drop obsolete unit columns from service-related tables
ALTER TABLE "services" DROP COLUMN "default_unit";--> statement-breakpoint
ALTER TABLE "service_package_items" DROP COLUMN "unit";--> statement-breakpoint
ALTER TABLE "product_items" DROP COLUMN "unit";--> statement-breakpoint

-- ====================
-- Constraints
-- ====================

-- Add check constraints to calendar_slots table for data integrity
ALTER TABLE "calendar_slots" ADD CONSTRAINT "user_type_check" CHECK (calendar_user_type IN ('mentor', 'student', 'counselor'));--> statement-breakpoint
ALTER TABLE "calendar_slots" ADD CONSTRAINT "slot_type_check" CHECK (slot_type IN ('session', 'class_session'));--> statement-breakpoint
ALTER TABLE "calendar_slots" ADD CONSTRAINT "status_check" CHECK (slot_status IN ('booked', 'cancelled'));--> statement-breakpoint
ALTER TABLE "calendar_slots" ADD CONSTRAINT "duration_check" CHECK (duration_minutes >= 30 AND duration_minutes <= 180);--> statement-breakpoint

-- ====================
-- Type Cleanup
-- ====================

-- Drop old resource type enums
DROP TYPE "public"."resource_type";--> statement-breakpoint
DROP TYPE "public"."service_unit";