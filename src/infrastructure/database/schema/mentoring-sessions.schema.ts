import {
  pgTable,
  uuid,
  varchar,
  timestamp,
  integer,
  text,
  index,
  foreignKey,
  unique,
} from "drizzle-orm/pg-core";
import { meetings } from "./meetings.schema";

/**
 * Mentoring Session Status Enum
 */
export const MENTORING_SESSION_STATUS = {
  SCHEDULED: "scheduled",
  COMPLETED: "completed",
  CANCELLED: "cancelled",
  DELETED: "deleted",
} as const;

/**
 * Mentoring Sessions Table
 *
 * Business domain table for mentoring sessions
 * References Core Meeting Layer via meeting_id FK
 *
 * Design principles:
 * 1. This is the "Business Domain Layer" that manages mentoring-specific data
 * 2. References meetings.id as FK for 1:1 relationship
 * 3. Stores business attributes: feedback, rating, service_duration
 * 4. Does NOT duplicate Core Layer fields (meeting_no, meeting_url, etc.)
 */
export const mentoringSessions = pgTable(
  "mentoring_sessions",
  {
    id: uuid("id").defaultRandom().primaryKey(), // Primary key

    // Foreign key to Core Meeting
    meetingId: uuid("meeting_id")
      .notNull()
      .references(() => meetings.id, { onDelete: "restrict" }), // 1:1 relationship

    // Business participants
    studentId: uuid("student_id").notNull(), // Student user ID
    mentorId: uuid("mentor_id").notNull(), // Mentor user ID

    // Business status
    status: varchar("status", { length: 20 })
      .notNull()
      .default("scheduled"), // scheduled | completed | cancelled | deleted

    // Service billing
    serviceDuration: integer("service_duration"), // Duration in seconds (for billing calculations)

    // Business data
    feedback: text("feedback"), // Mentor feedback text
    rating: integer("rating"), // Student rating (1-5)
    topic: varchar("topic", { length: 255 }), // Session topic
    notes: text("notes"), // Additional notes

    // Timestamps
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }), // Soft delete
  },
  (table) => ({
    // Unique constraint: one mentoring session per meeting
    uniqueMeetingId: unique("unique_mentoring_meeting_id").on(table.meetingId),

    // Index for student queries
    idxStudentCreatedAt: index("idx_mentoring_student_created_at").on(
      table.studentId,
      table.createdAt,
    ),

    // Index for mentor queries
    idxMentorCreatedAt: index("idx_mentoring_mentor_created_at").on(
      table.mentorId,
      table.createdAt,
    ),

    // Index for status queries
    idxStatus: index("idx_mentoring_status").on(table.status),

    // Index for soft delete queries
    idxDeletedAt: index("idx_mentoring_deleted_at").on(table.deletedAt),
  }),
);

// Type inference for mentoring session entity
export type MentoringSession = typeof mentoringSessions.$inferSelect;
export type NewMentoringSession = typeof mentoringSessions.$inferInsert;

