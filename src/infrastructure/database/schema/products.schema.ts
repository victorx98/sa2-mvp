import {
  pgTable,
  uuid,
  varchar,
  integer,
  timestamp,
  text,
  json,
  numeric,
  pgEnum,
} from "drizzle-orm/pg-core";
import { userTable } from "./user.schema";

// 产品状态枚举
export const productStatusEnum = pgEnum("product_status", [
  "draft", // 草稿
  "active", // 上架
  "inactive", // 下架
  "deleted", // 已删除
]);

// 货币枚举
export const currencyEnum = pgEnum("currency", [
  "USD", // 美元
  "CNY", // 人民币
  "EUR", // 欧元（预留）
  "GBP", // 英镑（预留）
  "JPY", // 日元（预留）
]);

// 用户类型枚举
export const userTypeEnum = pgEnum("user_type", [
  "undergraduate", // 本科生
  "graduate", // 研究生
  "working", // 在职人士
]);

export const products = pgTable("products", {
  id: uuid("id").defaultRandom().primaryKey(),

  // 基本信息
  name: varchar("name", { length: 500 }).notNull(),
  code: varchar("code", { length: 100 }).notNull().unique(), // 产品编码
  description: text("description"),
  coverImage: varchar("cover_image", { length: 500 }),

  // 目标用户（支持多选）
  targetUserTypes:
    json("target_user_types").$type<
      Array<"undergraduate" | "graduate" | "working">
    >(),

  // 定价信息
  price: numeric("price", { precision: 12, scale: 2 }).notNull(),
  currency: currencyEnum("currency").notNull().default("USD"),

  // 有效期，如果为NULL表示长期有效（单位：天）
  validityDays: integer("validity_days"),

  // 营销标签
  marketingLabels:
    json("marketing_labels").$type<Array<"hot" | "new" | "recommended">>(),

  // 状态管理
  status: productStatusEnum("status").notNull().default("draft"),

  // 定时上架（仅作为元数据，不自动触发）
  scheduledPublishAt: timestamp("scheduled_publish_at", { withTimezone: true }),

  // 实际上下架时间
  publishedAt: timestamp("published_at", { withTimezone: true }),
  unpublishedAt: timestamp("unpublished_at", { withTimezone: true }),

  // 展示顺序
  sortOrder: integer("sort_order").notNull().default(0),

  // 元数据
  metadata: json("metadata").$type<{
    features?: string[]; // 产品特点
    faqs?: Array<{
      // 常见问题
      question: string;
      answer: string;
    }>;
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
  publishedBy: varchar("published_by", { length: 32 }).references(
    () => userTable.id,
  ),
  unpublishedBy: varchar("unpublished_by", { length: 32 }).references(
    () => userTable.id,
  ),
});

// 类型推断
export type Product = typeof products.$inferSelect;
export type InsertProduct = typeof products.$inferInsert;

// 索引和约束说明（在migration中创建）:
// CREATE INDEX idx_products_status ON products(status);
// CREATE INDEX idx_products_sort_order ON products(sort_order);
// CREATE INDEX idx_products_published_at ON products(published_at);
// CREATE INDEX idx_products_code ON products(code);
// CREATE INDEX idx_products_scheduled_publish ON products(scheduled_publish_at) WHERE status = 'draft';
//
// 约束:
// ALTER TABLE products ADD CONSTRAINT chk_price_positive CHECK (price::numeric > 0);
// ALTER TABLE products ADD CONSTRAINT chk_validity_days_positive CHECK (validity_days IS NULL OR validity_days > 0);
