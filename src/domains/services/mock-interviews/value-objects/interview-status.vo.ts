/**
 * Interview Status Value Object
 * Defines valid status values and transition rules
 */

export enum InterviewStatus {
  SCHEDULED = 'scheduled',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
  DELETED = 'deleted',
}

/**
 * Valid status transitions
 */
const VALID_TRANSITIONS: Record<InterviewStatus, InterviewStatus[]> = {
  [InterviewStatus.SCHEDULED]: [InterviewStatus.COMPLETED, InterviewStatus.CANCELLED, InterviewStatus.DELETED],
  [InterviewStatus.COMPLETED]: [InterviewStatus.DELETED],
  [InterviewStatus.CANCELLED]: [InterviewStatus.DELETED],
  [InterviewStatus.DELETED]: [],
};

/**
 * Check if status transition is valid
 */
export function canTransitionTo(from: InterviewStatus, to: InterviewStatus): boolean {
  return VALID_TRANSITIONS[from]?.includes(to) ?? false;
}

/**
 * Check if interview can be cancelled
 * Rule: Only 'scheduled' can be cancelled, 'completed' cannot
 */
export function canBeCancelled(status: InterviewStatus): boolean {
  return status === InterviewStatus.SCHEDULED;
}

/**
 * Check if interview can be updated
 */
export function canBeUpdated(status: InterviewStatus): boolean {
  return ![
    InterviewStatus.COMPLETED,
    InterviewStatus.CANCELLED,
    InterviewStatus.DELETED,
  ].includes(status);
}

