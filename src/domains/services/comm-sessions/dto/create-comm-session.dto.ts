import { CommSessionType } from '../entities/comm-session.entity';

/**
 * Create Comm Session DTO
 *
 * Passed from Application layer to Domain layer
 */
export class CreateCommSessionDto {
  meetingId: string;
  sessionType: CommSessionType;
  studentUserId: string;
  mentorUserId?: string;
  counselorUserId?: string;
  createdByCounselorId: string;
  title: string;
  description?: string;
  scheduledAt: Date;

  constructor(data: CreateCommSessionDto) {
    Object.assign(this, data);
  }

  validate(): void {
    if (!this.meetingId) {
      throw new Error('Meeting ID is required');
    }

    if (this.sessionType !== CommSessionType.COMM_SESSION) {
      throw new Error(`Invalid session type: ${this.sessionType}`);
    }

    if (!this.studentUserId) {
      throw new Error('Student ID is required');
    }

    if (!this.createdByCounselorId) {
      throw new Error('Created by Counselor ID is required');
    }

    if (!this.title || this.title.trim().length === 0) {
      throw new Error('Title is required');
    }

    if (!this.scheduledAt) {
      throw new Error('Scheduled at is required');
    }

    // Ensure either mentorUserId or counselorUserId is provided
    if (!this.mentorUserId && !this.counselorUserId) {
      throw new Error('Either mentorUserId or counselorUserId must be provided');
    }
  }
}

