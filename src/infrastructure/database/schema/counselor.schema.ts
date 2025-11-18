import {
  pgTable,
  varchar,
  timestamp,
  uuid,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { userTable } from "./user.schema";

export const counselorTable = pgTable(
  "counselor",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => userTable.id, { onDelete: "cascade" }),
    status: varchar("status", { length: 50 }),
  createdTime: timestamp("created_time", { withTimezone: true, mode: "date" })
    .defaultNow(),
  modifiedTime: timestamp("modified_time", { withTimezone: true, mode: "date" })
    .defaultNow()
    .$onUpdate(() => new Date()),
  createdBy: uuid("created_by").references(() => userTable.id),
  updatedBy: uuid("updated_by").references(() => userTable.id),
  },
  (table) => ({
    userIdUnique: uniqueIndex("counselor_user_id_unique").on(table.userId),
  }),
);

export type Counselor = typeof counselorTable.$inferSelect;
export type InsertCounselor = typeof counselorTable.$inferInsert;
