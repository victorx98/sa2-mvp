/**
 * Duration Statistics Interfaces
 *
 * Used for calculating session duration from event sourcing
 */

// Time interval
export interface ITimeInterval {
  start: Date;
  end: Date;
}

// Duration statistics
export interface IDurationStats {
  mentorTotalDurationSeconds: number; // Mentor total online duration
  studentTotalDurationSeconds: number; // Student total online duration
  effectiveTutoringDurationSeconds: number; // Effective tutoring duration (both online)
  mentorJoinCount: number; // Mentor join count
  studentJoinCount: number; // Student join count
  overlapIntervals: ITimeInterval[]; // Overlapping intervals (for debugging)
}

// Participant session (join/leave pair)
export interface IParticipantSession {
  userId: string; // User ID (mentor or student)
  role: "mentor" | "student"; // User role
  joinTime: Date; // Join timestamp
  leaveTime: Date | null; // Leave timestamp (null if still in meeting)
}
