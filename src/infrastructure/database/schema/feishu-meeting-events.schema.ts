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
 * Feishu Meeting Events Table
 * 
 * Stores all Feishu webhook events for audit trail and compliance
 * This is a pure archive table - business logic should NOT query this table
 * 
 * Design principles:
 * - Events are stored immediately upon receipt
 * - Business logic extracts key data and stores in meetings table
 * - This table serves as audit log and event replay source
 */
export const feishuMeetingEvents = pgTable(
  "feishu_meeting_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),

    // Meeting identification
    meetingId: varchar("meeting_id", { length: 255 }).notNull(), // Feishu meeting ID
    meetingNo: varchar("meeting_no", { length: 20 }).notNull(), // Feishu 9-digit meeting number
    eventId: varchar("event_id", { length: 255 }).notNull().unique(), // Unique event ID for deduplication

    // Event type
    eventType: varchar("event_type", { length: 100 }).notNull(), // Event type (e.g., vc.meeting.meeting_started_v1)
    
    // Meeting information
    meetingTopic: varchar("meeting_topic", { length: 255 }), // Meeting topic/title

    // Event data
    eventData: jsonb("event_data").notNull(), // Complete raw webhook payload for audit trail

    // Event occurrence time (from Feishu header.create_time)
    occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull(),

    // Record creation time
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    // Indexes for query optimization (if ever needed for debugging)
    meetingNoIdx: index("idx_feishu_meeting_no").on(table.meetingNo),
    meetingIdIdx: index("idx_feishu_meeting_id").on(table.meetingId),
    eventTypeIdx: index("idx_feishu_event_type").on(table.eventType),
    occurredAtIdx: index("idx_feishu_occurred_at").on(table.occurredAt),
    // Unique constraint on event_id for deduplication
    eventIdUnique: unique("uq_feishu_event_id").on(table.eventId),
  }),
);

// Type inference
export type FeishuMeetingEvent = typeof feishuMeetingEvents.$inferSelect;
export type InsertFeishuMeetingEvent = typeof feishuMeetingEvents.$inferInsert;

