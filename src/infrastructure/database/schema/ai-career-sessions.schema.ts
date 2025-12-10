import { pgTable, uuid, varchar, text, timestamp, jsonb, index } from 'drizzle-orm/pg-core';
import { meetings } from './meetings.schema';
import { userTable } from './user.schema';
import { sessionTypes } from './session-types.schema';

/**
 * AI Career Sessions Schema
 * 
 * Manages AI career assessment session business information and lifecycle
 */
export const aiCareerSessions = pgTable(
  'ai_career_sessions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    meetingId: uuid('meeting_id')
      .unique()
      .references(() => meetings.id, { onDelete: 'cascade' }),
    sessionType: varchar('session_type', { length: 50 })
      .notNull()
      .default('ai_career'),
    sessionTypeId: uuid('session_type_id')
      .notNull()
      .references(() => sessionTypes.id),
    studentUserId: uuid('student_user_id')
      .notNull()
      .references(() => userTable.id),
    mentorUserId: uuid('mentor_user_id')
      .notNull()
      .references(() => userTable.id),
    createdByCounselorId: uuid('created_by_counselor_id').references(() => userTable.id),
    title: varchar('title', { length: 255 }).notNull(),
    description: text('description'),
    status: varchar('status', { length: 20 }).notNull().default('scheduled'),
    scheduledAt: timestamp('scheduled_at', { withTimezone: true }).notNull(),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    cancelledAt: timestamp('cancelled_at', { withTimezone: true }),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
    aiSummaries: jsonb('ai_summaries').notNull().default([]),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    meetingIdx: index('idx_ai_career_session_meeting').on(table.meetingId),
    typeIdx: index('idx_ai_career_session_type').on(table.sessionType),
    typeIdIdx: index('idx_ai_career_session_type_id').on(table.sessionTypeId),
    statusIdx: index('idx_ai_career_session_status').on(table.status),
    mentorScheduledIdx: index('idx_ai_career_session_mentor_scheduled').on(
      table.mentorUserId,
      table.scheduledAt,
    ),
    studentScheduledIdx: index('idx_ai_career_session_student_scheduled').on(
      table.studentUserId,
      table.scheduledAt,
    ),
  }),
);

export type AiCareerSession = typeof aiCareerSessions.$inferSelect;
export type NewAiCareerSession = typeof aiCareerSessions.$inferInsert;

