import { pgTable, uuid, varchar, timestamp } from "drizzle-orm/pg-core";
import { userTable } from "./user.schema";
import { studentTable } from "./student.schema";
import { counselorTable } from "./counselor.schema";

export const studentCounselorTable = pgTable("student_counselor", {
  id: uuid("id").defaultRandom().primaryKey(),
  studentId: uuid("student_id").references(() => studentTable.id),
  counselorId: uuid("counselor_id").references(() => counselorTable.id),
  status: varchar("status", { length: 50 }),
  type: varchar("type", { length: 50 }),
  createdTime: timestamp("created_time", { withTimezone: true, mode: "date" })
    .defaultNow(),
  modifiedTime: timestamp("modified_time", { withTimezone: true, mode: "date" })
    .defaultNow()
    .$onUpdate(() => new Date()),
  createdBy: uuid("created_by").references(() => userTable.id),
  updatedBy: uuid("updated_by").references(() => userTable.id),
});

export type StudentCounselor = typeof studentCounselorTable.$inferSelect;
export type InsertStudentCounselor = typeof studentCounselorTable.$inferInsert;
