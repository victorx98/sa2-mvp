import {
  pgTable,
  uuid,
  varchar,
  integer,
  timestamp,
  text,
  json,
  boolean,
  pgEnum,
} from "drizzle-orm/pg-core";
import { contracts } from "./contracts.schema";
import { contractServiceEntitlements } from "./contract-service-entitlements.schema";
import { userTable } from "./user.schema";

/**
 * 权益修订类型枚举
 * - initial: 初始权益（创建合同时）
 * - addon: 添加额外权益（促成签约）
 * - promotion: 促销活动赠送
 * - compensation: 补偿
 * - increase: 增加数量（手动调整）
 * - decrease: 减少数量（手动调整）
 * - expiration: 过期调整
 * - termination: 合同终止时的权益处理
 */
export const entitlementRevisionTypeEnum = pgEnum("entitlement_revision_type", [
  "initial",
  "addon",
  "promotion",
  "compensation",
  "increase",
  "decrease",
  "expiration",
  "termination",
]);

/**
 * 修订状态枚举（审核流程）
 * - pending: 待审核
 * - approved: 已批准
 * - rejected: 已拒绝
 * - applied: 已应用
 */
export const revisionStatusEnum = pgEnum("revision_status", [
  "pending",
  "approved",
  "rejected",
  "applied",
]);

/**
 * 合同权益修订表
 *
 * 用途：记录合同服务权益的变更历史，支持审计追溯和版本管理
 * 设计决策：
 * - 合同级别版本号：revisionNumber在合同内全局递增
 * - 仅记录"权益赋予"类变更（不记录消费/预占等临时状态）
 * - 关联到具体权益记录（entitlementId）
 * - 支持审核流程（status, requiresApproval）
 * - 创建合同时记录初始权益（revisionType='initial'）
 */
export const contractEntitlementRevisions = pgTable(
  "contract_entitlement_revisions",
  {
    id: uuid("id").defaultRandom().primaryKey(),

    // 关联合同
    contractId: uuid("contract_id")
      .notNull()
      .references(() => contracts.id, { onDelete: "cascade" }),

    // 关联权益记录
    entitlementId: uuid("entitlement_id").references(
      () => contractServiceEntitlements.id,
      { onDelete: "set null" },
    ),

    // 服务类型
    serviceType: varchar("service_type", { length: 100 }).notNull(),

    // 服务名称快照
    serviceName: varchar("service_name", { length: 500 }).notNull(),

    // 修订版本号（合同内全局递增）
    revisionNumber: integer("revision_number").notNull(),

    // 修订类型
    revisionType: entitlementRevisionTypeEnum("revision_type").notNull(),

    // 权益来源
    source: varchar("source", { length: 50 }).notNull(),

    // 变更数量（正数=增加，负数=减少）
    quantityChanged: integer("quantity_changed").notNull(),

    // 变更后的总量
    totalQuantity: integer("total_quantity").notNull(),

    // 变更后的可用量
    availableQuantity: integer("available_quantity").notNull(),

    // 审核状态
    status: revisionStatusEnum("status").notNull().default("pending"),

    // 需要审批
    requiresApproval: boolean("requires_approval").notNull().default(false),

    // 审批信息
    approvedBy: varchar("approved_by", { length: 32 }).references(
      () => userTable.id,
    ),
    approvedAt: timestamp("approved_at", { withTimezone: true }),
    approvalNotes: text("approval_notes"),

    // 变更原因（addon/promotion/compensation 时必填）
    addOnReason: text("add_on_reason"),

    // 详细说明
    description: text("description"),

    // 附件（如：审批文件、客户确认邮件等）
    attachments: json("attachments").$type<string[]>(),

    // 操作人（创建人）
    createdBy: varchar("created_by", { length: 32 }).references(
      () => userTable.id,
    ),

    // 关联的业务ID
    relatedBookingId: uuid("related_booking_id"),
    relatedHoldId: uuid("related_hold_id"),
    relatedProductId: uuid("related_product_id"),

    // 快照信息
    snapshot: json("snapshot").$type<{
      serviceSnapshot?: any;
      productSnapshot?: any;
      originItems?: any[];
    }>(),

    // 审计字段
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
);

// 索引定义（用于查询优化）
// 这些索引将在迁移文件中创建

// 1. 按合同查询修订历史
// CREATE INDEX idx_entitlement_revisions_contract ON contract_entitlement_revisions(contract_id);

// 2. 按权益记录查询修订历史
// CREATE INDEX idx_entitlement_revisions_entitlement ON contract_entitlement_revisions(entitlement_id);

// 3. 按服务类型查询
// CREATE INDEX idx_entitlement_revisions_service_type ON contract_entitlement_revisions(service_type);

// 4. 按修订类型查询
// CREATE INDEX idx_entitlement_revisions_revision_type ON contract_entitlement_revisions(revision_type);

// 5. 按状态查询（审核流程）
// CREATE INDEX idx_entitlement_revisions_status ON contract_entitlement_revisions(status);

// 6. 按创建时间查询
// CREATE INDEX idx_entitlement_revisions_created_at ON contract_entitlement_revisions(created_at);

// 唯一约束：每个合同的修订版本号必须唯一
// CREATE UNIQUE INDEX idx_entitlement_revisions_version_unique
// ON contract_entitlement_revisions(contract_id, revision_number);

// CHECK 约束：quantityChanged 不能为 0
// ALTER TABLE contract_entitlement_revisions ADD CONSTRAINT chk_quantity_changed_not_zero
// CHECK (quantity_changed != 0);

// CHECK 约束：如果状态是 pending，则 requires_approval 必须为 true
// ALTER TABLE contract_entitlement_revisions ADD CONSTRAINT chk_approval_consistency
// CHECK (
//   (status != 'pending') OR
//   (status = 'pending' AND requires_approval = true)
// );

export type ContractEntitlementRevision =
  typeof contractEntitlementRevisions.$inferSelect;
export type NewContractEntitlementRevision =
  typeof contractEntitlementRevisions.$inferInsert;
