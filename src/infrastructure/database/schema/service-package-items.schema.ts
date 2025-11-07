import { pgTable, uuid, integer, timestamp } from "drizzle-orm/pg-core";
import { servicePackages } from "./service-packages.schema";
import { services } from "./services.schema";

export const servicePackageItems = pgTable("service_package_items", {
  id: uuid("id").defaultRandom().primaryKey(),

  // 关联服务包和服务
  packageId: uuid("package_id")
    .notNull()
    .references(() => servicePackages.id, { onDelete: "cascade" }),
  serviceId: uuid("service_id")
    .notNull()
    .references(() => services.id, { onDelete: "restrict" }),

  // 数量配置
  quantity: integer("quantity").notNull(), // 服务次数（所有服务统一按次数计费）

  // 展示顺序
  sortOrder: integer("sort_order").notNull().default(0),

  // 时间戳字段
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull()
    .$onUpdate(() => new Date()),
});

// 类型推断
export type ServicePackageItem = typeof servicePackageItems.$inferSelect;
export type InsertServicePackageItem = typeof servicePackageItems.$inferInsert;

// 索引和约束说明（在migration中创建）:
// CREATE INDEX idx_service_package_items_package_id ON service_package_items(package_id);
// CREATE INDEX idx_service_package_items_service_id ON service_package_items(service_id);
// CREATE UNIQUE INDEX idx_service_package_items_package_service ON service_package_items(package_id, service_id);
//
// 外键约束说明：
// - packageId: CASCADE DELETE（服务包删除时，自动删除关联记录）
// - serviceId: RESTRICT DELETE（服务被引用时，不允许删除）
