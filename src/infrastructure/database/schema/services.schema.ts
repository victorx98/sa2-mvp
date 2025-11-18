import {
  pgTable,
  uuid,
  varchar,
  text,
  boolean,
  timestamp,
  json,
} from "drizzle-orm/pg-core";
import { userTable } from "./user.schema";
import { serviceTypes } from "./service-types.schema";
import { BillingMode, ServiceStatus } from "@shared/types/catalog-enums";

export const services = pgTable("services", {
  id: uuid("id").defaultRandom().primaryKey(),

  // 服务标识
  code: varchar("code", { length: 100 }).notNull().unique(), // 服务编码，如 'resume_review'
  serviceType: varchar("service_type", { length: 50 })
    .notNull()
    .references(() => serviceTypes.code), // Reference to service_types.code

  // 基本信息
  name: varchar("name", { length: 200 }).notNull(), // 服务名称，如 '简历修改'
  description: text("description"),
  coverImage: varchar("cover_image", { length: 500 }),

  // 计费配置
  billingMode: varchar("billing_mode", { length: 20 })
    .$type<BillingMode>()
    .notNull()
    .default(BillingMode.ONE_TIME),

  // 服务配置
  requiresEvaluation: boolean("requires_evaluation").default(false), // 是否需要评价后计费
  requiresMentorAssignment: boolean("requires_mentor_assignment").default(true), // 是否需要分配导师

  // 状态管理
  status: varchar("status", { length: 20 })
    .$type<ServiceStatus>()
    .notNull()
    .default(ServiceStatus.ACTIVE),

  // 元数据
  metadata: json("metadata").$type<{
    features?: string[]; // 服务特点
    deliverables?: string[]; // 交付物
    duration?: number; // 预计时长（分钟）
    prerequisites?: string[]; // 前置条件
  }>(),

  // 审计字段
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull()
    .$onUpdate(() => new Date()),
  createdBy: uuid("created_by")
    .notNull()
    .references(() => userTable.id),
});

// 类型推断
export type Service = typeof services.$inferSelect;
export type InsertService = typeof services.$inferInsert;
