import {
  pgTable,
  uuid,
  varchar,
  timestamp,
  jsonb,
  index,
} from "drizzle-orm/pg-core";

// Session event table for tracking all meeting events
// Used for duration calculation and event sourcing
export const sessionEvents = pgTable(
  "session_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),

    // Associated session (no FK constraint, validation in application layer)
    sessionId: uuid("session_id").notNull(),

    // Event source
    provider: varchar("provider", { length: 20 }).notNull(), // 'feishu' | 'zoom'

    // Event type (e.g., meeting_started_v1, join_meeting_v1)
    eventType: varchar("event_type", { length: 100 }).notNull(),

    // Event data (JSONB, stores complete webhook payload)
    eventData: jsonb("event_data").notNull(),

    // Event occurrence time (from webhook)
    occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull(),

    // Record creation time
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    // Composite index for duration calculation
    sessionEventTimeIdx: index("idx_session_event_time").on(
      table.sessionId,
      table.occurredAt,
    ),
    // Event type index for querying
    eventTypeIdx: index("idx_event_type").on(table.eventType),
  }),
);

// Type inference
export type SessionEvent = typeof sessionEvents.$inferSelect;
export type InsertSessionEvent = typeof sessionEvents.$inferInsert;
