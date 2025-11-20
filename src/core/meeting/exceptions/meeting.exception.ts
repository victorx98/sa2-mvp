import { HttpException, HttpStatus } from "@nestjs/common";

/**
 * Base exception for Meeting Provider errors
 */
export class MeetingProviderException extends HttpException {
  constructor(message: string, status: HttpStatus = HttpStatus.BAD_REQUEST) {
    super(message, status);
  }
}

/**
 * Exception thrown when meeting creation fails
 */
export class MeetingCreationFailedException extends MeetingProviderException {
  constructor(provider: string, reason: string) {
    super(
      `Failed to create meeting on ${provider}: ${reason}`,
      HttpStatus.BAD_REQUEST,
    );
  }
}

/**
 * Exception thrown when meeting update fails
 */
export class MeetingUpdateFailedException extends MeetingProviderException {
  constructor(provider: string, meetingId: string, reason: string) {
    super(
      `Failed to update meeting ${meetingId} on ${provider}: ${reason}`,
      HttpStatus.BAD_REQUEST,
    );
  }
}

/**
 * Exception thrown when meeting cancellation fails
 */
export class MeetingCancellationFailedException extends MeetingProviderException {
  constructor(provider: string, meetingId: string, reason: string) {
    super(
      `Failed to cancel meeting ${meetingId} on ${provider}: ${reason}`,
      HttpStatus.BAD_REQUEST,
    );
  }
}

/**
 * Exception thrown when meeting not found
 */
export class MeetingNotFoundException extends MeetingProviderException {
  constructor(provider: string, meetingId: string) {
    super(
      `Meeting ${meetingId} not found on ${provider}`,
      HttpStatus.NOT_FOUND,
    );
  }
}

/**
 * Exception thrown when authentication fails
 */
export class MeetingProviderAuthenticationException extends MeetingProviderException {
  constructor(provider: string, reason: string) {
    super(
      `Authentication failed for ${provider}: ${reason}`,
      HttpStatus.UNAUTHORIZED,
    );
  }
}

/**
 * Exception thrown when API call fails
 */
export class MeetingProviderAPIException extends MeetingProviderException {
  constructor(
    provider: string,
    endpoint: string,
    statusCode: number,
    message: string,
  ) {
    super(
      `API call to ${provider} ${endpoint} failed with status ${statusCode}: ${message}`,
      HttpStatus.BAD_GATEWAY,
    );
  }
}

/**
 * Exception thrown when duplicate meeting is detected
 */
export class DuplicateMeetingException extends MeetingProviderException {
  constructor(meetingNo: string, timeWindow: string) {
    super(
      `Meeting ${meetingNo} already exists within time window ${timeWindow}`,
      HttpStatus.CONFLICT,
    );
  }
}

/**
 * Exception thrown when meeting is in invalid state for operation
 */
export class InvalidMeetingStateException extends MeetingProviderException {
  constructor(meetingId: string, currentState: string, operation: string) {
    super(
      `Cannot ${operation} meeting ${meetingId} in state ${currentState}`,
      HttpStatus.BAD_REQUEST,
    );
  }
}

