import {
  pgTable,
  uuid,
  varchar,
  integer,
  timestamp,
  text,
  json,
  pgEnum,
} from "drizzle-orm/pg-core";
import { userTable } from "./user.schema";
import { serviceTypeEnum } from "./service-type.enum";

/**
 * 权益流水类型枚举 (Entitlement ledger type enum)
 * - addon: 促成签约 (To facilitate contract signing)
 * - promotion: 促销活动 (Promotional activity)
 * - compensation: 补偿 (Compensation for service issues)
 */
export const entitlementLedgerTypeEnum = pgEnum("entitlement_ledger_type", [
  "addon", // 促成签约
  "promotion", // 促销活动
  "compensation", // 补偿
]);

// 服务快照接口 (Service snapshot interface)
interface ServiceSnapshot {
  serviceId?: string;
  serviceName?: string;
  serviceType?: string;
  quantity?: number;
}

// 产品快照接口 (Product snapshot interface)
interface ProductSnapshot {
  productId?: string;
  productName?: string;
  productVersion?: string;
}

/**
 * Contract Amendment Ledgers Table (v2.16.13 重命名自 contract_entitlement_ledgers)
 *
 * Core Purpose: Audit log system for contract amendments (合同修正审计流水表)
 * Renamed: v2.16.13 from "contract_entitlement_ledgers" to better reflect business intent
 *
 * Design Principles (v2.16.10 重大简化):
 * - ✅ 立即生效：所有权益变更创建后立即应用
 * - ✅ 简化设计：从21个字段减少到15个字段（精简28.6%）
 * - ✅ 移除审批：无需管理员审批，变更直接生效
 * - ✅ 完整审计：记录 who/when/what/why 用于追溯
 *
 * Scope:
 * - ✅ 仅记录"合同修正"添加的服务权益（addon/promotion/compensation）
 * - ❌ 不记录合同初始权益（初始权益在 contract_service_entitlements 直接创建）
 * - ❌ 不记录日常消费（由 service_ledgers 记录）
 * - ❌ 不记录预占（由 service_holds 记录）
 *
 * Data Flow:
 * 1. Application layer INSERT into this table (amendment ledger entry)
 * 2. Trigger automatically updates contract_service_entitlements.total_quantity
 * 3. Application layer INSERT into service_ledgers (audit trail)
 * 4. Both operations happen in same transaction (atomic)
 *
 * @change {v2.16.13} Renamed from contractEntitlementLedgers to contractAmendmentLedgers
 */
export const contractAmendmentLedgers = pgTable(
  "contract_amendment_ledgers",
  {
    id: uuid("id").defaultRandom().primaryKey(),

    // 关联学生 (Associated student)
    studentId: varchar("student_id", { length: 32 })
      .notNull()
      .references(() => userTable.id),

    // 服务类型 (Service type)
    serviceType: serviceTypeEnum("service_type").notNull(),

    // 变更类型 (Type of change)
    ledgerType: entitlementLedgerTypeEnum("ledger_type").notNull(),

    // 变更数量（正数）(Quantity changed - positive number)
    quantityChanged: integer("quantity_changed").notNull(),

    // 变更原因 (Reason for change - required for audit)
    reason: text("reason").notNull(),

    // 详细说明 (Detailed description)
    description: text("description"),

    // 附件URL数组 (Array of attachment URLs)
    attachments: json("attachments").$type<string[]>(),

    // 操作人 (Operator)
    createdBy: varchar("created_by", { length: 32 })
      .notNull()
      .references(() => userTable.id),

    // 时间戳 (Timestamp)
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),

    // 快照信息（可选，包含 contract_id 用于审计）(Snapshot info)
    snapshot: json("snapshot").$type<{
      contractId?: string;
      contractNumber?: string;
      serviceSnapshot?: ServiceSnapshot;
      productSnapshot?: ProductSnapshot;
    }>(),
  },
);


export type ContractAmendmentLedger =
  typeof contractAmendmentLedgers.$inferSelect;
export type NewContractAmendmentLedger =
  typeof contractAmendmentLedgers.$inferInsert;

/*
 * Indexes (在 contract_indexes.sql 中创建):
 *
 * 1. 按学生查询合同修正历史 (Query amendment history by student)
 *    CREATE INDEX idx_ledger_by_student
 *    ON contract_amendment_ledgers(student_id, service_type, created_at DESC);
 *
 * 2. 按类型查询（统计促销活动）(Query by type - statistics for promotions)
 *    CREATE INDEX idx_ledger_by_type
 *    ON contract_amendment_ledgers(ledger_type, student_id, created_at DESC);
 *
 * 3. 按创建时间查询 (Query by creation time)
 *    CREATE INDEX idx_ledger_created_at
 *    ON contract_amendment_ledgers(created_at DESC);
 *
 * 4. 按操作人审计 (Audit by operator)
 *    CREATE INDEX idx_ledger_by_created_by
 *    ON contract_amendment_ledgers(created_by, created_at DESC);
 *
 * CHECK Constraints:
 * - quantity_changed > 0 (正数)
 * - reason NOT NULL AND length(reason) > 0 (原因必填)
 */
