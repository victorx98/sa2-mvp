/**
 * Comm Session Entity
 *
 * Represents internal communication session between student and mentor/counselor
 * Features:
 * - Not counted for billing (no service registration)
 * - No completion event publication
 * - Simplified workflow
 */
export enum CommSessionStatus {
  PENDING_MEETING = 'pending_meeting',
  SCHEDULED = 'scheduled',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
  DELETED = 'deleted',
  MEETING_FAILED = 'meeting_failed',
}

export enum CommSessionType {
  COMM_SESSION = 'comm_session',
}

export class CommSessionEntity {
  id: string;
  meetingId: string | null; // Nullable for async meeting creation
  sessionType: CommSessionType;
  studentUserId: string;
  mentorUserId?: string;
  counselorUserId?: string;
  createdByCounselorId: string;
  title: string;
  description?: string;
  status: CommSessionStatus;
  scheduledAt: Date;
  completedAt?: Date;
  cancelledAt?: Date;
  deletedAt?: Date;
  aiSummaries?: Record<string, any>[];
  createdAt: Date;
  updatedAt: Date;

  constructor(data: Partial<CommSessionEntity>) {
    Object.assign(this, data);
  }

  isScheduled(): boolean {
    return this.status === CommSessionStatus.SCHEDULED;
  }

  isCompleted(): boolean {
    return this.status === CommSessionStatus.COMPLETED;
  }

  isCancelled(): boolean {
    return this.status === CommSessionStatus.CANCELLED;
  }

  isDeleted(): boolean {
    return this.status === CommSessionStatus.DELETED;
  }

  complete(): void {
    this.status = CommSessionStatus.COMPLETED;
    this.completedAt = new Date();
    this.updatedAt = new Date();
  }

  cancel(): void {
    this.status = CommSessionStatus.CANCELLED;
    this.cancelledAt = new Date();
    this.updatedAt = new Date();
  }

  softDelete(): void {
    this.status = CommSessionStatus.DELETED;
    this.deletedAt = new Date();
    this.updatedAt = new Date();
  }
}

