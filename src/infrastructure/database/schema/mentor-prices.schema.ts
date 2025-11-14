import {
  pgTable,
  uuid,
  varchar,
  numeric,
  timestamp,
} from "drizzle-orm/pg-core";

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
 * 3. Package-based pricing: Optional linking to service packages
 * 4. Status tracking: Active/inactive price configurations
 * 5. Audit trail: Track creator and last updater
 *
 * Usage:
 * - Session Domain queries this table when session completes
 * - Returns price for event publishing
 * - Financial Domain uses event data, not this table (avoid cross-domain queries)
 */
export const mentorPrices = pgTable("mentor_prices", {
  // ========== Primary Key ==========
  id: uuid("id").primaryKey().defaultRandom(),

  /**
   * Mentor User ID (with foreign key comment)
   * References: identity.users.id
   */
  mentorUserId: uuid("mentor_user_id").notNull(),

  // ========== Service & Billing ==========
  /**
   * Service Type Code - References service_types.code
   * Purpose: Snapshots service type at the time of pricing (no foreign key - ACL principle)
   */
  serviceTypeCode: varchar("service_type_code", { length: 50 }).notNull(),

  /**
   * Service Package ID - Optional reference to service package
   * Purpose: Link to specific service package if pricing is package-based
   */
  servicePackageId: uuid("service_package_id"),

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
   * Created By - Creator user ID (for audit trail)
   * References: identity.users.id
   */
  createdBy: uuid("created_by"),

  /**
   * Updated At - Last update timestamp
   * Updated when price or status changes
   */
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),

  /**
   * Updated By - Operator user ID (for audit trail)
   * References: identity.users.id
   */
  updatedBy: uuid("updated_by"),
});

export type MentorPrice = typeof mentorPrices.$inferSelect;
export type InsertMentorPrice = typeof mentorPrices.$inferInsert;

/**
 * Unique Indexes (created in migration files):
 *
 * 1. Unique price per mentor + service type
 *    Ensures each mentor has one active price per service type
 *    CREATE UNIQUE INDEX idx_mentor_price_unique
 *    ON mentor_prices(mentor_user_id, service_type_code)
 *    WHERE status = 'active';
 *
 * 2. Query optimization
 *    CREATE INDEX idx_mentor_prices_mentor
 *    ON mentor_prices(mentor_user_id);
 */
