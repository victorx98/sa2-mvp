import { RecommLetterStatus, canMarkAsDeleted } from '../value-objects/recomm-letter-status.vo';
import { InvalidRecommLetterStatusException, RecommLetterAlreadyBilledException } from '../exceptions';

/**
 * Rich Domain Model - Recommendation Letter Entity
 * 
 * Encapsulates recommendation letter business logic and state transitions
 */
export class RecommLetterEntity {
  private constructor(
    private readonly id: string,
    private readonly studentUserId: string,
    private readonly letterTypeId: string,
    private readonly packageTypeId: string | undefined,
    private readonly serviceType: string,
    private readonly fileName: string,
    private readonly fileUrl: string,
    private status: RecommLetterStatus,
    private readonly uploadedBy: string,
    private readonly createdAt: Date,
    private updatedAt: Date,
    private description?: string,
    private mentorUserId?: string,
    private billedBy?: string,
    private billedAt?: Date,
  ) {}

  // Factory method
  static create(params: {
    id: string;
    studentUserId: string;
    letterTypeId: string;
    packageTypeId?: string;
    serviceType: string;
    fileName: string;
    fileUrl: string;
    status: RecommLetterStatus;
    uploadedBy: string;
    createdAt: Date;
    updatedAt: Date;
    description?: string;
    mentorUserId?: string;
    billedBy?: string;
    billedAt?: Date;
  }): RecommLetterEntity {
    return new RecommLetterEntity(
      params.id,
      params.studentUserId,
      params.letterTypeId,
      params.packageTypeId,
      params.serviceType,
      params.fileName,
      params.fileUrl,
      params.status,
      params.uploadedBy,
      params.createdAt,
      params.updatedAt,
      params.description,
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

  getLetterTypeId(): string {
    return this.letterTypeId;
  }

  getPackageTypeId(): string | undefined {
    return this.packageTypeId;
  }

  getServiceType(): string {
    return this.serviceType;
  }

  getFileName(): string {
    return this.fileName;
  }

  getFileUrl(): string {
    return this.fileUrl;
  }

  getStatus(): RecommLetterStatus {
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

  getMentorUserId(): string | undefined {
    return this.mentorUserId;
  }

  getBilledBy(): string | undefined {
    return this.billedBy;
  }

  getBilledAt(): Date | undefined {
    return this.billedAt;
  }

  // Business logic - Mark as deleted (only if not billed)
  markAsDeleted(): void {
    if (this.billedAt) {
      throw new InvalidRecommLetterStatusException(
        'Cannot delete recommendation letter that has been billed'
      );
    }

    if (!canMarkAsDeleted(this.status)) {
      throw new InvalidRecommLetterStatusException(
        `Cannot delete recommendation letter with status: ${this.status}`
      );
    }

    this.status = RecommLetterStatus.DELETED;
    this.updatedAt = new Date();
  }

  // Business logic - Validate billing eligibility
  validateBilling(): void {
    if (this.status !== RecommLetterStatus.UPLOADED) {
      throw new InvalidRecommLetterStatusException(
        `Only uploaded recommendation letters can be billed. Current status: ${this.status}`
      );
    }

    if (this.billedAt) {
      throw new RecommLetterAlreadyBilledException(this.id);
    }
  }

  // Business logic - Mark as billed
  markAsBilled(mentorUserId: string, billedBy: string, description?: string): void {
    this.validateBilling();
    this.mentorUserId = mentorUserId;
    this.billedBy = billedBy;
    this.billedAt = new Date();
    this.description = description;
    this.updatedAt = new Date();
  }

  // Business logic - Cancel billing
  cancelBilling(description?: string): void {
    if (!this.billedAt) {
      throw new InvalidRecommLetterStatusException('This recommendation letter has not been billed and cannot cancel billing');
    }

    this.billedAt = undefined;
    this.mentorUserId = undefined;
    this.billedBy = undefined;
    this.description = description;
    this.updatedAt = new Date();
  }
}

