/**
 * Session Status Value Object
 * Encapsulates business rules for class session status transitions
 */
export enum SessionStatus {
  PENDING_MEETING = 'pending_meeting',
  SCHEDULED = 'scheduled',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
  DELETED = 'deleted',
  MEETING_FAILED = 'meeting_failed',
}

/**
 * Check if status can transition to SCHEDULED
 */
export function canTransitionToScheduled(currentStatus: SessionStatus): boolean {
  return currentStatus === SessionStatus.PENDING_MEETING;
}

/**
 * Check if status can transition to COMPLETED
 */
export function canTransitionToCompleted(currentStatus: SessionStatus): boolean {
  return currentStatus === SessionStatus.SCHEDULED;
}

/**
 * Check if status can transition to CANCELLED
 */
export function canTransitionToCancelled(currentStatus: SessionStatus): boolean {
  return [
    SessionStatus.PENDING_MEETING,
    SessionStatus.SCHEDULED,
  ].includes(currentStatus);
}

/**
 * Check if status can be updated (not in terminal state)
 */
export function canUpdate(status: SessionStatus): boolean {
  return ![
    SessionStatus.COMPLETED,
    SessionStatus.CANCELLED,
    SessionStatus.DELETED,
  ].includes(status);
}

/**
 * Check if session is in terminal state
 */
export function isTerminalState(status: SessionStatus): boolean {
  return [
    SessionStatus.COMPLETED,
    SessionStatus.CANCELLED,
    SessionStatus.DELETED,
  ].includes(status);
}

