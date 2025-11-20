import {
  pgTable,
  uuid,
  timestamp,
} from "drizzle-orm/pg-core";

/**
 * Settlement Details Table (结算明细关联表)
 *
 * Design Principles (设计原则):
 * 1. **Association Table**: Links settlement_ledger records with mentor_payable_ledger records
 *    - Establishes many-to-many relationship between settlements and payable ledgers
 *    - Enables tracking of which payable ledgers are included in each settlement
 *    (关联表：建立settlement_ledgers与mentor_payable_ledgers之间的多对多关系)
 *
 * 2. **Append Only**: No UPDATE/DELETE, only INSERT
 *    - Records are permanent and cannot be modified
 *    - Provides complete audit trail of settlement composition
 *    (Append Only模式：只允许插入，不允许更新或删除 - 提供完整的结算组成审计追踪)
 *
 * 3. **Immutable Records**: Once created, records cannot be changed
 *    - Settlement composition is fixed for audit purposes
 *    - New settlements must be created to modify composition
 *    (不可变记录：创建后不可更改 - 结算组成固定用于审计)
 *
 * 4. **Traceability**: Track which payable ledgers are settled
 *    - Enables reverse lookup from payable ledgers to settlements
 *    - Supports verification and reconciliation processes
 *    (可追溯性：追踪哪些应付账款已被结算 - 支持验证和对账)
 */
export const settlementDetails = pgTable("settlement_details", {
  // ========== Primary Key ==========
  /**
   * Primary Key (主键)
   */
  id: uuid("id").primaryKey().defaultRandom(),

  // ========== Relations ==========
  /**
   * Settlement ID (结算记录ID)
   * References: settlement_ledgers.id
   * Links to the settlement record
   * (关联到settlement_ledgers表的id)
   */
  settlementId: uuid("settlement_id").notNull(),

  /**
   * Mentor Payable Ledger ID (导师应付账款流水ID)
   * References: mentor_payable_ledgers.id
   * Links to the payable ledger record being settled
   * (关联到mentor_payable_ledgers表的id)
   */
  mentorPayableId: uuid("mentor_payable_id").notNull(),

  // ========== Audit Trail ==========
  /**
   * Created At (创建时间)
   * Timestamp when the association was created
   * (关联记录创建时间戳)
   */
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),

  /**
   * Created By (创建人)
   * Operator user ID for audit trail
   * (操作者用户ID，用于审计追踪)
   */
  createdBy: uuid("created_by").notNull(),
});

export type SettlementDetail = typeof settlementDetails.$inferSelect;
export type InsertSettlementDetail = typeof settlementDetails.$inferInsert;

/**
 * Unique Indexes (created in migration files):
 *
 * 1. idx_settlement_detail_composite
 *    Ensures each payable ledger is linked to a settlement only once
 *    CREATE UNIQUE INDEX idx_settlement_detail_composite
 *    ON settlement_details(settlement_id, mentor_payable_id);
 *
 * 2. Query optimization indexes:
 *    CREATE INDEX idx_settlement_detail_settlement
 *    ON settlement_details(settlement_id);
 *
 *    CREATE INDEX idx_settlement_detail_payable
 *    ON settlement_details(mentor_payable_id);
 *
 *    CREATE INDEX idx_settlement_detail_created_at
 *    ON settlement_details(created_at);
 */
