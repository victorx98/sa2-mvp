import { NodePgDatabase } from "drizzle-orm/node-postgres";
import * as schema from "@infrastructure/database/schema";

/**
 * Drizzle database connection type
 * Used for direct database operations
 */
export type DrizzleDatabase = NodePgDatabase<typeof schema>;

/**
 * Drizzle transaction type
 * Used for operations within a transaction context
 * Extracted from database transaction callback parameter type
 */
export type DrizzleTransaction = Parameters<
  Parameters<DrizzleDatabase["transaction"]>[0]
>[0];

/**
 * Drizzle executor type
 * Can be either a database connection or a transaction
 * Used in services that support both standalone and transactional operations
 */
export type DrizzleExecutor = DrizzleDatabase | DrizzleTransaction;
