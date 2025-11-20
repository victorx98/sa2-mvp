import { pgTable, uuid, integer, timestamp } from "drizzle-orm/pg-core";
import { products } from "./products.schema";
import { serviceTypes } from "./service-types.schema";

/**
 * Product Items Table [产品项表]
 * Represents the relationship between products and service types
 * [代表产品和服务类型之间的关系]
 */
export const productItems = pgTable("product_items", {
  // Primary Key [主键]
  id: uuid("id").defaultRandom().primaryKey(),

  // Association Information [关联信息]
  productId: uuid("product_id")
    .notNull()
    .references(() => products.id, { onDelete: "cascade" }), // Associated product ID [关联的产品ID]
  serviceTypeId: uuid("service_type_id")
    .notNull()
    .references(() => serviceTypes.id), // Associated service type ID [关联的服务类型ID]

  // Quantity Record [数量记录]
  quantity: integer("quantity").notNull(), // Quantity of the service type [服务类型的数量]

  // Sorting Function [排序功能]
  sortOrder: integer("sort_order").notNull().default(0), // Sort order [排序序号]

  // Audit Fields [审计字段]
  createdBy: uuid("created_by"),
  updatedBy: uuid("updated_by"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

// Type inference [类型推断]
export type ProductItem = typeof productItems.$inferSelect;
export type InsertProductItem = typeof productItems.$inferInsert;

// Indexes and constraints (to be created in migration) [索引和约束（在迁移中创建）]:
// CREATE INDEX idx_product_items_product_id ON product_items(product_id);
// CREATE INDEX idx_product_items_service_type_id ON product_items(service_type_id);
// CREATE INDEX idx_product_items_sort_order ON product_items(sort_order);
// CREATE UNIQUE INDEX idx_product_items_unique ON product_items(product_id, service_type_id);
//
// Constraints [约束]:
// ALTER TABLE product_items ADD CONSTRAINT chk_quantity_positive CHECK (quantity > 0);
