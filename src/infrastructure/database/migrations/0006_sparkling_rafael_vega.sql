ALTER TABLE "contracts" DROP CONSTRAINT "contracts_override_approved_by_user_id_fk";
--> statement-breakpoint
ALTER TABLE "contracts" DROP COLUMN "override_amount";--> statement-breakpoint
ALTER TABLE "contracts" DROP COLUMN "override_reason";--> statement-breakpoint
ALTER TABLE "contracts" DROP COLUMN "override_approved_by";