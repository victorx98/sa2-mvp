import {
  pgTable,
  uuid,
  varchar,
  integer,
  timestamp,
} from "drizzle-orm/pg-core";
import { userTable } from "./user.schema";
import { serviceTypes } from "./service-types.schema";
import { HoldStatus } from "../../../shared/types/contract-enums";

/**
 * Service Holds Table (v2.16.13 - 服务预占表)
 *
 * Core Architecture: 防止超额预约的服务预占机制 (Service reservation to prevent over-booking)
 *
 * Key Design Decisions:
 *
 * v2.16.13 重新引入过期机制 (Re-introduced expiration mechanism):
 * - ✅ 添加 expiryAt 字段 (Added expiryAt field)
 * - ✅ 支持自动过期和手动释放 (Supports both automatic expiration and manual release)
 * - ✅ 状态管理：active → released/cancelled/expired (Status management)
 *
 * v2.16.9 重大简化 (Major simplification):
 * - ❌ 移除 TTL 过期机制 (Removed TTL expiration)
 * - ❌ 移除 expiresAt 字段 (Removed expiresAt field)
 * - ✅ 预占永不过期 (Holds never expire automatically)
 * - ✅ 必须手动释放 (Must be manually released)
 * - ✅ 状态管理：active → released/cancelled (Status management)
 *
 * v2.16.5 触发器同步 (Trigger synchronization - C-NEW-2):
 * - ✅ held_quantity 由触发器自动同步 (held_quantity automatically synced by trigger)
 * - ✅ 保证数据一致性 (Ensures data consistency)
 * - ✅ 应用层无需手动同步 (No manual sync needed in application layer)
 *
 * Use Cases:
 * - 学生预约服务时创建预占 (Create hold when student books service)
 * - 服务完成后释放预占并生成消费流水 (Release hold and create consumption ledger after service completion)
 * - 用户取消预约时取消预占 (Cancel hold when user cancels booking)
 * - 预占过期时自动释放 (Automatic release when hold expires)
 *
 * State Transitions:
 * active → released (service completed or admin manual release)
 * active → cancelled (user cancelled the booking)
 * active → expired (hold expired automatically)
 *
 * Data Flow:
 * 1. Create hold → INSERT into service_holds (status = 'active')
 * 2. Trigger executes → UPDATE contract_service_entitlements.held_quantity += quantity
 * 3. Service completed → UPDATE service_holds (status = 'released')
 * 4. Trigger executes → UPDATE contract_service_entitlements.held_quantity -= quantity
 * 5. Create service ledger → INSERT into service_ledgers (consumption record)
 * 6. Hold expired → UPDATE service_holds (status = 'expired')
 * 7. Trigger executes → UPDATE contract_service_entitlements.held_quantity -= quantity
 */
export const serviceHolds = pgTable("service_holds", {
  // Primary key
  id: uuid("id").defaultRandom().primaryKey(),

  // 关联学生（移除 contract_id，只关联学生）[Associated student (removed contract_id, only associate with student)]
  studentId: uuid("student_id")
    .notNull()
    .references(() => userTable.id),

  // 服务类型 (Service type)
  serviceType: varchar("service_type", { length: 50 })
    .notNull()
    .references(() => serviceTypes.code), // Reference to service_types.code

  // 预占数量 (Hold quantity)
  quantity: integer("quantity").notNull().default(1),

  // 状态管理 (Status management)
  status: varchar("status", { length: 20 })
    .notNull()
    .default("active")
    .$type<HoldStatus>(),

  // 关联预约 (Related booking)
  relatedBookingId: uuid("related_booking_id"),

  // 过期时间 (Expiration time)
  expiryAt: timestamp("expiry_at", { withTimezone: true }), // null表示永不过期 [null means never expires]

  // 释放信息 (Release information)
  releasedAt: timestamp("released_at", { withTimezone: true }),
  releaseReason: varchar("release_reason", { length: 100 }), // 'completed' | 'cancelled' | 'admin_manual' | 'expired'

  // 审计字段 (Audit fields)
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  createdBy: uuid("created_by")
    .notNull()
    .references(() => userTable.id),
});

// Type inference
export type ServiceHold = typeof serviceHolds.$inferSelect;
export type InsertServiceHold = typeof serviceHolds.$inferInsert;

/*
 * Indexes (在 contract_indexes.sql 中创建):
 *
 * 1. 查询学生的活跃预占 (Query active holds for student)
 *    CREATE INDEX idx_holds_by_student_active
 *    ON service_holds(student_id, service_type, status)
 *    WHERE status = 'active';
 *
 * 2. 按预约查询 (Query by booking)
 *    CREATE INDEX idx_holds_by_booking
 *    ON service_holds(related_booking_id);
 *
 * 3. 按创建时间查询长时间未释放的预占 (Query long-unreleased holds by creation time)
 *    CREATE INDEX idx_holds_created_at
 *    ON service_holds(created_at)
 *    WHERE status = 'active';
 *
 * 4. 查询过期的预占 (Query expired holds)
 *    CREATE INDEX idx_holds_expiry
 *    ON service_holds(expiry_at, status)
 *    WHERE status = 'active' AND expiry_at IS NOT NULL;
 *
 * CHECK 约束 (在 contract_constraints.sql 中创建):
 * - quantity > 0 (预占数量必须为正)
 * - released 状态必须设置时间 (released status must have timestamp)
 * - expired 状态必须设置时间 (expired status must have timestamp)
 */

// Trigger function (在 contract_triggers.sql 中创建):
// - sync_hold_to_entitlement(): Updates contract_service_entitlements.held_quantity
//   when service_holds INSERT (active) or UPDATE (active → released/cancelled)
