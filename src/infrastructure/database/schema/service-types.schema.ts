import { pgTable, uuid, varchar, timestamp, text } from "drizzle-orm/pg-core";

/**
 * Service Types Table [服务类型表]
 * Represents the classification standard for services
 * [代表服务的分类标准]
 */
export const serviceTypes = pgTable("service_types", {
  // Primary Key [主键]
  id: uuid("id").defaultRandom().primaryKey(),

  // Basic Information [基本信息]
  code: varchar("code", { length: 50 }).notNull(), // Service type code [服务类型编码]
  name: varchar("name", { length: 255 }).notNull(), // Service type name [服务类型名称]
  description: text("description"), // Service type description [服务类型描述]

  // Status Management [状态管理]
  status: varchar("status", { length: 20 }).notNull().default("ACTIVE"), // Service type status [服务类型状态]

  // Audit Fields [审计字段]
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

// Type inference [类型推断]
export type ServiceType = typeof serviceTypes.$inferSelect;
export type InsertServiceType = typeof serviceTypes.$inferInsert;
