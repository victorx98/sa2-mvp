import { pgTable, varchar, timestamp, text, date, uuid } from "drizzle-orm/pg-core";
import { userTable } from "./user.schema";

export const studentTable = pgTable("student", {
  id: uuid("id").defaultRandom().primaryKey(),
  status: varchar("status", { length: 50 }),
  underMajor: varchar("under_major", { length: 100 }),
  underCollege: varchar("under_college", { length: 100 }),
  graduateMajor: varchar("graduate_major", { length: 100 }),
  graduateCollege: varchar("graduate_college", { length: 100 }),
  aiResumeSummary: text("ai_resume_summary"),
  customerImportance: varchar("customer_importance", { length: 50 }),
  fulltimeStartdate: date("fulltime_startdate"),
  backgroundInfo: text("background_info"),
  grades: text("grades"),
  createdTime: timestamp("created_time", { withTimezone: true, mode: "date" })
    .defaultNow(),
  modifiedTime: timestamp("modified_time", { withTimezone: true, mode: "date" })
    .defaultNow()
    .$onUpdate(() => new Date()),
  createdBy: uuid("created_by").references(() => userTable.id),
  updatedBy: uuid("updated_by").references(() => userTable.id),
});

export type Student = typeof studentTable.$inferSelect;
export type InsertStudent = typeof studentTable.$inferInsert;
