CREATE TYPE "public"."billing_mode" AS ENUM('one_time', 'per_session', 'staged', 'package');--> statement-breakpoint
CREATE TYPE "public"."service_status" AS ENUM('active', 'inactive', 'deleted');--> statement-breakpoint
CREATE TYPE "public"."service_type" AS ENUM('gap_analysis', 'resume_review', 'recommendation_letter', 'recommendation_letter_online', 'session', 'mock_interview', 'class_session', 'internal_referral', 'contract_signing_assistance', 'proxy_application', 'other_service');--> statement-breakpoint
CREATE TYPE "public"."service_unit" AS ENUM('times', 'hours');--> statement-breakpoint
CREATE TYPE "public"."currency" AS ENUM('USD', 'CNY', 'EUR', 'GBP', 'JPY');--> statement-breakpoint
CREATE TYPE "public"."product_status" AS ENUM('draft', 'active', 'inactive', 'deleted');--> statement-breakpoint
CREATE TYPE "public"."user_type" AS ENUM('undergraduate', 'graduate', 'working');--> statement-breakpoint
CREATE TYPE "public"."product_item_type" AS ENUM('service', 'service_package');--> statement-breakpoint
CREATE TYPE "public"."meeting_provider" AS ENUM('feishu', 'zoom');--> statement-breakpoint
CREATE TYPE "public"."session_status" AS ENUM('scheduled', 'started', 'completed', 'cancelled');--> statement-breakpoint
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
CREATE TABLE "services" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" varchar(100) NOT NULL,
	"service_type" "service_type" NOT NULL,
	"name" varchar(200) NOT NULL,
	"description" text,
	"cover_image" varchar(500),
	"billing_mode" "billing_mode" DEFAULT 'one_time' NOT NULL,
	"default_unit" "service_unit" DEFAULT 'times' NOT NULL,
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
CREATE TABLE "service_package_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"package_id" uuid NOT NULL,
	"service_id" uuid NOT NULL,
	"quantity" integer NOT NULL,
	"unit" "service_unit" DEFAULT 'times' NOT NULL,
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
CREATE TABLE "product_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"product_id" uuid NOT NULL,
	"type" "product_item_type" NOT NULL,
	"reference_id" uuid NOT NULL,
	"quantity" integer NOT NULL,
	"unit" "service_unit" DEFAULT 'times' NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
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
ALTER TABLE "services" ADD CONSTRAINT "services_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_packages" ADD CONSTRAINT "service_packages_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_package_items" ADD CONSTRAINT "service_package_items_package_id_service_packages_id_fk" FOREIGN KEY ("package_id") REFERENCES "public"."service_packages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_package_items" ADD CONSTRAINT "service_package_items_service_id_services_id_fk" FOREIGN KEY ("service_id") REFERENCES "public"."services"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_published_by_user_id_fk" FOREIGN KEY ("published_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_unpublished_by_user_id_fk" FOREIGN KEY ("unpublished_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_items" ADD CONSTRAINT "product_items_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_session_student" ON "sessions" USING btree ("student_id","scheduled_start_time");--> statement-breakpoint
CREATE INDEX "idx_session_mentor" ON "sessions" USING btree ("mentor_id","scheduled_start_time");--> statement-breakpoint
CREATE INDEX "idx_session_contract" ON "sessions" USING btree ("contract_id");--> statement-breakpoint
CREATE INDEX "idx_session_meeting" ON "sessions" USING btree ("meeting_id");--> statement-breakpoint
CREATE INDEX "idx_session_status" ON "sessions" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_session_event_time" ON "session_events" USING btree ("session_id","occurred_at");--> statement-breakpoint
CREATE INDEX "idx_event_type" ON "session_events" USING btree ("event_type");