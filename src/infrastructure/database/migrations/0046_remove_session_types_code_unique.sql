-- Remove unique constraint from session_types.code field
ALTER TABLE "session_types" DROP CONSTRAINT IF EXISTS "session_types_code_unique";
ALTER TABLE "session_types" DROP CONSTRAINT IF EXISTS "session_types_code_key";

