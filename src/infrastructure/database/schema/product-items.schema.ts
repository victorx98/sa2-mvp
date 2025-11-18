import {
  pgTable,
  uuid,
  integer,
  timestamp,
  varchar,
} from "drizzle-orm/pg-core";
import { products } from "./products.schema";
import { ProductItemType } from "@shared/types/catalog-enums";

export const productItems = pgTable("product_items", {
  id: uuid("id").defaultRandom().primaryKey(),

  // 关联产品
  productId: uuid("product_id")
    .notNull()
    .references(() => products.id, { onDelete: "cascade" }),

  // 项类型和引用ID
  type: varchar("type", { length: 20 }).$type<ProductItemType>().notNull(),
  referenceId: uuid("reference_id").notNull(), // type='service' → services.id
  // type='service_package' → service_packages.id

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
