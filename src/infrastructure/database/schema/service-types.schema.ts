import {
  pgTable,
  uuid,
  varchar,
  timestamp,
  boolean,
} from "drizzle-orm/pg-core";

/**
 * Service Types Table
 * Centralized configuration for service types
 * Supports dynamic configuration of service attributes
 * Currently managed by admin in database (no admin UI)
 */
export const serviceTypes = pgTable("service_types", {
  // ========== Primary Key ==========
  id: uuid("id").primaryKey().defaultRandom(),

  // ========== Service Identification ==========
  /**
   * Service Type Code - Unique identifier for service type
   * Examples: 'session', 'mock_interview', 'career_consultation'
   */
  code: varchar("code", { length: 50 }).notNull().unique(),

  /**
   * Service Name - Human-readable service name
   * Examples: "CS面试辅导", "模拟面试", "职业规划咨询"
   */
  name: varchar("name", { length: 200 }).notNull(),

  // ========== Billing Configuration ==========
  /**
   * Required Evaluation - Whether evaluation is required before billing
   * - true: Wait for evaluation before billing
   * - false: Bill immediately upon service completion
   */
  requiredEvaluation: boolean("required_evaluation").notNull().default(false),

  // ========== Audit Fields ==========
  /**
   * Created At - Record creation timestamp
   */
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),

  /**
   * Updated At - Last update timestamp
   * Updated when service type configuration changes
   */
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export type ServiceType = typeof serviceTypes.$inferSelect.code;
