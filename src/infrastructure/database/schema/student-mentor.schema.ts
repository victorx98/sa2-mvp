import { pgTable, varchar, timestamp } from "drizzle-orm/pg-core";
import { userTable } from "./user.schema";
import { studentTable } from "./student.schema";
import { mentorTable } from "./mentor.schema";

export const studentMentorTable = pgTable("student_mentor", {
  id: varchar("id", { length: 32 }).primaryKey(),
  studentId: varchar("student_id", { length: 32 }).references(() => studentTable.id),
  mentorId: varchar("mentor_id", { length: 32 }).references(() => mentorTable.id),
  createdTime: timestamp("created_time", { withTimezone: true, mode: "date" })
    .defaultNow(),
  modifiedTime: timestamp("modified_time", { withTimezone: true, mode: "date" })
    .defaultNow()
    .$onUpdate(() => new Date()),
  createdBy: varchar("created_by", { length: 32 }).references(() => userTable.id),
  updatedBy: varchar("updated_by", { length: 32 }).references(() => userTable.id),
});

export type StudentMentor = typeof studentMentorTable.$inferSelect;
export type InsertStudentMentor = typeof studentMentorTable.$inferInsert;

