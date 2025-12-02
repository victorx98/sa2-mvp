export class UpdateClassSessionDto {
  title?: string;
  description?: string;
  scheduledAt?: Date;
  mentorUserId?: string;

  constructor(data: Partial<UpdateClassSessionDto>) {
    Object.assign(this, data);
  }

  validate(): void {
    if (this.title !== undefined && (!this.title || this.title.trim().length === 0)) {
      throw new Error('Title cannot be empty');
    }

    if (this.scheduledAt !== undefined && !this.scheduledAt) {
      throw new Error('Invalid scheduled at date');
    }
  }
}

