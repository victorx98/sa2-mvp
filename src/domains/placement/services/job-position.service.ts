import { Injectable, Logger, Inject, NotFoundException } from "@nestjs/common";
import { eq, and, sql } from "drizzle-orm";
import { DATABASE_CONNECTION } from "@infrastructure/database/database.provider";
import { DrizzleDatabase } from "@shared/types/database.types";
import { recommendedJobs } from "@infrastructure/database/schema";
import {
  ICreateJobPositionDto,
  IMarkJobExpiredDto,
  IJobPositionSearchFilter,
} from "../dto";
import { IServiceResult } from "../interfaces";
import { IPaginationQuery, ISortQuery } from "@shared/types/pagination.types";

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
    this.logger.log(
      `Creating job position: ${dto.title} at ${dto.companyName}`,
    );

    // Create job position record [创建岗位记录]
    const values: any = {
      title: dto.title,
      companyName: dto.companyName,
      companyNameNormalized: dto.companyName.toLowerCase(), // Normalize company name [标准化公司名称]
      source: dto.source,
      status: "active",
      createdBy: dto.createdBy,
      updatedBy: dto.createdBy,
    };

    // Add optional fields [添加可选字段]
    if (dto.description) values.description = dto.description;
    if (dto.responsibilities) values.responsibilities = dto.responsibilities;
    if (dto.jobType) values.jobType = dto.jobType;
    if (dto.experienceLevel) values.experienceLevel = dto.experienceLevel;
    if (dto.industry) values.industry = dto.industry;
    if (dto.remoteType) values.remoteType = dto.remoteType;
    if (dto.sourceUrl) values.sourceUrl = dto.sourceUrl;
    if (dto.sourceJobId) values.externalId = dto.sourceJobId; // Map sourceJobId to externalId [将sourceJobId映射到externalId]
    // Map locations array to single location string [将地点数组映射为单个地点字符串]
    if (dto.locations && dto.locations.length > 0) {
      values.location = dto.locations
        .map((loc) => loc.name || loc.city || "")
        .filter(Boolean)
        .join(", ");
    }
    // Map salaryMin, salaryMax, salaryCurrency to salaryRange string [将salaryMin, salaryMax, salaryCurrency映射为salaryRange字符串]
    if (
      dto.salaryMin !== undefined &&
      dto.salaryMax !== undefined &&
      dto.salaryCurrency
    ) {
      values.salaryRange = `${dto.salaryMin} - ${dto.salaryMax} ${dto.salaryCurrency}`;
    } else if (dto.salaryMin !== undefined && dto.salaryCurrency) {
      values.salaryRange = `${dto.salaryMin}+ ${dto.salaryCurrency}`;
    } else if (dto.salaryMax !== undefined && dto.salaryCurrency) {
      values.salaryRange = `Up to ${dto.salaryMax} ${dto.salaryCurrency}`;
    }
    // Map requirements object to array [将requirements对象映射为数组]
    if (dto.requirements) {
      // Extract skills array if available, otherwise use empty array
      values.requirements = Array.isArray(dto.requirements)
        ? dto.requirements
        : dto.requirements.skills
          ? dto.requirements.skills
          : [];
    }
    // Initialize empty arrays for array fields to avoid null errors
    values.benefits = [];
    values.skillsRequired = [];

    const [job] = await this.db
      .insert(recommendedJobs)
      .values(values)
      .returning();

    this.logger.log(`Job position created: ${job.id}`);

    return {
      data: job,
    };
  }

  /**
   * Find a job position [查找岗位]
   *
   * @param params - Search parameters [搜索参数]
   * @returns Job position [岗位]
   */
  async findOne(params: {
    id?: string;
    title?: string;
    companyName?: string;
    status?: string;
    [key: string]: any;
  }) {
    // Build conditions based on provided params
    const conditions = [];

    // Handle known columns explicitly to avoid TypeScript errors
    if (params.id) {
      conditions.push(eq(recommendedJobs.id, params.id));
    }
    if (params.title) {
      conditions.push(eq(recommendedJobs.title, params.title));
    }
    if (params.companyName) {
      conditions.push(eq(recommendedJobs.companyName, params.companyName));
    }
    if (params.status) {
      // Use type assertion for enum column to avoid TypeScript error
      conditions.push(eq(recommendedJobs.status, params.status as any));
    }
    // Add more known columns as needed

    const [job] = await this.db
      .select()
      .from(recommendedJobs)
      .where(and(...conditions));

    if (!job) {
      throw new NotFoundException(
        `Job position not found: ${JSON.stringify(params)}`,
      );
    }

    return job;
  }

  /**
   * Search job positions [搜索岗位]
   *
   * @param filter - Search filter criteria [搜索筛选条件]
   * @param pagination - Pagination parameters [分页参数]
   * @param sort - Sorting parameters [排序参数]
   * @returns Paginated job positions [分页岗位列表]
   */
  async search(
    filter?: IJobPositionSearchFilter,
    pagination?: IPaginationQuery,
    sort?: ISortQuery,
  ): Promise<{
    items: Record<string, any>[];
    total: number;
    offset: number;
    limit: number;
  }> {
    this.logger.log(
      `Searching job positions with filter: ${JSON.stringify(filter)}, pagination: ${JSON.stringify(pagination)}, sort: ${JSON.stringify(sort)}`,
    );

    const conditions = [];

    // Build conditions based on filter criteria
    if (filter) {
      if (filter.status) {
        conditions.push(eq(recommendedJobs.status, filter.status));
      } else {
        // Default to active status [默认查询活跃状态]
        conditions.push(eq(recommendedJobs.status, "active"));
      }

      if (filter.companyName) {
        conditions.push(
          sql`${recommendedJobs.companyName} ILIKE ${`%${filter.companyName}%`}`,
        );
      }

      if (filter.jobType) {
        conditions.push(eq(recommendedJobs.jobType, filter.jobType));
      }

      if (filter.experienceLevel) {
        conditions.push(
          eq(recommendedJobs.experienceLevel, filter.experienceLevel),
        );
      }

      if (filter.industry) {
        conditions.push(eq(recommendedJobs.industry, filter.industry));
      }
      // Add more filter conditions as needed
    } else {
      // Default to active status if no filter provided
      conditions.push(eq(recommendedJobs.status, "active"));
    }

    // Build query with dynamic conditions [构建动态条件查询]
    let query: any = this.db.select().from(recommendedJobs);
    if (conditions.length > 0) {
      query = query.where(and(...conditions));
    }

    // Apply sorting if provided
    if (
      sort &&
      sort.field &&
      recommendedJobs[sort.field as keyof typeof recommendedJobs]
    ) {
      const direction = sort.direction === "desc" ? sql`desc` : sql`asc`;
      query = query.orderBy(
        sql`${recommendedJobs[sort.field as keyof typeof recommendedJobs]} ${direction}`,
      );
    }

    // Pagination [分页]
    const page = pagination?.page || 1;
    const pageSize = pagination?.pageSize || 20;
    const offset = (page - 1) * pageSize;
    const limit = pageSize;
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
    const job = await this.findOne({ id: dto.jobId });

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

    return {
      data: updatedJob,
    };
  }
}
