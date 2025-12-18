import { Injectable, Logger, Inject, NotFoundException, BadRequestException } from "@nestjs/common";
import { eq, and, sql, asc, desc } from "drizzle-orm";
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
import { JobStatus } from "@domains/placement/types";

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
  ): Promise<
    IServiceResult<typeof recommendedJobs.$inferSelect, Record<string, unknown>>
  > {
    this.logger.log(
      `Creating job position: ${dto.jobTitle} at ${dto.companyName}`,
    );

    // Create job position record [创建岗位记录]
    const values: Partial<typeof recommendedJobs.$inferInsert> = {
      title: dto.jobTitle,
      companyName: dto.companyName,
      status: dto.status || "active",
    };

    // Add optional fields [添加可选字段]
    if (dto.objectId) values.objectId = dto.objectId;
    if (dto.normJobTitles) values.normalizedJobTitles = dto.normJobTitles;
    if (dto.jobTypes) values.jobTypes = dto.jobTypes;
    if (dto.postDate) values.postDate = dto.postDate;
    if (dto.countryCode) values.countryCode = dto.countryCode;
    if (dto.locations) values.jobLocations = dto.locations;
    if (dto.experienceRequirement) values.experienceRequirement = dto.experienceRequirement;
    if (dto.salaryDetails) values.salaryDetails = dto.salaryDetails;
    if (dto.jobDescription) values.jobDescription = dto.jobDescription;
    if (dto.h1b) values.h1b = dto.h1b;
    if (dto.usCitizenship) values.usCitizenship = dto.usCitizenship;

    const [job] = await this.db
      .insert(recommendedJobs)
      .values(values as typeof recommendedJobs.$inferInsert)
      .returning();

    this.logger.log(`Job position created: ${job.id}`);

    return {
      data: job,
    };
  }

  /**
   * Find a job position [查找岗位]
   *
   * @param params - Query parameters [查询参数]
   * @returns Job position [岗位]
   */
  async findOne(params: { id?: string; title?: string; companyName?: string; status?: JobStatus }): Promise<Record<string, unknown>> {
    // Build conditions based on provided params
    const conditions = [];

    // Handle known columns explicitly
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
      conditions.push(eq(recommendedJobs.status, params.status));
    }

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
    items: Record<string, unknown>[];
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
      
      // Add more filter conditions as needed
      if (filter.locations && filter.locations.length > 0) {
        // Filter by locations
        conditions.push(sql`${recommendedJobs.jobLocations} && ${filter.locations}`);
      }
    } else {
      // Default to active status if no filter provided
      conditions.push(eq(recommendedJobs.status, "active"));
    }

    // Build query with dynamic conditions [构建动态条件查询]
    let query = this.db.select().from(recommendedJobs);

    // Apply conditions if any
    if (conditions.length > 0) {
      query = query.where(and(...conditions)) as typeof query;
    }

    // Apply sorting if provided
    if (sort?.field) {
      const sortableColumnMap = {
        id: recommendedJobs.id,
        jobId: recommendedJobs.jobId,
        status: recommendedJobs.status,
        title: recommendedJobs.title,
        companyName: recommendedJobs.companyName,
        postDate: recommendedJobs.postDate,
        createdAt: recommendedJobs.createdAt,
        updatedAt: recommendedJobs.updatedAt,
      } as const;

      type SortField = keyof typeof sortableColumnMap;
      const isSortField = (field: string): field is SortField =>
        Object.prototype.hasOwnProperty.call(sortableColumnMap, field);

      if (isSortField(sort.field)) {
        const sortFn = sort.direction === "desc" ? desc : asc;
        query = query.orderBy(sortFn(sortableColumnMap[sort.field])) as typeof query;
      }
    }

    // Pagination [分页]
    const page = pagination?.page || 1;
    const pageSize = pagination?.pageSize || 20;
    const offset = (page - 1) * pageSize;
    const limit = pageSize;
    const jobs = await query.limit(limit).offset(offset);

    // Get total count [获取总数]
    const countQuery = this.db
      .select({ count: sql<number>`count(*)` })
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
  ): Promise<IServiceResult<Record<string, unknown>, Record<string, unknown>>> {
    this.logger.log(`Marking job position as expired: ${dto.jobId}`);

    // Check if job exists [检查岗位是否存在]
    const job = await this.findOne({ id: dto.jobId });

    if (job.status === "expired") {
      throw new BadRequestException(`Job position is already expired: ${dto.jobId}`);
    }

    // Update job status [更新岗位状态]
    const [updatedJob] = await this.db
      .update(recommendedJobs)
      .set({
        status: "expired",
        updatedAt: new Date(),
      })
      .where(eq(recommendedJobs.id, dto.jobId)) // Changed from Number(dto.jobId) to dto.jobId [从Number(dto.jobId)改为dto.jobId]
      .returning();

    this.logger.log(`Job position marked as expired: ${dto.jobId}`);

    return {
      data: updatedJob,
    };
  }
}
