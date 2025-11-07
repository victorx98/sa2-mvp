// Resource type enum
export enum ResourceType {
  MENTOR = "mentor",
  STUDENT = "student",
  ROOM = "room",
}

// Slot type enum
export enum SlotType {
  SESSION = "session",
  BLOCKED = "blocked",
}

// Slot status enum
export enum SlotStatus {
  OCCUPIED = "occupied",
  CANCELLED = "cancelled",
}

// Time range structure
export interface ITimeRange {
  start: Date;
  end: Date;
}

// Calendar slot entity interface (matches database table)
export interface ICalendarSlotEntity {
  id: string; // UUID primary key
  resourceType: ResourceType; // Resource type
  resourceId: string; // Resource UUID
  timeRange: ITimeRange; // Time range (PostgreSQL TSTZRANGE)
  durationMinutes: number; // Duration in minutes
  sessionId: string | null; // Associated session ID (nullable)
  slotType: SlotType; // Slot type
  status: SlotStatus; // Slot status
  reason: string | null; // Reason for blocking/cancellation
  createdAt: Date; // Created timestamp
  updatedAt: Date; // Updated timestamp
}

// Helper interface for availability check result
export interface IAvailabilityResult {
  available: boolean;
  conflictingSlots?: ICalendarSlotEntity[];
}
