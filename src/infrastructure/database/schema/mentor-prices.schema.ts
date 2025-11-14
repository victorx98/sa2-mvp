import {
  pgTable,
  uuid,
  varchar,
  numeric,
  timestamp,
  pgEnum,
} from "drizzle-orm/pg-core";
import { userTable } from "./user.schema";

/**
 * Billing mode enum (计费模式枚举)
 * - per_session: 按次计费
 * - per_hour: 按时长计费
 * - package: 按包计费（多个session组成一个包）
 */
export const billingModeEnum = pgEnum("billing_mode", [
  "per_session",
  "per_hour",
  "package",
]);

/**
 * Mentor Prices Table (导师价格配置表)
 *
 * Purpose:
 * Stores mentor service pricing configurations
 * Used by Session Domain to determine billing amounts when publishing SessionCompletedEvent
 *
 * Design Principles:
 * 1. Mentor-specific: Each mentor can have different prices
 * 2. Service-specific: Different prices per service type
 * 3. Billing mode support: per_session, per_hour, package
 * 4. Status tracking: Active/inactive price configurations
 *
 * Usage:
 * - Session Domain queries this table when session completes
 * - Returns billing mode and price for event publishing
 * - Financial Domain uses event data, not this table (avoid cross-domain queries)
 */
export const mentorPrices = pgTable("mentor_prices", {
  // ========== Primary Key ==========
  id: uuid("id").primaryKey().defaultRandom(),

  /**
   * Mentor User ID (with foreign key comment)
   * References: identity.users.id
   */
  mentorUserId: uuid("mentor_user_id")
    .notNull()
    .references(() => userTable.id, { onDelete: "cascade" }),

  // ========== Service & Billing ==========
  /**
   * Service Type ID - References service_types.id
   * Purpose: Snapshots service type at the time of pricing (no foreign key - ACL principle)
   */
  serviceTypeId: uuid("service_type_id").notNull(),

  /**
   * Billing Mode - How the service is billed
   * - per_session: Fixed price per session
   * - per_hour: Price per hour × duration
   * - package: Fixed price for all sessions in package
   */
  billingMode: billingModeEnum("billing_mode").notNull(),

  /**
   * Unit Price - Price per session/hour/package
   * Precision: 12 digits total, 1 decimal place
   * Examples:
   *   - per_session: 100.0 (per session)
   *   - per_hour: 50.0 (per hour)
   *   - package: 2000.0 (total package price)
   */
  price: numeric("price", { precision: 12, scale: 1 }).notNull(),

  /**
   * Currency - ISO 4217 currency code
   * Default: USD
   */
  currency: varchar("currency", { length: 3 }).notNull().default("USD"),

  // ========== Package Mode (Optional) ==========
  /**
   * Service Package ID - From catalog domain
   * Required when billing_mode = 'package'
   * References catalog service package
   */
  servicePackageId: uuid("service_package_id"),

  // ========== Status & Lifecycle ==========
  /**
   * Status - Price configuration status
   * active: Currently active and usable
   * inactive: No longer active (price history)
   */
  status: varchar("status", { length: 20 }).notNull().default("active"),

  /**
   * Created At - Record creation timestamp
   */
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),

  /**
   * Updated At - Last update timestamp
   * Updated when price or status changes
   */
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export type MentorPrice = typeof mentorPrices.$inferSelect;
export type InsertMentorPrice = typeof mentorPrices.$inferInsert;

/**
 * Unique Indexes (created in migration files):
 *
 * 1. Unique price per mentor + service + billing mode
 *    Ensures each mentor has one active price per service type
 *    CREATE UNIQUE INDEX idx_mentor_price_unique
 *    ON mentor_prices(mentor_user_id, service_type_id, billing_mode)
 *    WHERE status = 'active';
 *
 * 2. Query optimization
 *    CREATE INDEX idx_mentor_prices_mentor
 *    ON mentor_prices(mentor_user_id);
 *
 * 3. Package price lookup
 *    CREATE INDEX idx_mentor_prices_package
 *    ON mentor_prices(service_package_id)
 *    WHERE billing_mode = 'package';
 */
