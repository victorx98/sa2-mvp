ALTER TYPE "public"."hold_status" ADD VALUE 'expired';--> statement-breakpoint
ALTER TABLE "contract_service_entitlements" DROP CONSTRAINT "pk_contract_service_entitlements";--> statement-breakpoint
ALTER TABLE "contract_service_entitlements" ADD COLUMN "id" serial PRIMARY KEY NOT NULL;--> statement-breakpoint
ALTER TABLE "service_holds" ADD COLUMN "expiry_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "contract_service_entitlements" DROP COLUMN "expires_at";--> statement-breakpoint
ALTER TABLE "contract_service_entitlements" DROP COLUMN "source";--> statement-breakpoint
DROP TYPE "public"."entitlement_source";