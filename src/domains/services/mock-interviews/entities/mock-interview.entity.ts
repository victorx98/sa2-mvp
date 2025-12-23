import { InterviewStatus, canBeCancelled, canTransitionTo, canBeUpdated } from '../value-objects/interview-status.vo';
import { InvalidStatusTransitionException } from '../exceptions/exceptions';

/**
 * Mock Interview Entity (Rich Domain Model)
 * 
 * AI-powered mock interview session
 * Features:
 * - Student-only (no mentor/counselor participation)
 * - No third-party meeting (WebRTC-based)
 * - Direct 'scheduled' status (no pending_meeting)
 * - Not billable
 * 
 * Responsibilities:
 * 1. Encapsulate business state
 * 2. Provide business behavior methods
 * 3. Maintain business invariants
 * 4. Manage state transitions
 */
export class MockInterview {
  private constructor(
    private readonly id: string,
    private readonly sessionType: string,
    private readonly studentUserId: string,
    private readonly createdByCounselorId: string | null,
    private title: string,
    private status: InterviewStatus,
    private scheduledAt: Date,
    private scheduleDuration: number,
    private completedAt: Date | null,
    private cancelledAt: Date | null,
    private deletedAt: Date | null,
    private interviewType: string | null,
    private language: string | null,
    private companyName: string | null,
    private jobTitle: string | null,
    private jobDescription: string | null,
    private resumeText: string | null,
    private studentInfo: any,
    private interviewQuestions: any[],
    private interviewInstructions: string | null,
    private systemInstruction: string | null,
    private serviceType: string | null,
    private readonly aiSummaries: any[],
    private readonly createdAt: Date,
    private updatedAt: Date,
  ) {}

  // ============================================
  // Factory Methods
  // ============================================

  /**
   * Create new interview (factory method)
   */
  static create(props: {
    id: string;
    sessionType: string;
    studentUserId: string;
    createdByCounselorId?: string;
    title: string;
    scheduledAt: Date;
    scheduleDuration?: number;
    interviewType?: string;
    language?: string;
    companyName?: string;
    jobTitle?: string;
    jobDescription?: string;
    resumeText?: string;
    studentInfo?: any;
    interviewQuestions?: any[];
    interviewInstructions?: string;
    systemInstruction?: string;
    serviceType?: string;
  }): MockInterview {
    const now = new Date();
    
    return new MockInterview(
      props.id,
      props.sessionType,
      props.studentUserId,
      props.createdByCounselorId || null,
      props.title,
      InterviewStatus.SCHEDULED, // initial status
      props.scheduledAt,
      props.scheduleDuration || 60,
      null, // completedAt
      null, // cancelledAt
      null, // deletedAt
      props.interviewType || null,
      props.language || null,
      props.companyName || null,
      props.jobTitle || null,
      props.jobDescription || null,
      props.resumeText || null,
      props.studentInfo || {},
      props.interviewQuestions || [],
      props.interviewInstructions || null,
      props.systemInstruction || null,
      props.serviceType || null,
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
    sessionType: string;
    studentUserId: string;
    createdByCounselorId: string | null;
    title: string;
    status: InterviewStatus;
    scheduledAt: Date;
    scheduleDuration: number;
    completedAt: Date | null;
    cancelledAt: Date | null;
    deletedAt: Date | null;
    interviewType: string | null;
    language: string | null;
    companyName: string | null;
    jobTitle: string | null;
    jobDescription: string | null;
    resumeText: string | null;
    studentInfo: any;
    interviewQuestions: any[];
    interviewInstructions: string | null;
    systemInstruction: string | null;
    serviceType: string | null;
    aiSummaries: any[];
    createdAt: Date;
    updatedAt: Date;
  }): MockInterview {
    return new MockInterview(
      props.id,
      props.sessionType,
      props.studentUserId,
      props.createdByCounselorId,
      props.title,
      props.status,
      props.scheduledAt,
      props.scheduleDuration,
      props.completedAt,
      props.cancelledAt,
      props.deletedAt,
      props.interviewType,
      props.language,
      props.companyName,
      props.jobTitle,
      props.jobDescription,
      props.resumeText,
      props.studentInfo,
      props.interviewQuestions,
      props.interviewInstructions,
      props.systemInstruction,
      props.serviceType,
      props.aiSummaries,
      props.createdAt,
      props.updatedAt,
    );
  }

  // ============================================
  // Business Methods (State Transitions)
  // ============================================

  /**
   * Complete interview
   * SCHEDULED → COMPLETED
   */
  complete(): void {
    if (!canTransitionTo(this.status, InterviewStatus.COMPLETED)) {
      throw new InvalidStatusTransitionException(
        this.status,
        InterviewStatus.COMPLETED,
      );
    }
    
    this.status = InterviewStatus.COMPLETED;
    this.completedAt = new Date();
    this.updatedAt = new Date();
  }

  /**
   * Cancel interview
   * SCHEDULED → CANCELLED
   * Rule: completed interviews cannot be cancelled
   */
  cancel(): void {
    if (!canBeCancelled(this.status)) {
      throw new Error(
        `Cannot cancel interview with status: ${this.status}`,
      );
    }
    
    this.status = InterviewStatus.CANCELLED;
    this.cancelledAt = new Date();
    this.updatedAt = new Date();
  }

  /**
   * Soft delete interview
   */
  softDelete(): void {
    this.status = InterviewStatus.DELETED;
    this.deletedAt = new Date();
    this.updatedAt = new Date();
  }

  /**
   * Update interview information
   */
  updateInfo(props: {
    title?: string;
    scheduledAt?: Date;
    scheduleDuration?: number;
    interviewType?: string;
    language?: string;
    companyName?: string;
    jobTitle?: string;
    jobDescription?: string;
    resumeText?: string;
    interviewInstructions?: string;
    systemInstruction?: string;
  }): void {
    if (props.title !== undefined) {
      this.title = props.title;
    }
    if (props.scheduledAt !== undefined) {
      this.scheduledAt = props.scheduledAt;
    }
    if (props.scheduleDuration !== undefined) {
      this.scheduleDuration = props.scheduleDuration;
    }
    if (props.interviewType !== undefined) {
      this.interviewType = props.interviewType;
    }
    if (props.language !== undefined) {
      this.language = props.language;
    }
    if (props.companyName !== undefined) {
      this.companyName = props.companyName;
    }
    if (props.jobTitle !== undefined) {
      this.jobTitle = props.jobTitle;
    }
    if (props.jobDescription !== undefined) {
      this.jobDescription = props.jobDescription;
    }
    if (props.resumeText !== undefined) {
      this.resumeText = props.resumeText;
    }
    if (props.interviewInstructions !== undefined) {
      this.interviewInstructions = props.interviewInstructions;
    }
    if (props.systemInstruction !== undefined) {
      this.systemInstruction = props.systemInstruction;
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
    return canBeUpdated(this.status);
  }

  // ============================================
  // Getters
  // ============================================

  getId(): string {
    return this.id;
  }

  getSessionType(): string {
    return this.sessionType;
  }

  getStudentUserId(): string {
    return this.studentUserId;
  }

  getCreatedByCounselorId(): string | null {
    return this.createdByCounselorId;
  }

  getTitle(): string {
    return this.title;
  }

  getStatus(): InterviewStatus {
    return this.status;
  }

  getScheduledAt(): Date {
    return this.scheduledAt;
  }

  getScheduleDuration(): number {
    return this.scheduleDuration;
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

  getInterviewType(): string | null {
    return this.interviewType;
  }

  getLanguage(): string | null {
    return this.language;
  }

  getCompanyName(): string | null {
    return this.companyName;
  }

  getJobTitle(): string | null {
    return this.jobTitle;
  }

  getJobDescription(): string | null {
    return this.jobDescription;
  }

  getResumeText(): string | null {
    return this.resumeText;
  }

  getStudentInfo(): any {
    return this.studentInfo;
  }

  getInterviewQuestions(): any[] {
    return this.interviewQuestions;
  }

  getInterviewInstructions(): string | null {
    return this.interviewInstructions;
  }

  getSystemInstruction(): string | null {
    return this.systemInstruction;
  }

  getServiceType(): string | null {
    return this.serviceType;
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
}

