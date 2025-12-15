import {
  Injectable,
  Logger,
  Inject,
  NotFoundException,
  BadRequestException,
} from "@nestjs/common";
import { eq, and, sql, desc, asc, getTableColumns } from "drizzle-orm";
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
} from "../events";
import {
  ISubmitApplicationDto,
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

    // Verify job exists [验证岗位存在]
    const job = await this.db
      .select()
      .from(recommendedJobs)
      .where(eq(recommendedJobs.id, dto.jobId));
    if (job.length === 0) {
      throw new NotFoundException(`Job position not found: ${dto.jobId}`);
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
          customAnswers: dto.customAnswers,
          status:
            dto.applicationType === ApplicationType.REFERRAL
              ? "recommended"
              : "submitted",
          isUrgent: dto.isUrgent || false,
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

    return {
      data: application,
      event: {
        type: JOB_APPLICATION_STATUS_CHANGED_EVENT,
        payload: eventPayload,
      },
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
    }

    // ✅ 新增：导师评估场景验证
    if (previousStatus === 'mentor_assigned' && dto.newStatus === 'submitted') {
      const mentorId = dto.mentorId as string | undefined;
      
      if (!mentorId) {
        throw new BadRequestException(
          'mentorId is required for mentor screening',
        );
      }

      // Security check: verify mentor is assigned [安全检查：验证导师已分配]
      if (application.assignedMentorId !== mentorId) {
        throw new BadRequestException(
          `Only the assigned mentor (${application.assignedMentorId}) can submit screening results. Provided: ${mentorId}`,
        );
      }

      // Validate screening result exists [验证评估结果存在]
      if (!dto.changeMetadata?.screeningResult) {
        throw new BadRequestException(
          'screeningResult is required in changeMetadata for mentor screening',
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
      // Update application status [更新申请状态]
      const [app] = await tx
        .update(jobApplications)
        .set({
          status: dto.newStatus,
          result: this.getResultFromStatus(dto.newStatus),
          // [新增] Record mentor assignment for referral applications [记录推荐申请的导师分配]
          assignedMentorId: dto.mentorId || null,
          // [新增] Update update timestamp [更新时间戳]
          updatedAt: new Date(),
        })
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
      ...(dto.mentorId && { assignedMentorId: dto.mentorId }),
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

      // [新增] Filter by assigned mentor [按分配的导师筛选]
      if (filter.assignedMentorId) {
        conditions.push(
          eq(jobApplications.assignedMentorId, filter.assignedMentorId),
        );
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
   * Get result from status [从状态获取结果]
   *
   * @param status - Application status [申请状态]
   * @returns Result or null [结果或null]
   */
  private getResultFromStatus(status: ApplicationStatus): "rejected" | null {
    const resultStatuses: ApplicationStatus[] = ["rejected"];
    return resultStatuses.includes(status) ? (status as "rejected") : null;
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

    // Get status history [获取状态历史]
    const statusHistory = await this.db
      .select()
      .from(applicationHistory)
      .where(eq(applicationHistory.applicationId, dto.applicationId))
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

    // Wrap all operations in a transaction to ensure atomicity [将所有操作包裹在事务中以确保原子性]
    const updatedApplication = await this.db.transaction(async (tx) => {
      // Update application status [更新申请状态]
      const [app] = await tx
        .update(jobApplications)
        .set({
          status: previousStatus,
          result: this.getResultFromStatus(previousStatus),
          // [新增] Record mentor assignment for referral applications [记录推荐申请的导师分配]
          assignedMentorId: dto.mentorId || null,
          // [新增] Update update timestamp [更新时间戳]
          updatedAt: new Date(),
        })
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
