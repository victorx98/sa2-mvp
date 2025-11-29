import { pgTable, varchar, timestamp, uuid } from "drizzle-orm/pg-core";
import { countryEnum } from "./enums";

export const schoolsTable = pgTable("schools", {
  id: uuid("id").defaultRandom().primaryKey(),
  nameZh: varchar("name_zh", { length: 500 }).notNull(),
  nameEn: varchar("name_en", { length: 500 }).notNull(),
  country: countryEnum("country"),
  createdTime: timestamp("created_time", { withTimezone: true, mode: "date" })
    .notNull()
    .defaultNow(),
  modifiedTime: timestamp("modified_time", { withTimezone: true, mode: "date" })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export type School = typeof schoolsTable.$inferSelect;
export type InsertSchool = typeof schoolsTable.$inferInsert;
