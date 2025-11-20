import {
  pgTable,
  uuid,
  varchar,
  timestamp,
  integer,
  text,
  jsonb,
  pgEnum,
  index,
} from "drizzle-orm/pg-core";

// Session status enum
export const sessionStatusEnum = pgEnum("session_status", [
  "scheduled", // Scheduled
  "started", // In progress
  "completed", // Completed
  "cancelled", // Cancelled
]);

// Meeting provider enum
export const meetingProviderEnum = pgEnum("meeting_provider", [
  "feishu", // Feishu/Lark
  "zoom", // Zoom
]);

// Recording structure for JSONB field
export interface IRecording {
  recordingId: string; // Recording file ID
  recordingUrl: string; // Recording file URL
  transcriptUrl: string | null; // Transcript URL (to be confirmed)
  duration: number; // Recording duration in seconds
  sequence: number; // Recording sequence (supports multiple recordings)
  startedAt: Date; // Recording start time
  endedAt: Date; // Recording end time
}

// AI Summary structure for JSONB field
export interface IAISummary {
  summary: string; // Main summary
  topics?: string[]; // Key topics discussed
  keyPoints?: string[]; // Key points
  suggestions?: string[]; // Suggestions for student
  durationAnalysis?: {
    effectiveMinutes: number; // Effective tutoring duration in minutes
    topicBreakdown?: Record<string, number>; // Time spent on each topic
  };
}

export const sessions = pgTable(
  "sessions",
  {
    id: uuid("id").defaultRandom().primaryKey(),

    // User references (no FK constraint, validation in application layer)
    studentId: uuid("student_id").notNull(),
    mentorId: uuid("mentor_id").notNull(),
    contractId: uuid("contract_id"), // Associated contract ID (nullable)

    // Meeting information
    meetingProvider: meetingProviderEnum("meeting_provider").notNull(),
    meetingNo: varchar("meeting_no", { length: 20 }), // Feishu meeting number (9 digits, key for webhook association)
    meetingUrl: text("meeting_url"), // Meeting link
    meetingPassword: varchar("meeting_password", { length: 50 }), // Meeting password

    // Scheduled time
    scheduledStartTime: timestamp("scheduled_start_time", {
      withTimezone: true,
    }).notNull(),
    scheduledDuration: integer("scheduled_duration").notNull(), // Planned duration in minutes

    // Meeting time segments (list of meeting start and end times for multi-segment sessions)
    meetingTimeList: jsonb("meeting_time_list").$type<Array<{ startTime: Date; endTime: Date }>>().default([]), // Array of meeting time segments

    // Actual service duration (calculated from meeting_time_list)
    actualServiceDuration: integer("actual_service_duration"), // Actual service duration in minutes (sum of all meeting segments)

    // Recordings (JSONB array, supports multiple recordings)
    recordings: jsonb("recordings").$type<IRecording[]>().default([]),

    // AI summary (JSONB object)
    aiSummary: jsonb("ai_summary").$type<IAISummary | null>(),

    // Business fields
    sessionName: varchar("session_name", { length: 255 }).notNull(), // Session name
    notes: text("notes"), // Notes

    // Status management
    status: sessionStatusEnum("status").notNull().default("scheduled"),

    // Audit fields
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
    deletedAt: timestamp("deleted_at", { withTimezone: true }), // Soft delete
  },
  (table) => ({
    // Indexes for query optimization
    studentIdx: index("idx_session_student").on(
      table.studentId,
      table.scheduledStartTime,
    ),
    mentorIdx: index("idx_session_mentor").on(
      table.mentorId,
      table.scheduledStartTime,
    ),
    contractIdx: index("idx_session_contract").on(table.contractId),
    meetingNoIdx: index("idx_session_meeting_no").on(table.meetingNo),
    statusIdx: index("idx_session_status").on(table.status),
  }),
);

// Type inference
export type Session = typeof sessions.$inferSelect;
export type InsertSession = typeof sessions.$inferInsert;
