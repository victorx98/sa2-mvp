/**
 * Mentoring Session Entity
 *
 * Domain entity for mentoring session business logic
 * References core meeting via meeting_id FK
 */

export enum MentoringSessionStatus {
  SCHEDULED = "scheduled", // Session is scheduled
  COMPLETED = "completed", // Session is completed
  CANCELLED = "cancelled", // Session is cancelled
  DELETED = "deleted", // Session is soft deleted
}

/**
 * Mentoring Session Entity Interface
 * Represents the business domain of mentoring sessions
 */
export interface MentoringSessionEntity {
  id: string; // UUID primary key
  meetingId: string; // Foreign key to meetings.id (Core Layer)
  studentId: string; // Student user ID
  mentorId: string; // Mentor user ID
  status: MentoringSessionStatus; // Business status
  serviceDuration: number | null; // Service duration in seconds (for billing)
  feedback: string | null; // Mentor feedback
  rating: number | null; // Student rating (1-5)
  topic: string | null; // Session topic
  notes: string | null; // Additional notes
  createdAt: Date; // Record creation timestamp
  updatedAt: Date; // Record last update timestamp
  deletedAt: Date | null; // Soft delete timestamp
}

/**
 * Create Mentoring Session Input
 */
export interface CreateMentoringSessionInput {
  meetingId: string; // Meeting ID from Core Layer
  studentId: string;
  mentorId: string;
  topic?: string;
  notes?: string;
}

/**
 * Update Mentoring Session Input
 */
export interface UpdateMentoringSessionInput {
  status?: MentoringSessionStatus;
  serviceDuration?: number;
  feedback?: string;
  rating?: number;
  topic?: string;
  notes?: string;
}

