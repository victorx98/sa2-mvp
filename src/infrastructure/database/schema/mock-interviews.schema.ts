import { pgTable, uuid, varchar, text, timestamp, jsonb, integer, index, check } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

/**
 * Mock Interviews Schema
 *
 * AI-powered mock interview sessions for students
 * Key features:
 * - Student-only calendar slots (no mentor/counselor)
 * - No third-party meeting integration (WebRTC-based)
 * - Direct 'scheduled' status (no pending_meeting)
 * - Not billable (no service_references)
 */
export const mockInterviews = pgTable(
  'mock_interviews',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    sessionType: varchar('session_type', { length: 50 }).notNull().default('mock_interview'),
    studentUserId: uuid('student_user_id').notNull(),
    createdByCounselorId: uuid('created_by_counselor_id'),
    title: varchar('title', { length: 255 }).notNull(),
    status: varchar('status', { length: 20 }).notNull().default('scheduled'),
    scheduledAt: timestamp('scheduled_at').notNull(),
    scheduleDuration: integer('schedule_duration').notNull().default(60),
    completedAt: timestamp('completed_at'),
    cancelledAt: timestamp('cancelled_at'),
    deletedAt: timestamp('deleted_at'),
    interviewType: varchar('interview_type', { length: 50 }),
    language: varchar('language', { length: 10 }),
    companyName: varchar('company_name', { length: 255 }),
    jobTitle: varchar('job_title', { length: 255 }),
    jobDescription: text('job_description'),
    resumeText: text('resume_text'),
    studentInfo: jsonb('student_info').default('{}'),
    interviewQuestions: jsonb('interview_questions').default('[]'),
    interviewInstructions: text('interview_instructions'),
    systemInstruction: text('system_instruction'),
    serviceType: varchar('service_type', { length: 50 }),
    aiSummaries: jsonb('ai_summaries').default('[]'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => [
    index('idx_mock_interview_student_scheduled').on(table.studentUserId, table.scheduledAt),
    index('idx_mock_interview_status').on(table.status),
    index('idx_mock_interview_created_by_counselor').on(table.createdByCounselorId),
    check('mock_interviews_status_check',
      sql`status IN ('scheduled', 'completed', 'cancelled', 'deleted')`
    ),
  ],
);

export type MockInterview = typeof mockInterviews.$inferSelect;

