/**
 * User type enum - represents the role of users in the calendar system
 */
export enum UserType {
  MENTOR = "mentor",
  STUDENT = "student",
  COUNSELOR = "counselor",
}

/**
 * Slot type enum - represents the type of time slot
 */
export enum SlotType {
  SESSION = "session",
  CLASS_SESSION = "class_session",
}

/**
 * Slot status enum - represents the booking status of a slot
 */
export enum SlotStatus {
  BOOKED = "booked",
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
 * Calendar slot entity interface - matches the database table structure
 * Represents a time slot in a user's calendar
 */
export interface ICalendarSlotEntity {
  id: string; // UUID primary key
  userId: string; // User ID (UUID)
  userType: UserType; // User type (mentor/student/counselor)
  timeRange: ITimeRange; // Time range (PostgreSQL TSTZRANGE)
  durationMinutes: number; // Duration in minutes (30-180)
  sessionId: string | null; // Associated session ID (nullable)
  slotType: SlotType; // Slot type (session/class_session)
  status: SlotStatus; // Slot status (booked/cancelled)
  reason: string | null; // Reason for blocking or cancellation
  createdAt: Date; // Created timestamp
  updatedAt: Date; // Updated timestamp
}
