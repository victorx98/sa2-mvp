import { pgTable, uuid, varchar, timestamp, index, check } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { userTable } from './user.schema';

/**
 * Resumes Schema
 * 
 * Manages student resumes for different job titles
 */
export const resumes = pgTable(
  'resumes',
  {
    id: uuid('id').defaultRandom().primaryKey(),

    // Student reference
    studentUserId: uuid('student_user_id')
      .notNull()
      .references(() => userTable.id, { onDelete: 'cascade' }),
    
    // Job title information (stored as text)
    jobTitle: varchar('job_title', { length: 200 }).notNull(),
    
    // Session type for billing
    sessionType: varchar('session_type', { length: 50 }).notNull(),
    
    // Description for operations (set final, bill, etc.)
    description: varchar('description', { length: 1000 }),

    // File information (AWS S3)
    fileUrl: varchar('file_url', { length: 1000 }).notNull(),
    fileName: varchar('file_name', { length: 500 }).notNull(),

    // Status information
    status: varchar('status', { length: 20 }).notNull().default('uploaded'), // 'uploaded' | 'final' | 'deleted'
    finalSetAt: timestamp('final_set_at', { withTimezone: true }),

    // Billing information
    mentorUserId: uuid('mentor_user_id').references(() => userTable.id), // NULL = not billed
    billedAt: timestamp('billed_at', { withTimezone: true }),

    // Audit fields
    uploadedBy: uuid('uploaded_by').notNull().references(() => userTable.id),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('idx_resumes_student_user_id').on(table.studentUserId),
    index('idx_resumes_job_title').on(table.jobTitle),
    index('idx_resumes_status').on(table.status),
    index('idx_resumes_mentor_user_id').on(table.mentorUserId),
    index('idx_resumes_student_job_title').on(table.studentUserId, table.jobTitle),
    // Status constraint
    check('resumes_status_check',
      sql`status IN ('uploaded', 'final', 'deleted')`
    ),
  ],
);

export type Resume = typeof resumes.$inferSelect;
export type NewResume = typeof resumes.$inferInsert;

