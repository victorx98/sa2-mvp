import {
  pgTable,
  uuid,
  varchar,
  timestamp,
  jsonb,
  index,
  unique,
} from "drizzle-orm/pg-core";

/**
 * Zoom Meeting Events Table
 * 
 * Stores all Zoom webhook events for audit trail and compliance
 * This is a pure archive table - business logic should NOT query this table
 * 
 * Design principles:
 * - Events are stored immediately upon receipt
 * - Business logic extracts key data and stores in meetings table
 * - This table serves as audit log and event replay source
 */
export const zoomMeetingEvents = pgTable(
  "zoom_meeting_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),

    // Meeting identification
    meetingId: varchar("meeting_id", { length: 255 }).notNull(), // Zoom meeting ID (payload.object.id)
    eventId: varchar("event_id", { length: 255 }).notNull().unique(), // Zoom event UUID (payload.object.uuid) for deduplication

    // Event type
    eventType: varchar("event_type", { length: 100 }).notNull(), // Event type (e.g., meeting.started, meeting.ended)
    
    // Meeting information
    meetingTopic: varchar("meeting_topic", { length: 255 }), // Meeting topic/title

    // Event data
    eventData: jsonb("event_data").notNull(), // Complete raw webhook payload for audit trail

    // Event occurrence time (from Zoom event_ts)
    occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull(),

    // Record creation time
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    // Indexes for query optimization (if ever needed for debugging)
    meetingIdIdx: index("idx_zoom_meeting_id").on(table.meetingId),
    eventTypeIdx: index("idx_zoom_event_type").on(table.eventType),
    occurredAtIdx: index("idx_zoom_occurred_at").on(table.occurredAt),
    // Unique constraint on event_id for deduplication
    eventIdUnique: unique("uq_zoom_event_id").on(table.eventId),
  }),
);

// Type inference
export type ZoomMeetingEvent = typeof zoomMeetingEvents.$inferSelect;
export type InsertZoomMeetingEvent = typeof zoomMeetingEvents.$inferInsert;

