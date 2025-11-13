import {
  pgTable,
  uuid,
  varchar,
  timestamp,
  jsonb,
  index,
  integer,
  unique,
} from "drizzle-orm/pg-core";

// Meeting event table for tracking all Feishu/Zoom webhook events
// Generic event store used by all session types (session, comm_session, class_session)
// Domains query by meeting_no to identify their events
export const meetingEvents = pgTable(
  "meeting_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),

    // Meeting identification
    meetingId: varchar("meeting_id", { length: 255 }).notNull(), // Feishu/Zoom meeting ID
    eventId: varchar("event_id", { length: 255 }).notNull().unique(), // Unique event ID for deduplication

    // Event source and type
    provider: varchar("provider", { length: 20 }).notNull(), // 'feishu' | 'zoom'
    eventType: varchar("event_type", { length: 100 }).notNull(), // Event type (e.g., vc.meeting.join_meeting_v1)

    // Operator information
    operatorId: varchar("operator_id", { length: 255 }), // User ID who triggered the event
    operatorRole: integer("operator_role"), // 1 = host, 2 = participant

    // Meeting information (extracted from event)
    meetingNo: varchar("meeting_no", { length: 20 }), // Feishu meeting number (Feishu only)
    meetingTopic: varchar("meeting_topic", { length: 255 }), // Meeting topic/title
    meetingStartTime: timestamp("meeting_start_time", { withTimezone: true }), // Meeting start time
    meetingEndTime: timestamp("meeting_end_time", { withTimezone: true }), // Meeting end time

    // Event data
    eventData: jsonb("event_data").notNull(), // Complete raw webhook payload for audit trail

    // Event occurrence time (from webhook header.create_time)
    occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull(),

    // Record creation time
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    // Indexes for query optimization
    // Index for meeting_no lookups (key query pattern for domains)
    meetingNoIdx: index("idx_meeting_no").on(table.meetingNo),
    // Event type index for filtering by event type
    meetingEventTypeIdx: index("idx_meeting_event_type").on(
      table.eventType,
      table.provider,
    ),
    // Index for looking up all events of a meeting
    meetingEventLookupIdx: index("idx_meeting_event_lookup").on(
      table.meetingId,
      table.eventType,
    ),
    // Index for operator-based queries
    meetingEventOperatorIdx: index("idx_meeting_event_operator").on(
      table.operatorId,
      table.occurredAt,
    ),
    // Index for time-based queries
    meetingEventTimeIdx: index("idx_meeting_event_time").on(table.occurredAt),
    // Unique constraint on event_id for deduplication
    eventIdUnique: unique("uq_meeting_event_id").on(table.eventId),
  }),
);

// Type inference
export type MeetingEvent = typeof meetingEvents.$inferSelect;
export type InsertMeetingEvent = typeof meetingEvents.$inferInsert;
