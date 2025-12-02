/**
 * Update Comm Session DTO
 *
 * Supports updating: title, description, scheduledAt
 */
export class UpdateCommSessionDto {
  title?: string;
  description?: string;
  scheduledAt?: Date;

  constructor(data: Partial<UpdateCommSessionDto>) {
    Object.assign(this, data);
  }

  validate(): void {
    if (this.title !== undefined && (!this.title || this.title.trim().length === 0)) {
      throw new Error('Title cannot be empty if provided');
    }

    if (this.scheduledAt !== undefined && !(this.scheduledAt instanceof Date)) {
      throw new Error('Scheduled at must be a valid Date');
    }
  }
}

