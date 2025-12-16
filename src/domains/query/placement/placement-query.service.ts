/**
 * Placement Query Service [岗位查询服务]
 * Handles job position query operations [处理岗位查询操作]
 */
import { Injectable, Logger, Inject } from '@nestjs/common';
import { eq, and, or, sql, desc, asc, getTableColumns } from 'drizzle-orm';
import { DATABASE_CONNECTION } from '@infrastructure/database/database.provider';
import { DrizzleDatabase } from '@shared/types/database.types';
import { recommendedJobs } from '@infrastructure/database/schema';
import { IJobQueryFilter, IPaginatedJobResults } from './dto/placement-query.dto';
import { IPaginationQuery, ISortQuery } from '@shared/types/pagination.types';

@Injectable()
export class PlacementQueryService {
  private readonly logger = new Logger(PlacementQueryService.name);

  constructor(
    @Inject(DATABASE_CONNECTION)
    private readonly db: DrizzleDatabase,
  ) {}

  /**
   * Query jobs with filters, pagination and sorting [带筛选、分页和排序的岗位查询]
   *
   * @param filter - Job query filter [岗位查询筛选条件]
   * @param pagination - Pagination parameters [分页参数]
   * @param sort - Sorting parameters [排序参数]
   * @returns Paginated job results [分页岗位结果]
   */
  async queryJobs(
    filter?: IJobQueryFilter,
    pagination?: IPaginationQuery,
    sort?: ISortQuery,
  ): Promise<IPaginatedJobResults> {
    this.logger.log(
      `Querying jobs with filter: ${JSON.stringify(filter)}, pagination: ${JSON.stringify(pagination)}, sort: ${JSON.stringify(sort)}`,
    );

    // Build query conditions [构建查询条件]
    const conditions = this.buildQueryConditions(filter);

    // Build main query [构建主查询]
    let query = this.db.select().from(recommendedJobs);

    // Apply conditions [应用筛选条件]
    if (conditions.length > 0) {
      query = query.where(and(...conditions)) as typeof query;
    }

    // Apply sorting [应用排序]
    if (sort && sort.field) {
      query = this.applySorting(query, sort);
    } else {
      // Default sort by postDate descending, with NULLs last [默认按发布日期降序排序，NULL值在最后]
      // Use SQL to handle NULL values properly [使用SQL正确处理NULL值]
      query = query.orderBy(sql`${recommendedJobs.postDate} DESC NULLS LAST`) as typeof query;
    }

    // Apply pagination [应用分页]
    const page = pagination?.page || 1;
    const pageSize = pagination?.pageSize || 20;
    const offset = (page - 1) * pageSize;
    const limit = pageSize;
    
    query = query.limit(limit).offset(offset) as typeof query;

    // Execute query [执行查询]
    const jobs = await query;

    // Get total count [获取总数]
    const countQuery = this.db
      .select({ count: sql`count(*)` })
      .from(recommendedJobs)
      .where(conditions.length > 0 ? and(...conditions) : undefined);

    const countResult = await countQuery;
    const total = Number(countResult[0]?.count || 0);
    const totalPages = Math.ceil(total / pageSize);

    this.logger.log(
      `Query completed: ${total} total jobs, ${jobs.length} jobs returned for page ${page} of ${totalPages}`,
    );

    return {
      items: jobs,
      total,
      page,
      pageSize,
      totalPages,
    };
  }

  /**
   * Build query conditions based on filter [根据筛选条件构建查询条件]
   *
   * @param filter - Job query filter [岗位查询筛选条件]
   * @returns Array of query conditions [查询条件数组]
   */
  private buildQueryConditions(filter?: IJobQueryFilter): any[] {
    const conditions: any[] = [];

    if (!filter) {
      // Filter is required, but if not provided, throw error [筛选条件是必填的，如果未提供则抛出错误]
      throw new Error('Job query filter is required, including jobApplicationType');
    }

    // Required: Job application type filter [必填：岗位投递类型筛选]
    // Validate jobApplicationType is provided [验证jobApplicationType已提供]
    if (!filter.jobApplicationType) {
      throw new Error('jobApplicationType is required in filter');
    }

    // Check if job_application_type array contains the requested type [检查job_application_type数组是否包含请求的类型]
    conditions.push(sql`${recommendedJobs.jobApplicationType} @> ARRAY[${filter.jobApplicationType}]::text[]`);

    // Status filter [状态筛选]
    if (filter.status) {
      conditions.push(eq(recommendedJobs.status, filter.status));
    } else {
      // Default: active status [默认：活跃状态]
      conditions.push(eq(recommendedJobs.status, 'active'));
    }

    // Location filter [地点筛选] - Single value [单值]
    if (filter.location) {
      // jobLocations is a JSONB array type [jobLocations是JSONB数组类型]
      // Check if jobLocations array contains the single location value [检查jobLocations数组是否包含单个地点值]
      // Use JSON.stringify to create JSONB array literal [使用JSON.stringify创建JSONB数组字面量]
      // Escape single quotes in JSON string to prevent SQL injection [转义JSON字符串中的单引号以防止SQL注入]
      const locationArrayJson = JSON.stringify([filter.location]);
      const escapedJson = locationArrayJson.replace(/'/g, "''");
      // Use sql.raw to directly inject the JSON string without parameter binding [使用sql.raw直接注入JSON字符串，避免参数绑定]
      conditions.push(
        sql`${recommendedJobs.jobLocations}::jsonb @> ${sql.raw(`'${escapedJson}'::jsonb`)}`,
      );
    }

    // Job type filter [职位类型筛选] - Single value [单值]
    if (filter.jobType) {
      // jobTypes is a text array type [jobTypes是text数组类型]
      // Check if jobTypes array contains the single job type value [检查jobTypes数组是否包含单个职位类型值]
      conditions.push(sql`${recommendedJobs.jobTypes} @> ARRAY[${filter.jobType}]::text[]`);
    }

    // Job titles filter [职位名称筛选]
    if (filter.jobTitles && filter.jobTitles.length > 0) {
      // normalizedJobTitles is a text array type [normalizedJobTitles是text数组类型]
      // For text arrays, use && operator directly [对于text数组，直接使用&&操作符]
      conditions.push(sql`${recommendedJobs.normalizedJobTitles} && ${filter.jobTitles}`);
    }

    // Keyword search (job title or company name) [关键词搜索（职位或公司名称）]
    if (filter.keyword) {
      const keyword = `%${filter.keyword}%`;
      conditions.push(
        or(
          sql`${recommendedJobs.title} ILIKE ${keyword}`,
          sql`${recommendedJobs.companyName} ILIKE ${keyword}`,
        ),
      );
    }

    // H1B filter [H1B筛选]
    if (filter.h1b) {
      conditions.push(eq(recommendedJobs.h1b, filter.h1b));
    }

    // US citizenship filter [美国公民身份筛选]
    if (filter.usCitizenship) {
      conditions.push(eq(recommendedJobs.usCitizenship, filter.usCitizenship));
    }

    // Level filter [级别筛选]
    if (filter.level) {
      conditions.push(eq(recommendedJobs.level, filter.level));
    }

    // Post date range filter [发布日期范围筛选]
    if (filter.postDateRange) {
      if (filter.postDateRange.start) {
        conditions.push(sql`${recommendedJobs.postDate} >= ${filter.postDateRange.start}`);
      }
      if (filter.postDateRange.end) {
        conditions.push(sql`${recommendedJobs.postDate} <= ${filter.postDateRange.end}`);
      }
    }

    return conditions;
  }

  /**
   * Apply sorting to query [对查询应用排序]
   *
   * @param query - Database query [数据库查询]
   * @param sort - Sorting parameters [排序参数]
   * @returns Updated query with sorting [带排序的更新查询]
   */
  private applySorting(query: any, sort: ISortQuery): any {
    // Get table columns [获取表列]
    const columns = getTableColumns(recommendedJobs);

    // Validate sort field exists in the schema [验证排序字段在schema中存在]
    if (!sort.field || !(sort.field in columns)) {
      // Invalid sort field, default to postDate descending [无效排序字段，默认按发布日期降序]
      return query.orderBy(sql`${recommendedJobs.postDate} DESC NULLS LAST`) as typeof query;
    }

    const column = columns[sort.field];

    // Handle postDate specially to ensure proper NULL handling [特殊处理postDate以确保正确处理NULL]
    if (sort.field === 'postDate') {
      if (sort.direction === 'asc') {
        return query.orderBy(sql`${recommendedJobs.postDate} ASC NULLS LAST`) as typeof query;
      } else {
        return query.orderBy(sql`${recommendedJobs.postDate} DESC NULLS LAST`) as typeof query;
      }
    }

    // For other columns, use the standard asc/desc functions [对于其他列，使用标准的asc/desc函数]
    if (sort.direction === 'asc') {
      // Use asc() function for ascending sort [使用asc()函数进行升序排序]
      return query.orderBy(asc(column)) as typeof query;
    } else {
      // Use desc() function for descending sort [使用desc()函数进行降序排序]
      return query.orderBy(desc(column)) as typeof query;
    }
  }
}