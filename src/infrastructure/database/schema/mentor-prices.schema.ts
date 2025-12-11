import {
  pgTable,
  uuid,
  varchar,
  decimal,
  timestamp,
  index,
} from "drizzle-orm/pg-core";

/**
 * Mentor Prices Table (导师价格配置表)
 *
 * Design Principles (设计原则):
 * 1. Price configuration associated with mentor and service type
 *    (价格配置与导师和服务类型关联)
 * 2. Support multiple billing modes (支持多种计费模式)
 * 3. Price history traceable (价格历史可追溯)
 *
 * Notes (注意事项):
 * 1. Price changes do NOT require creating new records, update existing record
 *    (价格变更不需要创建新记录，而是更新现有记录)
 * 2. Price changes do NOT require approval workflow
 *    (价格变更不需要审批流程)
 * 3. Price changes do NOT require notification to related parties
 *    (价格变更不需要通知相关方)
 * 4. Price changes require recording the changer, not the reason
 *    (价格变更需要记录变更人，不需要记录变更原因)
 */
export const mentorPrices = pgTable(
  "mentor_prices",
  {
    // ========== Primary Key ==========
    /**
     * Record ID (记录ID)
     */
    id: uuid("id").defaultRandom().primaryKey(),

    // ========== Entity References ==========
    /**
     * Mentor User ID (导师用户ID)
     * References: user.id
     */
    mentorUserId: uuid("mentor_user_id")
      .notNull(),

    /**
     * Session Type ID (会话类型ID) - Deprecated, use session_type_code instead
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

    // ========== Pricing Configuration ==========
    /**
     * Package Code - Optional (课程包编码 - 可选)
     */
    packageCode: varchar("package_code", { length: 50 }),

    /**
     * Price amount (价格金额)
     * Precision: 12 digits total, 1 decimal place (精度：总共12位，1位小数)
     */
    price: decimal("price", { precision: 12, scale: 1 }).notNull(),

    /**
     * Currency code (货币代码)
     * ISO 4217 format (ISO 4217格式)
     * Default: USD
     */
    currency: varchar("currency", { length: 3 }).notNull().default("USD"),

    /**
     * Status of the price configuration (价格配置状态)
     * Values: 'active', 'inactive' (值：'active', 'inactive')
     * Default: active
     */
    status: varchar("status", { length: 20 }).notNull().default("active"),

    /**
     * Updated by user ID (变更人用户ID)
     * References: user.id
     * Nullable: Initial creation may not have an updater
     * (可为空：初始创建可能没有更新者)
     */
    updatedBy: uuid("updated_by"),

    // ========== Timestamps ==========
    /**
     * Creation timestamp (创建时间戳)
     */
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),

    /**
     * Last update timestamp (最后更新时间戳)
     */
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    // Composite index: Mentor User ID + Session Type Code + Status
    // (复合索引：导师用户ID + 会话类型代码 + 状态)
    mentorSessionTypeIdx: index("idx_mentor_session_type_status").on(
      table.mentorUserId,
      table.sessionTypeCode,
      table.status,
    ),

    // Mentor User ID index (导师用户ID索引)
    mentorIdx: index("idx_mentor_prices_mentor").on(table.mentorUserId),

    // Session type code index (会话类型代码索引)
    sessionTypeIdx: index("idx_mentor_prices_session_type").on(
      table.sessionTypeCode,
    ),

    // Status index (状态索引)
    statusIdx: index("idx_mentor_prices_status").on(table.status),
  }),
);

export type MentorPrice = typeof mentorPrices.$inferSelect;
export type InsertMentorPrice = typeof mentorPrices.$inferInsert;
