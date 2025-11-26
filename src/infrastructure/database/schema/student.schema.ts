import {
  pgTable,
  varchar,
  timestamp,
  text,
  date,
  uuid,
} from "drizzle-orm/pg-core";
import { userTable } from "./user.schema";
import { schoolsTable } from "./schools.schema";
import { majorsTable } from "./majors.schema";

export const studentTable = pgTable(
  "student",
  {
    id: uuid("id").defaultRandom().primaryKey().references(() => userTable.id, { onDelete: "cascade" }),
  status: varchar("status", { length: 50 }),
  highSchool: uuid("high_school").references(() => schoolsTable.id),
  underCollege: uuid("under_college").references(() => schoolsTable.id),
  underMajor: uuid("under_major").references(() => majorsTable.id),
  graduateCollege: uuid("graduate_college").references(() => schoolsTable.id),
  graduateMajor: uuid("graduate_major").references(() => majorsTable.id),
  aiResumeSummary: text("ai_resume_summary"),
  customerImportance: varchar("customer_importance", { length: 50 }),
  graduationDate: date("graduation_date"),
  grades: text("grades"),
  createdTime: timestamp("created_time", { withTimezone: true, mode: "date" })
    .defaultNow(),
  modifiedTime: timestamp("modified_time", { withTimezone: true, mode: "date" })
    .defaultNow()
    .$onUpdate(() => new Date()),
  createdBy: uuid("created_by").references(() => userTable.id),
  updatedBy: uuid("updated_by").references(() => userTable.id),
  },
);

export type Student = typeof studentTable.$inferSelect;
export type InsertStudent = typeof studentTable.$inferInsert;
