/**
 * Experience Requirement Interface (经验要求接口)
 * Represents experience requirements for a job position (表示岗位的经验要求)
 */
interface ExperienceRequirement {
  minYears?: number; // Minimum years of experience (最低经验年数)
  maxYears?: number; // Maximum years of experience (最高经验年数)
  requiredSkills?: string[]; // Required skills (所需技能)
  preferredSkills?: string[]; // Preferred skills (优先技能)
}

/**
 * Salary Details Interface (薪资详情接口)
 * Represents salary information for a job position (表示岗位的薪资信息)
 */
interface SalaryDetails {
  minSalary?: number; // Minimum salary (最低薪资)
  maxSalary?: number; // Maximum salary (最高薪资)
  currency?: string; // Currency code (货币代码)
  period?: string; // Salary period (e.g., 'yearly', 'monthly', 'hourly') (薪资周期)
  type?: string; // Salary type (e.g., 'base', 'total') (薪资类型)
}

/**
 * Job Location Interface (工作地点接口)
 * Represents a job location (表示工作地点)
 */
export interface JobLocation {
  city?: string; // City name (城市名称)
  state?: string; // State/province (州/省)
  country?: string; // Country code (国家代码)
  remote?: boolean; // Whether remote work is available (是否支持远程工作)
}

/**
 * AI Analysis Interface (AI分析接口)
 * Represents AI analysis results for a job position (表示岗位的AI分析结果)
 */
interface AIAnalysis {
  jobCategories?: string[]; // Job categories identified by AI (AI识别的职位类别)
  matchScore?: number; // Match score for candidate-job fit (候选人-岗位匹配分数)
  skills?: string[]; // Extracted skills from job description (从岗位描述提取的技能)
  summary?: string; // AI-generated job summary (AI生成的岗位摘要)
}

/**
 * JobPosition Entity (岗位实体)
 * Represents a job position with all its attributes (表示包含所有属性的岗位)
 */

import { v4 as uuidv4 } from 'uuid';
import { JobStatusVO } from '../value-objects/job-status.vo';
import { H1BStatusVO } from '../value-objects/h1b-status.vo';
import { USCitizenshipRequirementVO } from '../value-objects/us-citizenship-requirement.vo';
import { JobLevelVO } from '../value-objects/job-level.vo';
import { DomainException } from '@core/exceptions/domain.exception';

// JobPosition properties interface (JobPosition属性接口)
interface JobPositionProps {
  id: string;
  jobId?: string;
  jobLink?: string;
  objectId?: string;
  normalizedJobTitles: string[];
  jobTypes: string[];
  postDate?: Date;
  applicationDeadline?: Date;
  status: JobStatusVO;
  title: string;
  countryCode?: string;
  experienceRequirement?: ExperienceRequirement;
  salaryDetails?: SalaryDetails;
  jobLocations: JobLocation[];
  jobDescription?: string;
  companyName: string;
  h1bStatus?: H1BStatusVO;
  usCitizenshipRequirement?: USCitizenshipRequirementVO;
  jobLevel?: JobLevelVO;
  aiAnalysis?: AIAnalysis;
  jobApplicationTypes: string[];
  createdAt: Date;
  updatedAt: Date;
}

export class JobPosition {
  private constructor(private readonly props: JobPositionProps) {}

  /**
   * Create a new job position (创建新岗位)
   *
   * @param title - Job title (岗位标题)
   * @param companyName - Company name (公司名称)
   * @param createdBy - Creator user ID (创建人ID)
   * @param options - Optional parameters (可选参数)
   * @returns JobPosition instance (JobPosition实例)
   * @throws InvalidJobTitleException if title is invalid (标题无效时抛出InvalidJobTitleException)
   * @throws InvalidCompanyNameException if company name is invalid (公司名称无效时抛出InvalidCompanyNameException)
   */
  static create(
    title: string,
    companyName: string,
    createdBy: string,
    options?: {
      jobId?: string;
      jobLink?: string;
      objectId?: string;
      normalizedJobTitles?: string[];
      jobTypes?: string[];
      postDate?: Date;
      applicationDeadline?: Date;
      countryCode?: string;
      experienceRequirement?: ExperienceRequirement;
      salaryDetails?: SalaryDetails;
      jobLocations?: JobLocation[];
      jobDescription?: string;
      h1bStatus?: string;
      usCitizenshipRequirement?: string;
      jobLevel?: string;
      aiAnalysis?: AIAnalysis;
      jobApplicationTypes?: string[];
    },
  ): JobPosition {
    if (!title || title.trim().length === 0) {
      throw new InvalidJobTitleException(title);
    }

    if (title.length > 300) {
      throw new InvalidJobTitleException(title, 'Title must not exceed 300 characters');
    }

    if (!companyName || companyName.trim().length === 0) {
      throw new InvalidCompanyNameException(companyName);
    }

    if (companyName.length > 300) {
      throw new InvalidCompanyNameException(companyName, 'Company name must not exceed 300 characters');
    }

    const now = new Date();

    // Validate application deadline if provided (如果提供了申请截止日期，则验证)
    if (options?.applicationDeadline && options.applicationDeadline <= now) {
      throw new InvalidApplicationDeadlineException(
        options.applicationDeadline,
        'Application deadline must be in the future',
      );
    }

    // Validate jobId length if provided (如果提供了jobId，则验证长度)
    if (options?.jobId && options.jobId.length > 100) {
      throw new InvalidJobIdException(options.jobId, 'jobId must not exceed 100 characters');
    }

    // Validate objectId length if provided (如果提供了objectId，则验证长度)
    if (options?.objectId && options.objectId.length > 50) {
      throw new InvalidObjectIdException(options.objectId, 'objectId must not exceed 50 characters');
    }

    // Validate job locations (验证工作地点)
    const jobLocations = options?.jobLocations || [];
    if (jobLocations.length > 0) {
      this.validateJobLocations(jobLocations);
    }

    // Default job application types if not provided (如果未提供，设置默认投递类型)
    const jobApplicationTypes = options?.jobApplicationTypes || ['direct'];

    return new JobPosition({
      id: uuidv4(),
      jobId: options?.jobId,
      jobLink: options?.jobLink,
      objectId: options?.objectId,
      normalizedJobTitles: options?.normalizedJobTitles || [],
      jobTypes: options?.jobTypes || [],
      postDate: options?.postDate || now,
      applicationDeadline: options?.applicationDeadline,
      status: JobStatusVO.ACTIVE,
      title: title.trim(),
      countryCode: options?.countryCode,
      experienceRequirement: options?.experienceRequirement,
      salaryDetails: options?.salaryDetails,
      jobLocations,
      jobDescription: options?.jobDescription,
      companyName: companyName.trim(),
      h1bStatus: options?.h1bStatus ? H1BStatusVO.fromString(options.h1bStatus) : undefined,
      usCitizenshipRequirement: options?.usCitizenshipRequirement
        ? USCitizenshipRequirementVO.fromString(options.usCitizenshipRequirement)
        : undefined,
      jobLevel: options?.jobLevel ? JobLevelVO.fromString(options.jobLevel) : undefined,
      aiAnalysis: options?.aiAnalysis,
      jobApplicationTypes,
      createdAt: now,
      updatedAt: now,
    });
  }

  /**
   * Reconstruct a JobPosition from persistence data (从持久化数据重建JobPosition)
   *
   * @param props - JobPosition properties (JobPosition属性)
   * @returns JobPosition instance (JobPosition实例)
   * @internal For use by mappers only (仅供Mapper使用)
   */
  static reconstruct(props: JobPositionProps): JobPosition {
    return new JobPosition({
      ...props,
      status: props.status instanceof JobStatusVO ? props.status : JobStatusVO.reconstruct(props.status as any),
      h1bStatus: props.h1bStatus
        ? props.h1bStatus instanceof H1BStatusVO
          ? props.h1bStatus
          : H1BStatusVO.reconstruct(props.h1bStatus as any)
        : undefined,
      usCitizenshipRequirement: props.usCitizenshipRequirement
        ? props.usCitizenshipRequirement instanceof USCitizenshipRequirementVO
          ? props.usCitizenshipRequirement
          : USCitizenshipRequirementVO.reconstruct(props.usCitizenshipRequirement as any)
        : undefined,
      jobLevel: props.jobLevel
        ? props.jobLevel instanceof JobLevelVO
          ? props.jobLevel
          : JobLevelVO.reconstruct(props.jobLevel as any)
        : undefined,
    });
  }

  /**
   * Update job position details (更新岗位详情)
   * Only allowed for ACTIVE and INACTIVE jobs (仅允许更新ACTIVE和INACTIVE状态的岗位)
   *
   * @param updatedBy - User ID who updated the position (更新岗位的用户ID)
   * @param updates - Fields to update (要更新的字段)
   * @throws JobPositionNotEditableException if job is in EXPIRED status (岗位处于EXPIRED状态时抛出JobPositionNotEditableException)
   */
  update(
    updatedBy: string,
    updates: {
      title?: string;
      companyName?: string;
      jobDescription?: string;
      applicationDeadline?: Date;
      countryCode?: string;
      normalizedJobTitles?: string[];
      jobTypes?: string[];
      experienceRequirement?: ExperienceRequirement;
      salaryDetails?: SalaryDetails;
      jobLocations?: JobLocation[];
      h1bStatus?: string;
      usCitizenshipRequirement?: string;
      jobLevel?: string;
      jobApplicationTypes?: string[];
    },
  ): void {
    if (this.props.status.isExpired()) {
      throw new JobPositionNotEditableException(this.props.id, this.props.status.getValue());
    }

    // Validate title if updating (如果更新标题，则验证)
    if (updates.title !== undefined) {
      if (!updates.title || updates.title.trim().length === 0) {
        throw new InvalidJobTitleException(updates.title);
      }
      if (updates.title.length > 300) {
        throw new InvalidJobTitleException(updates.title, 'Title must not exceed 300 characters');
      }
      (this.props as any).title = updates.title.trim();
    }

    // Validate company name if updating (如果更新公司名称，则验证)
    if (updates.companyName !== undefined) {
      if (!updates.companyName || updates.companyName.trim().length === 0) {
        throw new InvalidCompanyNameException(updates.companyName);
      }
      if (updates.companyName.length > 300) {
        throw new InvalidCompanyNameException(updates.companyName, 'Company name must not exceed 300 characters');
      }
      (this.props as any).companyName = updates.companyName.trim();
    }

    // Validate application deadline if updating (如果更新申请截止日期，则验证)
    if (updates.applicationDeadline !== undefined) {
      const now = new Date();
      if (updates.applicationDeadline && updates.applicationDeadline <= now) {
        throw new InvalidApplicationDeadlineException(
          updates.applicationDeadline,
          'Application deadline must be in the future',
        );
      }
      (this.props as any).applicationDeadline = updates.applicationDeadline;
    }

    // Validate job locations if updating (如果更新工作地点，则验证)
    if (updates.jobLocations !== undefined) {
      JobPosition.validateJobLocations(updates.jobLocations);
      (this.props as any).jobLocations = updates.jobLocations;
    }

    // Update H1B status if provided (如果提供了H1B状态，则更新)
    if (updates.h1bStatus !== undefined) {
      (this.props as any).h1bStatus = updates.h1bStatus
        ? H1BStatusVO.fromString(updates.h1bStatus)
        : undefined;
    }

    // Update US citizenship requirement if provided (如果提供了美国公民身份要求，则更新)
    if (updates.usCitizenshipRequirement !== undefined) {
      (this.props as any).usCitizenshipRequirement = updates.usCitizenshipRequirement
        ? USCitizenshipRequirementVO.fromString(updates.usCitizenshipRequirement)
        : undefined;
    }

    // Update job level if provided (如果提供了岗位级别，则更新)
    if (updates.jobLevel !== undefined) {
      (this.props as any).jobLevel = updates.jobLevel
        ? JobLevelVO.fromString(updates.jobLevel)
        : undefined;
    }

    // Update other fields (更新其他字段)
    if (updates.jobDescription !== undefined) (this.props as any).jobDescription = updates.jobDescription;
    if (updates.countryCode !== undefined) (this.props as any).countryCode = updates.countryCode;
    if (updates.normalizedJobTitles !== undefined) (this.props as any).normalizedJobTitles = updates.normalizedJobTitles;
    if (updates.jobTypes !== undefined) (this.props as any).jobTypes = updates.jobTypes;
    if (updates.experienceRequirement !== undefined) (this.props as any).experienceRequirement = updates.experienceRequirement;
    if (updates.salaryDetails !== undefined) (this.props as any).salaryDetails = updates.salaryDetails;
    if (updates.jobApplicationTypes !== undefined) (this.props as any).jobApplicationTypes = updates.jobApplicationTypes;

    (this.props as any).updatedAt = new Date();
  }

  /**
   * Mark job as expired (标记岗位为已过期)
   * Valid transition: ACTIVE/INACTIVE → EXPIRED (有效转换：ACTIVE/INACTIVE → EXPIRED)
   *
   * @param updatedBy - User ID who marked the job as expired (标记岗位过期的用户ID)
   * @throws InvalidJobStatusTransitionException if job is already EXPIRED (岗位已经是EXPIRED状态时抛出InvalidJobStatusTransitionException)
   */
  markAsExpired(updatedBy: string): void {
    if (this.props.status.isExpired()) {
      throw new InvalidJobStatusTransitionException(
        this.props.status.getValue(),
        'expired',
      );
    }

    (this.props as any).status = this.props.status.transitionToExpired();
    (this.props as any).updatedAt = new Date();
  }

  /**
   * Activate the job (激活岗位)
   * Valid transition: INACTIVE/EXPIRED → ACTIVE (有效转换：INACTIVE/EXPIRED → ACTIVE)
   *
   * @param updatedBy - User ID who activated the job (激活岗位的用户ID)
   * @param options - Optional parameters (可选参数)
   * @throws InvalidJobStatusTransitionException if job is already ACTIVE (岗位已经是ACTIVE状态时抛出InvalidJobStatusTransitionException)
   */
  activate(updatedBy: string, options?: { validateDeadline?: boolean }): void {
    if (this.props.status.isActive()) {
      throw new InvalidJobStatusTransitionException(
        this.props.status.getValue(),
        'active',
      );
    }

    // Validate application deadline when reactivating (重新激活时验证申请截止日期)
    if (options?.validateDeadline !== false && this.props.applicationDeadline) {
      const now = new Date();
      if (this.props.applicationDeadline <= now) {
        throw new InvalidApplicationDeadlineException(
          this.props.applicationDeadline,
          'Cannot activate job with past application deadline',
        );
      }
    }

    (this.props as any).status = this.props.status.transitionToActive();
    (this.props as any).updatedAt = new Date();
  }

  /**
   * Deactivate the job (停用岗位)
   * Valid transition: ACTIVE → INACTIVE (有效转换：ACTIVE → INACTIVE)
   *
   * @param updatedBy - User ID who deactivated the job (停用岗位的用户ID)
   * @throws InvalidJobStatusTransitionException if job is not ACTIVE (岗位不是ACTIVE状态时抛出InvalidJobStatusTransitionException)
   */
  deactivate(updatedBy: string): void {
    if (!this.props.status.isActive()) {
      throw new InvalidJobStatusTransitionException(
        this.props.status.getValue(),
        'inactive',
      );
    }

    (this.props as any).status = this.props.status.transitionToInactive();
    (this.props as any).updatedAt = new Date();
  }

  /**
   * Check if job is still open for applications (检查岗位是否仍开放申请)
   *
   * @returns true if job is active and deadline has not passed (岗位活跃且截止日期未过时返回true)
   */
  isOpenForApplications(): boolean {
    if (!this.props.status.isActive()) {
      return false;
    }

    if (this.props.applicationDeadline) {
      return this.props.applicationDeadline > new Date();
    }

    return true;
  }

  /**
   * Check if job supports the given application type (检查岗位是否支持给定的申请类型)
   *
   * @param applicationType - Application type to check (要检查的申请类型)
   * @returns true if supported (支持时返回true)
   */
  supportsApplicationType(applicationType: string): boolean {
    return this.props.jobApplicationTypes.includes(applicationType);
  }

  /**
   * Add a supported application type (添加支持的申请类型)
   *
   * @param applicationType - Application type to add (要添加的申请类型)
   */
  addApplicationType(applicationType: string): void {
    if (!this.supportsApplicationType(applicationType)) {
      (this.props as any).jobApplicationTypes = [...this.props.jobApplicationTypes, applicationType];
      (this.props as any).updatedAt = new Date();
    }
  }

  /**
   * Remove a supported application type (移除支持的申请类型)
   *
   * @param applicationType - Application type to remove (要移除的申请类型)
   */
  removeApplicationType(applicationType: string): void {
    if (this.supportsApplicationType(applicationType)) {
      (this.props as any).jobApplicationTypes = this.props.jobApplicationTypes.filter(
        (type) => type !== applicationType,
      );
      (this.props as any).updatedAt = new Date();
    }
  }

  /**
   * Validate job locations [验证工作地点]
   *
   * @param locations - Job locations to validate [要验证的工作地点]
   * @throws InvalidJobLocationException if any location is invalid [任一地点无效时抛出InvalidJobLocationException]
   */
  private static validateJobLocations(locations: JobLocation[]): void {
    locations.forEach((location, index) => {
      if (!location.city && !location.remote) {
        throw new InvalidJobLocationException(
          `Location at index ${index} must have either city or remote=true`,
        );
      }
    });
  }

  // Getters
  getId(): string {
    return this.props.id;
  }

  getJobId(): string | undefined {
    return this.props.jobId;
  }

  getJobLink(): string | undefined {
    return this.props.jobLink;
  }

  getObjectId(): string | undefined {
    return this.props.objectId;
  }

  getNormalizedJobTitles(): string[] {
    return [...this.props.normalizedJobTitles];
  }

  getJobTypes(): string[] {
    return [...this.props.jobTypes];
  }

  getPostDate(): Date {
    return this.props.postDate;
  }

  getApplicationDeadline(): Date | undefined {
    return this.props.applicationDeadline;
  }

  getStatus(): JobStatusVO {
    return this.props.status;
  }

  getTitle(): string {
    return this.props.title;
  }

  getCountryCode(): string | undefined {
    return this.props.countryCode;
  }

  getExperienceRequirement(): ExperienceRequirement | undefined {
    return this.props.experienceRequirement ? { ...this.props.experienceRequirement } : undefined;
  }

  getSalaryDetails(): SalaryDetails | undefined {
    return this.props.salaryDetails ? { ...this.props.salaryDetails } : undefined;
  }

  getJobLocations(): JobLocation[] {
    return this.props.jobLocations.map((loc) => ({ ...loc }));
  }

  getJobDescription(): string | undefined {
    return this.props.jobDescription;
  }

  getCompanyName(): string {
    return this.props.companyName;
  }

  getH1BStatus(): H1BStatusVO | undefined {
    return this.props.h1bStatus;
  }

  getUSCitizenshipRequirement(): USCitizenshipRequirementVO | undefined {
    return this.props.usCitizenshipRequirement;
  }

  getJobLevel(): JobLevelVO | undefined {
    return this.props.jobLevel;
  }

  getAIAnalysis(): AIAnalysis | undefined {
    return this.props.aiAnalysis ? { ...this.props.aiAnalysis } : undefined;
  }

  getJobApplicationTypes(): string[] {
    return [...this.props.jobApplicationTypes];
  }

  getCreatedAt(): Date {
    return this.props.createdAt;
  }

  getUpdatedAt(): Date {
    return this.props.updatedAt;
  }

  /**
   * Check if job is active (检查岗位是否为活动状态)
   *
   * @returns true if active (活动状态时返回true)
   */
  isActive(): boolean {
    return this.props.status.isActive();
  }

  /**
   * Check if job is inactive (检查岗位是否为非活动状态)
   *
   * @returns true if inactive (非活动状态时返回true)
   */
  isInactive(): boolean {
    return this.props.status.isInactive();
  }

  /**
   * Check if job is expired (检查岗位是否已过期)
   *
   * @returns true if expired (已过期时返回true)
   */
  isExpired(): boolean {
    return this.props.status.isExpired();
  }

  /**
   * Check if job is visible to students (检查岗位是否对学生可见)
   *
   * @returns true if visible (可见时返回true)
   */
  isVisibleToStudents(): boolean {
    return this.props.status.isVisibleToStudents() && this.isOpenForApplications();
  }
}

/**
 * InvalidJobTitleException (无效岗位标题异常)
 */
export class InvalidJobTitleException extends DomainException {
  constructor(title: string, message?: string) {
    super(
      'INVALID_JOB_TITLE',
      message || `Invalid job title: ${title}`,
      { title },
    );
  }
}

/**
 * InvalidCompanyNameException (无效公司名称异常)
 */
export class InvalidCompanyNameException extends DomainException {
  constructor(companyName: string, message?: string) {
    super(
      'INVALID_COMPANY_NAME',
      message || `Invalid company name: ${companyName}`,
      { companyName },
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
 * InvalidObjectIdException (无效对象ID异常)
 */
export class InvalidObjectIdException extends DomainException {
  constructor(objectId: string, message?: string) {
    super(
      'INVALID_OBJECT_ID',
      message || `Invalid object ID: ${objectId}`,
      { objectId },
    );
  }
}

/**
 * InvalidApplicationDeadlineException (无效申请截止日期异常)
 */
export class InvalidApplicationDeadlineException extends DomainException {
  constructor(deadline: Date, message: string) {
    super(
      'INVALID_APPLICATION_DEADLINE',
      `${message}: ${deadline.toISOString()}`,
      { deadline: deadline.toISOString(), message },
    );
  }
}

/**
 * InvalidJobLocationException (无效工作地点异常)
 */
export class InvalidJobLocationException extends DomainException {
  constructor(message: string) {
    super(
      'INVALID_JOB_LOCATION',
      message,
      { message },
    );
  }
}

/**
 * JobPositionNotEditableException (岗位不可编辑异常)
 */
export class JobPositionNotEditableException extends DomainException {
  constructor(jobId: string, status: string) {
    super(
      'JOB_POSITION_NOT_EDITABLE',
      `Job position ${jobId} in ${status} status cannot be edited`,
      { jobId, status },
    );
  }
}

/**
 * InvalidJobStatusTransitionException (无效岗位状态转换异常)
 */
export class InvalidJobStatusTransitionException extends DomainException {
  constructor(from: string, to: string) {
    super(
      'INVALID_JOB_STATUS_TRANSITION',
      `Invalid job status transition from ${from} to ${to}`,
      { from, to },
    );
  }
}
