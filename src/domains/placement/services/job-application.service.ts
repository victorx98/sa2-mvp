// Note: DTO interfaces temporarily defined in this file until moved to API layer
import {
  Injectable,
  Logger,
  Inject,
  NotFoundException,
  BadRequestException,
} from "@nestjs/common";
import { eq, and, sql, desc, asc, getTableColumns, inArray } from "drizzle-orm";
import { DATABASE_CONNECTION } from "@infrastructure/database/database.provider";
import { DrizzleDatabase } from "@shared/types/database.types";
import {
  recommendedJobs,
  jobApplications,
  applicationHistory,
} from "@infrastructure/database/schema";
import {
  JOB_APPLICATION_STATUS_CHANGED_EVENT,
  JOB_APPLICATION_STATUS_ROLLED_BACK_EVENT,
  PLACEMENT_APPLICATION_SUBMITTED_EVENT,
} from "@shared/events/event-constants";
// Removed - module not found: @shared/events/placement-application-submitted.event
import {
  ISubmitApplicationDto,
  IRecommendReferralApplicationsBatchDto,
  IUpdateApplicationStatusDto,
  IJobApplicationSearchFilter,
  IRollbackApplicationStatusDto,
  ICreateManualJobApplicationDto,
} from "@api/dto/request/placement/placement.index";
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

  private isUuid(value: string | undefined): value is string {
    // Simple UUID v4-ish validation to protect Service Registry FK constraints (English only) [简单 UUID 校验以保护 Service Registry 外键约束]
    return (
      typeof value === "string" &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        value,
      )
    );
  }

  /**
   * Submit a job application [提交投递申请]
   * - Wraps all operations in a transaction to ensure atomicity [将所有操作包裹在事务中以确保原子性]
   * - Creates application record, history record, and publishes event [创建申请记录、历史记录并发布事件]
   *
   * @param dto - Submit application DTO [提交申请DTO]
   * @returns Created application and events [创建的申请和事件]
   */
  async submitApplication(
    dto: ISubmitApplicationDto,
  ): Promise<
    IServiceResult<typeof jobApplications.$inferSelect, Record<string, unknown>>
  > {
    this.logger.log(
      `Submitting job application: student=${dto.studentId}, job=${dto.jobId}`,
    );

    // Verify job exists and is active [验证岗位存在且为active]
    const [job] = await this.db
      .select()
      .from(recommendedJobs)
      .where(eq(recommendedJobs.id, dto.jobId));
    if (!job) {
      throw new NotFoundException(`Job position not found: ${dto.jobId}`);
    }
    if (job.status !== "active") {
      throw new BadRequestException(
        `Job position is not active: ${dto.jobId} (status: ${job.status})`,
      );
    }

    // Check for duplicate application using studentId and jobId [检查学生ID和岗位ID的重复申请]
    await this.checkDuplicateApplication(dto.studentId, dto.jobId, job.jobLink || undefined);

    // Wrap all operations in a transaction to ensure atomicity [将所有操作包裹在事务中以确保原子性]
    const application = await this.db.transaction(async (tx) => {
      // Create application record [创建申请记录]
      const [newApplication] = await tx
        .insert(jobApplications)
        .values({
          studentId: dto.studentId,
          recommendedJobId: dto.jobId, // Use recommendedJobId field (UUID reference to recommended_jobs) [使用recommendedJobId字段（UUID引用recommended_jobs）]
          jobLink: job.jobLink || null, // Store job link for quick access [存储岗位链接便于快速访问]
          applicationType: dto.applicationType as ApplicationType,
          coverLetter: '', // coverLetter is not provided in ISubmitApplicationDto
          status:
            dto.applicationType === ApplicationType.REFERRAL
              ? "recommended"
              : "submitted",
        })
        .returning();

      this.logger.log(`Job application submitted: ${newApplication.id}`);

      // Record status change history [记录状态变更历史]
      await tx.insert(applicationHistory).values({
        applicationId: newApplication.id,
        previousStatus: null,
        newStatus: newApplication.status as ApplicationStatus,
        changedBy: dto.studentId,
        changeReason: "Initial submission",
      });

      return newApplication;
    });

    // No longer updating application counts in recommended_jobs table [不再更新recommended_jobs表中的申请次数]

    // Publish application status changed event AFTER transaction (在事务后发布投递状态变更事件) [在事务成功后发布事件]
    // Event is published after transaction commits to ensure data consistency [事件在事务提交后发布以确保数据一致性]
    const eventPayload = {
      applicationId: application.id,
      previousStatus: null,
      newStatus: application.status,
      changedBy: application.studentId,
      changedAt: application.submittedAt.toISOString(),
    };
    this.eventEmitter.emit(JOB_APPLICATION_STATUS_CHANGED_EVENT, eventPayload);

    if (application.status === "submitted") {
      const providerCandidate = dto.studentId;
      const submittedPayload: any = {
        id: application.id,
        service_type: "job_application",
        student_user_id: application.studentId,
        provider_user_id: this.isUuid(providerCandidate)
          ? providerCandidate
          : application.studentId,
        consumed_units: 1,
        unit_type: "count",
        completed_time: application.submittedAt,
        title: job.title ?? undefined,
      };
      this.eventEmitter.emit(
        PLACEMENT_APPLICATION_SUBMITTED_EVENT,
        submittedPayload,
      );
    }

    return {
      data: application,
      event: {
        type: JOB_APPLICATION_STATUS_CHANGED_EVENT,
        payload: eventPayload,
      },
    };
  }

  /**
   * Batch recommend referral applications (counselor -> students) [批量内推推荐（顾问 -> 学生）]
   * - All-or-nothing transaction: any failure rolls back all inserts [全成功事务：任一失败则整体回滚]
   */
  async recommendReferralApplicationsBatch(
    dto: IRecommendReferralApplicationsBatchDto,
  ): Promise<IServiceResult<{ items: Record<string, unknown>[] }, Record<string, unknown>>> {
    if (!dto) {
      throw new BadRequestException(
        "recommendReferralApplicationsBatch dto is required",
      );
    }

    const studentIds: string[] = Array.from(new Set(dto.studentIds ?? []));
    const jobIds: string[] = Array.from(new Set(dto.jobIds ?? []));

    if (!dto.recommendedBy) {
      throw new BadRequestException("recommendedBy is required");
    }
    if (studentIds.length === 0) {
      throw new BadRequestException("studentIds must not be empty");
    }
    if (jobIds.length === 0) {
      throw new BadRequestException("jobIds must not be empty");
    }

    const pairs = studentIds.flatMap((studentId) =>
      jobIds.map((jobId) => ({ studentId, jobId })),
    );

    // Keep a reasonable cap to prevent accidental explosion (N*M) [限制组合数量避免误操作]
    if (pairs.length > 5000) {
      throw new BadRequestException(
        `Too many combinations (${pairs.length}). Please reduce studentIds/jobIds.`,
      );
    }

    // Validate jobs exist and are active [校验岗位存在且为active]
    const jobs = await this.db
      .select({
        id: recommendedJobs.id,
        status: recommendedJobs.status,
        title: recommendedJobs.title,
        jobLink: recommendedJobs.jobLink,
        companyName: recommendedJobs.companyName,
        jobLocations: recommendedJobs.jobLocations,
        jobTypes: recommendedJobs.jobTypes,
        normalizedJobTitles: recommendedJobs.normalizedJobTitles,
        level: recommendedJobs.level,
      })
      .from(recommendedJobs)
      .where(and(inArray(recommendedJobs.id, jobIds), eq(recommendedJobs.status, "active")));

    const foundJobIdSet = new Set(jobs.map((j) => j.id));
    const missingJobIds = jobIds.filter((id) => !foundJobIdSet.has(id));
    if (missingJobIds.length > 0) {
      throw new BadRequestException(
        `Some jobs are missing or not active: ${missingJobIds.slice(0, 10).join(", ")}`,
      );
    }

    // Create job info map for fast lookup [创建职位信息映射表用于快速查找]
    const jobInfoMap = new Map(jobs.map((job) => [job.id, job]));

    // Detect duplicates (any existing studentId+jobId is forbidden) [检测重复申请（任一已存在则整体失败）]
    const existing = await this.db
      .select({ studentId: jobApplications.studentId, jobId: jobApplications.jobId })
      .from(jobApplications)
      .where(and(inArray(jobApplications.studentId, studentIds), inArray(jobApplications.jobId, jobIds)));

    const existingPairSet = new Set(existing.map((x) => `${x.studentId}::${x.jobId}`));
    const duplicatePairs = pairs.filter((p) => existingPairSet.has(`${p.studentId}::${p.jobId}`));
    if (duplicatePairs.length > 0) {
      const sample = duplicatePairs
        .slice(0, 10)
        .map((p) => `${p.studentId}/${p.jobId}`)
        .join(", ");
      throw new BadRequestException(`Duplicate applications detected: ${sample}`);
    }

    const recommendedAt = new Date();
    const createdApplications = await this.db.transaction(async (tx) => {
      const inserted = await tx
        .insert(jobApplications)
        .values(
          pairs.map((p) => {
            const job = jobInfoMap.get(p.jobId);
            return {
              studentId: p.studentId,
              jobId: p.jobId,
              applicationType: ApplicationType.REFERRAL,
              status: "recommended" as const,
              recommendedBy: dto.recommendedBy, // Set recommended_by field [设置推荐人字段]
              recommendedAt: recommendedAt, // Set recommended_at field [设置推荐时间字段]
              // Job information from recommendedJobs [从recommendedJobs表获取职位信息]
              jobType: job?.jobTypes?.[0] || null, // Take first job type [取第一个职位类型]
              jobTitle: job?.title || null,
              jobLink: job?.jobLink || null,
              companyName: job?.companyName || null,
              location: job?.jobLocations ? JSON.stringify(job.jobLocations) : null, // Convert JSONB to string [转换JSONB为字符串]
              jobCategories: job?.jobTypes || [], // Use job types as categories [使用职位类型作为类别]
              normalJobTitle: job?.normalizedJobTitles?.[0] || null, // Take first normalized title [取第一个标准化标题]
              level: job?.level || null,
            };
          }),
        )
        .returning();

      await tx.insert(applicationHistory).values(
        inserted.map((app) => ({
          applicationId: app.id,
          previousStatus: null,
          newStatus: app.status as ApplicationStatus,
          changedBy: dto.recommendedBy,
          changeReason: "Counselor recommendation",
          changeMetadata: {
            recommendedBy: dto.recommendedBy,
            recommendedAt: recommendedAt.toISOString(),
          },
        })),
      );

      return inserted;
    });

    const events = createdApplications.map((application) => {
      const payload = {
        applicationId: application.id,
        previousStatus: null,
        newStatus: application.status,
        changedBy: dto.recommendedBy,
        changedAt: application.submittedAt.toISOString(),
      };
      this.eventEmitter.emit(JOB_APPLICATION_STATUS_CHANGED_EVENT, payload);
      return { type: JOB_APPLICATION_STATUS_CHANGED_EVENT, payload };
    });

    return {
      data: { items: createdApplications },
      events,
    };
  }

  /**
   * Update application status [更新投递状态]
   * - Wraps all operations in a transaction to ensure atomicity [将所有操作包裹在事务中以确保原子性]
   * - Updates status, records history, and publishes event [更新状态、记录历史并发布事件]
   *
   * @param dto - Update status DTO [更新状态DTO]
   * @returns Updated application and events [更新的申请和事件]
   */
  async updateApplicationStatus(
    dto: IUpdateApplicationStatusDto,
  ): Promise<IServiceResult<Record<string, unknown>, Record<string, unknown>>> {
    this.logger.log(
      `Updating application status: ${dto.applicationId} -> ${dto.status}`,
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

    // Validate status transition (验证状态转换)
    const targetStatus = dto.status as ApplicationStatus;
    const allowedTransitions = ALLOWED_APPLICATION_STATUS_TRANSITIONS[previousStatus];
    if (!allowedTransitions || !allowedTransitions.includes(targetStatus)) {
      throw new BadRequestException(
        `Invalid status transition: ${previousStatus} -> ${targetStatus}`,
      );
    }

    // Wrap all operations in a transaction to ensure atomicity (将所有操作包裹在事务中以确保原子性)
    const updatedApplication = await this.db.transaction(async (tx) => {
      // Update application status (更新申请状态)
      const [app] = await tx
        .update(jobApplications)
        .set({
          status: targetStatus,
          updatedAt: new Date(),
        })
        .where(eq(jobApplications.id, dto.applicationId))
        .returning();

      // Record status change history (记录状态变更历史)
      await tx.insert(applicationHistory).values({
        applicationId: dto.applicationId,
        previousStatus,
        newStatus: targetStatus,
        changedBy: null,
        changeReason: null,
        changeMetadata: null,
      });

      return app;
    });

    this.logger.log(`Application status updated: ${dto.applicationId}`);

    // Publish status changed event AFTER transaction (在事务后发布状态变更事件)
    const eventPayload = {
      applicationId: updatedApplication.id,
      previousStatus: previousStatus,
      newStatus: targetStatus,
      changedBy: null,
      changedAt: new Date().toISOString(),
      // Include mentor assignment if exists (如果存在导师分配则包含)
      ...(updatedApplication.assignedMentorId && {
        assignedMentorId: updatedApplication.assignedMentorId,
      }),
    };
    this.eventEmitter.emit(JOB_APPLICATION_STATUS_CHANGED_EVENT, eventPayload);

    if (targetStatus === "submitted") {
      // Query job title if recommendedJobId exists (如果存在recommendedJobId则查询职位标题)
      let jobTitle: string | undefined;
      if (updatedApplication.recommendedJobId) {
        const [job] = await this.db
          .select({ title: recommendedJobs.title })
          .from(recommendedJobs)
          .where(eq(recommendedJobs.id, updatedApplication.recommendedJobId));
        jobTitle = job?.title;
      }

      const providerCandidate =
        updatedApplication.assignedMentorId ??
        updatedApplication.recommendedBy ??
        updatedApplication.studentId;

      const submittedPayload: any = {
        id: updatedApplication.id,
        service_type: "job_application",
        student_user_id: updatedApplication.studentId,
        provider_user_id: this.isUuid(providerCandidate as string)
          ? providerCandidate
          : updatedApplication.studentId,
        consumed_units: 1,
        unit_type: "count",
        completed_time: updatedApplication.updatedAt,
        title: jobTitle,
      };
      this.eventEmitter.emit(
        PLACEMENT_APPLICATION_SUBMITTED_EVENT,
        submittedPayload,
      );
    }

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
    items: Record<string, unknown>[];
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
        conditions.push(eq(jobApplications.status, filter.status as ApplicationStatus));
      }

      if (filter.applicationType) {
        conditions.push(
          eq(jobApplications.applicationType, filter.applicationType as ApplicationType),
        );
      }

      // Filter by assigned mentor [按分配的导师筛选]
      if (filter.assignedMentorId) {
        conditions.push(
          eq(jobApplications.assignedMentorId, filter.assignedMentorId),
        );
      }

      // Filter by recommender [按推荐人筛选]
      if (filter.recommendedBy) {
        conditions.push(
          eq(jobApplications.recommendedBy, filter.recommendedBy),
        );
      }

      // Filter by recommendation time range [按推荐时间范围筛选]
      if (filter.recommendedAtRange) {
        if (filter.recommendedAtRange.start) {
          conditions.push(
            sql`${jobApplications.recommendedAt} >= ${filter.recommendedAtRange.start}`,
          );
        }
        if (filter.recommendedAtRange.end) {
          conditions.push(
            sql`${jobApplications.recommendedAt} <= ${filter.recommendedAtRange.end}`,
          );
        }
      }
    }

    // Pagination [分页]
    const page = pagination?.page || 1;
    const pageSize = pagination?.pageSize || 20;
    const offset = (page - 1) * pageSize;
    const limit = pageSize;

    // Build and execute main query [构建并执行主查询]
    const columns = getTableColumns(jobApplications);
    const sortColumn = sort?.field && sort.field in columns 
      ? columns[sort.field] 
      : columns.submittedAt;
    const orderByClause = sort?.direction === "asc" 
      ? asc(sortColumn) 
      : desc(sortColumn);

    const applications = await this.db
      .select()
      .from(jobApplications)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(orderByClause)
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
   * @param params - Query parameters [查询参数]
   * @returns Application [投递申请]
   */
  async findOne(params: { id?: string; studentId?: string; jobId?: string; status?: ApplicationStatus; applicationType?: ApplicationType }): Promise<Record<string, unknown>> {
    // Build conditions based on provided params
    const conditions = [];

    // Handle known columns explicitly
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
      conditions.push(eq(jobApplications.status, params.status));
    }
    if (params.applicationType) {
      conditions.push(eq(jobApplications.applicationType, params.applicationType));
    }

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
  async getStatusHistory(
    applicationId: string,
  ): Promise<Array<Record<string, unknown>>> {
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
   * @param jobId - Job ID [岗位ID]
   * @param jobLink - Job link URL [职位链接]
   * @throws Error if duplicate application exists [如果存在重复申请则抛出错误]
   */
  private async checkDuplicateApplication(
    studentId: string,
    jobId: string,
    jobLink: string | undefined = undefined,
  ) {
    this.logger.debug(
      `checkDuplicateApplication called: studentId=${studentId}, jobId=${jobId}, jobLink=${jobLink}`,
    );

    // Check if jobId is a valid UUID before querying [查询前检查jobId是否为有效UUID]
    const isUuidFormat =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        jobId,
      );

    this.logger.debug(`isUuidFormat: ${isUuidFormat}`);

    // For UUID jobId: check duplicate using studentId + jobId [对于UUID格式的jobId：使用studentId + jobId检查重复]
    if (isUuidFormat) {
      const [existingApplication] = await this.db
        .select()
        .from(jobApplications)
        .where(
          and(
            eq(jobApplications.studentId, studentId),
            eq(jobApplications.jobId, jobId),
          ),
        );

      if (existingApplication) {
        throw new BadRequestException(
          `Student ${studentId} has already applied for job ${jobId}`,
        );
      }
    }
    // For non-UUID jobId (external job IDs): check duplicate using studentId + job_link [对于非UUID格式的jobId（外部职位ID）：使用studentId + job_link检查重复]
    else if (jobLink) {
      const [existingApplication] = await this.db
        .select()
        .from(jobApplications)
        .where(
          and(
            eq(jobApplications.studentId, studentId),
            eq(jobApplications.jobLink, jobLink),
          ),
        );

      if (existingApplication) {
        throw new BadRequestException(
          `Student ${studentId} has already applied for job using the same link: ${jobLink}`,
        );
      }
    }
    // For non-UUID jobId without jobLink: skip duplicate check [对于非UUID格式且没有jobLink的jobId：跳过重复检查]
    else {
      this.logger.warn(
        `Skipping duplicate check for non-UUID jobId without jobLink: ${jobId}`,
      );
    }
  }

  /**
   * Rollback application status to previous state [回撤申请状态到上一个状态]
   * - Wraps all operations in a transaction to ensure atomicity [将所有操作包裹在事务中以确保原子性]
   * - Rolls back status, records history, and publishes event [回滚状态、记录历史并发布事件]
   *
   * @param dto - Rollback application status DTO [回撤状态DTO]
   * @returns Updated application and events [更新后的申请和事件]
   */
  async rollbackApplicationStatus(
    dto: IRollbackApplicationStatusDto,
  ): Promise<IServiceResult<Record<string, unknown>, Record<string, unknown>>> {
    this.logger.log(
      `Rolling back status for application: ${dto.applicationId}`,
    );

    // Get current application [获取当前申请]
    const [application] = await this.db
      .select()
      .from(jobApplications)
      .where(eq(jobApplications.id, dto.applicationId));

    if (!application) {
      throw new NotFoundException(
        `Application not found: ${dto.applicationId}`,
      );
    }

    // Get recent status history (last 2 records) [获取最近的状态历史（最后2条记录）]
    const statusHistory = await this.db
      .select()
      .from(applicationHistory)
      .where(eq(applicationHistory.applicationId, dto.applicationId))
      .orderBy(desc(applicationHistory.changedAt))
      .limit(2);

    if (statusHistory.length < 2) {
      throw new BadRequestException(
        `Cannot rollback: Application has insufficient status history`,
      );
    }

    // Validate consistency: latest history record must match current status [验证一致性：最新历史记录必须匹配当前状态]
    const currentStatus = application.status as ApplicationStatus;
    const latestHistoryRecord = statusHistory[0];
    if (latestHistoryRecord.newStatus !== currentStatus) {
      throw new BadRequestException(
        `Status inconsistency: current status is ${currentStatus}, but latest history shows ${latestHistoryRecord.newStatus}`,
      );
    }

    // Get previous status from second-to-last record [从倒数第二条记录获取上一个状态]
    const previousStatusRecord = statusHistory[1];
    const previousStatus = previousStatusRecord.newStatus as ApplicationStatus;

    // Validate status transition [验证状态转换]
    const allowedTransitions = 
      ALLOWED_APPLICATION_STATUS_TRANSITIONS[previousStatus];
    if (!allowedTransitions || !allowedTransitions.includes(currentStatus)) {
      throw new BadRequestException(
        `Invalid status transition: ${previousStatus} -> ${currentStatus}`,
      );
    }

    // Wrap all operations in a transaction to ensure atomicity [将所有操作包裹在事务中以确保原子性]
    const updatedApplication = await this.db.transaction(async (tx) => {
      // Build update data [构建更新数据]
      const updateData: {
        status: ApplicationStatus;
        assignedMentorId?: string | null;
        updatedAt: Date;
      } = {
        status: previousStatus,
        updatedAt: new Date(),
      };

      // Only update assignedMentorId if explicitly provided [仅在显式提供时更新assignedMentorId]
      if (dto.mentorId !== undefined) {
        updateData.assignedMentorId = dto.mentorId || null;
      }
      // If mentorId is undefined, keep the existing value [如果mentorId未定义，保持原值]

      // Update application status [更新申请状态]
      const [app] = await tx
        .update(jobApplications)
        .set(updateData)
        .where(eq(jobApplications.id, dto.applicationId))
        .returning();

      // Record status change history [记录状态变更历史]
      await tx.insert(applicationHistory).values({
        applicationId: dto.applicationId,
        previousStatus: currentStatus,
        newStatus: previousStatus,
        changedBy: dto.changedBy,
        changeReason: "Status rolled back",
      } as typeof applicationHistory.$inferInsert);

      return app;
    });

    this.logger.log(
      `Application status rolled back: ${dto.applicationId} from ${currentStatus} to ${previousStatus}`,
    );

    // Publish status rolled back event AFTER transaction (在事务后发布状态回撤事件) [在事务成功后发布事件]
    // Event is published after transaction commits to ensure data consistency [事件在事务提交后发布以确保数据一致性]
    const eventPayload = {
      applicationId: updatedApplication.id,
      previousStatus: currentStatus,
      newStatus: previousStatus,
      changedBy: dto.changedBy,
      changedAt: new Date().toISOString(),
      rollbackReason: "Status rolled back",
      // [新增] Include mentor assignment in event payload [在事件payload中包含导师分配]
      ...(dto.mentorId && { assignedMentorId: dto.mentorId }),
    };
    this.eventEmitter.emit(
      JOB_APPLICATION_STATUS_ROLLED_BACK_EVENT,
      eventPayload,
    );

    return {
      data: updatedApplication,
      event: {
        type: JOB_APPLICATION_STATUS_ROLLED_BACK_EVENT,
        payload: eventPayload,
      },
    };
  }

  /**
   * Create manual job application [手工创建投递申请]
   * - Used for counselor to manually create job applications with mentor assigned status [用于顾问手工创建内推投递记录，状态默认设置为mentor_assigned]
   * - Wraps all operations in a transaction to ensure atomicity [将所有操作包裹在事务中以确保原子性]
   *
   * @param dto - Create manual job application DTO [手工创建投递申请DTO]
   * @returns Created application and events [创建的申请和事件]
   */
  async createManualJobApplication(
    dto: ICreateManualJobApplicationDto,
  ): Promise<IServiceResult<typeof jobApplications.$inferSelect, Record<string, unknown>>> {
    this.logger.log(
      `Creating manual job application: student=${dto.studentId}, mentor=${dto.mentorId}, jobTitle=${dto.jobTitle}`,
    );

    // Check for duplicate application using studentId and jobId/jobLink [检查学生ID和岗位ID/职位链接的重复申请]
    // Strategy: Always prefer jobLink for duplicate checking when available [策略：当jobLink可用时，始终优先使用jobLink进行重复检查]
    // This avoids UUID type errors when jobId is a non-UUID external ID [这避免了当jobId是非UUID外部ID时的类型错误]
    if (!dto.jobId && !dto.jobLink) {
      throw new BadRequestException(
        "Either jobId or jobLink is required for duplicate checking",
      );
    }

    // Use jobLink as the primary identifier for duplicate checking if available [如果jobLink可用，则将其用作重复检查的主要标识符]
    const identifierForCheck = dto.jobLink || dto.jobId!;
    await this.checkDuplicateApplication(
      dto.studentId,
      identifierForCheck,
      dto.jobLink,
    );

    // Wrap all operations in a transaction to ensure atomicity [将所有操作包裹在事务中以确保原子性]
    const application = await this.db.transaction(async (tx) => {
      // Create application record [创建申请记录]
      const [newApplication] = await tx
        .insert(jobApplications)
        .values({
          studentId: dto.studentId,
          jobId: dto.jobId, // External job ID for manually created applications [手工创建的申请使用外部岗位ID]
          jobLink: dto.jobLink, // Job link for quick access [岗位链接便于快速访问]
          applicationType: ApplicationType.REFERRAL,
          status: "mentor_assigned" as const,
          assignedMentorId: dto.mentorId,
          recommendedBy: '',
          recommendedAt: new Date(),
          submittedAt: dto.resumeSubmittedDate,
          updatedAt: new Date(),
        })
        .returning();

      this.logger.log(`Manual job application created: ${newApplication.id}`);

      // Record status change history [记录状态变更历史]
      await tx.insert(applicationHistory).values({
        applicationId: newApplication.id,
        previousStatus: null,
        newStatus: newApplication.status as ApplicationStatus,
        changedBy: dto.createdBy || null,
        changeReason: "Manual creation by counselor",
      });

      return newApplication;
    });

    // Publish application status changed event AFTER transaction (在事务后发布投递状态变更事件) [在事务成功后发布事件]
    // Event is published after transaction commits to ensure data consistency [事件在事务提交后发布以确保数据一致性]
    const eventPayload = {
      applicationId: application.id,
      previousStatus: null,
      newStatus: application.status,
      changedBy: dto.createdBy || null,
      changedAt: application.submittedAt.toISOString(),
      assignedMentorId: application.assignedMentorId,
    };
    this.eventEmitter.emit(JOB_APPLICATION_STATUS_CHANGED_EVENT, eventPayload);

    return {
      data: application,
      event: {
        type: JOB_APPLICATION_STATUS_CHANGED_EVENT,
        payload: eventPayload,
      },
    };
  }
}
