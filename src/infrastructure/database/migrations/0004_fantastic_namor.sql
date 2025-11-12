ALTER TYPE "public"."entitlement_ledger_type" RENAME TO "amendment_ledger_type";--> statement-breakpoint
ALTER TABLE "contract_entitlement_ledgers" RENAME TO "contract_amendment_ledgers";--> statement-breakpoint
ALTER TABLE "contract_amendment_ledgers" DROP CONSTRAINT "contract_entitlement_ledgers_student_id_user_id_fk";
--> statement-breakpoint
ALTER TABLE "contract_amendment_ledgers" DROP CONSTRAINT "contract_entitlement_ledgers_created_by_user_id_fk";
--> statement-breakpoint
ALTER TABLE "contract_amendment_ledgers" ADD CONSTRAINT "contract_amendment_ledgers_student_id_user_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contract_amendment_ledgers" ADD CONSTRAINT "contract_amendment_ledgers_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;