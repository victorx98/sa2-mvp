import {
  pgTable,
  uuid,
  varchar,
  decimal,
  timestamp,
  boolean,
  index,
  primaryKey,
} from "drizzle-orm/pg-core";
import { mentorTable } from "./mentor.schema";
import { serviceTypes } from "./service-types.schema";

/**
 * 导师价格表
 *
 * 设计原则：
 * 1. 价格配置与导师和服务类型关联
 * 2. 支持多种计费模式
 * 3. 价格历史可追溯
 * 4. 价格变更需要审批
 *
 * 注意事项：
 * 1. 价格变更需要创建新记录，而不是更新现有记录
 * 2. 价格变更需要审批流程
 * 3. 价格变更需要通知相关方
 * 4. 价格变更需要记录变更原因
 * 5. 价格变更需要记录变更人
 * 6. 价格变更需要记录变更时间
 * 7. 价格变更需要记录变更前的值
 * 8. 价格变更需要记录变更后的值
 * 9. 价格变更需要记录变更的影响范围
 * 10. 价格变更需要记录变更的影响对象
 */
export const mentorPrices = pgTable(
  "mentor_prices",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    mentorUserId: varchar("mentor_user_id", { length: 32 })
      .references(() => mentorTable.userId, { onDelete: "cascade" })
      .notNull(),
    serviceTypeCode: varchar("service_type_code", { length: 50 }) // 使用serviceTypeCode引用service_types.code
      .notNull()
      .references(() => serviceTypes.code, { onDelete: "cascade" }),
    billingMode: varchar("billing_mode", { length: 20 }).notNull(), // 'one_time', 'per_session', 'staged'
    price: decimal("price", { precision: 10, scale: 2 }).notNull(),
    currency: varchar("currency", { length: 3 }).notNull().default("USD"),
    status: varchar("status", { length: 20 }).notNull().default("active"), // 'active', 'inactive'
    updatedBy: varchar("updated_by", { length: 32 }).references(
      () => mentorTable.userId,
    ),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    // 复合索引：导师ID + 服务类型代码 + 状态
    mentorServiceTypeIdx: index("idx_mentor_service_type").on(
      table.mentorUserId,
      table.serviceTypeCode,
      table.status,
    ),
    // 导师ID索引
    mentorIdx: index("idx_mentor_prices_mentor").on(table.mentorUserId),
    // 服务类型代码索引
    serviceTypeIdx: index("idx_mentor_prices_service_type").on(
      table.serviceTypeCode,
    ),
    // 状态索引
    statusIdx: index("idx_mentor_prices_status").on(table.status),
  }),
);

export type MentorPrice = typeof mentorPrices.$inferSelect;
export type InsertMentorPrice = typeof mentorPrices.$inferInsert;
