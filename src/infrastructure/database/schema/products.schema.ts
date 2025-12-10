import {
  pgTable,
  uuid,
  varchar,
  timestamp,
  text,
  json,
  numeric,
} from "drizzle-orm/pg-core";
import { userTable } from "./user.schema";

/**
 * Products Table [产品表]
 * Represents the core product entity in the catalog domain
 * [代表目录域中的核心产品实体]
 */
export const products = pgTable("products", {
  // Primary Key [主键]
  id: uuid("id").defaultRandom().primaryKey(),

  // Basic Information [基本信息]
  name: varchar("name", { length: 255 }).notNull(),
  code: varchar("code", { length: 100 }).notNull().unique(), // Product code [产品编码]
  description: text("description"),
  coverImage: varchar("cover_image", { length: 500 }),

  // Sales Attributes [销售属性]
  // [修复] Changed scale from 1 to 2 to support cent-level precision [将scale从1改为2以支持分位精度]
  price: numeric("price", { precision: 12, scale: 2 }).notNull(),
  currency: varchar("currency", { length: 3 }).notNull().default("CNY"),
  targetUserPersona: text("target_user_persona").array(), // Target user personas [目标用户画像] - Fixed: Changed from json() to text().array() to match PostgreSQL text[] type [修复：从json()改为text().array()以匹配PostgreSQL text[]类型]
  marketingLabels: text("marketing_labels").array(), // Marketing labels [营销标签] - Fixed: Changed from json() to text().array() to match PostgreSQL text[] type [修复：从json()改为text().array()以匹配PostgreSQL text[]类型]

  // Status Management [状态管理]
  status: varchar("status", { length: 20 }).notNull().default("DRAFT"), // DRAFT/ACTIVE/INACTIVE/DELETED
  publishedAt: timestamp("published_at", { withTimezone: true }),
  unpublishedAt: timestamp("unpublished_at", { withTimezone: true }),

  // Metadata [元数据]
  metadata: json("metadata").$type<{
    features?: string[]; // Product features [产品特点]
    faqs?: Array<{
      // Frequently asked questions [常见问题]
      question: string;
      answer: string;
    }>;
    deliverables?: string[]; // Product deliverables [产品交付物]
    duration?: string; // Product duration [产品时长]
    prerequisites?: string[]; // Product prerequisites [产品先决条件]
  }>(),

  // Audit Fields [审计字段]
  createdBy: uuid("created_by").references(() => userTable.id),
  updatedBy: uuid("updated_by").references(() => userTable.id),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  deletedAt: timestamp("deleted_at", { withTimezone: true }), // Soft delete [软删除]
});

// Type inference [类型推断]
export type Product = typeof products.$inferSelect;
export type InsertProduct = typeof products.$inferInsert;

// Indexes and constraints (to be created in migration) [索引和约束（在迁移中创建）]:
// CREATE INDEX idx_products_status ON products(status);
// CREATE INDEX idx_products_deleted_at ON products(deleted_at);
// CREATE INDEX idx_products_created_at ON products(created_at);
//
// Constraints [约束]:
// ALTER TABLE products ADD CONSTRAINT chk_price_positive CHECK (price::numeric > 0);
// ALTER TABLE products ADD CONSTRAINT chk_valid_status CHECK (status IN ('DRAFT', 'ACTIVE', 'INACTIVE', 'DELETED'));
