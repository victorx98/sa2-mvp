import { pgTable, uuid, varchar, timestamp } from "drizzle-orm/pg-core";
import { userTable } from "./user.schema";
import { roleTable } from "./role.schema";

export const userRolesTable = pgTable("user_roles", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => userTable.id),
  roleId: varchar("role_id", { length: 32 })
    .notNull()
    .references(() => roleTable.id),
  status: varchar("status", { length: 32 }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export type UserRole = typeof userRolesTable.$inferSelect;
export type InsertUserRole = typeof userRolesTable.$inferInsert;
