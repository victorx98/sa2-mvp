import { NotFoundException, BadRequestException } from '@nestjs/common';

/**
 * Domain-specific exceptions for Class
 */

export class ClassNotFoundException extends NotFoundException {
  constructor(classId: string) {
    super(`Class not found: ${classId}`);
  }
}

export class InvalidClassStateException extends BadRequestException {
  constructor(message: string) {
    super(message);
  }
}

export class MentorAlreadyAssignedException extends BadRequestException {
  constructor(mentorId: string, classId: string) {
    super(`Mentor ${mentorId} is already assigned to class ${classId}`);
  }
}

export class StudentAlreadyEnrolledException extends BadRequestException {
  constructor(studentId: string, classId: string) {
    super(`Student ${studentId} is already enrolled in class ${classId}`);
  }
}

export class CounselorAlreadyAssignedException extends BadRequestException {
  constructor(counselorId: string, classId: string) {
    super(`Counselor ${counselorId} is already assigned to class ${classId}`);
  }
}

