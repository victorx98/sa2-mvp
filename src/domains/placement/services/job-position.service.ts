import { Injectable, Logger, Inject, NotFoundException } from "@nestjs/common";
import { eq, and, sql } from "drizzle-orm";
import { DATABASE_CONNECTION } from "@infrastructure/database/database.provider";
import { DrizzleDatabase } from "@shared/types/database.types";
import { recommendedJobs } from "@infrastructure/database/schema";
import {
  JOB_POSITION_CREATED_EVENT,
  JOB_POSITION_STATUS_CHANGED_EVENT,
  JOB_POSITION_EXPIRED_EVENT,
  JobPositionCreatedEvent,
  JobPositionStatusChangedEvent,
  JobPositionExpiredEvent,
} from "../events";
import { ICreateJobPositionDto, ISearchJobPositionsDto, IMarkJobExpiredDto } from "../dto";
import { IServiceResult } from "../interfaces";

/**
 * Job Position Service [岗位服务]
 * Handles job position lifecycle management [处理岗位生命周期管理]
 */
@Injectable()
export class JobPositionService {
  private readonly logger = new Logger(JobPositionService.name);

  constructor(
    @Inject(DATABASE_CONNECTION)
    private readonly db: DrizzleDatabase,
  ) {}

  /**
   * Create a new job position [创建新岗位]
   *
   * @param dto - Create job position DTO [创建岗位DTO]
   * @returns Created job position [创建的岗位]
   */
  async createJobPosition(
    dto: ICreateJobPositionDto,
  ): Promise<IServiceResult<Record<string, any>, Record<string, any>>> {
    this.logger.log(`Creating job position: ${dto.title} at ${dto.companyName}`);

    // Create job position record [创建岗位记录]
    const values: any = {
      title: dto.title,
      companyName: dto.companyName,
      source: dto.source,
      jobSource: dto.jobSource,
      status: "active",
      viewCount: 0,
      applicationCount: 0,
    };

    // Add optional fields [添加可选字段]
    if (dto.description) values.description = dto.description;
    if (dto.requirements) values.requirements = dto.requirements;
    if (dto.responsibilities) values.responsibilities = dto.responsibilities;
    if (dto.jobType) values.jobType = dto.jobType;
    if (dto.experienceLevel) values.experienceLevel = dto.experienceLevel;
    if (dto.industry) values.industry = dto.industry;
    if (dto.locations) values.locations = dto.locations;
    if (dto.remoteType) values.remoteType = dto.remoteType;
    if (dto.salaryMin !== undefined) values.salaryMin = dto.salaryMin;
    if (dto.salaryMax !== undefined) values.salaryMax = dto.salaryMax;
    if (dto.salaryCurrency) values.salaryCurrency = dto.salaryCurrency;
    if (dto.postedDate) values.postedDate = dto.postedDate;
    if (dto.expiryDate) values.expiryDate = dto.expiryDate;
    if (dto.sourceUrl) values.sourceUrl = dto.sourceUrl;
    if (dto.sourceJobId) values.sourceJobId = dto.sourceJobId;
    if (dto.aiAnalysis) values.aiAnalysis = dto.aiAnalysis;
    if (dto.qualityScore !== undefined) values.qualityScore = dto.qualityScore;

    const [job] = await this.db.insert(recommendedJobs).values(values).returning();

    this.logger.log(`Job position created: ${job.id}`);

    // Build and return event [构建并返回事件]
    const event: JobPositionCreatedEvent = {
      positionId: job.id,
      title: job.title,
      companyName: job.companyName,
      jobSource: job.jobSource as "web" | "bd",
      locations: job.locations ? (job.locations as any) : [],
      aiAnalysis: job.aiAnalysis,
      createdBy: dto.createdBy,
      createdAt: job.createdAt.toISOString(),
    };

    return {
      data: job,
      event: { type: JOB_POSITION_CREATED_EVENT, payload: event },
    };
  }

  /**
   * Find a job position by ID [根据ID查找岗位]
   *
   * @param id - Job position ID [岗位ID]
   * @returns Job position [岗位]
   */
  async findOneById(id: string) {
    const [job] = await this.db.select().from(recommendedJobs).where(eq(recommendedJobs.id, id));

    if (!job) {
      throw new NotFoundException(`Job position not found: ${id}`);
    }

    return job;
  }

  /**
   * Search job positions [搜索岗位]
   *
   * @param dto - Search criteria [搜索条件]
   * @returns Paginated job positions [分页岗位列表]
   */
  async search(dto: ISearchJobPositionsDto): Promise<{ items: Record<string, any>[]; total: number; offset: number; limit: number }> {
    this.logger.log(`Searching job positions with criteria: ${JSON.stringify(dto)}`);

    const conditions = [];

    if (dto.status) {
      conditions.push(eq(recommendedJobs.status, dto.status));
    } else {
      // Default to active status [默认查询活跃状态]
      conditions.push(eq(recommendedJobs.status, "active"));
    }

    if (dto.companyName) {
      conditions.push(sql`${recommendedJobs.companyName} ILIKE ${`%${dto.companyName}%`}`);
    }

    if (dto.jobType) {
      conditions.push(eq(recommendedJobs.jobType, dto.jobType));
    }

    if (dto.experienceLevel) {
      conditions.push(eq(recommendedJobs.experienceLevel, dto.experienceLevel));
    }

    if (dto.industry) {
      conditions.push(eq(recommendedJobs.industry, dto.industry));
    }

    // Build query with dynamic conditions [构建动态条件查询]
    let query: any = this.db.select().from(recommendedJobs);
    if (conditions.length > 0) {
      query = query.where(and(...conditions));
    }

    // Pagination [分页]
    const offset = dto.offset || 0;
    const limit = dto.limit || 20;
    query = query.limit(limit).offset(offset);

    const jobs = await query;

    // Get total count [获取总数]
    const countQuery = this.db
      .select({ count: sql`count(*)` })
      .from(recommendedJobs)
      .where(and(...conditions));

    const countResult = await countQuery;
    const count = countResult[0]?.count || 0;

    return {
      items: jobs,
      total: Number(count),
      offset,
      limit,
    };
  }

  /**
   * Mark a job position as expired [标记岗位过期]
   *
   * @param dto - Mark job expired DTO [标记过期DTO]
   * @returns Updated job position and events [更新的岗位和事件]
   */
  async markJobExpired(
    dto: IMarkJobExpiredDto,
  ): Promise<IServiceResult<Record<string, any>, Record<string, any>>> {
    this.logger.log(`Marking job position as expired: ${dto.jobId}`);

    // Check if job exists [检查岗位是否存在]
    const job = await this.findOneById(dto.jobId);

    if (job.status === "expired") {
      throw new Error(`Job position is already expired: ${dto.jobId}`);
    }

    // Update job status [更新岗位状态]
    const [updatedJob] = await this.db
      .update(recommendedJobs)
      .set({
        status: "expired",
        updatedAt: new Date(),
      })
      .where(eq(recommendedJobs.id, dto.jobId))
      .returning();

    this.logger.log(`Job position marked as expired: ${dto.jobId}`);

    // Build events [构建事件]
    const statusChangedEvent: JobPositionStatusChangedEvent = {
      positionId: dto.jobId,
      previousStatus: job.status as "active" | "inactive" | "expired",
      newStatus: "expired",
      changedBy: dto.expiredBy,
      changedAt: new Date().toISOString(),
      changeReason: dto.reason,
    };

    const expiredEvent: JobPositionExpiredEvent = {
      positionId: dto.jobId,
      expiredBy: dto.expiredBy,
      expiredByType: dto.expiredByType,
      expiredAt: new Date().toISOString(),
      reason: dto.reason,
    };

    return {
      data: updatedJob,
      events: [
        { type: JOB_POSITION_STATUS_CHANGED_EVENT, payload: statusChangedEvent },
        { type: JOB_POSITION_EXPIRED_EVENT, payload: expiredEvent },
      ],
    };
  }

  /**
   * Update job view count [更新岗位查看次数]
   *
   * @param jobId - Job position ID [岗位ID]
   */
  async incrementViewCount(jobId: string) {
    await this.db
      .update(recommendedJobs)
      .set({
        viewCount: sql`${recommendedJobs.viewCount} + 1`,
      })
      .where(eq(recommendedJobs.id, jobId));
  }

  /**
   * Update job application count [更新岗位申请次数]
   *
   * @param jobId - Job position ID [岗位ID]
   */
  async incrementApplicationCount(jobId: string) {
    await this.db
      .update(recommendedJobs)
      .set({
        applicationCount: sql`${recommendedJobs.applicationCount} + 1`,
      })
      .where(eq(recommendedJobs.id, jobId));
  }
}
