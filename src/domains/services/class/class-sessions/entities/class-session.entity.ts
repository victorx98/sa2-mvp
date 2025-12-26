import { SessionStatus, canTransitionToScheduled, canTransitionToCompleted, canTransitionToCancelled, canUpdate } from '../value-objects/session-status.vo';
import { InvalidSessionStateException, SessionAlreadyCompletedException, SessionAlreadyCancelledException } from '../exceptions/exceptions';

export enum SessionType {
  CLASS_SESSION = 'class_session',
}

/**
 * Rich Domain Model - Class Session Entity
 * Encapsulates business logic and validation rules
 */
export class ClassSessionEntity {
  private id: string;
  private classId: string;
  private meetingId: string;
  private sessionType: SessionType;
  private serviceType?: string;
  private mentorUserId: string;
  private createdByCounselorId?: string;
  private title: string;
  private description?: string;
  private status: SessionStatus;
  private scheduledAt: Date;
  private completedAt?: Date;
  private cancelledAt?: Date;
  private deletedAt?: Date;
  private feishuCalendarEventId?: string;
  private aiSummaries: any[];
  private createdAt: Date;
  private updatedAt: Date;

  constructor(data: {
    id: string;
    classId: string;
    meetingId: string;
    sessionType: SessionType;
    serviceType?: string;
    mentorUserId: string;
    createdByCounselorId?: string;
    title: string;
    description?: string;
    status: SessionStatus;
    scheduledAt: Date;
    completedAt?: Date;
    cancelledAt?: Date;
    deletedAt?: Date;
    feishuCalendarEventId?: string;
    aiSummaries?: any[];
    createdAt: Date;
    updatedAt: Date;
  }) {
    this.id = data.id;
    this.classId = data.classId;
    this.meetingId = data.meetingId;
    this.sessionType = data.sessionType;
    this.serviceType = data.serviceType;
    this.mentorUserId = data.mentorUserId;
    this.createdByCounselorId = data.createdByCounselorId;
    this.title = data.title;
    this.description = data.description;
    this.status = data.status;
    this.scheduledAt = data.scheduledAt;
    this.completedAt = data.completedAt;
    this.cancelledAt = data.cancelledAt;
    this.deletedAt = data.deletedAt;
    this.feishuCalendarEventId = data.feishuCalendarEventId;
    this.aiSummaries = data.aiSummaries || [];
    this.createdAt = data.createdAt;
    this.updatedAt = data.updatedAt;
  }

  // Getters
  getId(): string { return this.id; }
  getClassId(): string { return this.classId; }
  getMeetingId(): string { return this.meetingId; }
  getSessionType(): SessionType { return this.sessionType; }
  getServiceType(): string | undefined { return this.serviceType; }
  getMentorUserId(): string { return this.mentorUserId; }
  getCreatedByCounselorId(): string | undefined { return this.createdByCounselorId; }
  getTitle(): string { return this.title; }
  getDescription(): string | undefined { return this.description; }
  getStatus(): SessionStatus { return this.status; }
  getScheduledAt(): Date { return this.scheduledAt; }
  getCompletedAt(): Date | undefined { return this.completedAt; }
  getCancelledAt(): Date | undefined { return this.cancelledAt; }
  getDeletedAt(): Date | undefined { return this.deletedAt; }
  getAiSummaries(): any[] { return this.aiSummaries; }
  getCreatedAt(): Date { return this.createdAt; }
  getUpdatedAt(): Date { return this.updatedAt; }

  // Business logic methods
  isScheduled(): boolean {
    return this.status === SessionStatus.SCHEDULED;
  }

  isCompleted(): boolean {
    return this.status === SessionStatus.COMPLETED;
  }

  isCancelled(): boolean {
    return this.status === SessionStatus.CANCELLED;
  }

  isDeleted(): boolean {
    return this.status === SessionStatus.DELETED;
  }

  /**
   * Mark session as scheduled (after meeting creation)
   */
  markAsScheduled(meetingId: string): void {
    if (!canTransitionToScheduled(this.status)) {
      throw new InvalidSessionStateException(
        `Cannot transition from ${this.status} to SCHEDULED`
      );
    }
    this.meetingId = meetingId;
    this.status = SessionStatus.SCHEDULED;
    this.updatedAt = new Date();
  }

  /**
   * Complete the session
   */
  complete(): void {
    if (this.status === SessionStatus.COMPLETED) {
      throw new SessionAlreadyCompletedException(this.id);
    }
    if (!canTransitionToCompleted(this.status)) {
      throw new InvalidSessionStateException(
        `Cannot complete session in ${this.status} status`
      );
    }
    this.status = SessionStatus.COMPLETED;
    this.completedAt = new Date();
    this.updatedAt = new Date();
  }

  /**
   * Cancel the session
   */
  cancel(): void {
    if (this.status === SessionStatus.CANCELLED) {
      throw new SessionAlreadyCancelledException(this.id);
    }
    if (!canTransitionToCancelled(this.status)) {
      throw new InvalidSessionStateException(
        `Cannot cancel session in ${this.status} status`
      );
    }
    this.status = SessionStatus.CANCELLED;
    this.cancelledAt = new Date();
    this.updatedAt = new Date();
  }

  /**
   * Mark meeting creation as failed
   */
  markMeetingFailed(): void {
    if (this.status === SessionStatus.MEETING_FAILED) {
      return;
    }
    if (this.status !== SessionStatus.PENDING_MEETING) {
      throw new InvalidSessionStateException(
        `Can only mark PENDING_MEETING sessions as failed`
      );
    }
    this.status = SessionStatus.MEETING_FAILED;
    this.updatedAt = new Date();
  }

  /**
   * Soft delete the session
   */
  softDelete(): void {
    this.status = SessionStatus.DELETED;
    this.deletedAt = new Date();
    this.updatedAt = new Date();
  }

  /**
   * Update session details
   */
  updateDetails(data: {
    title?: string;
    description?: string;
    scheduledAt?: Date;
    mentorUserId?: string;
  }): void {
    if (!canUpdate(this.status)) {
      throw new InvalidSessionStateException(
        `Cannot update session in ${this.status} status`
      );
    }
    if (data.title !== undefined) this.title = data.title;
    if (data.description !== undefined) this.description = data.description;
    if (data.scheduledAt !== undefined) this.scheduledAt = data.scheduledAt;
    if (data.mentorUserId !== undefined) this.mentorUserId = data.mentorUserId;
    this.updatedAt = new Date();
  }

  /**
   * Add AI summary
   */
  addAiSummary(summary: any): void {
    this.aiSummaries.push(summary);
    this.updatedAt = new Date();
  }

  getFeishuCalendarEventId(): string | undefined {
    return this.feishuCalendarEventId;
  }

  setFeishuCalendarEventId(eventId: string): void {
    this.feishuCalendarEventId = eventId;
    this.updatedAt = new Date();
  }
}

// Re-export for backward compatibility
export { SessionStatus as ClassSessionStatus };
