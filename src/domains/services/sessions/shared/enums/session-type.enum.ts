/**
 * Session Type Enum
 * 
 * Technical identifiers for different session subtypes
 */
export enum SessionType {
  REGULAR_MENTORING = 'regular_mentoring',
  GAP_ANALYSIS = 'gap_analysis',
  AI_CAREER = 'ai_career',
  COMM_SESSION = 'comm_session',
  CLASS_SESSION = 'class_session',
}

/**
 * Session Status Enum
 */
export enum SessionStatus {
  PENDING_MEETING = 'pending_meeting',
  SCHEDULED = 'scheduled',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
  DELETED = 'deleted',
  MEETING_FAILED = 'meeting_failed',
}

