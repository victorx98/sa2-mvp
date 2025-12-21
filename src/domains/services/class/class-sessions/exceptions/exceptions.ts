import { NotFoundException, BadRequestException } from '@nestjs/common';

/**
 * Domain-specific exceptions for Class Session
 */

export class ClassSessionNotFoundException extends NotFoundException {
  constructor(sessionId: string) {
    super(`Class session not found: ${sessionId}`);
  }
}

export class InvalidSessionStateException extends BadRequestException {
  constructor(message: string) {
    super(message);
  }
}

export class SessionAlreadyCompletedException extends BadRequestException {
  constructor(sessionId: string) {
    super(`Session ${sessionId} is already completed`);
  }
}

export class SessionAlreadyCancelledException extends BadRequestException {
  constructor(sessionId: string) {
    super(`Session ${sessionId} is already cancelled`);
  }
}

export class MentorNotAssignedToClassException extends BadRequestException {
  constructor(mentorId: string, classId: string) {
    super(`Mentor ${mentorId} is not assigned to class ${classId}`);
  }
}

