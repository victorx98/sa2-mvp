import { SessionType } from '../entities/class-session.entity';

export class CreateClassSessionDto {
  classId: string;
  meetingId: string;
  sessionType: SessionType;
  mentorUserId: string;
  title: string;
  description?: string;
  scheduledAt: Date;

  constructor(data: CreateClassSessionDto) {
    Object.assign(this, data);
  }

  validate(): void {
    if (!this.classId) {
      throw new Error('Class ID is required');
    }

    if (!this.meetingId) {
      throw new Error('Meeting ID is required');
    }

    if (this.sessionType !== SessionType.CLASS_SESSION) {
      throw new Error(`Invalid session type: ${this.sessionType}`);
    }

    if (!this.mentorUserId) {
      throw new Error('Mentor ID is required');
    }

    if (!this.title || this.title.trim().length === 0) {
      throw new Error('Title is required');
    }

    if (!this.scheduledAt) {
      throw new Error('Scheduled at is required');
    }
  }
}

