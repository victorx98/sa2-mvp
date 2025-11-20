CREATE EXTENSION IF NOT EXISTS "pgcrypto"; 
ALTER TABLE "contract_service_entitlements" ALTER COLUMN "id" DROP DEFAULT;
ALTER TABLE "contract_service_entitlements" ALTER COLUMN "id" SET DATA TYPE uuid USING gen_random_uuid();
ALTER TABLE "contract_service_entitlements" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();