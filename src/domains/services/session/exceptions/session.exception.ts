import {
  BadRequestException,
  NotFoundException,
  ConflictException,
  HttpStatus,
} from "@nestjs/common";

// Error message mapping table
export const SESSION_ERROR_MESSAGES: Record<string, string> = {
  // Session related errors
  SESSION_NOT_FOUND: "Session not found",
  SESSION_DELETED: "Session has been deleted",
  SESSION_ALREADY_CANCELLED: "Session has already been cancelled",
  SESSION_ALREADY_STARTED: "Session has already started",
  SESSION_ALREADY_COMPLETED: "Session has already been completed",
  SESSION_NOT_SCHEDULED: "Session is not in scheduled status",
  SESSION_CANNOT_UPDATE: "Session cannot be updated in current status",
  SESSION_CANNOT_CANCEL: "Session cannot be cancelled in current status",

  // User validation errors
  STUDENT_NOT_FOUND: "Student user not found",
  MENTOR_NOT_FOUND: "Mentor user not found",
  STUDENT_DELETED: "Student user has been deleted",
  MENTOR_DELETED: "Mentor user has been deleted",
  INVALID_MENTOR_ROLE: "User is not a mentor",
  STUDENT_MENTOR_SAME: "Student and mentor cannot be the same user",

  // Time validation errors
  INVALID_START_TIME: "Start time must be in the future",
  INVALID_DURATION: "Duration must be between 30 and 180 minutes",
  TIME_SLOT_CONFLICT: "Time slot conflicts with existing session",

  // Meeting validation errors
  MEETING_INFO_NOT_FOUND: "Meeting information not found",
  MEETING_ID_REQUIRED: "Meeting ID is required",
  INVALID_MEETING_PROVIDER: "Invalid meeting provider",

  // Contract validation errors
  CONTRACT_NOT_FOUND: "Contract not found",
  CONTRACT_EXPIRED: "Contract has expired",
  CONTRACT_INSUFFICIENT_BALANCE: "Contract has insufficient balance",

  // Common validation errors
  INVALID_SESSION_STATUS: "Invalid session status",
  CANCEL_REASON_REQUIRED: "Cancel reason is required",
  INVALID_UPDATE_DATA: "Invalid update data provided",
};

// Custom exception base class
export class SessionException extends BadRequestException {
  constructor(
    public readonly code: string,
    message?: string,
  ) {
    super({
      statusCode: HttpStatus.BAD_REQUEST,
      code,
      message: message || SESSION_ERROR_MESSAGES[code] || "Unknown error",
    });
  }
}

// 404 Not Found exception
export class SessionNotFoundException extends NotFoundException {
  constructor(
    public readonly code: string,
    message?: string,
  ) {
    super({
      statusCode: HttpStatus.NOT_FOUND,
      code,
      message: message || SESSION_ERROR_MESSAGES[code] || "Resource not found",
    });
  }
}

// 409 Conflict exception
export class SessionConflictException extends ConflictException {
  constructor(
    public readonly code: string,
    message?: string,
  ) {
    super({
      statusCode: HttpStatus.CONFLICT,
      code,
      message: message || SESSION_ERROR_MESSAGES[code] || "Resource conflict",
    });
  }
}

// 410 Gone exception (resource has been deleted)
export class SessionGoneException extends BadRequestException {
  constructor(
    public readonly code: string,
    message?: string,
  ) {
    super({
      statusCode: HttpStatus.GONE,
      code,
      message:
        message || SESSION_ERROR_MESSAGES[code] || "Resource has been deleted",
    });
  }
}
