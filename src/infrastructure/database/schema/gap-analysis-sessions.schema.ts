import { pgTable, uuid, varchar, text, timestamp, jsonb, index } from 'drizzle-orm/pg-core';
import { meetings } from './meetings.schema';
import { userTable } from './user.schema';
import { sessionTypes } from './session-types.schema';

/**
 * Gap Analysis Sessions Schema
 * 
 * Manages gap analysis session business information and lifecycle
 */
export const gapAnalysisSessions = pgTable(
  'gap_analysis_sessions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    meetingId: uuid('meeting_id')
      .unique()
      .references(() => meetings.id, { onDelete: 'cascade' }),
    sessionType: varchar('session_type', { length: 50 })
      .notNull()
      .default('gap_analysis'),
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
    meetingIdx: index('idx_gap_session_meeting').on(table.meetingId),
    typeIdx: index('idx_gap_session_type').on(table.sessionType),
    typeIdIdx: index('idx_gap_session_type_id').on(table.sessionTypeId),
    statusIdx: index('idx_gap_session_status').on(table.status),
    mentorScheduledIdx: index('idx_gap_session_mentor_scheduled').on(
      table.mentorUserId,
      table.scheduledAt,
    ),
    studentScheduledIdx: index('idx_gap_session_student_scheduled').on(
      table.studentUserId,
      table.scheduledAt,
    ),
  }),
);

export type GapAnalysisSession = typeof gapAnalysisSessions.$inferSelect;
export type NewGapAnalysisSession = typeof gapAnalysisSessions.$inferInsert;

