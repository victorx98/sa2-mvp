import { pgTable, varchar, timestamp } from "drizzle-orm/pg-core";

export const roleTable = pgTable("role", {
  id: varchar("id", { length: 32 }).primaryKey(),
  cnName: varchar("cn_name", { length: 64 }).notNull(),
  desc: varchar("desc", { length: 128 }),
  status: varchar("status", { length: 32 }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export type Role = typeof roleTable.$inferSelect;
export type InsertRole = typeof roleTable.$inferInsert;
