/**
 * Gap Analysis Domain Exceptions
 */

/**
 * Session not found
 */
export class SessionNotFoundException extends Error {
  constructor(sessionId: string) {
    super(`Session not found: ${sessionId}`);
    this.name = 'SessionNotFoundException';
  }
}

/**
 * Invalid status transition
 */
export class InvalidStatusTransitionException extends Error {
  constructor(currentStatus: string, targetStatus: string) {
    super(`Invalid status transition: ${currentStatus} → ${targetStatus}`);
    this.name = 'InvalidStatusTransitionException';
  }
}

/**
 * Session not cancellable
 */
export class SessionNotCancellableException extends Error {
  constructor(sessionId: string, status: string) {
    super(`Session ${sessionId} cannot be cancelled (current status: ${status})`);
    this.name = 'SessionNotCancellableException';
  }
}

/**
 * Session not updatable
 */
export class SessionNotUpdatableException extends Error {
  constructor(sessionId: string, status: string) {
    super(`Session ${sessionId} cannot be updated (current status: ${status})`);
    this.name = 'SessionNotUpdatableException';
  }
}

