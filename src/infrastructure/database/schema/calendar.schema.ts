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
 * Slot type enum - represents the type of time slot
 * Values: session, class_session
 */
export const calendarTypeEnum = pgEnum("calendar_type", ["session", "class_session"]);

/**
 * Slot status enum - represents the booking status of a slot
 * Values: booked, cancelled
 */
export const calendarStatusEnum = pgEnum("calendar_status", ["booked", "cancelled"]);

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
    const match = value.match(/\[(.*?), (.*?)\)/);
    if (!match) {
      throw new Error("Invalid tstzrange format");
    }
    return {
      start: new Date(match[1]),
      end: new Date(match[2]),
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
    userType: calendarUserTypeEnum("calendar_user_type").notNull(),

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
     * Slot type (session/class_session)
     */
    type: calendarTypeEnum("type").notNull(),

    /**
     * Booking status (booked/cancelled)
     * Default: booked
     * Only 'booked' slots trigger the EXCLUDE constraint
     */
    status: calendarStatusEnum("status").notNull().default("booked"),

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
     * Index for user-based queries
     * Searches by user_id and user_type
     */
    userIdx: index("idx_calendar_user").on(table.userId, table.userType),

    /**
     * Session index for joining with sessions table
     */
    sessionIdx: index("idx_calendar_session").on(table.sessionId),

    /**
     * Check constraints for enum values
     * Ensures data integrity at database level
     */
    userTypeCheck: check("user_type_check", sql`calendar_user_type IN ('mentor', 'student', 'counselor')`),
    typeCheck: check("type_check", sql`type IN ('session', 'class_session')`),
    statusCheck: check("status_check", sql`status IN ('booked', 'cancelled')`),
    durationCheck: check("duration_check", sql`duration_minutes >= 30 AND duration_minutes <= 180`),

    /**
     * Note: GIST index and EXCLUDE constraint are created via migration
     * See migration file for details on:
     * - GIST index for time_range overlap detection
     * - EXCLUDE constraint for preventing overlapping bookings
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
 * These constraints are defined in the Drizzle migration file:
 * @see src/infrastructure/database/migrations/0004_add_calendar_constraints.sql
 * 
 * The migration includes:
 * 1. CHECK constraints for enums (user_type, slot_type, status)
 * 2. CHECK constraint for duration (30-180 minutes)
 * 3. GIST index for time_range overlap detection
 * 4. EXCLUDE constraint to prevent overlapping bookings for the same user:
 *    - Only user_id + time_range are in the constraint (not user_type)
 *    - Reason: Each user_id has unique identity, user_type is denormalized
 *    - Applies only to status = 'booked' slots
 *    - Cancelled slots do not participate in overlap detection
 * 5. Foreign key constraints to users and sessions tables
 * 
 * To execute the migration:
 * 1. Make sure your database schema matches this table definition
 * 2. Run: npm run db:migrate
 *    or: drizzle-kit migrate
 * 
 * The migration uses "NOT VALID" constraints to ensure compatibility with
 * existing data, and then validates each constraint after creation.
 */
