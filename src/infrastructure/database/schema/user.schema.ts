import { pgTable, varchar, timestamp } from 'drizzle-orm/pg-core';

export const userTable = pgTable('user', {
  id: varchar('id', { length: 32 }).primaryKey(),
  gender: varchar('gender', { length: 10 }),
  nickname: varchar('nickname', { length: 100 }),
  cnNickname: varchar('cn_nickname', { length: 100 }),
  status: varchar('status', { length: 50 }),
  password: varchar('password', { length: 255 }),
  email: varchar('email', { length: 255 }),
  country: varchar('country', { length: 100 }),
  createdTime: timestamp('created_time', { withTimezone: true, mode: 'date' })
    .notNull()
    .defaultNow(),
  modifiedTime: timestamp('modified_time', { withTimezone: true, mode: 'date' })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
  createdBy: varchar('created_by', { length: 32 }),
  updatedBy: varchar('updated_by', { length: 32 }),
});

export type User = typeof userTable.$inferSelect;
export type InsertUser = typeof userTable.$inferInsert;
