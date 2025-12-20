/**
 * Session Status Value Object
 * Using enum + helper functions approach
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
 * Check if status can be cancelled
 */
export function canBeCancelled(status: SessionStatus): boolean {
  return [
    SessionStatus.PENDING_MEETING,
    SessionStatus.SCHEDULED,
  ].includes(status);
}

/**
 * Check if status can be updated
 */
export function canBeUpdated(status: SessionStatus): boolean {
  return ![
    SessionStatus.COMPLETED,
    SessionStatus.CANCELLED,
    SessionStatus.DELETED,
  ].includes(status);
}

/**
 * Check if status transition is valid
 */
export function canTransitionTo(
  currentStatus: SessionStatus,
  newStatus: SessionStatus,
): boolean {
  const transitions: Record<SessionStatus, SessionStatus[]> = {
    [SessionStatus.PENDING_MEETING]: [
      SessionStatus.SCHEDULED,
      SessionStatus.CANCELLED,
      SessionStatus.MEETING_FAILED,
    ],
    [SessionStatus.SCHEDULED]: [
      SessionStatus.COMPLETED,
      SessionStatus.CANCELLED,
    ],
    [SessionStatus.COMPLETED]: [],
    [SessionStatus.CANCELLED]: [],
    [SessionStatus.DELETED]: [],
    [SessionStatus.MEETING_FAILED]: [
      SessionStatus.CANCELLED,
    ],
  };
  
  return transitions[currentStatus]?.includes(newStatus) || false;
}

/**
 * Create SessionStatus from string
 */
export function fromString(value: string): SessionStatus {
  const statusMap: Record<string, SessionStatus> = {
    'pending_meeting': SessionStatus.PENDING_MEETING,
    'scheduled': SessionStatus.SCHEDULED,
    'completed': SessionStatus.COMPLETED,
    'cancelled': SessionStatus.CANCELLED,
    'deleted': SessionStatus.DELETED,
    'meeting_failed': SessionStatus.MEETING_FAILED,
  };
  
  const status = statusMap[value.toLowerCase()];
  if (!status) {
    throw new Error(`Invalid session status: ${value}`);
  }
  
  return status;
}

/**
 * Check if status is final
 */
export function isFinalStatus(status: SessionStatus): boolean {
  return [
    SessionStatus.COMPLETED,
    SessionStatus.CANCELLED,
  ].includes(status);
}

