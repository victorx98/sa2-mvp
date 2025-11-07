-- Migration: Create Contract Domain Tables and Functions
-- This migration creates all tables and functions for the contract domain

-- ====================
-- Enums
-- ====================

DO $$ BEGIN
  CREATE TYPE "contract_status" AS ENUM(
    'signed',
    'active',
    'suspended',
    'completed',
    'terminated'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "entitlement_source" AS ENUM(
    'product',
    'addon',
    'promotion',
    'compensation'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "service_ledger_type" AS ENUM(
    'consumption',
    'refund',
    'adjustment',
    'initial',
    'expiration'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "service_ledger_source" AS ENUM(
    'booking_completed',
    'booking_cancelled',
    'contract_signed',
    'manual_adjustment',
    'auto_expiration'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "service_hold_status" AS ENUM(
    'active',
    'released',
    'expired'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "event_status" AS ENUM(
    'pending',
    'published',
    'failed'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "archive_status" AS ENUM(
    'active',
    'disabled'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- ====================
-- Tables
-- ====================

-- Contracts table
CREATE TABLE IF NOT EXISTS "contracts" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "contract_number" varchar(50) NOT NULL UNIQUE,
  "student_id" varchar(32) NOT NULL REFERENCES "user"("id") ON DELETE RESTRICT,
  "product_id" uuid NOT NULL,
  "product_snapshot" jsonb NOT NULL,
  "status" "contract_status" NOT NULL DEFAULT 'signed',
  "total_amount" numeric(12, 2) NOT NULL,
  "currency" "currency" NOT NULL DEFAULT 'USD',
  "override_amount" numeric(12, 2),
  "override_reason" varchar(500),
  "override_approved_by" varchar(32) REFERENCES "user"("id"),
  "validity_days" integer,
  "signed_at" timestamp with time zone NOT NULL,
  "activated_at" timestamp with time zone,
  "expires_at" timestamp with time zone,
  "suspended_at" timestamp with time zone,
  "resumed_at" timestamp with time zone,
  "completed_at" timestamp with time zone,
  "terminated_at" timestamp with time zone,
  "suspension_count" integer NOT NULL DEFAULT 0,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "created_by" varchar(32) NOT NULL REFERENCES "user"("id")
);

-- Contract service entitlements table
CREATE TABLE IF NOT EXISTS "contract_service_entitlements" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "contract_id" uuid NOT NULL REFERENCES "contracts"("id") ON DELETE CASCADE,
  "service_type" "service_type" NOT NULL,
  "source" "entitlement_source" NOT NULL DEFAULT 'product',
  "total_quantity" integer NOT NULL,
  "consumed_quantity" integer NOT NULL DEFAULT 0,
  "held_quantity" integer NOT NULL DEFAULT 0,
  "available_quantity" integer NOT NULL,
  "service_snapshot" jsonb NOT NULL,
  "origin_items" jsonb,
  "expires_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  UNIQUE ("contract_id", "service_type", "expires_at", "source")
);

-- Service ledgers table
CREATE TABLE IF NOT EXISTS "service_ledgers" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "contract_id" uuid NOT NULL REFERENCES "contracts"("id"),
  "student_id" varchar(32) NOT NULL REFERENCES "user"("id"),
  "service_type" "service_type" NOT NULL,
  "quantity" integer NOT NULL,
  "type" "service_ledger_type" NOT NULL,
  "source" "service_ledger_source" NOT NULL,
  "balance_after" integer NOT NULL,
  "related_hold_id" uuid,
  "related_booking_id" varchar(100),
  "reason" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "created_by" varchar(32) NOT NULL REFERENCES "user"("id"),
  "metadata" jsonb
);

-- Service holds table
CREATE TABLE IF NOT EXISTS "service_holds" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "contract_id" uuid NOT NULL REFERENCES "contracts"("id"),
  "student_id" varchar(32) NOT NULL REFERENCES "user"("id"),
  "service_type" "service_type" NOT NULL,
  "quantity" integer NOT NULL DEFAULT 1,
  "status" "service_hold_status" NOT NULL DEFAULT 'active',
  "expires_at" timestamp with time zone NOT NULL,
  "related_booking_id" varchar(100),
  "released_at" timestamp with time zone,
  "release_reason" varchar(100),
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "created_by" varchar(32) NOT NULL REFERENCES "user"("id"),
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

-- Domain events table
CREATE TABLE IF NOT EXISTS "domain_events" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "event_type" varchar(100) NOT NULL,
  "aggregate_id" uuid NOT NULL,
  "aggregate_type" varchar(50) NOT NULL DEFAULT 'Contract',
  "payload" jsonb NOT NULL,
  "status" "event_status" NOT NULL DEFAULT 'pending',
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "published_at" timestamp with time zone,
  "retry_count" integer NOT NULL DEFAULT 0,
  "max_retries" integer NOT NULL DEFAULT 3,
  "error_message" text,
  "metadata" jsonb
);

-- Service ledgers archive table
CREATE TABLE IF NOT EXISTS "service_ledgers_archive" (
  "id" uuid PRIMARY KEY NOT NULL,
  "contract_id" uuid NOT NULL,
  "student_id" varchar(32) NOT NULL,
  "service_type" "service_type" NOT NULL,
  "quantity" integer NOT NULL,
  "type" "service_ledger_type" NOT NULL,
  "source" "service_ledger_source" NOT NULL,
  "balance_after" integer NOT NULL,
  "related_hold_id" uuid,
  "related_booking_id" uuid,
  "reason" text,
  "created_at" timestamp with time zone NOT NULL,
  "created_by" varchar(32) NOT NULL,
  "metadata" jsonb,
  "archived_at" timestamp with time zone DEFAULT now() NOT NULL
);

-- Service ledger archive policies table
CREATE TABLE IF NOT EXISTS "service_ledger_archive_policies" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "name" varchar(100) NOT NULL UNIQUE,
  "retention_days" integer NOT NULL,
  "status" "archive_status" NOT NULL DEFAULT 'active',
  "description" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "last_executed_at" timestamp with time zone,
  "next_execution_at" timestamp with time zone
);
