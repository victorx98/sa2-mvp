import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  json,
} from "drizzle-orm/pg-core";
import { userTable } from "./user.schema";
import { serviceStatusEnum } from "./services.schema";

export const servicePackages = pgTable("service_packages", {
  id: uuid("id").defaultRandom().primaryKey(),

  // 服务包标识
  code: varchar("code", { length: 100 }).notNull().unique(), // 服务包编码，如 'basic_package'
  name: varchar("name", { length: 200 }).notNull(), // 服务包名称，如 '求职基础包'
  description: text("description"),
  coverImage: varchar("cover_image", { length: 500 }),

  // 状态管理
  status: serviceStatusEnum("status").notNull().default("active"),

  // 元数据
  metadata: json("metadata").$type<{
    features?: string[]; // 服务包特点
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
export type ServicePackage = typeof servicePackages.$inferSelect;
export type InsertServicePackage = typeof servicePackages.$inferInsert;

// 索引说明（在migration中创建）:
// CREATE INDEX idx_service_packages_code ON service_packages(code);
// CREATE INDEX idx_service_packages_status ON service_packages(status);
