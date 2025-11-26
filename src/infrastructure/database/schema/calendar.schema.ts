import {
  pgTable,
  uuid,
  varchar,
  integer,
  timestamp,
  pgEnum,
  index,
  customType,
  check,
  jsonb,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

/**
 * Calendar user type enum - represents user roles in the calendar system
 * Note: Different from products.schema userTypeEnum (which is for product categories)
 * Values: mentor, student, counselor
 */
export const calendarUserTypeEnum = pgEnum("calendar_user_type", [
  "mentor",
  "student",
  "counselor",
]);

/**
 * Slot type enum - represents the type of time slot (legacy, to be deprecated)
 * Values: session, class_session, comm_session
 */
export const calendarTypeEnum = pgEnum("calendar_type", [
  "session",
  "class_session",
  "comm_session",
]);

/**
 * Session type enum (v5.3) - represents the type of session/class
 * Values: regular_mentoring, gap_analysis, ai_career, comm_session, class_session
 */
export const calendarSessionTypeEnum = pgEnum("calendar_session_type", [
  "regular_mentoring",
  "gap_analysis",
  "ai_career",
  "comm_session",
  "class_session",
]);

/**
 * Slot status enum - represents the booking status of a slot
 * Values: booked, completed, cancelled
 */
export const calendarStatusEnum = pgEnum("calendar_status", [
  "booked",
  "completed",
  "cancelled",
]);

/**
 * PostgreSQL TSTZRANGE custom type
 * Note: Drizzle doesn't natively support TSTZRANGE, so we use a custom type
 * TSTZRANGE is a PostgreSQL range type for time zones
 */
const tstzrange = customType<{
  data: { start: Date; end: Date };
  driverData: string;
}>({
  dataType() {
    return "tstzrange";
  },
  toDriver(value: { start: Date; end: Date }): string {
    // Convert to PostgreSQL tstzrange format: '[start, end)'
    return `[${value.start.toISOString()}, ${value.end.toISOString()})`;
  },
  fromDriver(value: string): { start: Date; end: Date } {
    // Parse PostgreSQL tstzrange format
    const match = value.match(/\[(.*?),(.*?)\)/);
    if (!match) {
      throw new Error("Invalid tstzrange format");
    }
    return {
      start: new Date(match[1].trim()),
      end: new Date(match[2].trim()),
    };
  },
});

/**
 * Calendar slots table schema
 * Represents time slots in users' calendars
 *
 * Key design:
 * - Uses PostgreSQL EXCLUDE constraint with GIST index to prevent overlapping bookings
 * - EXCLUDE constraint: (user_id WITH =, time_range WITH &&) WHERE (status = 'booked')
 * - user_type is a denormalized field for query optimization, not part of the constraint
 * - Each user_id has unique identity, no need to include user_type in constraint
 */
export const calendarSlots = pgTable(
  "calendar",
  {
    /**
     * Primary key (UUID)
     */
    id: uuid("id").defaultRandom().primaryKey(),

    /**
     * User identification
     * Foreign key to users table
     */
    userId: uuid("user_id").notNull(),

    /**
     * User type (mentor/student/counselor)
     * Denormalized field for query optimization
     * Each user_id has unique identity in the system
     */
    userType: calendarUserTypeEnum("user_type").notNull(),

    /**
     * Time range (PostgreSQL TSTZRANGE type)
     * Represents half-open interval [start, end)
     * Adjacent slots like [10:00,10:30) and [10:30,11:00) do not overlap
     */
    timeRange: tstzrange("time_range").notNull(),

    /**
     * Duration in minutes (for convenience, calculated from time_range)
     * Constraint: 30-180 minutes
     */
    durationMinutes: integer("duration_minutes").notNull(),

    /**
     * Associated session ID (nullable)
     * Links this slot to a session record
     */
    sessionId: uuid("session_id"),

    /**
     * Associated meeting ID (nullable) - v4.1
     * Links this slot directly to a meeting record
     * Used for event-driven status updates when meeting completes
     */
    meetingId: uuid("meeting_id"),

    /**
     * Session type (v5.3) - regular_mentoring/gap_analysis/ai_career/comm_session/class_session
     * Replaces legacy 'type' field with more granular categorization
     */
    sessionType: calendarSessionTypeEnum("session_type").notNull(),

    /**
     * Course title (v5.3)
     * Stores the name/title of the session/class
     */
    title: varchar("title", { length: 255 }).notNull(),

    /**
     * Scheduled start time (v5.3)
     * Redundant field extracted from time_range for query optimization
     * Used for efficient sorting and filtering
     */
    scheduledStartTime: timestamp("scheduled_start_time", { withTimezone: true }).notNull(),

    /**
     * Booking status (booked/completed/cancelled)
     * Default: booked
     * Only 'booked' slots trigger the EXCLUDE constraint
     */
    status: calendarStatusEnum("status").notNull().default("booked"),

    /**
     * Metadata (v5.3) - JSONB snapshot data
     * Stores: { otherPartyName: string, meetingUrl: string }
     * otherPartyName: snapshot (not synchronized)
     * meetingUrl: synchronized with actual meeting URL
     */
    metadata: jsonb("metadata").default(sql`'{}'::jsonb`),

    /**
     * Reason or remarks (for blocking or cancellation)
     * Max 255 characters
     */
    reason: varchar("reason", { length: 255 }),

    /**
     * Audit: creation timestamp
     */
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),

    /**
     * Audit: last update timestamp
     */
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (table) => ({
    /**
     * Index for user-based queries (legacy)
     * Searches by user_id and user_type
     */
    userIdx: index("idx_calendar_user").on(table.userId, table.userType),

    /**
     * Index for user-scheduled queries (v5.3)
     * Optimized for sorting by scheduled_start_time
     * Used in calendar views and upcoming sessions queries
     */
    userScheduledIdx: index("idx_calendar_user_scheduled").on(
      table.userId,
      table.scheduledStartTime,
    ),

    /**
     * Session index for joining with sessions table
     */
    sessionIdx: index("idx_calendar_session").on(table.sessionId),

    /**
     * Meeting index for event-driven updates (v4.1)
     * Used to update calendar status when meeting completes
     */
    meetingIdx: index("idx_calendar_meeting").on(table.meetingId),

    /**
     * Status index for filtering by status
     */
    statusIdx: index("idx_calendar_status").on(table.status),

    /**
     * Check constraints for enum values
     * Ensures data integrity at database level
     */
    userTypeCheck: check(
      "user_type_check",
      sql`user_type IN ('mentor', 'student', 'counselor')`,
    ),
    sessionTypeCheck: check(
      "check_calendar_session_type",
      sql`session_type IN ('regular_mentoring', 'gap_analysis', 'ai_career', 'comm_session', 'class_session')`,
    ),
    statusCheck: check(
      "check_calendar_status",
      sql`status IN ('booked', 'completed', 'cancelled')`,
    ),
    durationCheck: check(
      "duration_check",
      sql`duration_minutes >= 30 AND duration_minutes <= 180`,
    ),

    /**
     * Note: GIST index and EXCLUDE constraint are created via migration
     * See migration file for details on:
     * - GIST index for time_range overlap detection (idx_calendar_time_range)
     * - EXCLUDE constraint for preventing overlapping bookings (exclude_calendar_time_overlap)
     */
  }),
);

/**
 * Type inference for database operations
 */
export type CalendarSlot = typeof calendarSlots.$inferSelect;
export type InsertCalendarSlot = typeof calendarSlots.$inferInsert;

/**
 * Helper type for time range
 */
export interface ITimeRange {
  start: Date;
  end: Date;
}

/**
 * IMPORTANT: GIST Index and EXCLUDE Constraint Configuration
 *
 * These constraints are defined in the Drizzle migration files:
 * @see src/infrastructure/database/migrations/0004_add_calendar_constraints.sql (original)
 * @see src/infrastructure/database/migrations/0018_add_calendar_v5_3_fields.sql (v5.3 update)
 *
 * The migration includes:
 * 1. CHECK constraints for enums (user_type, slot_type, session_type, status)
 * 2. CHECK constraint for duration (30-180 minutes)
 * 3. GIST index for time_range overlap detection (idx_calendar_time_range)
 * 4. EXCLUDE constraint to prevent overlapping bookings for the same user:
 *    - Only user_id + time_range are in the constraint (not user_type)
 *    - Reason: Each user_id has unique identity, user_type is denormalized
 *    - Applies only to status = 'booked' slots
 *    - Completed/cancelled slots do not participate in overlap detection
 * 5. Foreign key constraints to users table
 * 6. Additional indexes for v5.3:
 *    - idx_calendar_user_scheduled: (user_id, scheduled_start_time DESC) for query optimization
 *    - idx_calendar_status: (status) for filtering
 *
 * To execute the migration:
 * 1. Make sure your database schema matches this table definition
 * 2. Run: npm run db:migrate
 *    or: drizzle-kit migrate
 *
 * V5.3 Enhancements:
 * - Added session_type field (5 types: regular_mentoring, gap_analysis, ai_career, comm_session, class_session)
 * - Added title field for course name
 * - Added scheduled_start_time field for query optimization
 * - Added metadata JSONB field for snapshot data (otherPartyName, meetingUrl)
 * - Updated status enum to include 'completed' state
 */
