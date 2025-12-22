/**
 * Drizzle Job Position Repository (Drizzle岗位仓储)
 * Implementation of IJobPositionRepository using Drizzle ORM (使用Drizzle ORM实现IJobPositionRepository)
 */

import { Injectable } from '@nestjs/common';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { eq, and, ilike, isNotNull, sql, desc, SQL } from 'drizzle-orm';
import { JobPosition } from '../../entities/job-position.entity';
import {
  IJobPositionRepository,
  JobPositionSearchCriteria,
  JobPositionSearchResult,
} from '../../repositories/job-position.repository.interface';
import { JobPositionMapper } from '../../infrastructure/mappers/job-position.mapper';
import * as schema from '@infrastructure/database/schema';
import { DATABASE_CONNECTION } from '@infrastructure/database/database.provider';

@Injectable()
export class DrizzleJobPositionRepository implements IJobPositionRepository {
  constructor(
    private readonly db: NodePgDatabase<typeof schema>,
    private readonly mapper: JobPositionMapper,
  ) {}

  /**
   * Find job position by ID (通过ID查找岗位)
   */
  async findById(id: string): Promise<JobPosition | null> {
    const [record] = await this.db
      .select()
      .from(schema.recommendedJobs)
      .where(eq(schema.recommendedJobs.id, id));

    if (!record) {
      return null;
    }

    return this.mapper.toDomain(record);
  }

  /**
   * Find job positions by company name (通过公司名称查找岗位)
   */
  async findByCompanyName(companyName: string): Promise<JobPosition[]> {
    const records = await this.db
      .select()
      .from(schema.recommendedJobs)
      .where(ilike(schema.recommendedJobs.companyName, `%${companyName}%`))
      .orderBy(schema.recommendedJobs.createdAt);

    return records.map((record) => this.mapper.toDomain(record));
  }

  /**
   * Find job position by job ID (external ID) (通过job ID查找岗位)
   */
  async findByJobId(jobId: string): Promise<JobPosition | null> {
    const [record] = await this.db
      .select()
      .from(schema.recommendedJobs)
      .where(eq(schema.recommendedJobs.jobId, jobId));

    if (!record) {
      return null;
    }

    return this.mapper.toDomain(record);
  }

  /**
   * Find job position by object ID (通过对象ID查找岗位)
   */
  async findByObjectId(objectId: string): Promise<JobPosition | null> {
    const [record] = await this.db
      .select()
      .from(schema.recommendedJobs)
      .where(eq(schema.recommendedJobs.objectId, objectId));

    if (!record) {
      return null;
    }

    return this.mapper.toDomain(record);
  }

  /**
   * Search job positions by criteria (根据条件搜索岗位)
   */
  async search(criteria: JobPositionSearchCriteria): Promise<JobPositionSearchResult> {
    const {
      status,
      companyNameContains,
      titleContains,
      location,
      jobType,
      h1bStatus,
      countryCode,
      openForApplications,
      page = 1,
      pageSize = 10,
      sortBy = 'createdAt',
      sortOrder = 'DESC',
    } = criteria;

    // Build where conditions (构建where条件)
    const conditions: SQL[] = [];

    if (status) {
      conditions.push(eq(schema.recommendedJobs.status, status));
    }

    if (companyNameContains) {
      conditions.push(ilike(schema.recommendedJobs.companyName, `%${companyNameContains}%`));
    }

    if (titleContains) {
      conditions.push(ilike(schema.recommendedJobs.title, `%${titleContains}%`));
    }

    if (countryCode) {
      conditions.push(eq(schema.recommendedJobs.countryCode, countryCode));
    }

    if (h1bStatus) {
      conditions.push(eq(schema.recommendedJobs.h1b, h1bStatus));
    }

    if (jobType) {
      conditions.push(sql`${schema.recommendedJobs.jobTypes} @> ARRAY[${jobType}]`);
    }

    // Build base query (构建基础查询)
    const baseQuery = conditions.length > 0
      ? this.db.select().from(schema.recommendedJobs).where(and(...conditions))
      : this.db.select().from(schema.recommendedJobs);

    // Get total count (获取总数)
    const countResult = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(schema.recommendedJobs)
      .where(conditions.length > 0 ? and(...conditions) : undefined);

    const total = Number(countResult[0]?.count || 0);

    // Calculate pagination (计算分页)
    const skipCount = (page - 1) * pageSize;
    const totalPages = Math.ceil(total / pageSize);

    // Apply sorting (应用排序)
    let orderBy;
    switch (sortBy) {
      case 'title':
        orderBy = schema.recommendedJobs.title;
        break;
      case 'postDate':
        orderBy = schema.recommendedJobs.postDate;
        break;
      case 'createdAt':
      default:
        orderBy = schema.recommendedJobs.createdAt;
        break;
    }

    // Execute search query (执行搜索查询)
    const records = await baseQuery
      .orderBy(sortOrder === 'ASC' ? orderBy : desc(orderBy))
      .limit(pageSize)
      .offset(skipCount);

    // Convert records to domain entities (将记录转换为领域实体)
    const data = records.map((record) => this.mapper.toDomain(record));

    // Filter by openForApplications if requested (如果要求，按开放申请过滤)
    let filteredData = data;
    if (openForApplications) {
      filteredData = data.filter((job) => job.isOpenForApplications());
    }

    return {
      data: filteredData,
      total,
      page,
      pageSize,
      totalPages,
    };
  }

  /**
   * Save a new job position (保存新岗位)
   */
  async save(jobPosition: JobPosition): Promise<JobPosition> {
    // Note: createdBy is not stored in the database schema (注意：数据库架构中未存储createdBy)
    // If you need to track creator, add createdBy column to the schema (如果需要跟踪创建者，请向架构添加createdBy列)
    const record = this.mapper.toPersistence(jobPosition);

    const [result] = await this.db.insert(schema.recommendedJobs).values(record).returning();

    return this.mapper.toDomain(result);
  }

  /**
   * Update an existing job position (更新现有岗位)
   */
  async update(jobPosition: JobPosition): Promise<JobPosition> {
    // Note: updatedBy is not stored in the database schema (注意：数据库架构中未存储updatedBy)
    // If you need to track updater, add updatedBy column to the schema (如果需要跟踪更新者，请向架构添加updatedBy列)
    const record = this.mapper.toPersistence(jobPosition);

    const [result] = await this.db
      .update(schema.recommendedJobs)
      .set({
        ...record,
        updatedAt: new Date(),
      })
      .where(eq(schema.recommendedJobs.id, jobPosition.getId()))
      .returning();

    if (!result) {
      throw new Error(`Job position with ID ${jobPosition.getId()} not found`);
    }

    return this.mapper.toDomain(result);
  }

  /**
   * Execute operations within a transaction (在事务中执行操作)
   */
  async withTransaction<T>(fn: (repo: IJobPositionRepository) => Promise<T>): Promise<T> {
    return await this.db.transaction(async (tx) => {
      // Create a new repository instance with the transaction (使用事务创建新的仓库实例)
      const transactionalRepo = new DrizzleJobPositionRepository(
        tx as any,
        this.mapper,
      );
      return await fn(transactionalRepo);
    });
  }
}
