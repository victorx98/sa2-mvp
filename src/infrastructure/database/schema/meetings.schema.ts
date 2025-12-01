import {
  pgTable,
  uuid,
  varchar,
  timestamp,
  jsonb,
  integer,
  index,
  unique,
  text,
} from "drizzle-orm/pg-core";

/**
 * Meeting Status Enum (v4.1)
 */
export const MEETING_STATUS = {
  SCHEDULED: "scheduled",
  ACTIVE: "active",
  ENDED: "ended",
  CANCELLED: "cancelled", // v4.1 - replaced EXPIRED
} as const;

/**
 * Meeting Time Segment Interface
 */
export interface MeetingTimeSegment {
  start: string; // ISO timestamp
  end: string; // ISO timestamp
}

/**
 * Meetings Table (v4.1)
 *
 * Core aggregate root for meeting resources
 * Stores physical meeting lifecycle and state
 *
 * Design principles:
 * 1. This is the "Core Meeting Layer" that manages meeting resources
 * 2. Downstream domains (mentoring_sessions, etc.) reference this via meetings.id FK
 * 3. meeting_no can be reused over time (7+ days), so we use (meeting_no, schedule_start_time) for lookups
 * 4. meeting_id unifies both platforms (Feishu: reserve.id, Zoom: id)
 */
export const meetings = pgTable(
  "meetings",
  {
    id: uuid("id").defaultRandom().primaryKey(), // Primary key, referenced by downstream domains

    // Meeting identification
    meetingNo: varchar("meeting_no", { length: 20 }).notNull(), // Feishu 9-digit number, Zoom meeting number
    meetingProvider: varchar("meeting_provider", { length: 20 }).notNull(), // 'feishu' | 'zoom'
    meetingId: varchar("meeting_id", { length: 255 }).notNull(), // Meeting ID from provider (Feishu reserve.id, Zoom id)

    // Meeting details
    topic: varchar("topic", { length: 255 }).notNull(), // Meeting topic/title
    meetingUrl: text("meeting_url").notNull(), // Meeting join URL
    ownerId: varchar("owner_id", { length: 255 }), // Meeting owner ID (Feishu open_id/union_id, not UUID)

    // Scheduled time
    scheduleStartTime: timestamp("schedule_start_time", {
      withTimezone: true,
    }).notNull(), // Critical field for deduplication queries
    scheduleDuration: integer("schedule_duration").notNull(), // Duration in minutes

    // Lifecycle status
    status: varchar("status", { length: 20 }).notNull().default("scheduled"), // scheduled | active | ended | cancelled (v4.1)

    // Actual duration (calculated after meeting ends)
    actualDuration: integer("actual_duration"), // Duration in seconds

    // Meeting time segments (JSONB array of {start, end} objects)
    meetingTimeList: jsonb("meeting_time_list")
      .$type<MeetingTimeSegment[]>()
      .default([]),

    // Recording
    recordingUrl: text("recording_url"), // Recording URL (if available)

    // Delayed detection fields
    lastMeetingEndedTimestamp: timestamp("last_meeting_ended_timestamp", {
      withTimezone: true,
    }), // Last meeting.ended event timestamp
    pendingTaskId: varchar("pending_task_id", { length: 255 }), // Pending delayed task ID

    // Timestamps
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    // Unique constraint: meeting_no + provider + schedule_start_time (soft constraint, 7-day window in app logic)
    uniqueMeetingNoProviderTime: unique("unique_meeting_no_provider_time").on(
      table.meetingNo,
      table.meetingProvider,
      table.scheduleStartTime,
    ),

    // Index for Webhook reverse lookup: WHERE meeting_no = ? AND created_at > (NOW() - 7 DAYS)
    idxMeetingNoCreatedAt: index("idx_meeting_no_created_at").on(
      table.meetingNo,
      table.createdAt,
    ),

    // Index for status queries
    idxStatus: index("idx_meeting_status").on(table.status),

    // Index for schedule_start_time (for deduplication queries)
    idxScheduleStartTime: index("idx_schedule_start_time").on(
      table.scheduleStartTime,
    ),

    // Index for meeting_id (for update/cancel operations and event lookups)
    idxMeetingId: index("idx_meeting_meeting_id").on(table.meetingId),

    // v4.1 - Index for owner_id
    idxOwnerId: index("idx_meeting_owner").on(table.ownerId),
  }),
);

// Type inference for meeting entity
export type Meeting = typeof meetings.$inferSelect;
export type NewMeeting = typeof meetings.$inferInsert;

