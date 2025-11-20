import { pgTable, uuid, timestamp } from "drizzle-orm/pg-core";
import { userTable } from "./user.schema";
import { studentTable } from "./student.schema";
import { mentorTable } from "./mentor.schema";

export const studentMentorTable = pgTable("student_mentor", {
  id: uuid("id").defaultRandom().primaryKey(),
  studentId: uuid("student_id").references(() => studentTable.id),
  mentorId: uuid("mentor_id").references(() => mentorTable.id),
  createdTime: timestamp("created_time", { withTimezone: true, mode: "date" })
    .defaultNow(),
  modifiedTime: timestamp("modified_time", { withTimezone: true, mode: "date" })
    .defaultNow()
    .$onUpdate(() => new Date()),
  createdBy: uuid("created_by").references(() => userTable.id),
  updatedBy: uuid("updated_by").references(() => userTable.id),
});

export type StudentMentor = typeof studentMentorTable.$inferSelect;
export type InsertStudentMentor = typeof studentMentorTable.$inferInsert;
