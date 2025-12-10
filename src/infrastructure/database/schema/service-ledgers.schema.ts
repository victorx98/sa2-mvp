import {
  pgTable,
  uuid,
  varchar,
  integer,
  timestamp,
  text,
  pgEnum,
  jsonb,
} from "drizzle-orm/pg-core";
import { userTable } from "./user.schema";
import { serviceTypes } from "./service-types.schema";

/**
 * Service ledger type enum
 * - consumption: Service consumption (quantity < 0)
 * - refund: Refund (quantity > 0)
 * - adjustment: Manual adjustment (quantity can be positive or negative)
 */
export const serviceLedgerTypeEnum = pgEnum("service_ledger_type", [
  "consumption", // 服务消费（quantity < 0）[Service consumption (quantity < 0)]
  "refund", // 退款增加（quantity > 0）[Refund increase (quantity > 0)]
  "adjustment", // 手动调整（quantity 可正可负）[Manual adjustment (quantity can be positive or negative)]
]);

/**
 * Service ledger source enum
 * - booking_completed: Service session completed
 * - booking_cancelled: Booking cancelled by user
 * - manual_adjustment: Admin manual adjustment
 */
export const serviceLedgerSourceEnum = pgEnum("service_ledger_source", [
  "booking_completed", // 预约完成[Booking completed]
  "booking_cancelled", // 预约取消[Booking cancelled]
  "manual_adjustment", // 手动调整[Manual adjustment]
]);

/**
 * Service Ledgers Table (服务消费流水表)
 *
 * Core Architecture: Append-only tracking of service consumption
 *
 * Design Principles:
 * 1. **Append-only**: Only INSERT allowed, no UPDATE/DELETE permitted
 * 2. **Balance snapshot**: Each entry records balanceAfter for reconciliation
 * 3. **Full audit trail**: Immutable record of all service consumption and adjustments
 * 4. **Trigger-driven**: INSERT automatically updates contract_service_entitlements.consumed_quantity
 *
 * Data Flow:
 * 1. Service completed → INSERT into service_ledgers (quantity = -1)
 * 2. Trigger automatically executes → UPDATE contract_service_entitlements.consumed_quantity += 1
 * 3. Both operations in same transaction (atomic guarantee)
 */
export const serviceLedgers = pgTable("service_ledgers", {
  // Primary key
  id: uuid("id").defaultRandom().primaryKey(),

  // 关联学生 (Associated student)
  studentId: varchar("student_id", { length: 32 })
    .notNull()
    .references(() => userTable.id),

  // 服务类型 (Service type)
  serviceType: varchar("service_type", { length: 50 })
    .notNull()
    .references(() => serviceTypes.code), // Reference to service_types.code

  // 数量变化（负数=消费，正数=退款/调整）(Quantity change - negative=consumption, positive=refund/adjustment)
  quantity: integer("quantity").notNull(),

  // 流水类型 (Ledger type)
  type: serviceLedgerTypeEnum("type").notNull(),

  // 来源 (Source)
  source: serviceLedgerSourceEnum("source").notNull(),

  // 操作后余额（必须 >= 0，用于对账）[Balance after operation (must be >= 0, for reconciliation)]
  balanceAfter: integer("balance_after").notNull(),

  // 关联记录 (Related records)
  relatedHoldId: uuid("related_hold_id"), // 关联预占 (Related hold)
  relatedBookingId: uuid("related_booking_id"), // 关联预约 (Related booking)

  // 审计字段 (Audit fields)
  reason: text("reason"), // 调整原因（adjustment必填）[Reason (required for adjustment)]
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  createdBy: varchar("created_by", { length: 32 })
    .notNull()
    .references(() => userTable.id),

  // 元数据 (Metadata)
  metadata: jsonb("metadata").$type<ServiceLedgerMetadata>().default({}), // Metadata for booking source and other extended information [用于预约来源和其他扩展信息的元数据]
});

/**
 * Service Ledger Metadata Interface [服务流水元数据接口]
 * Stores extended information about the ledger entry [存储流水条目的扩展信息]
 */
export interface ServiceLedgerMetadata {
  bookingSource?: string; // Booking table name (e.g., 'regular_mentoring_sessions', 'job_applications') [预约表名（如'regular_mentoring_sessions'、'job_applications'）]
}

export type ServiceLedger = typeof serviceLedgers.$inferSelect;
export type InsertServiceLedger = typeof serviceLedgers.$inferInsert;

/*
 * Indexes (在 contract_indexes.sql 中创建):
 *
 * 1. 按学生 + 服务类型查询 (Query by student + service type)
 *    CREATE INDEX idx_ledgers_by_student_service
 *    ON service_ledgers(student_id, service_type, created_at DESC);
 *
 * 2. 按服务类型统计 (Statistics by service type)
 *    CREATE INDEX idx_ledgers_by_service_type
 *    ON service_ledgers(service_type, student_id, created_at DESC);
 *
 * 3. 按创建时间查询 (Query by creation time)
 *    CREATE INDEX idx_ledgers_created_at
 *    ON service_ledgers(created_at DESC);
 */
