import { pgTable, uuid, timestamp, text, jsonb } from "drizzle-orm/pg-core";
import { ContractStatus } from "../../../shared/types/contract-enums";
import { contracts } from "./contracts.schema";

/**
 * Contract Status History table [合同状态变更历史表]
 * Tracks all status changes for contracts for audit trail [跟踪所有合同状态变更以用于审计跟踪]
 *
 * Key features:
 * - Records every status transition with timestamp [记录每次状态转换及其时间戳]
 * - Stores change reason for operations like suspend/terminate [存储变更原因（如暂停/终止操作）]
 * - Links to user who made the change [关联到执行变更的用户]
 * - Supports metadata for additional context [支持元数据以提供额外上下文]
 */
export const contractStatusHistory = pgTable("contract_status_history", {
  // Primary key
  id: uuid("id").defaultRandom().primaryKey(),

  // Contract reference
  contractId: uuid("contract_id")
    .notNull()
    .references(() => contracts.id, { onDelete: "cascade" }),

  // Status change information
  fromStatus: text("from_status").$type<ContractStatus>(), // Previous status, null for initial state [变更前状态，初始状态为null]
  toStatus: text("to_status").notNull().$type<ContractStatus>(), // New status [变更后状态]

  // Change metadata
  changedAt: timestamp("changed_at", { withTimezone: true })
    .notNull()
    .defaultNow(), // Status change timestamp [状态变更时间]
  changedBy: uuid("changed_by"), // User ID who made the change [变更操作人用户ID]
  reason: text("reason"), // Reason for status change (for suspend/terminate) [变更原因（用于暂停/终止等操作）]
  metadata: jsonb("metadata").default({}), // Additional metadata [额外元数据]
});

// Type inference
export type ContractStatusHistory = typeof contractStatusHistory.$inferSelect;
export type InsertContractStatusHistory =
  typeof contractStatusHistory.$inferInsert;
