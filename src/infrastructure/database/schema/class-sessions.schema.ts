import { pgTable, uuid, varchar, text, timestamp, jsonb, uniqueIndex, index, foreignKey, check } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { classes } from './classes.schema';
import { classMentorsPrices } from './class-mentors-prices.schema';

export const classSessions = pgTable(
  'class_sessions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    classId: uuid('class_id')
      .notNull()
      .references(() => classes.id, { onDelete: 'cascade' }),
    meetingId: uuid('meeting_id').unique(),
    sessionType: varchar('session_type', { length: 50 }).notNull().default('class_session'),
    mentorUserId: uuid('mentor_user_id').notNull(),
    title: varchar('title', { length: 255 }).notNull(),
    description: text('description'),
    status: varchar('status', { length: 20 }).notNull().default('scheduled'),
    scheduledAt: timestamp('scheduled_at').notNull(),
    completedAt: timestamp('completed_at'),
    cancelledAt: timestamp('cancelled_at'),
    deletedAt: timestamp('deleted_at'),
    aiSummaries: jsonb('ai_summaries').default('[]'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => [
    index('idx_class_session_class').on(table.classId),
    index('idx_class_session_meeting').on(table.meetingId),
    index('idx_class_session_mentor').on(table.mentorUserId),
    index('idx_class_session_status').on(table.status),
    index('idx_class_session_scheduled').on(table.scheduledAt),
    foreignKey({
      columns: [table.classId, table.mentorUserId],
      foreignColumns: [classMentorsPrices.classId, classMentorsPrices.mentorUserId],
    }),
    check('class_sessions_status_check', 
      sql`status IN ('pending_meeting', 'scheduled', 'completed', 'cancelled', 'deleted', 'meeting_failed')`
    ),
  ],
);

export type ClassSession = typeof classSessions.$inferSelect;

