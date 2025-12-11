import { pgTable, uuid, integer, timestamp, uniqueIndex, index, varchar } from 'drizzle-orm/pg-core';
import { classes } from './classes.schema';
import { ClassMentorPriceStatus } from '@shared/types/financial-enums';

export const classMentorsPrices = pgTable(
  'class_mentors_prices',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    classId: uuid('class_id')
      .notNull()
      .references(() => classes.id, { onDelete: 'cascade' }),
    mentorUserId: uuid('mentor_user_id').notNull(),
    pricePerSession: integer('price_per_session').notNull(),
    status: varchar('status', { length: 20 }).notNull().default(ClassMentorPriceStatus.ACTIVE),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => [
    index('idx_class_mentors_class').on(table.classId),
    index('idx_class_mentors_mentor').on(table.mentorUserId),
    index('idx_class_mentors_status').on(table.status),
    uniqueIndex('unique_class_mentor').on(table.classId, table.mentorUserId, table.status),
  ],
);

export type ClassMentorPrice = typeof classMentorsPrices.$inferSelect;

