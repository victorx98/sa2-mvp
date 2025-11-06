import { pgTable, uuid, integer, timestamp, pgEnum } from "drizzle-orm/pg-core";
import { products } from "./products.schema";
import { serviceUnitEnum } from "./services.schema";

// 产品项类型枚举
export const productItemTypeEnum = pgEnum("product_item_type", [
  "service", // 直接服务
  "service_package", // 服务包
]);

export const productItems = pgTable("product_items", {
  id: uuid("id").defaultRandom().primaryKey(),

  // 关联产品
  productId: uuid("product_id")
    .notNull()
    .references(() => products.id, { onDelete: "cascade" }),

  // 项类型和引用ID
  type: productItemTypeEnum("type").notNull(),
  referenceId: uuid("reference_id").notNull(), // type='service' → services.id
  // type='service_package' → service_packages.id

  // 数量配置
  quantity: integer("quantity").notNull(), // 服务次数
  unit: serviceUnitEnum("unit").notNull().default("times"), // 单位

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
export type ProductItem = typeof productItems.$inferSelect;
export type InsertProductItem = typeof productItems.$inferInsert;

// 索引和约束说明（在migration中创建）:
// CREATE INDEX idx_product_items_product_id ON product_items(product_id);
// CREATE INDEX idx_product_items_type ON product_items(type);
// CREATE INDEX idx_product_items_reference_id ON product_items(reference_id);
// CREATE UNIQUE INDEX idx_product_items_unique ON product_items(product_id, type, reference_id);
//
// 外键约束说明：
// - productId: CASCADE DELETE（产品删除时，自动删除所有关联的产品项）
// - referenceId: 应用层保证引用完整性（因为引用两个不同的表）
