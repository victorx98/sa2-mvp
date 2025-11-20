import {
  pgTable,
  varchar,
  timestamp,
  text,
  doublePrecision,
  uuid,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { userTable } from "./user.schema";

export const mentorTable = pgTable(
  "mentor",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => userTable.id, { onDelete: "cascade" }),
    status: varchar("status", { length: 50 }),
  type: varchar("type", { length: 20 }),
  company: varchar("company", { length: 100 }),
  companyTitle: varchar("company_title", { length: 100 }),
  briefIntro: text("brief_intro"),
  school: varchar("school", { length: 100 }),
  location: varchar("location", { length: 100 }),
  level: varchar("level", { length: 50 }),
  rating: doublePrecision("rating"),
  createdTime: timestamp("created_time", { withTimezone: true, mode: "date" })
    .defaultNow(),
  modifiedTime: timestamp("modified_time", { withTimezone: true, mode: "date" })
    .defaultNow()
    .$onUpdate(() => new Date()),
  createdBy: uuid("created_by").references(() => userTable.id),
  updatedBy: uuid("updated_by").references(() => userTable.id),
  },
  (table) => ({
    userIdUnique: uniqueIndex("mentor_user_id_unique").on(table.userId),
  }),
);

export type Mentor = typeof mentorTable.$inferSelect;
export type InsertMentor = typeof mentorTable.$inferInsert;
