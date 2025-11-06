import {
  pgTable,
  uuid,
  varchar,
  integer,
  timestamp,
  pgEnum,
  index,
  customType,
} from "drizzle-orm/pg-core";

// Resource type enum
export const resourceTypeEnum = pgEnum("resource_type", [
  "mentor",
  "student",
  "room",
]);

// Slot type enum
export const slotTypeEnum = pgEnum("slot_type", ["session", "blocked"]);

// Slot status enum
export const slotStatusEnum = pgEnum("slot_status", ["occupied", "cancelled"]);

// PostgreSQL TSTZRANGE custom type
// Note: Drizzle doesn't natively support TSTZRANGE, so we use a custom type
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

export const calendarSlots = pgTable(
  "calendar_slots",
  {
    id: uuid("id").defaultRandom().primaryKey(),

    // Resource identification
    resourceType: resourceTypeEnum("resource_type").notNull(),
    resourceId: uuid("resource_id").notNull(),

    // Time range (PostgreSQL TSTZRANGE type)
    // Note: Use start_time and end_time for Drizzle queries,
    // but time_range column will be created in the database
    timeRange: tstzrange("time_range").notNull(),

    // Duration in minutes (for convenience, calculated from time_range)
    durationMinutes: integer("duration_minutes").notNull(),

    // Associated session (nullable, only for session type slots)
    sessionId: uuid("session_id"), // No FK constraint per design decision

    // Slot type
    slotType: slotTypeEnum("slot_type").notNull(),

    // Status
    status: slotStatusEnum("status").notNull().default("occupied"),

    // Reason for blocking or cancellation
    reason: varchar("reason", { length: 255 }),

    // Audit fields
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (table) => ({
    // Composite index for resource queries
    resourceIdx: index("idx_calendar_resource").on(
      table.resourceType,
      table.resourceId,
      table.status,
    ),
    // Session index
    sessionIdx: index("idx_calendar_session").on(table.sessionId),
    // Note: GIST index and EXCLUDE constraint need to be added manually via migration
    // See migration file for details
  }),
);

// Type inference
export type CalendarSlot = typeof calendarSlots.$inferSelect;
export type InsertCalendarSlot = typeof calendarSlots.$inferInsert;

// Helper type for time range
export interface ITimeRange {
  start: Date;
  end: Date;
}

// Note: After running drizzle-kit generate, you need to manually add to the migration:
//
// -- Create GIST index for time_range overlap detection
// CREATE INDEX idx_calendar_time_range ON calendar_slots USING GIST (
//   resource_type,
//   resource_id,
//   time_range
// );
//
// -- Add EXCLUDE constraint to prevent overlapping time slots
// ALTER TABLE calendar_slots ADD CONSTRAINT calendar_slots_no_overlap
// EXCLUDE USING GIST (
//   resource_type WITH =,
//   resource_id WITH =,
//   time_range WITH &&
// ) WHERE (status = 'occupied');
