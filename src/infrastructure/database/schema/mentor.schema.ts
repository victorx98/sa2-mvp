import {
  pgTable,
  varchar,
  timestamp,
  text,
  doublePrecision,
  uuid,
} from "drizzle-orm/pg-core";
import { userTable } from "./user.schema";
import { schoolsTable } from "./schools.schema";
import { majorsTable } from "./majors.schema";

export const mentorTable = pgTable(
  "mentor",
  {
    id: uuid("id").defaultRandom().primaryKey().references(() => userTable.id, { onDelete: "cascade" }),
    status: varchar("status", { length: 50 }),
  type: varchar("type", { length: 20 }),
  company: varchar("company", { length: 100 }),
  companyTitle: varchar("company_title", { length: 100 }),
  briefIntro: text("brief_intro"),
  highSchool: uuid("high_school").references(() => schoolsTable.id),
  location: varchar("location", { length: 100 }),
  level: varchar("level", { length: 50 }),
  rating: doublePrecision("rating"),
  underCollege: uuid("under_college").references(() => schoolsTable.id),
  underMajor: uuid("under_major").references(() => majorsTable.id),
  graduateCollege: uuid("graduate_college").references(() => schoolsTable.id),
  graduateMajor: uuid("graduate_major").references(() => majorsTable.id),
  createdTime: timestamp("created_time", { withTimezone: true, mode: "date" })
    .defaultNow(),
  modifiedTime: timestamp("modified_time", { withTimezone: true, mode: "date" })
    .defaultNow()
    .$onUpdate(() => new Date()),
    createdBy: uuid("created_by").references(() => userTable.id),
    updatedBy: uuid("updated_by").references(() => userTable.id),
  },
);

export type Mentor = typeof mentorTable.$inferSelect;
export type InsertMentor = typeof mentorTable.$inferInsert;
