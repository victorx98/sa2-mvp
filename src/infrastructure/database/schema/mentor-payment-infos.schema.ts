import { pgTable, uuid, varchar, jsonb, timestamp } from "drizzle-orm/pg-core";

/**
 * Mentor Payment Infos Table (导师支付信息表)
 *
 * Design Principles (设计原则):
 * 1. **Anti-Corruption Layer**: No foreign keys to other domains
 *    - Use string UUID references instead of foreign keys
 *    - Comment foreign keys for documentation
 *    (防腐层：不关联其他域的表 - 使用字符串UUID引用，注释说明外键)
 *
 * 2. **Flexible Payment Details**: Store payment details as JSON
 *    - Support multiple payment methods with different structures
 *    - Allow easy extension for new payment methods
 *    (灵活的支付详情：以JSON格式存储支付详情 - 支持多种支付方式)
 *
 * 3. **Status Management**: Support active/inactive status
 *    - Only one active payment info per mentor
 *    - Soft delete is preferred over hard delete
 *    (状态管理：支持激活/停用状态 - 每个导师只能有一条有效支付信息)
 */
export const mentorPaymentInfos = pgTable("mentor_payment_infos", {
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

  // ========== Payment Configuration ==========
  /**
   * Payment Currency (支付币种)
   * ISO 4217 currency code (e.g., USD, CNY, EUR)
   * (ISO 4217货币代码，如USD、CNY、EUR)
   */
  paymentCurrency: varchar("payment_currency", { length: 3 }).notNull(),

  /**
   * Payment Method (支付方式)
   * Possible values: DOMESTIC_TRANSFER, CHANNEL_BATCH_PAY, GUSTO, GUSTO_INTERNATIONAL, CHECK
   * (可能值：国内转账、渠道一起付、Gusto、Gusto-International、支票)
   */
  paymentMethod: varchar("payment_method", { length: 50 }).notNull(),

  /**
   * Payment Details (支付详情)
   * JSON format storing payment-specific details
   * Examples:
   * - Domestic Transfer: { bankName, accountNumber, accountHolder }
   * - Gusto: { employeeId, companyId }
   * - Check: { payee, address }
   * (JSON格式，根据支付方式存储不同的详情)
   */
  paymentDetails: jsonb("payment_details").notNull(),

  // ========== Status ==========
  /**
   * Status (状态)
   * Possible values: ACTIVE, INACTIVE
   * Default: ACTIVE
   * (可能值：ACTIVE(激活)、INACTIVE(停用)，默认ACTIVE)
   */
  status: varchar("status", { length: 20 }).notNull().default("ACTIVE"),

  // ========== Timestamps ==========
  /**
   * Created At (创建时间)
   */
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),

  /**
   * Updated At (更新时间)
   */
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),

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

export type MentorPaymentInfo = typeof mentorPaymentInfos.$inferSelect;
export type InsertMentorPaymentInfo = typeof mentorPaymentInfos.$inferInsert;

/**
 * Unique Indexes (created in migration files):
 *
 * 1. idx_mentor_payment_info_mentor_status
 *    Ensures each mentor has only one active payment info
 *    CREATE UNIQUE INDEX idx_mentor_payment_info_mentor_status
 *    ON mentor_payment_infos(mentor_id, status)
 *    WHERE status = 'ACTIVE';
 *
 * 2. Query optimization indexes:
 *    CREATE INDEX idx_mentor_payment_info_mentor
 *    ON mentor_payment_infos(mentor_id);
 *
 *    CREATE INDEX idx_mentor_payment_info_status
 *    ON mentor_payment_infos(status);
 */
