import { pgTable, varchar, timestamp } from "drizzle-orm/pg-core";
import { userTable } from "./user.schema";

export const counselorTable = pgTable("counselor", {
  id: varchar("id", { length: 32 }).primaryKey(),
  userId: varchar("user_id", { length: 32 }).references(() => userTable.id),
  status: varchar("status", { length: 50 }),
  createdTime: timestamp("created_time", { withTimezone: true, mode: "date" })
    .defaultNow(),
  modifiedTime: timestamp("modified_time", { withTimezone: true, mode: "date" })
    .defaultNow()
    .$onUpdate(() => new Date()),
  createdBy: varchar("created_by", { length: 32 }).references(() => userTable.id),
  updatedBy: varchar("updated_by", { length: 32 }).references(() => userTable.id),
});

export type Counselor = typeof counselorTable.$inferSelect;
export type InsertCounselor = typeof counselorTable.$inferInsert;

