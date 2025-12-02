export class UpdateClassDto {
  name?: string;
  startDate?: Date;
  endDate?: Date;
  description?: string;
  totalSessions?: number;

  constructor(data: Partial<UpdateClassDto>) {
    Object.assign(this, data);
  }

  validate(): void {
    if (this.name !== undefined && (!this.name || this.name.trim().length === 0)) {
      throw new Error('Class name cannot be empty');
    }

    if (this.startDate && this.endDate && this.endDate <= this.startDate) {
      throw new Error('End date must be after start date');
    }

    if (this.totalSessions !== undefined && this.totalSessions <= 0) {
      throw new Error('Total sessions must be greater than 0');
    }
  }
}

