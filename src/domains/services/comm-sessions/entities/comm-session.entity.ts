import { SessionStatus, canBeCancelled, canTransitionTo } from '../value-objects/session-status.vo';
import { InvalidStatusTransitionException } from '../exceptions/exceptions';

/**
 * Comm Session Entity (Rich Domain Model)
 * 
 * Represents internal communication session between student and mentor/counselor
 * Features:
 * - Not counted for billing (no service registration)
 * - No completion event publication
 * - Simplified workflow
 * 
 * Responsibilities:
 * 1. Encapsulate core business state
 * 2. Provide business behavior methods
 * 3. Maintain business invariants
 * 4. Manage state transitions
 */
export class CommSession {
  private constructor(
    private readonly id: string,
    private meetingId: string | null,
    private readonly sessionType: string,
    private readonly studentUserId: string,
    private readonly mentorUserId: string | null,
    private readonly counselorUserId: string | null,
    private readonly createdByCounselorId: string,
    private title: string,
    private description: string | null,
    private status: SessionStatus,
    private scheduledAt: Date,
    private completedAt: Date | null,
    private cancelledAt: Date | null,
    private deletedAt: Date | null,
    private feishuCalendarEventId: string | null,
    private readonly aiSummaries: any[],
    private readonly createdAt: Date,
    private updatedAt: Date,
  ) {}

  // ============================================
  // Factory Methods
  // ============================================

  /**
   * Create new session (factory method)
   */
  static create(props: {
    id: string;
    sessionType: string;
    studentUserId: string;
    mentorUserId?: string;
    counselorUserId?: string;
    createdByCounselorId: string;
    title: string;
    description?: string;
    scheduledAt: Date;
  }): CommSession {
    const now = new Date();
    
    return new CommSession(
      props.id,
      null, // meetingId filled asynchronously
      props.sessionType,
      props.studentUserId,
      props.mentorUserId || null,
      props.counselorUserId || null,
      props.createdByCounselorId,
      props.title,
      props.description || null,
      SessionStatus.PENDING_MEETING, // initial status
      props.scheduledAt,
      null, // completedAt
      null, // cancelledAt
      null, // deletedAt
      null, // feishuCalendarEventId
      [], // aiSummaries
      now, // createdAt
      now, // updatedAt
    );
  }

  /**
   * Reconstitute entity from database (used by Mapper)
   */
  static reconstitute(props: {
    id: string;
    meetingId: string | null;
    sessionType: string;
    studentUserId: string;
    mentorUserId: string | null;
    counselorUserId: string | null;
    createdByCounselorId: string;
    title: string;
    description: string | null;
    status: SessionStatus;
    scheduledAt: Date;
    completedAt: Date | null;
    cancelledAt: Date | null;
    deletedAt: Date | null;
    feishuCalendarEventId: string | null;
    aiSummaries: any[];
    createdAt: Date;
    updatedAt: Date;
  }): CommSession {
    return new CommSession(
      props.id,
      props.meetingId,
      props.sessionType,
      props.studentUserId,
      props.mentorUserId,
      props.counselorUserId,
      props.createdByCounselorId,
      props.title,
      props.description,
      props.status,
      props.scheduledAt,
      props.completedAt,
      props.cancelledAt,
      props.deletedAt,
      props.feishuCalendarEventId,
      props.aiSummaries,
      props.createdAt,
      props.updatedAt,
    );
  }

  // ============================================
  // Business Methods (State Transitions)
  // ============================================

  /**
   * Complete meeting setup (async flow)
   * PENDING_MEETING → SCHEDULED
   */
  scheduleMeeting(meetingId: string): void {
    if (!canTransitionTo(this.status, SessionStatus.SCHEDULED)) {
      throw new InvalidStatusTransitionException(
        this.status,
        SessionStatus.SCHEDULED,
      );
    }
    
    this.meetingId = meetingId;
    this.status = SessionStatus.SCHEDULED;
    this.updatedAt = new Date();
  }

  /**
   * Mark meeting creation as failed
   * PENDING_MEETING → MEETING_FAILED
   */
  markMeetingFailed(): void {
    if (!canTransitionTo(this.status, SessionStatus.MEETING_FAILED)) {
      throw new InvalidStatusTransitionException(
        this.status,
        SessionStatus.MEETING_FAILED,
      );
    }
    
    this.status = SessionStatus.MEETING_FAILED;
    this.updatedAt = new Date();
  }

  /**
   * Complete session
   * SCHEDULED → COMPLETED
   */
  complete(): void {
    if (!canTransitionTo(this.status, SessionStatus.COMPLETED)) {
      throw new InvalidStatusTransitionException(
        this.status,
        SessionStatus.COMPLETED,
      );
    }
    
    this.status = SessionStatus.COMPLETED;
    this.completedAt = new Date();
    this.updatedAt = new Date();
  }

  /**
   * Cancel session
   * SCHEDULED/PENDING_MEETING/MEETING_FAILED → CANCELLED
   */
  cancel(): void {
    if (!canBeCancelled(this.status)) {
      throw new Error(
        `Cannot cancel session with status: ${this.status}`,
      );
    }
    
    this.status = SessionStatus.CANCELLED;
    this.cancelledAt = new Date();
    this.updatedAt = new Date();
  }

  /**
   * Soft delete session
   */
  softDelete(): void {
    this.status = SessionStatus.DELETED;
    this.deletedAt = new Date();
    this.updatedAt = new Date();
  }

  /**
   * Update session information
   */
  updateInfo(props: {
    title?: string;
    description?: string;
    scheduledAt?: Date;
  }): void {
    if (props.title !== undefined) {
      this.title = props.title;
    }
    if (props.description !== undefined) {
      this.description = props.description;
    }
    if (props.scheduledAt !== undefined) {
      this.scheduledAt = props.scheduledAt;
    }
    this.updatedAt = new Date();
  }

  // ============================================
  // Business Rules (Validation)
  // ============================================

  /**
   * Check if can be cancelled
   */
  canBeCancelled(): boolean {
    return canBeCancelled(this.status);
  }

  /**
   * Check if can be updated
   */
  canBeUpdated(): boolean {
    return ![
      SessionStatus.COMPLETED,
      SessionStatus.CANCELLED,
      SessionStatus.DELETED,
    ].includes(this.status);
  }

  // ============================================
  // Getters
  // ============================================

  getId(): string {
    return this.id;
  }

  getMeetingId(): string | null {
    return this.meetingId;
  }

  getSessionType(): string {
    return this.sessionType;
  }

  getStudentUserId(): string {
    return this.studentUserId;
  }

  getMentorUserId(): string | null {
    return this.mentorUserId;
  }

  getCounselorUserId(): string | null {
    return this.counselorUserId;
  }

  getCreatedByCounselorId(): string {
    return this.createdByCounselorId;
  }

  getTitle(): string {
    return this.title;
  }

  getDescription(): string | null {
    return this.description;
  }

  getStatus(): SessionStatus {
    return this.status;
  }

  getScheduledAt(): Date {
    return this.scheduledAt;
  }

  getCompletedAt(): Date | null {
    return this.completedAt;
  }

  getCancelledAt(): Date | null {
    return this.cancelledAt;
  }

  getDeletedAt(): Date | null {
    return this.deletedAt;
  }

  getAiSummaries(): any[] {
    return this.aiSummaries;
  }

  getCreatedAt(): Date {
    return this.createdAt;
  }

  getUpdatedAt(): Date {
    return this.updatedAt;
  }

  getFeishuCalendarEventId(): string | null {
    return this.feishuCalendarEventId;
  }

  setFeishuCalendarEventId(eventId: string): void {
    this.feishuCalendarEventId = eventId;
    this.updatedAt = new Date();
  }
}
