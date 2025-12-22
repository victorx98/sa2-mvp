/**
 * JobApplication Entity (投递申请实体)
 * Represents a job application with all its attributes (表示包含所有属性的投递申请)
 */

import { v4 as uuidv4 } from 'uuid';
import { ApplicationStatus } from '../value-objects/application-status.vo';
import { ApplicationTypeVO } from '../value-objects/application-type.vo';
import { DomainException } from '@core/exceptions/domain.exception';

// JobApplication properties interface (JobApplication属性接口)
interface JobApplicationProps {
  id: string;
  studentId: string;
  jobId: string;
  applicationType: ApplicationTypeVO;
  coverLetter?: string;
  status: ApplicationStatus;
  assignedMentorId?: string;
  recommendedBy?: string;
  recommendedAt?: Date;
  submittedAt: Date;
  updatedAt: Date;
  notes?: string;
  // Manual creation fields (手工创建字段)
  jobType?: string;
  jobTitle?: string;
  jobLink?: string;
  companyName?: string;
  location?: string;
  jobCategories?: string[];
  normalJobTitle?: string;
  level?: string;
}

export class JobApplication {
  private constructor(private readonly props: JobApplicationProps) {}

  /**
   * Create a new job application (创建新的投递申请)
   *
   * @param studentId - Student ID (学生ID)
   * @param jobId - Job position ID (岗位ID)
   * @param applicationType - Application type (申请类型)
   * @param options - Optional parameters (可选参数)
   * @returns JobApplication instance (JobApplication实例)
   * @throws InvalidApplicationException if validation fails (验证失败时抛出InvalidApplicationException)
   */
  static create(
    studentId: string,
    jobId: string,
    applicationType: string,
    options?: {
      coverLetter?: string;
      assignedMentorId?: string;
      recommendedBy?: string;
      recommendedAt?: Date;
      notes?: string;
      // Manual creation fields
      jobType?: string;
      jobTitle?: string;
      jobLink?: string;
      companyName?: string;
      location?: string;
      jobCategories?: string[];
      normalJobTitle?: string;
      level?: string;
    },
  ): JobApplication {
    if (!studentId || studentId.trim().length === 0) {
      throw new InvalidStudentIdException(studentId);
    }

    if (!jobId || jobId.trim().length === 0) {
      throw new InvalidJobIdException(jobId);
    }

    const now = new Date();

    // Validate cover letter length if provided (如果提供了求职信，则验证长度)
    if (options?.coverLetter && options.coverLetter.length > 10000) {
      throw new InvalidCoverLetterException('Cover letter must not exceed 10000 characters');
    }

    // Validate job link if provided (如果提供了职位链接，则验证)
    if (options?.jobLink && !JobApplication.isValidUrl(options.jobLink)) {
      throw new InvalidJobLinkException(options.jobLink);
    }

    // For referral applications, assigned mentor is required (对于内推申请，需要分配导师)
    if (applicationType === ApplicationTypeVO.REFERRAL.getValue() && !options?.assignedMentorId) {
      throw new ReferralApplicationRequiresMentorException();
    }

    // For recommended applications, recommender info is required (对于推荐的申请，需要推荐人信息)
    if (options?.recommendedBy && !options?.recommendedAt) {
      throw new InvalidRecommendationException('recommendedAt is required when recommendedBy is provided');
    }

    return new JobApplication({
      id: uuidv4(),
      studentId,
      jobId,
      applicationType: ApplicationTypeVO.fromString(applicationType),
      coverLetter: options?.coverLetter,
      status: ApplicationStatus.SUBMITTED,
      assignedMentorId: options?.assignedMentorId,
      recommendedBy: options?.recommendedBy,
      recommendedAt: options?.recommendedAt,
      submittedAt: now,
      updatedAt: now,
      notes: options?.notes,
      // Manual creation fields
      jobType: options?.jobType,
      jobTitle: options?.jobTitle,
      jobLink: options?.jobLink,
      companyName: options?.companyName,
      location: options?.location,
      jobCategories: options?.jobCategories,
      normalJobTitle: options?.normalJobTitle,
      level: options?.level,
    });
  }

  /**
   * Reconstruct a JobApplication from persistence data (从持久化数据重建JobApplication)
   *
   * @param props - JobApplication properties (JobApplication属性)
   * @returns JobApplication instance (JobApplication实例)
   * @internal For use by mappers only (仅供Mapper使用)
   */
  static reconstruct(props: JobApplicationProps): JobApplication {
    return new JobApplication({
      ...props,
      applicationType: props.applicationType instanceof ApplicationTypeVO
        ? props.applicationType
        : ApplicationTypeVO.reconstruct(props.applicationType as any),
      status: props.status instanceof ApplicationStatus
        ? props.status
        : ApplicationStatus.reconstruct(props.status as any),
    });
  }

  /**
   * Update application status (更新申请状态)
   *
   * @param newStatus - New status (新状态)
   * @param updatedBy - User ID who updated the status (更新状态的用户ID)
   * @param reason - Reason for status change (状态变更原因)
   * @throws InvalidStatusTransitionException if transition is invalid (转换无效时抛出InvalidStatusTransitionException)
   */
  updateStatus(newStatus: string, updatedBy: string, reason?: string): void {
    const statusVO = ApplicationStatus.fromString(newStatus);

    if (!this.props.status.canTransitionTo(newStatus)) {
      throw new InvalidStatusTransitionException(
        this.props.status.getValue(),
        newStatus,
        `Cannot transition from ${this.props.status.getValue()} to ${newStatus}`,
      );
    }

    (this.props as any).status = statusVO;
    (this.props as any).updatedAt = new Date();
  }

  /**
   * Assign a mentor to the application (为申请分配导师)
   * Only applicable for referral applications (仅适用于内推申请)
   *
   * @param mentorId - Mentor ID (导师ID)
   * @param assignedBy - User ID who assigned the mentor (分配导师的用户ID)
   * @throws NotAReferralApplicationException if this is not a referral application (不是内推申请时抛出NotAReferralApplicationException)
   */
  assignMentor(mentorId: string, assignedBy: string): void {
    if (!this.props.applicationType.isReferral()) {
      throw new NotAReferralApplicationException(this.props.id);
    }

    if (!mentorId || mentorId.trim().length === 0) {
      throw new InvalidMentorIdException(mentorId);
    }

    (this.props as any).assignedMentorId = mentorId;
    (this.props as any).updatedAt = new Date();
  }

  /**
   * Add notes to the application (添加备注到申请)
   *
   * @param notes - Notes to add (要添加的备注)
   * @param addedBy - User ID who added the notes (添加备注的用户ID)
   */
  addNotes(notes: string, addedBy: string): void {
    if (!notes || notes.trim().length === 0) {
      throw new InvalidNotesException('Notes cannot be empty');
    }

    (this.props as any).notes = notes;
    (this.props as any).updatedAt = new Date();
  }

  /**
   * Mark the application as recommended by a counselor or mentor (标记申请为由顾问或导师推荐)
   *
   * @param recommendedBy - Recommender user ID (推荐人ID)
   * @param recommendedAt - Recommendation timestamp (推荐时间)
   * @throws ApplicationAlreadyCreatedException if application was already submitted (申请已提交时抛出ApplicationAlreadyCreatedException)
   */
  markAsRecommended(recommendedBy: string, recommendedAt: Date): void {
    if (this.props.status.getValue() !== 'submitted') {
      throw new ApplicationAlreadyCreatedException(
        this.props.id,
        `Cannot mark as recommended, application is in ${this.props.status.getValue()} status`,
      );
    }

    if (!recommendedBy || recommendedBy.trim().length === 0) {
      throw new InvalidRecommenderIdException(recommendedBy);
    }

    (this.props as any).recommendedBy = recommendedBy;
    (this.props as any).recommendedAt = recommendedAt;
    (this.props as any).updatedAt = new Date();
  }

  /**
   * Check if application requires mentor assignment (检查申请是否需要分配导师)
   *
   * @returns true if requires mentor (需要导师时返回true)
   */
  requiresMentorAssignment(): boolean {
    return this.props.applicationType.requiresMentor();
  }

  /**
   * Check if application requires service entitlement validation (检查申请是否需要验证服务权益)
   *
   * @returns true if requires validation (需要验证时返回true)
   */
  requiresServiceEntitlementValidation(): boolean {
    return this.props.applicationType.requiresServiceEntitlement();
  }

  /**
   * Validate URL format (验证URL格式)
   *
   * @param url - URL to validate (要验证的URL)
   * @returns true if valid (有效时返回true)
   */
  private static isValidUrl(url: string): boolean {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  }

  // Getters
  getId(): string {
    return this.props.id;
  }

  getStudentId(): string {
    return this.props.studentId;
  }

  getJobId(): string {
    return this.props.jobId;
  }

  getApplicationType(): ApplicationTypeVO {
    return this.props.applicationType;
  }

  getCoverLetter(): string | undefined {
    return this.props.coverLetter;
  }

  getStatus(): ApplicationStatus {
    return this.props.status;
  }

  getAssignedMentorId(): string | undefined {
    return this.props.assignedMentorId;
  }

  getRecommendedBy(): string | undefined {
    return this.props.recommendedBy;
  }

  getRecommendedAt(): Date | undefined {
    return this.props.recommendedAt;
  }

  getSubmittedAt(): Date {
    return this.props.submittedAt;
  }

  getUpdatedAt(): Date {
    return this.props.updatedAt;
  }

  getNotes(): string | undefined {
    return this.props.notes;
  }

  // Manual creation fields getters (手工创建字段getter)
  getJobType(): string | undefined {
    return this.props.jobType;
  }

  getJobTitle(): string | undefined {
    return this.props.jobTitle;
  }

  getJobLink(): string | undefined {
    return this.props.jobLink;
  }

  getCompanyName(): string | undefined {
    return this.props.companyName;
  }

  getLocation(): string | undefined {
    return this.props.location;
  }

  getJobCategories(): string[] | undefined {
    return this.props.jobCategories ? [...this.props.jobCategories] : undefined;
  }

  getNormalJobTitle(): string | undefined {
    return this.props.normalJobTitle;
  }

  getLevel(): string | undefined {
    return this.props.level;
  }

  /**
   * Check if this is a referral application (检查这是否为内推申请)
   *
   * @returns true if referral (是内推时返回true)
   */
  isReferral(): boolean {
    return this.props.applicationType.isReferral();
  }

  /**
   * Check if this application has been submitted (检查申请是否已提交)
   *
   * @returns true if submitted (已提交时返回true)
   */
  isSubmitted(): boolean {
    return this.props.status.isSubmitted();
  }

  /**
   * Check if this application has been recommended (检查申请是否已推荐)
   *
   * @returns true if recommended (已推荐时返回true)
   */
  isRecommended(): boolean {
    return this.props.status.isRecommended();
  }

  /**
   * Check if this application has received an offer (检查申请是否已收到Offer)
   *
   * @returns true if got offer (收到Offer时返回true)
   */
  hasReceivedOffer(): boolean {
    return this.props.status.isGotOffer();
  }

  /**
   * Check if this application has been rejected (检查申请是否被拒绝)
   *
   * @returns true if rejected (被拒绝时返回true)
   */
  isRejected(): boolean {
    return this.props.status.isRejected();
  }
}

/**
 * InvalidStudentIdException (无效学生ID异常)
 */
export class InvalidStudentIdException extends DomainException {
  constructor(studentId: string) {
    super(
      'INVALID_STUDENT_ID',
      `Invalid student ID: ${studentId}`,
      { studentId },
    );
  }
}

/**
 * InvalidJobIdException (无效岗位ID异常)
 */
export class InvalidJobIdException extends DomainException {
  constructor(jobId: string, message?: string) {
    super(
      'INVALID_JOB_ID',
      message || `Invalid job ID: ${jobId}`,
      { jobId },
    );
  }
}

/**
 * InvalidCoverLetterException (无效求职信异常)
 */
export class InvalidCoverLetterException extends DomainException {
  constructor(message: string) {
    super(
      'INVALID_COVER_LETTER',
      message,
      { message },
    );
  }
}

/**
 * InvalidJobLinkException (无效职位链接异常)
 */
export class InvalidJobLinkException extends DomainException {
  constructor(jobLink: string) {
    super(
      'INVALID_JOB_LINK',
      `Invalid job link: ${jobLink}`,
      { jobLink },
    );
  }
}

/**
 * InvalidRecommendationException (无效推荐异常)
 */
export class InvalidRecommendationException extends DomainException {
  constructor(message: string) {
    super(
      'INVALID_RECOMMENDATION',
      message,
      { message },
    );
  }
}

/**
 * ReferralApplicationRequiresMentorException (内推申请需要导师异常)
 */
export class ReferralApplicationRequiresMentorException extends DomainException {
  constructor() {
    super(
      'REFERRAL_REQUIRES_MENTOR',
      'Referral applications require an assigned mentor',
      {},
    );
  }
}

/**
 * NotAReferralApplicationException (不是内推申请异常)
 */
export class NotAReferralApplicationException extends DomainException {
  constructor(applicationId: string) {
    super(
      'NOT_A_REFERRAL_APPLICATION',
      `Application ${applicationId} is not a referral application`,
      { applicationId },
    );
  }
}

/**
 * InvalidMentorIdException (无效导师ID异常)
 */
export class InvalidMentorIdException extends DomainException {
  constructor(mentorId: string) {
    super(
      'INVALID_MENTOR_ID',
      `Invalid mentor ID: ${mentorId}`,
      { mentorId },
    );
  }
}

/**
 * InvalidRecommenderIdException (无效推荐人ID异常)
 */
export class InvalidRecommenderIdException extends DomainException {
  constructor(recommenderId: string) {
    super(
      'INVALID_RECOMMENDER_ID',
      `Invalid recommender ID: ${recommenderId}`,
      { recommenderId },
    );
  }
}

/**
 * InvalidNotesException (无效备注异常)
 */
export class InvalidNotesException extends DomainException {
  constructor(message: string) {
    super(
      'INVALID_NOTES',
      message,
      { message },
    );
  }
}

/**
 * ApplicationAlreadyCreatedException (申请已创建异常)
 */
export class ApplicationAlreadyCreatedException extends DomainException {
  constructor(applicationId: string, message?: string) {
    super(
      'APPLICATION_ALREADY_CREATED',
      message || `Application ${applicationId} has already been created`,
      { applicationId },
    );
  }
}

/**
 * InvalidStatusTransitionException (无效状态转换异常)
 */
export class InvalidStatusTransitionException extends DomainException {
  constructor(from: string, to: string, message: string) {
    super(
      'INVALID_STATUS_TRANSITION',
      message,
      { from, to, message },
    );
  }
}
