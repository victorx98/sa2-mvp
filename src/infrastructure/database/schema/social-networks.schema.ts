import { pgTable, varchar, timestamp, uuid, boolean } from "drizzle-orm/pg-core";
import { userTable } from "./user.schema";

export const socialNetworksTable = pgTable("social_networks", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => userTable.id, { onDelete: "cascade" }),
  platform: varchar("platform", { length: 100 }).notNull(),
  accountId: varchar("account_id", { length: 500 }),
  isPrimary: boolean("is_primary").notNull().default(false),
  createdTime: timestamp("created_time", { withTimezone: true, mode: "date" })
    .notNull()
    .defaultNow(),
  modifiedTime: timestamp("modified_time", { withTimezone: true, mode: "date" })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export type SocialNetwork = typeof socialNetworksTable.$inferSelect;
export type InsertSocialNetwork = typeof socialNetworksTable.$inferInsert;

