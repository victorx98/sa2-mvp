import { pgTable, uuid, varchar, text, timestamp, jsonb, index } from 'drizzle-orm/pg-core';

/**
 * Comm Sessions Schema
 *
 * Manages internal communication sessions between student and mentor/counselor
 * Key features:
 * - Not billable (not registered to service_references)
 * - Independent lifecycle management
 * - Simplified business logic (no downstream event publishing)
 */
export const commSessions = pgTable(
  'comm_sessions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    meetingId: uuid('meeting_id').notNull().unique(),
    sessionType: varchar('session_type', { length: 50 }).notNull().default('comm_session'),
    studentUserId: uuid('student_user_id').notNull(),
    mentorUserId: uuid('mentor_user_id'),
    counselorUserId: uuid('counselor_user_id'),
    createdByCounselorId: uuid('created_by_counselor_id').notNull(),
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
    // Composite indexes for efficient querying
    index('idx_comm_session_meeting').on(table.meetingId),
    index('idx_comm_session_mentor_scheduled').on(table.mentorUserId, table.scheduledAt),
    index('idx_comm_session_student_scheduled').on(table.studentUserId, table.scheduledAt),
    index('idx_comm_session_status').on(table.status),
    index('idx_comm_session_created_by_counselor').on(table.createdByCounselorId),
  ],
);

export type CommSession = typeof commSessions.$inferSelect;

