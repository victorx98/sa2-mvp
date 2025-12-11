import { pgTable, uuid, integer, timestamp, uniqueIndex, index } from 'drizzle-orm/pg-core';
import { classes } from './classes.schema';

export const classMentorsPrices = pgTable(
  'class_mentors_prices',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    classId: uuid('class_id')
      .notNull()
      .references(() => classes.id, { onDelete: 'cascade' }),
    mentorUserId: uuid('mentor_user_id').notNull(),
    pricePerSession: integer('price_per_session').notNull(),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => [
    index('idx_class_mentors_class').on(table.classId),
    index('idx_class_mentors_mentor').on(table.mentorUserId),
    uniqueIndex('unique_class_mentor').on(table.classId, table.mentorUserId),
  ],
);

export type ClassMentorPrice = typeof classMentorsPrices.$inferSelect;

