export enum ClassSessionStatus {
  PENDING_MEETING = 'pending_meeting',
  SCHEDULED = 'scheduled',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
  DELETED = 'deleted',
  MEETING_FAILED = 'meeting_failed',
}

export enum SessionType {
  CLASS_SESSION = 'class_session',
}

export class ClassSessionEntity {
  id: string;
  classId: string;
  meetingId: string;
  sessionType: SessionType;
  serviceType?: string; // Business-level service type
  mentorUserId: string;
  createdByCounselorId?: string; // Counselor who created the session
  title: string;
  description?: string;
  status: ClassSessionStatus;
  scheduledAt: Date;
  completedAt?: Date;
  cancelledAt?: Date;
  deletedAt?: Date;
  aiSummaries?: Record<string, any>[];
  createdAt: Date;
  updatedAt: Date;

  constructor(data: Partial<ClassSessionEntity>) {
    Object.assign(this, data);
  }

  isScheduled(): boolean {
    return this.status === ClassSessionStatus.SCHEDULED;
  }

  isCompleted(): boolean {
    return this.status === ClassSessionStatus.COMPLETED;
  }

  isCancelled(): boolean {
    return this.status === ClassSessionStatus.CANCELLED;
  }

  isDeleted(): boolean {
    return this.status === ClassSessionStatus.DELETED;
  }

  complete(): void {
    this.status = ClassSessionStatus.COMPLETED;
    this.completedAt = new Date();
    this.updatedAt = new Date();
  }

  cancel(): void {
    this.status = ClassSessionStatus.CANCELLED;
    this.cancelledAt = new Date();
    this.updatedAt = new Date();
  }

  softDelete(): void {
    this.status = ClassSessionStatus.DELETED;
    this.deletedAt = new Date();
    this.updatedAt = new Date();
  }
}

