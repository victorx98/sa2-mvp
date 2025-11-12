CREATE TYPE "public"."entitlement_ledger_type" AS ENUM('addon', 'promotion', 'compensation');--> statement-breakpoint
CREATE TYPE "public"."contract_status" AS ENUM('draft', 'signed', 'active', 'suspended', 'completed', 'terminated');--> statement-breakpoint
CREATE TYPE "public"."event_status" AS ENUM('pending', 'published', 'failed');--> statement-breakpoint
CREATE TYPE "public"."notification_status" AS ENUM('pending', 'sent', 'failed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."notification_type" AS ENUM('email', 'feishu_bot');--> statement-breakpoint
CREATE TYPE "public"."product_item_type" AS ENUM('service', 'service_package');--> statement-breakpoint
CREATE TYPE "public"."currency" AS ENUM('USD', 'CNY', 'EUR', 'GBP', 'JPY');--> statement-breakpoint
CREATE TYPE "public"."product_status" AS ENUM('draft', 'active', 'inactive', 'deleted');--> statement-breakpoint
CREATE TYPE "public"."user_type" AS ENUM('undergraduate', 'graduate', 'working');--> statement-breakpoint
CREATE TYPE "public"."hold_status" AS ENUM('active', 'released', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."archive_policy_scope" AS ENUM('global', 'contract', 'service_type');--> statement-breakpoint
CREATE TYPE "public"."service_ledger_source" AS ENUM('booking_completed', 'booking_cancelled', 'manual_adjustment');--> statement-breakpoint
CREATE TYPE "public"."service_ledger_type" AS ENUM('consumption', 'refund', 'adjustment');--> statement-breakpoint
CREATE TYPE "public"."billing_mode" AS ENUM('one_time', 'per_session', 'staged', 'package');--> statement-breakpoint
CREATE TYPE "public"."service_status" AS ENUM('active', 'inactive', 'deleted');--> statement-breakpoint
CREATE TYPE "public"."service_type" AS ENUM('gap_analysis', 'resume_review', 'recommendation_letter', 'recommendation_letter_online', 'session', 'mock_interview', 'class_session', 'internal_referral', 'contract_signing_assistance', 'proxy_application', 'other_service');--> statement-breakpoint
CREATE TYPE "public"."meeting_provider" AS ENUM('feishu', 'zoom');--> statement-breakpoint
CREATE TYPE "public"."session_status" AS ENUM('scheduled', 'started', 'completed', 'cancelled');--> statement-breakpoint
CREATE TABLE "contract_entitlement_ledgers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"student_id" varchar(32) NOT NULL,
	"service_type" "service_type" NOT NULL,
	"ledger_type" "entitlement_ledger_type" NOT NULL,
	"quantity_changed" integer NOT NULL,
	"reason" text NOT NULL,
	"description" text,
	"attachments" json,
	"created_by" varchar(32) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"snapshot" json
);
--> statement-breakpoint
CREATE TABLE "contract_service_entitlements" (
	"student_id" varchar(32) NOT NULL,
	"service_type" "service_type" NOT NULL,
	"total_quantity" integer DEFAULT 0 NOT NULL,
	"consumed_quantity" integer DEFAULT 0 NOT NULL,
	"held_quantity" integer DEFAULT 0 NOT NULL,
	"available_quantity" integer DEFAULT 0 NOT NULL,
	"expires_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" varchar(32),
	CONSTRAINT "pk_contract_service_entitlements" PRIMARY KEY("student_id","service_type")
);
--> statement-breakpoint
CREATE TABLE "contracts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"contract_number" varchar(50) NOT NULL,
	"title" varchar(200),
	"student_id" varchar(32) NOT NULL,
	"product_id" uuid NOT NULL,
	"product_snapshot" json NOT NULL,
	"status" "contract_status" DEFAULT 'draft' NOT NULL,
	"total_amount" numeric(12, 2) NOT NULL,
	"currency" "currency" DEFAULT 'USD' NOT NULL,
	"override_amount" numeric(12, 2),
	"override_reason" varchar(500),
	"override_approved_by" varchar(32),
	"validity_days" integer,
	"signed_at" timestamp with time zone NOT NULL,
	"activated_at" timestamp with time zone,
	"expires_at" timestamp with time zone,
	"suspended_at" timestamp with time zone,
	"resumed_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"terminated_at" timestamp with time zone,
	"suspension_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" varchar(32) NOT NULL,
	CONSTRAINT "contracts_contract_number_unique" UNIQUE("contract_number")
);
--> statement-breakpoint
CREATE TABLE "domain_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_type" varchar(100) NOT NULL,
	"aggregate_id" uuid NOT NULL,
	"aggregate_type" varchar(50) DEFAULT 'Contract' NOT NULL,
	"payload" json NOT NULL,
	"status" "event_status" DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"published_at" timestamp with time zone,
	"retry_count" integer DEFAULT 0 NOT NULL,
	"max_retries" integer DEFAULT 3 NOT NULL,
	"error_message" text,
	"metadata" json
);
--> statement-breakpoint
CREATE TABLE "notification_queue" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" uuid NOT NULL,
	"type" "notification_type" NOT NULL,
	"recipient" varchar(255) NOT NULL,
	"template" varchar(100) NOT NULL,
	"data" jsonb NOT NULL,
	"scheduled_time" timestamp with time zone NOT NULL,
	"status" "notification_status" DEFAULT 'pending' NOT NULL,
	"sent_at" timestamp with time zone,
	"error" varchar(500),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "product_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"product_id" uuid NOT NULL,
	"type" "product_item_type" NOT NULL,
	"reference_id" uuid NOT NULL,
	"quantity" integer NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "products" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(500) NOT NULL,
	"code" varchar(100) NOT NULL,
	"description" text,
	"cover_image" varchar(500),
	"target_user_types" json,
	"price" numeric(12, 2) NOT NULL,
	"currency" "currency" DEFAULT 'USD' NOT NULL,
	"validity_days" integer,
	"marketing_labels" json,
	"status" "product_status" DEFAULT 'draft' NOT NULL,
	"scheduled_publish_at" timestamp with time zone,
	"published_at" timestamp with time zone,
	"unpublished_at" timestamp with time zone,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"metadata" json,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" varchar(32) NOT NULL,
	"published_by" varchar(32),
	"unpublished_by" varchar(32),
	CONSTRAINT "products_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "service_holds" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"student_id" varchar(32) NOT NULL,
	"service_type" "service_type" NOT NULL,
	"quantity" integer DEFAULT 1 NOT NULL,
	"status" "hold_status" DEFAULT 'active' NOT NULL,
	"related_booking_id" uuid,
	"released_at" timestamp with time zone,
	"release_reason" varchar(100),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" varchar(32) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "service_ledger_archive_policies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"scope" "archive_policy_scope" NOT NULL,
	"contract_id" uuid,
	"service_type" "service_type",
	"archive_after_days" integer DEFAULT 90 NOT NULL,
	"delete_after_archive" boolean DEFAULT false NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"notes" text
);
--> statement-breakpoint
CREATE TABLE "service_ledgers_archive" (
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
	"metadata" json,
	"archived_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "service_ledgers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"student_id" varchar(32) NOT NULL,
	"service_type" "service_type" NOT NULL,
	"quantity" integer NOT NULL,
	"type" "service_ledger_type" NOT NULL,
	"source" "service_ledger_source" NOT NULL,
	"balance_after" integer NOT NULL,
	"related_hold_id" uuid,
	"related_booking_id" uuid,
	"reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" varchar(32) NOT NULL,
	"metadata" json
);
--> statement-breakpoint
CREATE TABLE "service_package_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"package_id" uuid NOT NULL,
	"service_id" uuid NOT NULL,
	"quantity" integer NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "service_packages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" varchar(100) NOT NULL,
	"name" varchar(200) NOT NULL,
	"description" text,
	"cover_image" varchar(500),
	"status" "service_status" DEFAULT 'active' NOT NULL,
	"metadata" json,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" varchar(32) NOT NULL,
	CONSTRAINT "service_packages_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "services" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" varchar(100) NOT NULL,
	"service_type" "service_type" NOT NULL,
	"name" varchar(200) NOT NULL,
	"description" text,
	"cover_image" varchar(500),
	"billing_mode" "billing_mode" DEFAULT 'one_time' NOT NULL,
	"requires_evaluation" boolean DEFAULT false,
	"requires_mentor_assignment" boolean DEFAULT true,
	"status" "service_status" DEFAULT 'active' NOT NULL,
	"metadata" json,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" varchar(32) NOT NULL,
	CONSTRAINT "services_code_unique" UNIQUE("code"),
	CONSTRAINT "services_service_type_unique" UNIQUE("service_type")
);
--> statement-breakpoint
CREATE TABLE "session_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" uuid NOT NULL,
	"provider" varchar(20) NOT NULL,
	"event_type" varchar(100) NOT NULL,
	"event_data" jsonb NOT NULL,
	"occurred_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"student_id" uuid NOT NULL,
	"mentor_id" uuid NOT NULL,
	"contract_id" uuid,
	"meeting_provider" "meeting_provider" NOT NULL,
	"meeting_id" varchar(255),
	"meeting_no" varchar(20),
	"meeting_url" text,
	"meeting_password" varchar(50),
	"scheduled_start_time" timestamp with time zone NOT NULL,
	"scheduled_duration" integer NOT NULL,
	"actual_start_time" timestamp with time zone,
	"actual_end_time" timestamp with time zone,
	"recordings" jsonb DEFAULT '[]'::jsonb,
	"ai_summary" jsonb,
	"mentor_total_duration_seconds" integer,
	"student_total_duration_seconds" integer,
	"effective_tutoring_duration_seconds" integer,
	"mentor_join_count" integer DEFAULT 0 NOT NULL,
	"student_join_count" integer DEFAULT 0 NOT NULL,
	"session_name" varchar(255) NOT NULL,
	"notes" text,
	"status" "session_status" DEFAULT 'scheduled' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "user" (
	"id" varchar(32) PRIMARY KEY NOT NULL,
	"gender" varchar(10),
	"nickname" varchar(100),
	"cn_nickname" varchar(100),
	"status" varchar(50),
	"password" varchar(255),
	"email" varchar(255),
	"country" varchar(100),
	"created_time" timestamp with time zone DEFAULT now() NOT NULL,
	"modified_time" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" varchar(32),
	"updated_by" varchar(32)
);
--> statement-breakpoint
ALTER TABLE "contract_entitlement_ledgers" ADD CONSTRAINT "contract_entitlement_ledgers_student_id_user_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contract_entitlement_ledgers" ADD CONSTRAINT "contract_entitlement_ledgers_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contract_service_entitlements" ADD CONSTRAINT "contract_service_entitlements_student_id_user_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contract_service_entitlements" ADD CONSTRAINT "contract_service_entitlements_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contracts" ADD CONSTRAINT "contracts_student_id_user_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contracts" ADD CONSTRAINT "contracts_override_approved_by_user_id_fk" FOREIGN KEY ("override_approved_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contracts" ADD CONSTRAINT "contracts_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_items" ADD CONSTRAINT "product_items_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_published_by_user_id_fk" FOREIGN KEY ("published_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_unpublished_by_user_id_fk" FOREIGN KEY ("unpublished_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_holds" ADD CONSTRAINT "service_holds_student_id_user_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_holds" ADD CONSTRAINT "service_holds_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_ledger_archive_policies" ADD CONSTRAINT "service_ledger_archive_policies_contract_id_contracts_id_fk" FOREIGN KEY ("contract_id") REFERENCES "public"."contracts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_ledgers" ADD CONSTRAINT "service_ledgers_student_id_user_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_ledgers" ADD CONSTRAINT "service_ledgers_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_package_items" ADD CONSTRAINT "service_package_items_package_id_service_packages_id_fk" FOREIGN KEY ("package_id") REFERENCES "public"."service_packages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_package_items" ADD CONSTRAINT "service_package_items_service_id_services_id_fk" FOREIGN KEY ("service_id") REFERENCES "public"."services"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_packages" ADD CONSTRAINT "service_packages_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "services" ADD CONSTRAINT "services_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_session_event_time" ON "session_events" USING btree ("session_id","occurred_at");--> statement-breakpoint
CREATE INDEX "idx_event_type" ON "session_events" USING btree ("event_type");--> statement-breakpoint
CREATE INDEX "idx_session_student" ON "sessions" USING btree ("student_id","scheduled_start_time");--> statement-breakpoint
CREATE INDEX "idx_session_mentor" ON "sessions" USING btree ("mentor_id","scheduled_start_time");--> statement-breakpoint
CREATE INDEX "idx_session_contract" ON "sessions" USING btree ("contract_id");--> statement-breakpoint
CREATE INDEX "idx_session_meeting" ON "sessions" USING btree ("meeting_id");--> statement-breakpoint
CREATE INDEX "idx_session_status" ON "sessions" USING btree ("status");