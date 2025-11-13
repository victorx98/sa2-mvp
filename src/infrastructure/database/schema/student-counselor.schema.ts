import { pgTable, varchar, timestamp } from "drizzle-orm/pg-core";
import { userTable } from "./user.schema";
import { studentTable } from "./student.schema";
import { counselorTable } from "./counselor.schema";

export const studentCounselorTable = pgTable("student_counselor", {
  id: varchar("id", { length: 32 }).primaryKey(),
  studentId: varchar("student_id", { length: 32 }).references(
    () => studentTable.id,
  ),
  counselorId: varchar("counselor_id", { length: 32 }).references(
    () => counselorTable.id,
  ),
  status: varchar("status", { length: 50 }),
  type: varchar("type", { length: 50 }),
  createdTime: timestamp("created_time", {
    withTimezone: true,
    mode: "date",
  }).defaultNow(),
  modifiedTime: timestamp("modified_time", { withTimezone: true, mode: "date" })
    .defaultNow()
    .$onUpdate(() => new Date()),
  createdBy: varchar("created_by", { length: 32 }).references(
    () => userTable.id,
  ),
  updatedBy: varchar("updated_by", { length: 32 }).references(
    () => userTable.id,
  ),
});

export type StudentCounselor = typeof studentCounselorTable.$inferSelect;
export type InsertStudentCounselor = typeof studentCounselorTable.$inferInsert;
