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
} from "../events";
import type { IPlacementApplicationSubmittedPayload } from "../events";
import {
  ISubmitApplicationDto,
  IRecommendReferralApplicationsBatchDto,
  IUpdateApplicationStatusDto,
  IJobApplicationSearchFilter,
  IRollbackApplicationStatusDto,
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

    // Check for duplicate application [检查重复申请]
    await this.checkDuplicateApplication(dto.studentId, dto.jobId);

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

    // Wrap all operations in a transaction to ensure atomicity [将所有操作包裹在事务中以确保原子性]
    const application = await this.db.transaction(async (tx) => {
      // Create application record [创建申请记录]
      const [newApplication] = await tx
        .insert(jobApplications)
        .values({
          studentId: dto.studentId,
          jobId: dto.jobId,
          applicationType: dto.applicationType,
          coverLetter: dto.coverLetter,
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
        newStatus: newApplication.status,
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
      const submittedPayload: IPlacementApplicationSubmittedPayload = {
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

    const studentIds = Array.from(new Set(dto.studentIds ?? []));
    const jobIds = Array.from(new Set(dto.jobIds ?? []));

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
      .select({ id: recommendedJobs.id, status: recommendedJobs.status })
      .from(recommendedJobs)
      .where(and(inArray(recommendedJobs.id, jobIds), eq(recommendedJobs.status, "active")));

    const foundJobIdSet = new Set(jobs.map((j) => j.id));
    const missingJobIds = jobIds.filter((id) => !foundJobIdSet.has(id));
    if (missingJobIds.length > 0) {
      throw new BadRequestException(
        `Some jobs are missing or not active: ${missingJobIds.slice(0, 10).join(", ")}`,
      );
    }

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
          pairs.map((p) => ({
            studentId: p.studentId,
            jobId: p.jobId,
            applicationType: ApplicationType.REFERRAL,
            status: "recommended" as const,
            recommendedBy: dto.recommendedBy, // Set recommended_by field [设置推荐人字段]
            recommendedAt: recommendedAt, // Set recommended_at field [设置推荐时间字段]
          })),
        )
        .returning();

      await tx.insert(applicationHistory).values(
        inserted.map((app) => ({
          applicationId: app.id,
          previousStatus: null,
          newStatus: app.status,
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

    // ✅ 新增：分配导师场景验证
    if (dto.newStatus === 'mentor_assigned') {
      const mentorId = dto.mentorId as string | undefined;
      if (!mentorId) {
        throw new BadRequestException(
          'mentorId is required when assigning mentor',
        );
      }

      // Business rule: mentor assignment is only valid for referral applications [业务规则：仅内推申请允许分配导师]
      if (application.applicationType !== "referral") {
        throw new BadRequestException(
          "mentor_assigned is only allowed for referral applications",
        );
      }
    }

    // Mentor handoff -> submission validation [导师交接 -> 已提交校验]
    // - The API may choose not to send mentorId/screeningResult for status-only updates [API 可能仅做状态更新，不传 mentorId/评估结果]
    // - When mentorId is omitted, we infer it from assignedMentorId [未传 mentorId 时从 assignedMentorId 推导]
    if (previousStatus === "mentor_assigned" && dto.newStatus === "submitted") {
      const effectiveMentorId =
        (dto.mentorId as string | undefined) ?? application.assignedMentorId;

      if (!effectiveMentorId) {
        throw new BadRequestException(
          "assignedMentorId is required when submitting after mentor assignment",
        );
      }

      // Security check: verify mentor is assigned when mentorId is explicitly provided [当显式传 mentorId 时校验其必须为已分配导师]
      if (dto.mentorId && application.assignedMentorId !== dto.mentorId) {
        throw new BadRequestException(
          `Only the assigned mentor (${application.assignedMentorId}) can submit screening results. Provided: ${dto.mentorId}`,
        );
      }
    }

    // Validate status transition [验证状态转换]
    const allowedTransitions =
      ALLOWED_APPLICATION_STATUS_TRANSITIONS[previousStatus];
    if (!allowedTransitions || !allowedTransitions.includes(dto.newStatus)) {
      throw new BadRequestException(
        `Invalid status transition: ${previousStatus} -> ${dto.newStatus}`,
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
        status: dto.newStatus,
        updatedAt: new Date(),
      };

      // Only update assignedMentorId when explicitly provided [仅在显式提供时更新assignedMentorId]
      if (dto.newStatus === "mentor_assigned") {
        // mentor_assigned status requires mentorId [mentor_assigned状态需要mentorId]
        updateData.assignedMentorId = dto.mentorId as string;
      } else if (dto.mentorId !== undefined) {
        // Other statuses: only update if mentorId is explicitly provided [其他状态：仅在显式提供mentorId时更新]
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
        previousStatus,
        newStatus: dto.newStatus,
        changedBy: dto.changedBy,
        changeReason: dto.changeReason,
        changeMetadata: dto.changeMetadata,
      });

      return app;
    });

    this.logger.log(`Application status updated: ${dto.applicationId}`);

    // Publish status changed event AFTER transaction (在事务后发布状态变更事件) [在事务成功后发布事件]
    // Event is published after transaction commits to ensure data consistency [事件在事务提交后发布以确保数据一致性]
    const eventPayload = {
      applicationId: updatedApplication.id,
      previousStatus: previousStatus,
      newStatus: dto.newStatus as ApplicationStatus,
      changedBy: dto.changedBy,
      changedAt: new Date().toISOString(),
      changeMetadata: dto.changeMetadata,
      // [新增] Include mentor assignment in event payload [在事件payload中包含导师分配]
      ...(updatedApplication.assignedMentorId && {
        assignedMentorId: updatedApplication.assignedMentorId,
      }),
    };
    this.eventEmitter.emit(JOB_APPLICATION_STATUS_CHANGED_EVENT, eventPayload);

    if (dto.newStatus === "submitted") {
      const [job] = await this.db
        .select({ title: recommendedJobs.title })
        .from(recommendedJobs)
        .where(eq(recommendedJobs.id, application.jobId));

      const providerCandidate =
        dto.mentorId ??
        updatedApplication.assignedMentorId ??
        application.recommendedBy ??
        dto.changedBy ??
        updatedApplication.studentId;

      const submittedPayload: IPlacementApplicationSubmittedPayload = {
        id: updatedApplication.id,
        service_type: "job_application",
        student_user_id: updatedApplication.studentId,
        provider_user_id: this.isUuid(providerCandidate)
          ? providerCandidate
          : updatedApplication.studentId,
        consumed_units: 1,
        unit_type: "count",
        completed_time: updatedApplication.updatedAt,
        title: job?.title ?? undefined,
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
        conditions.push(eq(jobApplications.status, filter.status));
      }

      if (filter.applicationType) {
        conditions.push(
          eq(jobApplications.applicationType, filter.applicationType),
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
   * @param params - Search parameters [搜索参数]
   * @returns Application [投递申请]
   */
  async findOne(params: {
    id?: string;
    studentId?: string;
    jobId?: string;
    status?: string;
    applicationType?: ApplicationType;
    [key: string]: unknown;
  }): Promise<Record<string, unknown>> {
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
      conditions.push(
        eq(jobApplications.status, params.status as ApplicationStatus),
      );
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
}
