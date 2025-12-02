import { pgTable, uuid, timestamp, uniqueIndex, index } from 'drizzle-orm/pg-core';
import { classes } from './classes.schema';

export const classCounselors = pgTable(
  'class_counselors',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    classId: uuid('class_id')
      .notNull()
      .references(() => classes.id, { onDelete: 'cascade' }),
    counselorUserId: uuid('counselor_user_id').notNull(),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (table) => [
    index('idx_class_counselors_class').on(table.classId),
    index('idx_class_counselors_counselor').on(table.counselorUserId),
    uniqueIndex('unique_class_counselor').on(table.classId, table.counselorUserId),
  ],
);

export type ClassCounselor = typeof classCounselors.$inferSelect;

