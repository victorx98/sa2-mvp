import {
  pgTable,
  uuid,
  varchar,
  numeric,
  timestamp,
} from "drizzle-orm/pg-core";

/**
 * Mentor Payable Ledgers Table (导师应付账款流水表)
 *
 * Design Principles (设计原则):
 * 1. **Immutable Table**: No UPDATE/DELETE, only INSERT
 *    - No updatedAt/updatedBy fields
 *    - Each record is permanent and append-only
 *    (不可变表：无UPDATE/DELETE，仅INSERT - 无updatedAt/updatedBy字段)
 *
 * 2. **Anti-Corruption Layer**: No foreign keys to other domains
 *    - Use string UUID references instead of foreign keys
 *    - Comment foreign keys for documentation
 *    (防腐层：不关联其他域的表 - 使用字符串UUID引用，注释说明外键)
 *
 * 3. **Snapshot Design**: Record service and price snapshots
 *    - Avoid cross-domain queries
 *    - Only store necessary information
 *    (快照设计：记录服务和价格快照 - 避免跨域查询)
 *
 * 4. **Chain Adjustment**: Support multiple adjustments
 *    - originalId points to the adjusted record (chain structure)
 *    - Adjustment records can have positive or negative amounts
 *    (链式调整：支持多次调整 - originalId指向被调整记录)
 *
 * 5. **Idempotency**: Unique indexes on reference_id for original records
 *    - original_id IS NULL identifies original records
 *    - Adjustments (original_id IS NOT NULL) can have multiple entries
 *    (幂等性：original_id为NULL的记录在reference_id上唯一)
 */
export const mentorPayableLedgers = pgTable("mentor_payable_ledgers", {
  // ========== Primary Key & Relations ==========
  /**
   * Primary Key (主键)
   */
  id: uuid("id").primaryKey().defaultRandom(),

  /**
   * Reference ID - Links to service_references table
   * References: service_references.id
   * For sessions: Maps to session.id
   * (关联ID - 关联到service_references表的id)
   */
  referenceId: uuid("reference_id").notNull(),

  // ========== Participants ==========
  /**
   * Mentor ID (导师ID)
   * References: mentor.id
   */
  mentorId: uuid("mentor_id").notNull(),

  /**
   * Student ID (nullable) (学生ID - 可为空)
   * References: student.id
   * Nullable: Some services may not have students
   * (可为空：某些服务可能没有学生)
   */
  studentId: uuid("student_id"),

  // ========== Service Snapshot ==========
  /**
   * Service Type ID - Deprecated, use session_type_code instead
   * References: service_types.id
   * @deprecated Use sessionTypeCode instead
   */
  serviceTypeId: varchar("service_type_id", { length: 50 }), // Made nullable via migration

  /**
   * Session Type Code (会话类型代码)
   * References: session_types.id
   * Purpose: Links to session type configuration
   * (引用session_types.id，关联会话类型配置)
   */
  sessionTypeCode: varchar("session_type_code", { length: 50 }),

  // ========== Price Snapshot ==========
  /**
   * Unit Price - Price per session/hour/package
   * Precision: 12 digits total, 1 decimal place
   * (单价 - 每次会话/每小时/每课程包的价格)
   */
  price: numeric("price", { precision: 12, scale: 1 }).notNull(),

  /**
   * Total Amount - Calculated amount (may be negative for adjustments)
   * Precision: 12 digits total, 2 decimal places
   * (总金额 - 计算金额，调整记录可为负值)
   */
  amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),

  /**
   * Currency - ISO 4217 currency code
   * Default: USD
   * (货币 - ISO 4217货币代码)
   */
  currency: varchar("currency", { length: 3 }).notNull().default("USD"),

  // ========== Adjustments ==========
  /**
   * Original ID - Points to the adjusted record
   * Used for chain adjustments (supports multiple adjustments)
   * Null for original records
   * (原始ID - 指向被调整的记录，用于链式调整)
   */
  originalId: uuid("original_id"),

  /**
   * Adjustment Reason - Reason for adjustment
   * Required when original_id is not null
   * (调整原因 - original_id不为空时必填)
   */
  adjustmentReason: varchar("adjustment_reason", { length: 500 }),

  // ========== Timestamps ==========
  /**
   * Created At - Record creation timestamp (immutable)
   * (创建时间 - 记录创建时间戳，不可变)
   */
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),

  /**
   * Created By - Operator user ID (for audit trail)
   * References: identity.users.id
   * (创建人 - 操作者用户ID，用于审计)
   */
  createdBy: uuid("created_by"),
});

export type MentorPayableLedger = typeof mentorPayableLedgers.$inferSelect;
export type InsertMentorPayableLedger =
  typeof mentorPayableLedgers.$inferInsert;

/**
 * Unique Indexes (created in migration files):
 *
 * 1. idx_mentor_payable_reference
 *    Ensures each reference_id is unique for original records
 *    CREATE UNIQUE INDEX idx_mentor_payable_reference
 *    ON mentor_payable_ledgers(reference_id)
 *    WHERE original_id IS NULL;
 *
 * 2. Query optimization indexes:
 *    CREATE INDEX idx_mentor_payable_mentor
 *    ON mentor_payable_ledgers(mentor_id);
 *
 *    CREATE INDEX idx_mentor_payable_session_type
 *    ON mentor_payable_ledgers(session_type_code);
 *
 *    CREATE INDEX idx_mentor_payable_original
 *    ON mentor_payable_ledgers(original_id)
 *    WHERE original_id IS NOT NULL;
 */
