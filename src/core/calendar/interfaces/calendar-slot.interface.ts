/**
 * User type enum - represents the role of users in the calendar system
 */
export enum UserType {
  MENTOR = "mentor",
  STUDENT = "student",
  COUNSELOR = "counselor",
}

/**
 * Session type enum (v5.3) - represents the type of session/class
 */
export enum SessionType {
  REGULAR_MENTORING = "regular_mentoring",
  GAP_ANALYSIS = "gap_analysis",
  AI_CAREER = "ai_career",
  COMM_SESSION = "comm_session",
  CLASS_SESSION = "class_session",
  MOCK_INTERVIEW = "mock_interview",
}

/**
 * Slot status enum - represents the booking status of a slot
 */
export enum SlotStatus {
  BOOKED = "booked",
  COMPLETED = "completed",
  CANCELLED = "cancelled",
}

/**
 * Time range structure for representing start and end times
 */
export interface ITimeRange {
  start: Date; // Start time
  end: Date; // End time
}

/**
 * Calendar metadata structure (v5.3) - stores snapshot data in JSONB
 */
export interface ICalendarMetadata {
  otherPartyName?: string; // Name of the other party (mentor/student) - snapshot
  meetingUrl?: string; // Meeting URL - synchronized
}

/**
 * Calendar slot entity interface (v5.3) - matches the database table structure
 * Represents a time slot in a user's calendar
 */
export interface ICalendarSlotEntity {
  id: string; // UUID primary key
  userId: string; // User ID (UUID)
  userType: UserType; // User type (mentor/student/counselor)
  timeRange: ITimeRange; // Time range (PostgreSQL TSTZRANGE)
  durationMinutes: number; // Duration in minutes (30-180)
  sessionId: string | null; // Associated session ID (nullable)
  meetingId: string | null; // Associated meeting ID (nullable)
  sessionType: SessionType; // Session type 
  title: string; // Course title
  scheduledStartTime: Date; // Scheduled start time (v5.3, redundant for query optimization)
  status: SlotStatus; // Slot status (booked/completed/cancelled)
  metadata: ICalendarMetadata; // Snapshot data
  reason: string | null; // Reason for blocking or cancellation
  createdAt: Date; // Created timestamp
  updatedAt: Date; // Updated timestamp
}
