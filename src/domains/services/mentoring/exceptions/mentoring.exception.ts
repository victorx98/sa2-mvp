/**
 * Mentoring Session Exceptions
 *
 * Custom exceptions for mentoring session business logic
 */

export class MentoringSessionException extends Error {
  constructor(
    public readonly code: string,
    message?: string,
  ) {
    super(message || code);
    this.name = "MentoringSessionException";
  }
}

export class MentoringSessionNotFoundException extends MentoringSessionException {
  constructor(message?: string) {
    super("MENTORING_SESSION_NOT_FOUND", message || "Mentoring session not found");
    this.name = "MentoringSessionNotFoundException";
  }
}

export class MentoringSessionValidationException extends MentoringSessionException {
  constructor(message: string) {
    super("MENTORING_SESSION_VALIDATION_ERROR", message);
    this.name = "MentoringSessionValidationException";
  }
}

export class MentoringSessionStateException extends MentoringSessionException {
  constructor(message: string) {
    super("MENTORING_SESSION_STATE_ERROR", message);
    this.name = "MentoringSessionStateException";
  }
}

