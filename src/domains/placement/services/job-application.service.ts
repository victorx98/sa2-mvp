import {
  Injectable,
  Logger,
  Inject,
  NotFoundException,
  BadRequestException,
} from "@nestjs/common";
import { eq, and, sql } from "drizzle-orm";
import { DATABASE_CONNECTION } from "@infrastructure/database/database.provider";
import { DrizzleDatabase } from "@shared/types/database.types";
import {
  recommendedJobs,
  jobApplications,
  applicationHistory,
} from "@infrastructure/database/schema";
import {
  JOB_APPLICATION_SUBMITTED_EVENT,
  JOB_APPLICATION_STATUS_CHANGED_EVENT,
  JOB_APPLICATION_STATUS_ROLLED_BACK_EVENT,
  MENTOR_SCREENING_COMPLETED_EVENT,
  MentorScreeningCompletedEvent,
} from "../events";
import {
  ISubmitApplicationDto,
  IUpdateApplicationStatusDto,
  IJobApplicationSearchFilter,
} from "../dto";
import { IJobApplicationService, IServiceResult } from "../interfaces";
import { IPaginationQuery, ISortQuery } from "@shared/types/pagination.types";
import {
  ApplicationStatus,
  ALLOWED_APPLICATION_STATUS_TRANSITIONS,
  ApplicationType,
} from "../types";
import { EventEmitter2 } from "@nestjs/event-emitter";

/**
 * Job Application Service [投递服务]
 * Handles job application lifecycle management [处理投递申请生命周期管理]
 */
@Injectable()
export class JobApplicationService implements IJobApplicationService {
  private readonly logger = new Logger(JobApplicationService.name);

  constructor(
    @Inject(DATABASE_CONNECTION)
    private readonly db: DrizzleDatabase,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  /**
   * Submit a job application [提交投递申请]
   *
   * @param dto - Submit application DTO [提交申请DTO]
   * @returns Created application and events [创建的申请和事件]
   */
  async submitApplication(
    dto: ISubmitApplicationDto,
  ): Promise<IServiceResult<Record<string, any>, Record<string, any>>> {
    this.logger.log(
      `Submitting job application: student=${dto.studentId}, job=${dto.jobId}`,
    );

    // Check for duplicate application [检查重复申请]
    await this.checkDuplicateApplication(dto.studentId, dto.jobId);

    // Verify job exists [验证岗位存在]
    const job = await this.db
      .select()
      .from(recommendedJobs)
      .where(eq(recommendedJobs.id, dto.jobId));
    if (job.length === 0) {
      throw new NotFoundException(`Job position not found: ${dto.jobId}`);
    }

    // Create application record [创建申请记录]
    const [application] = await this.db
      .insert(jobApplications)
      .values({
        studentId: dto.studentId,
        jobId: dto.jobId,
        applicationType: dto.applicationType,
        coverLetter: dto.coverLetter,
        customAnswers: dto.customAnswers,
        status:
          dto.applicationType === ApplicationType.REFERRAL
            ? "recommended"
            : "submitted",
        isUrgent: dto.isUrgent || false,
      })
      .returning();

    this.logger.log(`Job application submitted: ${application.id}`);

    // Record status change history [记录状态变更历史]
    await this.db.insert(applicationHistory).values({
      applicationId: application.id,
      previousStatus: null,
      newStatus: "submitted",
      changedBy: dto.studentId,
      changeReason: "Initial submission",
    });

    // No longer updating application counts in recommended_jobs table [不再更新recommended_jobs表中的申请次数]

    // Publish application submitted event [发布投递申请事件]
    const eventPayload = {
      applicationId: application.id,
      studentId: application.studentId,
      positionId: application.jobId,
      applicationType: application.applicationType,
      submittedAt: application.submittedAt.toISOString(),
    };
    this.eventEmitter.emit(JOB_APPLICATION_SUBMITTED_EVENT, eventPayload);

    return {
      data: application,
      event: { type: JOB_APPLICATION_SUBMITTED_EVENT, payload: eventPayload },
    };
  }

  /**
   * Submit mentor screening [提交内推导师评估]
   *
   * @param dto - Mentor screening DTO [导师评估DTO]
   * @returns Updated application and events [更新的申请和事件]
   */
  async submitMentorScreening(dto: any) {
    this.logger.log(
      `Submitting mentor screening: application=${dto.applicationId}, mentor=${dto.mentorId}`,
    );

    // Verify application exists and is mentor referral type [验证申请存在且为内推类型]
    const [application] = await this.db
      .select()
      .from(jobApplications)
      .where(eq(jobApplications.id, dto.applicationId));

    if (!application) {
      throw new NotFoundException(
        `Application not found: ${dto.applicationId}`,
      );
    }

    if (application.applicationType !== ApplicationType.REFERRAL) {
      throw new Error(
        "Mentor screening is only available for mentor referral applications",
      );
    }

    if (application.status !== "mentor_assigned") {
      throw new Error(
        "Mentor screening can only be submitted for applications in mentor_assigned status",
      );
    }

    // Save mentor screening result [保存导师评估结果]
    const screeningResult = {
      technicalSkills: dto.technicalSkills,
      experienceMatch: dto.experienceMatch,
      culturalFit: dto.culturalFit,
      overallRecommendation: dto.overallRecommendation,
      screeningNotes: dto.screeningNotes,
    };

    // Determine new status based on recommendation [根据推荐结果确定新状态]
    const newStatus =
      dto.overallRecommendation === "strongly_recommend" ||
      dto.overallRecommendation === "recommend"
        ? "submitted"
        : "rejected";

    const [updatedApplication] = await this.db
      .update(jobApplications)
      .set({
        mentorScreening: screeningResult,
        status: newStatus,
      })
      .where(eq(jobApplications.id, dto.applicationId))
      .returning();

    // Record status change history [记录状态变更历史]
    await (this.db.insert(applicationHistory).values as any)({
      applicationId: dto.applicationId,
      previousStatus: "mentor_assigned",
      newStatus: newStatus,
      changedBy: dto.mentorId,
      changeReason: `Mentor screening ${newStatus === "submitted" ? "passed" : "failed"}`,
      changeMetadata: screeningResult,
    });

    this.logger.log(
      `Mentor screening submitted: ${dto.applicationId}, new status: ${newStatus}`,
    );

    // Build event [构建事件]
    const event: MentorScreeningCompletedEvent = {
      applicationId: dto.applicationId,
      mentorId: dto.mentorId,
      screeningResult,
      evaluatedAt: new Date().toISOString(),
    };

    // Publish event [发布事件]
    this.eventEmitter.emit(MENTOR_SCREENING_COMPLETED_EVENT, event);

    return {
      data: updatedApplication,
      event: { type: MENTOR_SCREENING_COMPLETED_EVENT, payload: event },
    };
  }

  /**
   * Update application status [更新投递状态]
   *
   * @param dto - Update status DTO [更新状态DTO]
   * @returns Updated application and events [更新的申请和事件]
   */
  async updateApplicationStatus(
    dto: IUpdateApplicationStatusDto,
  ): Promise<IServiceResult<Record<string, any>, Record<string, any>>> {
    this.logger.log(
      `Updating application status: ${dto.applicationId} -> ${dto.newStatus}`,
    );

    // Get current application status [获取当前申请状态]
    const [application] = await this.db
      .select()
      .from(jobApplications)
      .where(eq(jobApplications.id, dto.applicationId));

    if (!application) {
      throw new NotFoundException(
        `Application not found: ${dto.applicationId}`,
      );
    }

    const previousStatus = application.status as ApplicationStatus;

    // Validate status transition [验证状态转换]
    const allowedTransitions =
      ALLOWED_APPLICATION_STATUS_TRANSITIONS[previousStatus];
    if (!allowedTransitions || !allowedTransitions.includes(dto.newStatus)) {
      throw new BadRequestException(
        `Invalid status transition: ${previousStatus} -> ${dto.newStatus}`,
      );
    }

    // Update application status [更新申请状态]
    const resultStatuses: ApplicationStatus[] = ["rejected"];
    const [updatedApplication] = await this.db
      .update(jobApplications)
      .set({
        status: dto.newStatus as any,
        result: this.getResultFromStatus(dto.newStatus) as any,
        resultDate: resultStatuses.includes(dto.newStatus) ? new Date() : null,
      } as any)
      .where(eq(jobApplications.id, dto.applicationId))
      .returning();

    // Record status change history [记录状态变更历史]
    await (this.db.insert(applicationHistory).values as any)({
      applicationId: dto.applicationId,
      previousStatus,
      newStatus: dto.newStatus as any,
      changedBy: dto.changedBy,
      changeReason: dto.changeReason,
      changeMetadata: dto.changeMetadata,
    });

    this.logger.log(`Application status updated: ${dto.applicationId}`);

    // Publish status changed event [发布状态变更事件]
    const eventPayload = {
      applicationId: updatedApplication.id,
      previousStatus: previousStatus,
      newStatus: dto.newStatus as ApplicationStatus,
      changedBy: dto.changedBy,
      changedAt: new Date().toISOString(),
      changeMetadata: dto.changeMetadata,
    };
    this.eventEmitter.emit(JOB_APPLICATION_STATUS_CHANGED_EVENT, eventPayload);

    return {
      data: updatedApplication,
      event: {
        type: JOB_APPLICATION_STATUS_CHANGED_EVENT,
        payload: eventPayload,
      },
    };
  }

  /**
   * Query applications [查询投递申请]
   *
   * @param filter - Search filter criteria [搜索筛选条件]
   * @param pagination - Pagination parameters [分页参数]
   * @param sort - Sorting parameters [排序参数]
   * @returns Paginated applications [分页投递列表]
   */
  async search(
    filter?: IJobApplicationSearchFilter,
    pagination?: IPaginationQuery,
    sort?: ISortQuery,
  ): Promise<{
    items: Record<string, any>[];
    total: number;
    offset: number;
    limit: number;
  }> {
    this.logger.log(
      `Searching applications with filter: ${JSON.stringify(filter)}, pagination: ${JSON.stringify(pagination)}, sort: ${JSON.stringify(sort)}`,
    );

    const conditions = [];

    // Build conditions based on filter
    if (filter) {
      if (filter.studentId) {
        conditions.push(eq(jobApplications.studentId, filter.studentId));
      }

      if (filter.jobId) {
        conditions.push(eq(jobApplications.jobId, filter.jobId));
      }

      if (filter.status) {
        conditions.push(eq(jobApplications.status, filter.status as any));
      }

      if (filter.applicationType) {
        conditions.push(
          eq(jobApplications.applicationType, filter.applicationType as any),
        );
      }
    }

    // Pagination [分页]
    const page = pagination?.page || 1;
    const pageSize = pagination?.pageSize || 20;
    const offset = (page - 1) * pageSize;
    const limit = pageSize;

    // Build and execute main query [构建并执行主查询]
    const applications = await this.db
      .select()
      .from(jobApplications)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(
        sort?.field
          ? sort.direction === "asc"
            ? (jobApplications as any)[sort.field]
            : sql`${(jobApplications as any)[sort.field]} DESC`
          : sql`${jobApplications.submittedAt} DESC`,
      )
      .limit(limit)
      .offset(offset);

    // Get total count [获取总数]
    const countResult = await this.db
      .select({ count: sql`count(*)` })
      .from(jobApplications)
      .where(conditions.length > 0 ? and(...conditions) : undefined);

    const count = countResult[0]?.count || 0;

    return {
      items: applications,
      total: Number(count),
      offset,
      limit,
    };
  }

  /**
   * Get application [获取投递申请]
   *
   * @param params - Search parameters [搜索参数]
   * @returns Application [投递申请]
   */
  async findOne(params: {
    id?: string;
    studentId?: string;
    jobId?: string;
    status?: string;
    applicationType?: ApplicationType;
    [key: string]: any;
  }) {
    // Build conditions based on provided params
    const conditions = [];

    // Handle known columns explicitly to avoid TypeScript errors
    if (params.id) {
      conditions.push(eq(jobApplications.id, params.id));
    }
    if (params.studentId) {
      conditions.push(eq(jobApplications.studentId, params.studentId));
    }
    if (params.jobId) {
      conditions.push(eq(jobApplications.jobId, params.jobId));
    }
    if (params.status) {
      // Use type assertion for enum column to avoid TypeScript error
      conditions.push(eq(jobApplications.status, params.status as any));
    }
    if (params.applicationType) {
      // Use enum type directly without type assertion
      conditions.push(
        eq(jobApplications.applicationType, params.applicationType),
      );
    }
    // Add more known columns as needed

    const [application] = await this.db
      .select()
      .from(jobApplications)
      .where(and(...conditions));

    if (!application) {
      throw new NotFoundException(
        `Application not found: ${JSON.stringify(params)}`,
      );
    }

    return application;
  }

  /**
   * Get application status history [获取投递状态历史]
   *
   * @param applicationId - Application ID [申请ID]
   * @returns Status history [状态历史]
   */
  async getStatusHistory(applicationId: string) {
    return this.db
      .select()
      .from(applicationHistory)
      .where(eq(applicationHistory.applicationId, applicationId))
      .orderBy(applicationHistory.changedAt);
  }

  /**
   * Check for duplicate application [检查重复申请]
   *
   * @param studentId - Student ID [学生ID]
   * @param jobId - Job position ID [岗位ID]
   * @throws Error if duplicate application exists [如果存在重复申请则抛出错误]
   */
  private async checkDuplicateApplication(studentId: string, jobId: string) {
    const [existing] = await this.db
      .select()
      .from(jobApplications)
      .where(
        and(
          eq(jobApplications.studentId, studentId),
          eq(jobApplications.jobId, jobId),
        ),
      );

    if (existing) {
      throw new Error(
        `Student ${studentId} has already applied for job ${jobId}`,
      );
    }
  }

  /**
   * Get result from status [从状态获取结果]
   *
   * @param status - Application status [申请状态]
   * @returns Result or null [结果或null]
   */
  private getResultFromStatus(status: ApplicationStatus): "rejected" | null {
    const resultStatuses: ApplicationStatus[] = ["rejected"];
    return resultStatuses.includes(status) ? (status as any) : null;
  }

  /**
   * Rollback application status to previous state [回撤申请状态到上一个状态]
   *
   * @param applicationId - Application ID [申请ID]
   * @param changedBy - User ID who initiated the rollback [发起回撤的用户ID]
   * @returns Updated application and events [更新后的申请和事件]
   */
  async rollbackApplicationStatus(
    applicationId: string,
    changedBy: string,
  ): Promise<IServiceResult<Record<string, any>, Record<string, any>>> {
    this.logger.log(`Rolling back status for application: ${applicationId}`);

    // Get current application [获取当前申请]
    const [application] = await this.db
      .select()
      .from(jobApplications)
      .where(eq(jobApplications.id, applicationId));

    if (!application) {
      throw new NotFoundException(`Application not found: ${applicationId}`);
    }

    // Get status history [获取状态历史]
    const statusHistory = await this.db
      .select()
      .from(applicationHistory)
      .where(eq(applicationHistory.applicationId, applicationId))
      .orderBy(applicationHistory.changedAt);

    if (statusHistory.length < 2) {
      throw new BadRequestException(
        `Cannot rollback: Application has insufficient status history`,
      );
    }

    // Get previous status [获取上一个状态]
    const currentStatus = application.status as ApplicationStatus;
    const previousStatusRecord = statusHistory[statusHistory.length - 2];
    const previousStatus = previousStatusRecord.newStatus as ApplicationStatus;

    // Validate status transition [验证状态转换]
    const allowedTransitions =
      ALLOWED_APPLICATION_STATUS_TRANSITIONS[previousStatus];
    if (!allowedTransitions || !allowedTransitions.includes(currentStatus)) {
      throw new BadRequestException(
        `Invalid status transition: ${previousStatus} -> ${currentStatus}`,
      );
    }

    // Update application status [更新申请状态]
    const resultStatuses: ApplicationStatus[] = ["rejected"];
    const [updatedApplication] = await this.db
      .update(jobApplications)
      .set({
        status: previousStatus,
        result: this.getResultFromStatus(previousStatus) as any,
        resultDate: resultStatuses.includes(previousStatus) ? new Date() : null,
      } as any)
      .where(eq(jobApplications.id, applicationId))
      .returning();

    // Record status change history [记录状态变更历史]
    await (this.db.insert(applicationHistory).values as any)({
      applicationId: applicationId,
      previousStatus: currentStatus,
      newStatus: previousStatus,
      changedBy: changedBy,
      changeReason: "Status rolled back",
    });

    this.logger.log(
      `Application status rolled back: ${applicationId} from ${currentStatus} to ${previousStatus}`,
    );

    // Publish status rolled back event [发布状态回撤事件]
    const eventPayload = {
      applicationId: updatedApplication.id,
      previousStatus: currentStatus,
      newStatus: previousStatus,
      changedBy: changedBy,
      changedAt: new Date().toISOString(),
      rollbackReason: "Status rolled back",
    };
    this.eventEmitter.emit(JOB_APPLICATION_STATUS_ROLLED_BACK_EVENT, eventPayload);

    return {
      data: updatedApplication,
      event: {
        type: JOB_APPLICATION_STATUS_ROLLED_BACK_EVENT,
        payload: eventPayload,
      },
    };
  }
}
