import { pgTable, uuid, varchar, text, timestamp, integer, index } from 'drizzle-orm/pg-core';
import { userTable } from './user.schema';

export const classes = pgTable(
  'classes',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    name: varchar('name', { length: 255 }).notNull(),
    type: varchar('type', { length: 20 }).notNull(), // 'session' | 'enroll'
    status: varchar('status', { length: 20 }).notNull().default('Active'), // 'Active' | 'Inactive'
    startDate: timestamp('start_date').notNull(),
    endDate: timestamp('end_date').notNull(),
    description: text('description'),
    totalSessions: integer('total_sessions').notNull().default(0),
    createdByCounselorId: uuid('created_by_counselor_id').references(() => userTable.id),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => [
    index('idx_class_type').on(table.type),
    index('idx_class_status').on(table.status),
    index('idx_class_start_date').on(table.startDate),
  ],
);

export type Class = typeof classes.$inferSelect;

