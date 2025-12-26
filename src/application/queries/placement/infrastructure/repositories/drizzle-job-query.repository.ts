/**
 * Drizzle Job Query Repository Implementation
 * 基于 Drizzle 的岗位查询仓储实现
 * 
 * Infrastructure layer implements the repository interface
 * Handles all SQL queries and data mapping
 */
import { Inject, Injectable } from '@nestjs/common';
import { eq, and, sql, getTableColumns, or } from 'drizzle-orm';
import { DrizzleDatabase } from '@shared/types/database.types';
import { DATABASE_CONNECTION } from '@infrastructure/database/database.provider';
import * as schema from '@infrastructure/database/schema';
import { IPaginatedResult } from '@shared/types/paginated-result';
import { IJobQueryRepository } from '../../interfaces/job-query.repository.interface';
import { JobReadModel } from '../../models/job-read.model';
import { QueryJobsDto } from '../../dto/query-jobs.dto';

@Injectable()
export class DrizzleJobQueryRepository implements IJobQueryRepository {
  constructor(
    @Inject(DATABASE_CONNECTION)
    private readonly db: DrizzleDatabase,
  ) {}

  /**
   * Query jobs with filters, pagination and sorting
   */
  async queryJobs(dto: QueryJobsDto): Promise<IPaginatedResult<JobReadModel>> {
    const { filter, pagination, sort } = dto;

    // Build query conditions
    const conditions = this.buildQueryConditions(filter);

    // Build main query
    let query = this.db.select().from(schema.recommendedJobs);

    // Apply conditions
    if (conditions.length > 0) {
      query = query.where(and(...conditions)) as typeof query;
    }

    // Apply sorting
    if (sort && sort.field) {
      query = this.applySorting(query, sort);
    } else {
      // Default sort by postDate descending, with NULLs last
      query = query.orderBy(sql`${schema.recommendedJobs.postDate} DESC NULLS LAST`) as typeof query;
    }

    // Apply pagination
    const page = pagination?.page || 1;
    const pageSize = pagination?.pageSize || 20;
    const offset = (page - 1) * pageSize;
    const limit = pageSize;

    query = query.limit(limit).offset(offset) as typeof query;

    // Execute query
    const jobs = await query;

    // Get total count
    const countQuery = this.db
      .select({ count: sql<number>`count(*)` })
      .from(schema.recommendedJobs)
      .where(conditions.length > 0 ? and(...conditions) : undefined);

    const countResult = await countQuery;
    const total = Number(countResult[0]?.count || 0);
    const totalPages = total === 0 ? 1 : Math.ceil(total / pageSize);

    // Map to Read Model
    const data: JobReadModel[] = jobs.map((job) => ({
      id: job.id,
      title: job.title,
      companyName: job.companyName,
      jobLocations: Array.isArray(job.jobLocations) ? job.jobLocations : [],
      jobTypes: job.jobTypes,
      level: job.level,
      h1b: job.h1b,
      usCitizenship: job.usCitizenship,
      postDate: job.postDate,
      applicationDeadline: job.applicationDeadline,
      jobApplicationType: job.jobApplicationType,
      status: job.status,
      normalizedJobTitles: job.normalizedJobTitles,
      description: job.jobDescription,
      // Extract experience requirements from JSONB field
      requirements: job.experienceRequirement as any,
      responsibilities: undefined,
      benefits: undefined,
      // Extract salary information from JSONB field
      salaryMin: undefined,
      salaryMax: undefined,
      salaryCurrency: undefined,
      experienceYearsMin: undefined,
      experienceYearsMax: undefined,
      educationLevel: undefined,
      skills: undefined,
      remoteWorkOption: undefined,
      source: undefined,
      sourceUrl: job.jobLink,
      companySize: undefined,
      companyIndustry: undefined,
      metadata: undefined,
      createdAt: job.createdAt,
      updatedAt: job.updatedAt,
    }));

    return {
      data, // Unified field name (was "items" before)
      total,
      page,
      pageSize,
      totalPages,
    };
  }

  /**
   * Build query conditions based on filter
   */
  private buildQueryConditions(filter?: QueryJobsDto['filter']): any[] {
    const conditions: any[] = [];

    if (!filter) {
      return conditions;
    }

    // Filter by status
    if (filter.status) {
      conditions.push(eq(schema.recommendedJobs.status, filter.status));
    } else {
      // Default to active status
      conditions.push(eq(schema.recommendedJobs.status, 'active'));
    }

    // Filter by title/company (case-insensitive)
    if (filter.keyword) {
      conditions.push(
        or(
          sql`${schema.recommendedJobs.title} ILIKE ${`%${filter.keyword}%`}`,
          sql`${schema.recommendedJobs.companyName} ILIKE ${`%${filter.keyword}%`}`,
        ),
      );
    }

    // Filter by location
    if (filter.location) {
      conditions.push(
        sql`${schema.recommendedJobs.jobLocations}::text ILIKE ${`%${filter.location}%`}`,
      );
    }

    // Filter by job type
    if (filter.jobType) {
      conditions.push(
        sql`${schema.recommendedJobs.jobTypes}::jsonb @> ${JSON.stringify([filter.jobType])}`,
      );
    }

    // Filter by level
    if (filter.level) {
      conditions.push(eq(schema.recommendedJobs.level, filter.level));
    }

    // Filter by job titles
    if (filter.jobTitles && filter.jobTitles.length > 0) {
      conditions.push(
        sql`${schema.recommendedJobs.normalizedJobTitles}::jsonb ?| array[${sql.join(filter.jobTitles.map((title) => sql`${title}`), sql`, `)}]`,
      );
    }

    // Filter by post date range
    if (filter.postDateRange) {
      if (filter.postDateRange.start) {
        conditions.push(sql`${schema.recommendedJobs.postDate} >= ${filter.postDateRange.start}`);
      }
      if (filter.postDateRange.end) {
        conditions.push(sql`${schema.recommendedJobs.postDate} <= ${filter.postDateRange.end}`);
      }
    }

    // Filter by visa sponsorship
    if (filter.h1b !== undefined) {
      conditions.push(eq(schema.recommendedJobs.h1b, filter.h1b));
    }
    if (filter.usCitizenship !== undefined) {
      conditions.push(eq(schema.recommendedJobs.usCitizenship, filter.usCitizenship));
    }

    // Filter by job application type
    if (filter.jobApplicationType) {
      conditions.push(
        sql`${schema.recommendedJobs.jobApplicationType}::jsonb @> ${JSON.stringify([filter.jobApplicationType])}`,
      );
    }

    return conditions;
  }

  /**
   * Apply sorting to query
   */
  private applySorting(
    query: any,
    sort: QueryJobsDto['sort'],
  ): any {
    if (!sort) return query;

    const { field, direction = 'desc' } = sort;

    const columns = getTableColumns(schema.recommendedJobs);
    const sortableColumns = Object.keys(columns);

    if (field && sortableColumns.includes(field)) {
      const column = columns[field as keyof typeof columns];
      if (direction === 'asc') {
        return query.orderBy(sql`${column} ASC NULLS LAST`);
      }
      return query.orderBy(sql`${column} DESC NULLS LAST`);
    }

    // If sort field is not found, apply default sorting
    return query.orderBy(sql`${schema.recommendedJobs.postDate} DESC NULLS LAST`);
  }
}

