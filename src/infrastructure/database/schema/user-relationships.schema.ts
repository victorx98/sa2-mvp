import { pgTable, uuid, varchar, timestamp } from "drizzle-orm/pg-core";
import { userTable } from "./user.schema";

export const userRelationshipsTable = pgTable("user_relationships", {
  id: uuid("id").defaultRandom().primaryKey(),
  fromUserId: uuid("from_user_id")
    .notNull()
    .references(() => userTable.id),
  toUserId: uuid("to_user_id")
    .notNull()
    .references(() => userTable.id),
  relationType: varchar("relation_type", { length: 64 }).notNull(),
  status: varchar("status", { length: 32 }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export type UserRelationship = typeof userRelationshipsTable.$inferSelect;
export type InsertUserRelationship =
  typeof userRelationshipsTable.$inferInsert;
