import { Inject, Injectable } from '@nestjs/common';
import { eq, and, sql, desc, getTableColumns, or } from 'drizzle-orm';
import { DrizzleDatabase } from '@shared/types/database.types';
import { DATABASE_CONNECTION } from '@infrastructure/database/database.provider';
import * as schema from '@infrastructure/database/schema';
import { IJobQueryFilter, IPaginatedJobResults } from '@domains/query/placement/dto/placement-query.dto';
import { IPaginationQuery, ISortQuery } from '@shared/types/pagination.types';

export interface QueryJobsInput {
  filter?: IJobQueryFilter;
  pagination?: IPaginationQuery;
  sort?: ISortQuery;
}

@Injectable()
export class QueryJobsQuery {
  constructor(
    @Inject(DATABASE_CONNECTION)
    private readonly db: DrizzleDatabase,
  ) {}

  /**
   * Query jobs with filters, pagination and sorting [带筛选、分页和排序的岗位查询]
   *
   * @param input - Query input containing filter, pagination and sort [查询输入，包含筛选、分页和排序]
   * @returns Paginated job results [分页岗位结果]
   */
  async execute(input: QueryJobsInput): Promise<IPaginatedJobResults> {
    const { filter, pagination, sort } = input;

    // Build query conditions [构建查询条件]
    const conditions = this.buildQueryConditions(filter);

    // Build main query [构建主查询]
    let query = this.db.select().from(schema.recommendedJobs);

    // Apply conditions [应用筛选条件]
    if (conditions.length > 0) {
      query = query.where(and(...conditions)) as typeof query;
    }

    // Apply sorting [应用排序]
    if (sort && sort.field) {
      query = this.applySorting(query, sort);
    } else {
      // Default sort by postDate descending, with NULLs last [默认按发布日期降序排序，NULL值在最后]
      query = query.orderBy(sql`${schema.recommendedJobs.postDate} DESC NULLS LAST`) as typeof query;
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
      .select({ count: sql<number>`count(*)` })
      .from(schema.recommendedJobs)
      .where(conditions.length > 0 ? and(...conditions) : undefined);

    const countResult = await countQuery;
    const total = Number(countResult[0]?.count || 0);
    const totalPages = Math.ceil(total / pageSize);

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
      return conditions;
    }

    // Filter by status [按状态筛选]
    if (filter.status) {
      conditions.push(eq(schema.recommendedJobs.status, filter.status));
    } else {
      // Default to active status [默认为active状态]
      conditions.push(eq(schema.recommendedJobs.status, 'active'));
    }

    // Filter by title/company (case-insensitive) [按标题/公司筛选（不区分大小写）]
    if (filter.keyword) {
      conditions.push(
        or(
          sql`${schema.recommendedJobs.title} ILIKE ${`%${filter.keyword}%`}`,
          sql`${schema.recommendedJobs.companyName} ILIKE ${`%${filter.keyword}%`}`,
        ),
      );
    }

    // Filter by company name [按公司名称筛选] - Not in interface, skip
    // 按公司名称筛选 - 不在接口中，跳过

    // Filter by location [按地点筛选]
    if (filter.location) {
      conditions.push(
        sql`${schema.recommendedJobs.jobLocations}::text ILIKE ${`%${filter.location}%`}`,
      );
    }

    // Filter by minimum salary [按最低薪资筛选] - Not in interface, skip
    // 按最低薪资筛选 - 不在接口中，跳过

    // Filter by experience level [按经验级别筛选] - Not in interface, skip
    // 按经验级别筛选 - 不在接口中，跳过

    // Filter by job type [按职位类型筛选]
    if (filter.jobType) {
      conditions.push(
        sql`${schema.recommendedJobs.jobTypes}::jsonb @> ${JSON.stringify([filter.jobType])}`,
      );
    }

    // Filter by experience tags [按经验标签筛选] - Not in interface, skip
    // 按经验标签筛选 - 不在接口中，跳过

    // Filter by work mode tags [按工作模式标签筛选] - Not in interface, skip
    // 按工作模式标签筛选 - 不在接口中，跳过

    // Filter by visa sponsorship [按签证担保筛选]
    if (filter.h1b !== undefined) {
      conditions.push(eq(schema.recommendedJobs.h1b, filter.h1b));
    }
    if (filter.usCitizenship !== undefined) {
      conditions.push(eq(schema.recommendedJobs.usCitizenship, filter.usCitizenship));
    }

    return conditions;
  }

  /**
   * Apply sorting to query [对查询应用排序]
   *
   * @param query - Current query [当前查询]
   * @param sort - Sorting parameters [排序参数]
   * @returns Query with sorting applied [已应用排序的查询]
   */
  private applySorting(
    query: any,
    sort: ISortQuery,
  ): any {
    const { field, direction = 'desc' } = sort;

    const columns = getTableColumns(schema.recommendedJobs);
    const sortableColumns = Object.keys(columns);

    if (sortableColumns.includes(field)) {
      const column = columns[field as keyof typeof columns];
      if (direction === 'asc') {
        return query.orderBy(sql`${column} ASC`);
      }
      return query.orderBy(sql`${column} DESC`);
    }

    // If sort field is not found, apply default sorting [如果未找到排序字段，应用默认排序]
    return query.orderBy(sql`${schema.recommendedJobs.postDate} DESC NULLS LAST`);
  }
}
