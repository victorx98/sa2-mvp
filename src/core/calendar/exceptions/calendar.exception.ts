import {
  BadRequestException,
  NotFoundException,
  HttpStatus,
} from "@nestjs/common";

/**
 * Custom exception for calendar-related validation and business logic errors
 */
export class CalendarException extends BadRequestException {
  /**
   * Throw a calendar validation/business logic error (HTTP 400)
   *
   * @param message - Error message
   */
  constructor(message: string) {
    super({
      statusCode: HttpStatus.BAD_REQUEST,
      message,
    });
  }
}

/**
 * Custom exception for calendar resource not found errors
 */
export class CalendarNotFoundException extends NotFoundException {
  /**
   * Throw a calendar not found error (HTTP 404)
   *
   * @param message - Error message
   */
  constructor(message: string) {
    super({
      statusCode: HttpStatus.NOT_FOUND,
      message,
    });
  }
}
