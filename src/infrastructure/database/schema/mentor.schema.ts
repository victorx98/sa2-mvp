import { pgTable, varchar, timestamp, text, doublePrecision } from "drizzle-orm/pg-core";
import { userTable } from "./user.schema";

export const mentorTable = pgTable("mentor", {
  id: varchar("id", { length: 32 }).primaryKey(),
  userId: varchar("user_id", { length: 32 }).references(() => userTable.id),
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
  createdBy: varchar("created_by", { length: 32 }).references(() => userTable.id),
  updatedBy: varchar("updated_by", { length: 32 }).references(() => userTable.id),
});

export type Mentor = typeof mentorTable.$inferSelect;
export type InsertMentor = typeof mentorTable.$inferInsert;

