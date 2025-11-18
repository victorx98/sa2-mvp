import {
  pgTable,
  uuid,
  varchar,
  numeric,
  timestamp,
} from "drizzle-orm/pg-core";
import { serviceTypes } from "./service-types.schema";

/**
 * Mentor Payable Ledgers Table (导师应付账款流水表)
 *
 * Design Principles:
 * 1. **Immutable Table**: No UPDATE/DELETE, only INSERT
 *    - No updatedAt/updatedBy fields
 *    - Each record is permanent and append-only
 *
 * 2. **Anti-Corruption Layer**: No foreign keys to other domains
 *    - Use string UUID references instead of foreign keys
 *    - Comment foreign keys for documentation
 *
 * 3. **Snapshot Design**: Record service and price snapshots
 *    - Avoid cross-domain queries
 *    - Only store necessary information
 *
 * 4. **Chain Adjustment**: Support multiple adjustments
 *    - originalId points to the adjusted record (chain structure)
 *    - Adjustment records can have positive or negative amounts
 *
 * 5. **Idempotency**: Unique indexes on (relation_id, source_entity) for original records
 *    - original_id IS NULL identifies original records
 *    - Adjustments (original_id IS NOT NULL) can have multiple entries
 */
export const mentorPayableLedgers = pgTable("mentor_payable_ledgers", {
  // ========== Primary Key & Relations ==========
  id: uuid("id").primaryKey().defaultRandom(),

  /**
   * Relation ID - Links to original service record
   * Maps to: session.id, internal_referral.id, etc.
   */
  relationId: uuid("relation_id").notNull(),

  /**
   * Source Entity Type - Identifies the source table
   * Examples: 'session', 'internal_referral', 'class_session'
   */
  sourceEntity: varchar("source_entity", { length: 50 }).notNull(),

  // ========== Participants ==========
  /**
   * Mentor user ID (with foreign key comment)
   * References: identity.users.id
   */
  mentorUserId: uuid("mentor_user_id").notNull(),

  /**
   * Student user ID (nullable, with foreign key comment)
   * References: identity.users.id
   * Nullable: Some services may not have students (e.g., internal_referral)
   */
  studentUserId: uuid("student_user_id"),

  // ========== Service Snapshot ==========
  /**
   * Service Type Code - References service_types.code
   * Purpose: Links to service type configuration
   */
  serviceTypeCode: varchar("service_type_code", { length: 50 })
    .notNull()
    .references(() => serviceTypes.code),

  /**
   * Service Name - Human-readable service name
   * Examples: "CS面试辅导", "班课：数据结构与算法"
   */
  serviceName: varchar("service_name", { length: 500 }),

  // ========== Price Snapshot ==========
  /**
   * Unit Price - Price per session/hour/package
   * Precision: 12 digits total, 1 decimal place
   */
  price: numeric("price", { precision: 12, scale: 1 }).notNull(),

  /**
   * Total Amount - Calculated amount (may be negative for adjustments)
   * Precision: 12 digits total, 2 decimal places
   * Calculation:
   *   - Per session: price × 1
   *   - Per hour: price × durationHours
   *   - Package: fixed package price
   */
  amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),

  /**
   * Currency - ISO 4217 currency code
   * Default: USD
   */
  currency: varchar("currency", { length: 3 }).notNull().default("USD"),

  // ========== Adjustments ==========
  /**
   * Original ID - Points to the adjusted record
   * Used for chain adjustments (supports multiple adjustments)
   * Null for original records
   */
  originalId: uuid("original_id"),

  /**
   * Adjustment Reason - Reason for adjustment
   * Required when original_id is not null
   * Examples:
   *   - "时长记录错误：实际0.5小时，系统记录1小时"
   *   - "服务质量问题，部分退款"
   */
  adjustmentReason: varchar("adjustment_reason", { length: 500 }),

  // ========== Package Mode ==========
  /**
   * Service Package ID - From catalog domain
   * Populated for package billing mode
   */
  servicePackageId: uuid("service_package_id"),

  // ========== Timestamps ==========
  /**
   * Created At - Record creation timestamp (immutable)
   */
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),

  /**
   * Created By - Operator user ID (for audit trail)
   * References: identity.users.id
   */
  createdBy: uuid("created_by"),
});

export type MentorPayableLedger = typeof mentorPayableLedgers.$inferSelect;
export type InsertMentorPayableLedger =
  typeof mentorPayableLedgers.$inferInsert;

/**
 * Unique Indexes (created in migration files):
 *
 * 1. Original records (per-session/per-hour)
 *    Ensures each relation_id+source_entity combination is unique for original records
 *    CREATE UNIQUE INDEX idx_mentor_payable_relation
 *    ON mentor_payable_ledgers(relation_id, source_entity)
 *    WHERE original_id IS NULL;
 *
 * 2. Package billing
 *    Ensures each service_package is billed only once (on the last session)
 *    CREATE UNIQUE INDEX idx_mentor_payable_package
 *    ON mentor_payable_ledgers(service_package_id, relation_id, source_entity)
 *    WHERE original_id IS NULL AND service_package_id IS NOT NULL;
 *
 * 3. Query optimization
 *    CREATE INDEX idx_mentor_payable_mentor
 *    ON mentor_payable_ledgers(mentor_user_id);
 *
 * 4. Service type lookup
 *    CREATE INDEX idx_mentor_payable_service_type
 *    ON mentor_payable_ledgers(service_type_code);
 *
 * 5. Adjustment chain query
 *    CREATE INDEX idx_mentor_payable_original
 *    ON mentor_payable_ledgers(original_id)
 *    WHERE original_id IS NOT NULL;
 */
