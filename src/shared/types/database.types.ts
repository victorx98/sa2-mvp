import { NodePgDatabase } from "drizzle-orm/node-postgres";
import { PgTransaction } from "drizzle-orm/pg-core";
import * as schema from "@infrastructure/database/schema";

/**
 * Drizzle database connection type
 * Used for direct database operations
 */
export type DrizzleDatabase = NodePgDatabase<typeof schema>;

/**
 * Drizzle transaction type
 * Used for operations within a transaction context
 */
export type DrizzleTransaction = PgTransaction<
  typeof schema,
  any,
  Record<string, never>
>;

/**
 * Drizzle executor type
 * Can be either a database connection or a transaction
 * Used in services that support both standalone and transactional operations
 */
export type DrizzleExecutor = DrizzleDatabase | DrizzleTransaction;
