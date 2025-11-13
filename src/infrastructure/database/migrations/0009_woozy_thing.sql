-- Financial Domain Tables
-- 导师应付账款账本表 - Financial Domain
CREATE TABLE "mentor_payable_ledgers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"relation_id" uuid NOT NULL,
	"source_entity" varchar(50) NOT NULL,
	"mentor_user_id" uuid NOT NULL,
	"student_user_id" uuid,
	"service_type_code" varchar(50) NOT NULL,
	"service_name" varchar(500),
	"price" numeric(12, 1) NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"currency" varchar(3) DEFAULT 'USD' NOT NULL,
	"original_id" uuid,
	"adjustment_reason" varchar(500),
	"service_package_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid
);

-- 导师价格表 - Financial Domain
CREATE TABLE "mentor_prices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"mentor_user_id" uuid NOT NULL,
	"service_type_code" varchar(50) NOT NULL,
	"price" numeric(12, 1) NOT NULL,
	"currency" varchar(3) DEFAULT 'USD' NOT NULL,
	"service_package_id" uuid,
	"status" varchar(20) DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" uuid
);

-- Service Types Table - Catalog Domain
CREATE TABLE "service_types" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" varchar(50) NOT NULL,
	"name" varchar(200) NOT NULL,
	"required_evaluation" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "service_types_code_unique" UNIQUE("code")
);

-- Contract Domain Changes
ALTER TABLE "contract_amendment_ledgers" DROP CONSTRAINT "contract_amendment_ledgers_student_id_user_id_fk";
ALTER TABLE "contract_amendment_ledgers" DROP CONSTRAINT "contract_amendment_ledgers_created_by_user_id_fk";
ALTER TABLE "contract_service_entitlements" DROP CONSTRAINT "contract_service_entitlements_student_id_user_id_fk";
ALTER TABLE "contract_service_entitlements" DROP CONSTRAINT "contract_service_entitlements_created_by_user_id_fk";
ALTER TABLE "contracts" DROP CONSTRAINT "contracts_student_id_user_id_fk";
ALTER TABLE "contracts" DROP CONSTRAINT "contracts_created_by_user_id_fk";

-- Contract Domain Column Type Changes
ALTER TABLE "contract_amendment_ledgers" ALTER COLUMN "student_id" SET DATA TYPE uuid;
ALTER TABLE "contract_amendment_ledgers" ALTER COLUMN "created_by" SET DATA TYPE uuid;
ALTER TABLE "contract_service_entitlements" ALTER COLUMN "student_id" SET DATA TYPE uuid;
ALTER TABLE "contract_service_entitlements" ALTER COLUMN "created_by" SET DATA TYPE uuid;
ALTER TABLE "contracts" ALTER COLUMN "student_id" SET DATA TYPE uuid;
ALTER TABLE "contracts" ALTER COLUMN "created_by" SET DATA TYPE uuid;

-- Catalog Domain Column Type Changes
ALTER TABLE "products" ALTER COLUMN "created_by" SET DATA TYPE uuid;
ALTER TABLE "products" ALTER COLUMN "published_by" SET DATA TYPE uuid;
ALTER TABLE "products" ALTER COLUMN "unpublished_by" SET DATA TYPE uuid;
ALTER TABLE "service_packages" ALTER COLUMN "created_by" SET DATA TYPE uuid;
ALTER TABLE "services" ALTER COLUMN "created_by" SET DATA TYPE uuid;

-- Service Holds Table - Contract Domain
ALTER TABLE "service_holds" ALTER COLUMN "student_id" SET DATA TYPE uuid;
ALTER TABLE "service_holds" ALTER COLUMN "created_by" SET DATA TYPE uuid;

-- Add unique indexes for Financial Domain tables
-- 导师应付账款账本表唯一索引 - Financial Domain
-- 按次计费（原始记录）- 根据设计文档实现
CREATE UNIQUE INDEX idx_mentor_payable_relation
  ON "mentor_payable_ledgers"("relation_id", "source_entity")
  WHERE "original_id" IS NULL;

-- 按包计费（原始记录）- 根据设计文档实现
CREATE UNIQUE INDEX idx_mentor_payable_package
  ON "mentor_payable_ledgers"("service_package_id", "relation_id", "source_entity")
  WHERE "original_id" IS NULL
    AND "service_package_id" IS NOT NULL;

-- 导师价格表唯一索引 - Financial Domain
CREATE UNIQUE INDEX "idx_mentor_prices_service_type" ON "mentor_prices" USING btree ("mentor_user_id", "service_type_code", "service_package_id") WHERE "status" = 'active';
CREATE UNIQUE INDEX "idx_mentor_prices_service_package" ON "mentor_prices" USING btree ("mentor_user_id", "service_package_id") WHERE "service_type_code" IS NULL AND "status" = 'active';