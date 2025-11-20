import {
  pgTable,
  uuid,
  varchar,
  numeric,
  timestamp,
} from "drizzle-orm/pg-core";

/**
 * Payment Params Table (支付参数表)
 *
 * Design Principles (设计原则):
 * 1. **Monthly Default Parameters**: Store default exchange rate and deduction rate per currency per month
 *    - Parameters can be modified within the month
 *    - Modified parameters apply to subsequent batches
 *    (月度默认参数：按币种和月份存储默认汇率和扣除比率)
 *
 * 2. **Temporal Parameters**: Parameters are time-bound (by month)
 *    - Each month can have different parameters
 *    - Historical parameters are preserved for audit
 *    (时效性参数：参数与时间绑定(按月) - 每月可有不同参数)
 *
 * 3. **Currency-Specific**: Parameters are specific to each currency
 *    - Different currencies can have different parameters
 *    - Enables multi-currency settlement scenarios
 *    (币种特定：每个币种可有不同参数 - 支持多币种结算)
 *
 * 4. **Audit Trail**: Full audit information for parameter changes
 *    - Track who created and updated the parameters
 *    - Maintain timestamps for all operations
 *    (审计追踪：完整的参数变更审计信息)
 */
export const paymentParams = pgTable("payment_params", {
  // ========== Primary Key ==========
  /**
   * Primary Key (主键)
   */
  id: uuid("id").primaryKey().defaultRandom(),

  // ========== Identification ==========
  /**
   * Currency (币种)
   * ISO 4217 currency code (e.g., USD, CNY, EUR)
   * (ISO 4217货币代码，如USD、CNY、EUR)
   */
  currency: varchar("currency", { length: 3 }).notNull(),

  /**
   * Settlement Month (结算月份)
   * Format: YYYY-MM (e.g., 2024-01)
   * (格式：YYYY-MM，如2024-01)
   */
  settlementMonth: varchar("settlement_month", { length: 7 }).notNull(),

  // ========== Parameters ==========
  /**
   * Default Exchange Rate (默认汇率)
   * Used to convert from original currency to target currency
   * Precision: 10 digits total, 1 decimal place (DECIMAL(10,1))
   * (用于从原始币种转换到目标币种的默认汇率)
   */
  defaultExchangeRate: numeric("default_exchange_rate", { precision: 10, scale: 1 }).notNull(),

  /**
   * Default Deduction Rate (默认扣除比率)
   * Percentage of amount to be deducted (e.g., platform fee)
   * Precision: 5 digits total, 4 decimal places (e.g., 0.0500 for 5%)
   * (默认扣除百分比，如平台费用)
   */
  defaultDeductionRate: numeric("default_deduction_rate", { precision: 5, scale: 4 }).notNull(),

  // ========== Timestamps ==========
  /**
   * Created At (创建时间)
   */
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),

  /**
   * Updated At (更新时间)
   */
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),

  /**
   * Created By (创建人)
   * References: identity.users.id
   * (关联到identity.users表的id)
   */
  createdBy: uuid("created_by"),

  /**
   * Updated By (更新人)
   * References: identity.users.id
   * (关联到identity.users表的id)
   */
  updatedBy: uuid("updated_by"),
});

export type PaymentParam = typeof paymentParams.$inferSelect;
export type InsertPaymentParam = typeof paymentParams.$inferInsert;

/**
 * Unique Indexes (created in migration files):
 *
 * 1. idx_payment_params_currency_month
 *    Ensures each currency has only one set of parameters per month
 *    CREATE UNIQUE INDEX idx_payment_params_currency_month
 *    ON payment_params(currency, settlement_month);
 *
 * 2. Query optimization indexes:
 *    CREATE INDEX idx_payment_params_currency
 *    ON payment_params(currency);
 *
 *    CREATE INDEX idx_payment_params_month
 *    ON payment_params(settlement_month);
 */
