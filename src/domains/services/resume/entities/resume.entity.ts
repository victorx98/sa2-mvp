import { ResumeStatus, canMarkAsFinal, canMarkAsDeleted } from '../value-objects/resume-status.vo';
import { InvalidResumeStatusException, ResumeAlreadyBilledException } from '../exceptions';

/**
 * Rich Domain Model - Resume Entity
 * 
 * Encapsulates resume business logic and state transitions
 */
export class ResumeEntity {
  private constructor(
    private readonly id: string,
    private readonly studentUserId: string,
    private readonly jobTitle: string,
    private readonly sessionType: string,
    private readonly fileName: string,
    private readonly fileUrl: string,
    private status: ResumeStatus,
    private readonly uploadedBy: string,
    private readonly createdAt: Date,
    private updatedAt: Date,
    private description?: string,
    private finalSetAt?: Date,
    private mentorUserId?: string,
    private billedBy?: string,
    private billedAt?: Date,
  ) {}

  // Factory method
  static create(params: {
    id: string;
    studentUserId: string;
    jobTitle: string;
    sessionType: string;
    fileName: string;
    fileUrl: string;
    status: ResumeStatus;
    uploadedBy: string;
    createdAt: Date;
    updatedAt: Date;
    description?: string;
    finalSetAt?: Date;
    mentorUserId?: string;
    billedBy?: string;
    billedAt?: Date;
  }): ResumeEntity {
    return new ResumeEntity(
      params.id,
      params.studentUserId,
      params.jobTitle,
      params.sessionType,
      params.fileName,
      params.fileUrl,
      params.status,
      params.uploadedBy,
      params.createdAt,
      params.updatedAt,
      params.description,
      params.finalSetAt,
      params.mentorUserId,
      params.billedBy,
      params.billedAt,
    );
  }

  // Getters
  getId(): string {
    return this.id;
  }

  getStudentUserId(): string {
    return this.studentUserId;
  }

  getJobTitle(): string {
    return this.jobTitle;
  }

  getSessionType(): string {
    return this.sessionType;
  }

  getFileName(): string {
    return this.fileName;
  }

  getFileUrl(): string {
    return this.fileUrl;
  }

  getStatus(): ResumeStatus {
    return this.status;
  }

  getUploadedBy(): string {
    return this.uploadedBy;
  }

  getCreatedAt(): Date {
    return this.createdAt;
  }

  getUpdatedAt(): Date {
    return this.updatedAt;
  }

  getDescription(): string | undefined {
    return this.description;
  }

  getFinalSetAt(): Date | undefined {
    return this.finalSetAt;
  }

  getMentorUserId(): string | undefined {
    return this.mentorUserId;
  }

  getBilledBy(): string | undefined {
    return this.billedBy;
  }

  getBilledAt(): Date | undefined {
    return this.billedAt;
  }

  // Business logic - Mark as final version
  markAsFinal(mentorUserId: string): void {
    if (!canMarkAsFinal(this.status)) {
      throw new InvalidResumeStatusException(
        `Cannot mark resume as final from status: ${this.status}`
      );
    }

    this.status = ResumeStatus.FINAL;
    this.finalSetAt = new Date();
    this.mentorUserId = mentorUserId;
    this.updatedAt = new Date();
  }

  // Business logic - Mark as deleted
  markAsDeleted(): void {
    if (!canMarkAsDeleted(this.status)) {
      throw new InvalidResumeStatusException(
        `Cannot delete resume with status: ${this.status}`
      );
    }

    this.status = ResumeStatus.DELETED;
    this.updatedAt = new Date();
  }

  // Business logic - Validate billing eligibility
  validateBilling(): void {
    if (this.billedAt) {
      throw new ResumeAlreadyBilledException(this.id);
    }
  }

  // Business logic - Mark as billed
  markAsBilled(billedBy: string): void {
    this.validateBilling();
    this.billedBy = billedBy;
    this.billedAt = new Date();
    this.updatedAt = new Date();
  }

  // Business logic - Cancel billing
  cancelBilling(): void {
    if (!this.billedAt) {
      throw new InvalidResumeStatusException('Resume has not been billed yet');
    }

    this.billedBy = undefined;
    this.billedAt = undefined;
    this.updatedAt = new Date();
  }
}
