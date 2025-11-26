import { pgTable, varchar, timestamp, uuid } from "drizzle-orm/pg-core";

export const majorsTable = pgTable("majors", {
  id: uuid("id").defaultRandom().primaryKey(),
  nameZh: varchar("name_zh", { length: 500 }).notNull(),
  nameEn: varchar("name_en", { length: 500 }).notNull(),
  degreeLevel: varchar("degree_level", { length: 50 }),
  createdTime: timestamp("created_time", { withTimezone: true, mode: "date" })
    .notNull()
    .defaultNow(),
  modifiedTime: timestamp("modified_time", { withTimezone: true, mode: "date" })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export type Major = typeof majorsTable.$inferSelect;
export type InsertMajor = typeof majorsTable.$inferInsert;
