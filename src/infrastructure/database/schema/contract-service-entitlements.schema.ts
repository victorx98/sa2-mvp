import { pgTable, integer, timestamp, uuid } from "drizzle-orm/pg-core";
import { userTable } from "./user.schema";
import { serviceTypeEnum } from "./services.schema";

/**
 * Contract service entitlements table (v2.16.12 - 学生级权益累积制)
 *
 * Core Architecture: 学生级别权益累积制 (Per-student cumulative entitlement system)
 * - PRIMARY KEY: (student_id, service_type) - 累积制核心
 * - 每个学生每种服务只有一条累积记录
 * - 多个合同的同类型服务权益自动累加
 * - 合同终止后权益继续保留
 *
 * Data Consistency: 触发器自动维护（应用层禁止直接 UPDATE/DELETE）
 * - total_quantity: 触发器从 contract_amendment_ledgers 累加
 * - consumed_quantity: 触发器从 service_ledgers 累加
 * - held_quantity: 触发器从 service_holds 更新
 * - available_quantity: 自动计算 (CHECK 约束)
 *
 * Key Principles:
 * 1. 权益跨合同累积 (Cross-contract accumulation)
 * 2. 合同终止不影响已累积权益 (Contract termination doesn't affect accumulated entitlements)
 * 3. 查询性能优化（单表查询）(Query performance optimization)
 * 4. 职责清晰分离 (Clear separation of responsibilities)
 *
 * Constraints (在 contract_constraints.sql 中定义):
 * - chk_available_quantity_non_negative: available_quantity >= 0
 * - chk_balance_consistency: available = total - consumed - held
 * - chk_quantities_non_negative: total, consumed, held >= 0
 * - chk_consumed_plus_held_not_exceed_total: consumed + held <= total
 */
export const contractServiceEntitlements = pgTable(
  "contract_service_entitlements",
  {
    // Primary key
    id: uuid("id").primaryKey().defaultRandom(),

    // 学生ID（外键）[Student ID (foreign key)]
    studentId: uuid("student_id").notNull(),

    // 服务类型[Service type]
    serviceType: serviceTypeEnum("service_type").notNull(),

    // 权益数量（触发器自动维护）[Entitlement quantities (maintained by triggers automatically)]
    totalQuantity: integer("total_quantity").notNull().default(0), // 总权益（初始 + 额外）[Total entitlement (initial + additional)]

    consumedQuantity: integer("consumed_quantity").notNull().default(0), // 已消费[Consumed]

    heldQuantity: integer("held_quantity").notNull().default(0), // 预占[Held]

    availableQuantity: integer("available_quantity").notNull().default(0), // 可用 = total - consumed - held[Available = total - consumed - held]

    // 审计字段[Audit fields]
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),

    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),

    createdBy: uuid("created_by"),
  },
);

export type ContractServiceEntitlement =
  typeof contractServiceEntitlements.$inferSelect;
export type InsertContractServiceEntitlement =
  typeof contractServiceEntitlements.$inferInsert;
