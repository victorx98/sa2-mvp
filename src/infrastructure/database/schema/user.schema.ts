import { pgTable, varchar, timestamp, uuid } from "drizzle-orm/pg-core";
import { genderEnum, countryEnum } from "./enums";

export const userTable = pgTable("user", {
  id: uuid("id").defaultRandom().primaryKey(),
  gender: genderEnum("gender"),
  nameEn: varchar("name_en", { length: 100 }),
  nameZh: varchar("name_zh", { length: 100 }),
  status: varchar("status", { length: 50 }),
  password: varchar("password", { length: 255 }),
  email: varchar("email", { length: 255 }),
  country: countryEnum("country"),
  createdTime: timestamp("created_time", { withTimezone: true, mode: "date" })
    .notNull()
    .defaultNow(),
  modifiedTime: timestamp("modified_time", { withTimezone: true, mode: "date" })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
  createdBy: uuid("created_by"),
  updatedBy: uuid("updated_by"),
});

export type User = typeof userTable.$inferSelect;
export type InsertUser = typeof userTable.$inferInsert;
