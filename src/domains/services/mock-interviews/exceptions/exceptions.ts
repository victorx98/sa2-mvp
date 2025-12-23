import { NotFoundException } from '@shared/exceptions';

/**
 * Interview not found exception
 */
export class InterviewNotFoundException extends NotFoundException {
  constructor(interviewId: string) {
    super(`Mock interview with ID ${interviewId} not found`);
    this.name = 'InterviewNotFoundException';
  }
}

/**
 * Invalid status transition exception
 */
export class InvalidStatusTransitionException extends Error {
  constructor(from: string, to: string) {
    super(`Cannot transition from status '${from}' to '${to}'`);
    this.name = 'InvalidStatusTransitionException';
  }
}

