import { pgTable, varchar, timestamp, uuid } from "drizzle-orm/pg-core";

export const schoolsTable = pgTable("schools", {
  id: uuid("id").defaultRandom().primaryKey(),
  zhName: varchar("zh_name", { length: 500 }).notNull(),
  enName: varchar("en_name", { length: 500 }).notNull(),
  countryCode: varchar("country_code", { length: 10 }),
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

