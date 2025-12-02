import { ClassType } from '../entities/class.entity';

export interface MentorPriceInput {
  mentorUserId: string;
  pricePerSession: number;
}

export class CreateClassDto {
  name: string;
  type: ClassType;
  startDate: Date;
  endDate: Date;
  description?: string;
  totalSessions: number;
  mentors: MentorPriceInput[];
  students: string[];
  counselors: string[];

  constructor(data: CreateClassDto) {
    Object.assign(this, data);
  }

  validate(): void {
    if (!this.name || this.name.trim().length === 0) {
      throw new Error('Class name is required');
    }

    if (!Object.values(ClassType).includes(this.type)) {
      throw new Error(`Invalid class type: ${this.type}`);
    }

    if (!this.startDate || !this.endDate) {
      throw new Error('Start date and end date are required');
    }

    if (this.endDate <= this.startDate) {
      throw new Error('End date must be after start date');
    }

    if (this.totalSessions <= 0) {
      throw new Error('Total sessions must be greater than 0');
    }

    if (!Array.isArray(this.mentors) || this.mentors.length === 0) {
      throw new Error('At least one mentor is required');
    }

    if (!Array.isArray(this.students) || this.students.length === 0) {
      throw new Error('At least one student is required');
    }

    if (!Array.isArray(this.counselors) || this.counselors.length === 0) {
      throw new Error('At least one counselor is required');
    }

    // Validate mentors
    for (const mentor of this.mentors) {
      if (!mentor.mentorUserId) {
        throw new Error('Mentor ID is required');
      }
      if (mentor.pricePerSession < 0) {
        throw new Error('Price per session must be non-negative');
      }
    }
  }
}

