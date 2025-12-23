import { pgTable, uuid, varchar, timestamp, index, check } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { userTable } from './user.schema';
import { recommLetterTypes } from './recomm-letter-types.schema';

/**
 * Recommendation Letters Schema
 * 
 * Manages recommendation letters for students
 */
export const recommLetters = pgTable(
  'recomm_letters',
  {
    id: uuid('id').defaultRandom().primaryKey(),

    // Student reference
    studentUserId: uuid('student_user_id')
      .notNull()
      .references(() => userTable.id),
    
    // Letter type references
    letterTypeId: uuid('letter_type_id')
      .notNull()
      .references(() => recommLetterTypes.id),
    
    packageTypeId: uuid('package_type_id')
      .references(() => recommLetterTypes.id),
    
    // Service type for billing
    serviceType: varchar('service_type', { length: 50 }).notNull(),
    
    // Description for operations (bill, cancel bill, etc.)
    description: varchar('description', { length: 1000 }),

    // File information (AWS S3)
    fileUrl: varchar('file_url', { length: 1000 }).notNull(),
    fileName: varchar('file_name', { length: 500 }).notNull(),

    // Status information
    status: varchar('status', { length: 20 }).notNull().default('uploaded'), // 'uploaded' | 'deleted'

    // Billing information
    mentorUserId: uuid('mentor_user_id').references(() => userTable.id), // NULL = not billed
    billedBy: uuid('billed_by').references(() => userTable.id), // Counselor who billed the letter
    billedAt: timestamp('billed_at', { withTimezone: true }),

    // Audit fields
    uploadedBy: uuid('uploaded_by').notNull().references(() => userTable.id),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('idx_recomm_letters_student_user_id').on(table.studentUserId),
    index('idx_recomm_letters_letter_type_id').on(table.letterTypeId),
    index('idx_recomm_letters_service_type').on(table.serviceType),
    index('idx_recomm_letters_status').on(table.status),
    index('idx_recomm_letters_mentor_user_id').on(table.mentorUserId),
    // Status constraint
    check('recomm_letters_status_check',
      sql`status IN ('uploaded', 'deleted')`
    ),
  ],
);

export type RecommLetter = typeof recommLetters.$inferSelect;
export type NewRecommLetter = typeof recommLetters.$inferInsert;

