import {
  pgTable,
  uuid,
  varchar,
  text,
  boolean,
  timestamp,
  json,
  pgEnum,
} from "drizzle-orm/pg-core";
import { userTable } from "./user.schema";

// 服务类型枚举
export const serviceTypeEnum = pgEnum("service_type", [
  // 1对1服务
  "gap_analysis", // GAP分析
  "resume_review", // 简历修改
  "recommendation_letter", // 推荐信
  "recommendation_letter_online", // 网申推荐信
  "session", // 通用1对1辅导
  "mock_interview", // 模拟面试（AI）

  // 小组服务
  "class_session", // 班课

  // 特殊服务
  "internal_referral", // 内推服务
  "contract_signing_assistance", // 合同促签
  "proxy_application", // 代投服务

  // 其他
  "other_service", // 其他服务
]);

// 计费模式枚举
export const billingModeEnum = pgEnum("billing_mode", [
  "one_time", // 按次计费（如简历修改）
  "per_session", // 按课节计费（如班课）
  "staged", // 阶段性计费（如内推，具体阶段由Financial Domain管理）
  "package", // 服务包计费（整包售卖）
]);

// 服务状态枚举
export const serviceStatusEnum = pgEnum("service_status", [
  "active", // 启用
  "inactive", // 禁用
  "deleted", // 已删除
]);

export const services = pgTable("services", {
  id: uuid("id").defaultRandom().primaryKey(),

  // 服务标识
  code: varchar("code", { length: 100 }).notNull().unique(), // 服务编码，如 'resume_review'
  serviceType: serviceTypeEnum("service_type").notNull().unique(),

  // 基本信息
  name: varchar("name", { length: 200 }).notNull(), // 服务名称，如 '简历修改'
  description: text("description"),
  coverImage: varchar("cover_image", { length: 500 }),

  // 计费配置
  billingMode: billingModeEnum("billing_mode").notNull().default("one_time"),

  // 服务配置
  requiresEvaluation: boolean("requires_evaluation").default(false), // 是否需要评价后计费
  requiresMentorAssignment: boolean("requires_mentor_assignment").default(true), // 是否需要分配导师

  // 状态管理
  status: serviceStatusEnum("status").notNull().default("active"),

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
  createdBy: varchar("created_by", { length: 32 })
    .notNull()
    .references(() => userTable.id),
});

// 类型推断
export type Service = typeof services.$inferSelect;
export type InsertService = typeof services.$inferInsert;

// 索引说明（在migration中创建）:
// CREATE INDEX idx_services_code ON services(code);
// CREATE INDEX idx_services_service_type ON services(service_type);
// CREATE INDEX idx_services_status ON services(status);
// CREATE INDEX idx_services_billing_mode ON services(billing_mode);
