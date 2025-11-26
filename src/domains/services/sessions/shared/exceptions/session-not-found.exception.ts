import { NotFoundException } from '@nestjs/common';

/**
 * Exception thrown when a session is not found
 */
export class SessionNotFoundException extends NotFoundException {
  constructor(sessionId: string) {
    super(`Session with ID ${sessionId} not found`);
  }
}

/**
 * Exception thrown when a session type is not found
 */
export class SessionTypeNotFoundException extends NotFoundException {
  constructor(sessionTypeId: string) {
    super(`Session type with ID ${sessionTypeId} not found`);
  }
}

