import {
  pgTable,
  uuid,
  varchar,
  numeric,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

/**
 * Settlement Ledgers Table (结算记录表)
 *
 * Design Principles (设计原则):
 * 1. **Append Only**: No UPDATE/DELETE, only INSERT
 *    - Once created, settlement records cannot be modified
 *    - No updatedAt/updatedBy fields
 *    (Append Only模式：只允许插入，不允许更新或删除)
 *
 * 2. **Anti-Corruption Layer**: No foreign keys to other domains
 *    - Use string UUID references instead of foreign keys
 *    - Comment foreign keys for documentation
 *    (防腐层：不关联其他域的表 - 使用字符串UUID引用，注释说明外键)
 *
 * 3. **Cross-Currency Support**: Store both original and target amounts
 *    - Supports currency conversion scenarios
 *    - Preserve original amount for audit trail
 *    (跨币种支持：同时存储原始金额和目标金额 - 支持币种转换场景)
 *
 * 4. **Immutable Records**: Settlement status is always CONFIRMED
 *    - Single state (CONFIRMED) for all settlement records
 *    - No state transitions
 *    (不可变记录：结算状态始终为CONFIRMED - 无需状态转换)
 *
 * 5. **Calculation Transparency**: Store calculation parameters
 *    - Store exchange rate and deduction rate for transparency
 *    - Enable audit and verification of calculations
 *    (计算透明度：存储计算参数 - 便于审计和验证)
 */
export const settlementLedgers = pgTable("settlement_ledgers", {
  // ========== Primary Key ==========
  /**
   * Primary Key (主键)
   */
  id: uuid("id").primaryKey().defaultRandom(),

  // ========== Relations ==========
  /**
   * Mentor ID (导师ID)
   * References: mentor.id
   * (关联到mentor表的id)
   */
  mentorId: uuid("mentor_id").notNull(),

  // ========== Settlement Period ==========
  /**
   * Settlement Month (结算月份)
   * Format: YYYY-MM (e.g., 2024-01)
   * (格式：YYYY-MM，如2024-01)
   */
  settlementMonth: varchar("settlement_month", { length: 7 }).notNull(),

  // ========== Amounts (Original and Target) ==========
  /**
   * Original Amount (原始金额)
   * Amount in original currency before conversion
   * Precision: 15 digits total, 2 decimal places
   * (原始币种金额，转换前的金额)
   */
  originalAmount: numeric("original_amount", { precision: 15, scale: 2 }).notNull(),

  /**
   * Target Amount (目标金额)
   * Amount in target currency after conversion
   * Precision: 15 digits total, 2 decimal places
   * (目标币种金额，转换后的金额)
   */
  targetAmount: numeric("target_amount", { precision: 15, scale: 2 }).notNull(),

  // ========== Currencies ==========
  /**
   * Original Currency (原始币种)
   * ISO 4217 currency code (e.g., USD, CNY, EUR)
   * (ISO 4217货币代码，如USD、CNY、EUR)
   */
  originalCurrency: varchar("original_currency", { length: 3 }).notNull(),

  /**
   * Target Currency (目标币种)
   * ISO 4217 currency code (e.g., USD, CNY, EUR)
   * (ISO 4217货币代码，如USD、CNY、EUR)
   */
  targetCurrency: varchar("target_currency", { length: 3 }).notNull(),

  // ========== Calculation Parameters ==========
  /**
   * Exchange Rate (汇率)
   * Rate used to convert from original currency to target currency
   * Precision: 10 digits total, 1 decimal place (DECIMAL(10,1))
   * (用于从原始币种转换到目标币种的汇率)
   */
  exchangeRate: numeric("exchange_rate", { precision: 10, scale: 1 }).notNull(),

  /**
   * Deduction Rate (扣除比率)
   * Percentage of amount to be deducted (e.g., platform fee)
   * Precision: 5 digits total, 4 decimal places (e.g., 0.0500 for 5%)
   * (扣除百分比，如平台费用)
   */
  deductionRate: numeric("deduction_rate", { precision: 5, scale: 4 }).notNull(),

  // ========== Status and Method ==========
  /**
   * Status (状态)
   * Only CONFIRMED status is used
   * Default: CONFIRMED
   * (仅使用CONFIRMED状态)
   */
  status: varchar("status", { length: 20 }).notNull().default("CONFIRMED"),

  /**
   * Settlement Method (结算方式)
   * Possible values: DOMESTIC_TRANSFER, CHANNEL_BATCH_PAY, GUSTO, GUSTO_INTERNATIONAL, CHECK
   * (可能值：DOMESTIC_TRANSFER、CHANNEL_BATCH_PAY、GUSTO、GUSTO_INTERNATIONAL、CHECK)
   */
  settlementMethod: varchar("settlement_method", { length: 50 }).notNull(),

  /**
   * Mentor Payment Info ID (关联的支付信息ID)
   * References: mentor_payment_infos.id
   * (关联到mentor_payment_infos表的id)
   */
  mentorPaymentInfoId: uuid("mentor_payment_info_id").notNull(),

  // ========== Timestamps (Creation only, no updates) ==========
  /**
   * Created At (创建时间)
   * Immutable timestamp
   * (不可变的创建时间戳)
   */
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),

  /**
   * Created By (创建人)
   * Operator user ID for audit trail
   * (操作者用户ID，用于审计追踪)
   */
  createdBy: uuid("created_by").notNull(),
}, (table) => [
  // [修复] Unique constraint to prevent duplicate settlements for same mentor/month [唯一约束防止同一导师/月份重复结算]
  // This ensures data integrity and prevents duplicate payments [这确保数据完整性并防止重复付款]
  uniqueIndex("idx_settlement_mentor_month").on(table.mentorId, table.settlementMonth),
]);

export type SettlementLedger = typeof settlementLedgers.$inferSelect;
export type InsertSettlementLedger = typeof settlementLedgers.$inferInsert;

/**
 * Unique Indexes (created in migration files):
 *
 * 1. idx_settlement_mentor_month
 *    Ensures each mentor has only one settlement per month
 *    CREATE UNIQUE INDEX idx_settlement_mentor_month
 *    ON settlement_ledgers(mentor_id, settlement_month);
 *
 * 2. Query optimization indexes:
 *    CREATE INDEX idx_settlement_mentor
 *    ON settlement_ledgers(mentor_id);
 *
 *    CREATE INDEX idx_settlement_month
 *    ON settlement_ledgers(settlement_month);
 *
 *    CREATE INDEX idx_settlement_status
 *    ON settlement_ledgers(status);
 *
 *    CREATE INDEX idx_settlement_created_at
 *    ON settlement_ledgers(created_at);
 */
