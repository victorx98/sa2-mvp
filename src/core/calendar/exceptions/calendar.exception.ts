import {
  BadRequestException,
  NotFoundException,
  ConflictException,
  HttpStatus,
} from "@nestjs/common";

// Error message mapping table
export const CALENDAR_ERROR_MESSAGES: Record<string, string> = {
  // Slot related errors
  SLOT_NOT_FOUND: "Calendar slot not found",
  SLOT_ALREADY_CANCELLED: "Calendar slot has already been cancelled",
  SLOT_CANNOT_CANCEL: "Calendar slot cannot be cancelled",

  // Time validation errors
  INVALID_TIME_RANGE: "Invalid time range: end time must be after start time",
  TIME_SLOT_CONFLICT: "Time slot conflicts with existing occupied slot",
  TIME_SLOT_IN_PAST: "Cannot create time slot in the past",
  INVALID_DURATION: "Duration must be between 30 and 180 minutes",

  // Resource validation errors
  RESOURCE_NOT_FOUND: "Resource not found",
  INVALID_RESOURCE_TYPE: "Invalid resource type",

  // Session validation errors
  SESSION_SLOT_NOT_FOUND: "No calendar slot found for this session",
  SLOT_ALREADY_ASSIGNED: "Calendar slot is already assigned to another session",

  // Common validation errors
  INVALID_QUERY_PARAMS: "Invalid query parameters",
  DATE_RANGE_TOO_LARGE: "Date range cannot exceed 90 days",
};

// Custom exception base class
export class CalendarException extends BadRequestException {
  constructor(
    public readonly code: string,
    message?: string,
  ) {
    super({
      statusCode: HttpStatus.BAD_REQUEST,
      code,
      message: message || CALENDAR_ERROR_MESSAGES[code] || "Unknown error",
    });
  }
}

// 404 Not Found exception
export class CalendarNotFoundException extends NotFoundException {
  constructor(
    public readonly code: string,
    message?: string,
  ) {
    super({
      statusCode: HttpStatus.NOT_FOUND,
      code,
      message: message || CALENDAR_ERROR_MESSAGES[code] || "Resource not found",
    });
  }
}

// 409 Conflict exception
export class CalendarConflictException extends ConflictException {
  constructor(
    public readonly code: string,
    message?: string,
  ) {
    super({
      statusCode: HttpStatus.CONFLICT,
      code,
      message: message || CALENDAR_ERROR_MESSAGES[code] || "Resource conflict",
    });
  }
}
