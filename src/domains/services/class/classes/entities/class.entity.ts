export enum ClassType {
  SESSION = 'session',
  ENROLL = 'enroll',
}

export enum ClassStatus {
  ACTIVE = 'Active',
  INACTIVE = 'Inactive',
}

export class ClassEntity {
  id: string;
  name: string;
  type: ClassType;
  status: ClassStatus;
  startDate: Date;
  endDate: Date;
  description?: string;
  totalSessions: number;
  createdAt: Date;
  updatedAt: Date;

  constructor(data: Partial<ClassEntity>) {
    Object.assign(this, data);
  }

  isActive(): boolean {
    return this.status === ClassStatus.ACTIVE;
  }

  isSession(): boolean {
    return this.type === ClassType.SESSION;
  }

  isEnroll(): boolean {
    return this.type === ClassType.ENROLL;
  }

  activate(): void {
    this.status = ClassStatus.ACTIVE;
    this.updatedAt = new Date();
  }

  deactivate(): void {
    this.status = ClassStatus.INACTIVE;
    this.updatedAt = new Date();
  }
}

