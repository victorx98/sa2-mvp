import { Injectable, Inject, Logger } from '@nestjs/common';
import { eq, ilike, and, or, sql, desc, asc } from 'drizzle-orm';
import type { DrizzleDatabase } from '@shared/types/database.types';
import { DATABASE_CONNECTION } from '@infrastructure/database/database.provider';
import { jobCategoryTable } from '@infrastructure/database/schema';
import type {
  JobCategoryEntity,
  CreateJobCategoryDto,
  UpdateJobCategoryDto,
  JobCategoryQueryOptions,
} from '../entities/job-category.entity';

/**
 * Job Category Repository
 * 岗位类别仓储(Job Category Repository)
 * 职责：数据访问层，封装数据库操作
 */
@Injectable()
export class JobCategoryRepository {
  private readonly logger = new Logger(JobCategoryRepository.name);

  constructor(
    @Inject(DATABASE_CONNECTION)
    private readonly db: DrizzleDatabase,
  ) {}

  /**
   * 创建岗位类别(Create job category)
   */
  async create(dto: CreateJobCategoryDto): Promise<JobCategoryEntity> {
    this.logger.log(`Creating job category: ${dto.id}`);

    const [result] = await this.db
      .insert(jobCategoryTable)
      .values({
        id: dto.id,
        description: dto.description || null,
        status: 'active',
        createdBy: dto.createdBy,
        updatedBy: dto.createdBy,
      })
      .returning();

    return this.mapToEntity(result);
  }

  /**
   * 更新岗位类别(Update job category)
   */
  async update(id: string, dto: UpdateJobCategoryDto): Promise<JobCategoryEntity> {
    this.logger.log(`Updating job category: ${id}`);

    const updateData: Record<string, unknown> = {
      updatedBy: dto.updatedBy,
      modifiedTime: new Date(),
    };

    if (dto.description !== undefined) {
      updateData.description = dto.description;
    }
    if (dto.status !== undefined) {
      updateData.status = dto.status;
    }

    const [result] = await this.db
      .update(jobCategoryTable)
      .set(updateData)
      .where(eq(jobCategoryTable.id, id))
      .returning();

    if (!result) {
      throw new Error(`Job category not found: ${id}`);
    }

    return this.mapToEntity(result);
  }

  /**
   * 逻辑删除岗位类别(Soft delete job category)
   */
  async delete(id: string, deletedBy: string): Promise<JobCategoryEntity> {
    this.logger.log(`Deleting job category: ${id}`);

    const [result] = await this.db
      .update(jobCategoryTable)
      .set({
        status: 'deleted',
        updatedBy: deletedBy,
        modifiedTime: new Date(),
      })
      .where(eq(jobCategoryTable.id, id))
      .returning();

    if (!result) {
      throw new Error(`Job category not found: ${id}`);
    }

    return this.mapToEntity(result);
  }

  /**
   * 根据ID查询岗位类别(Find job category by ID)
   */
  async findById(id: string): Promise<JobCategoryEntity | null> {
    this.logger.log(`Finding job category by id: ${id}`);

    const result = await this.db.query.jobCategoryTable.findFirst({
      where: eq(jobCategoryTable.id, id),
    });

    return result ? this.mapToEntity(result) : null;
  }

  /**
   * 分页查询岗位类别(Find all job categories with pagination)
   */
  async findAll(options: JobCategoryQueryOptions): Promise<JobCategoryEntity[]> {
    const {
      search,
      status,
      page = 1,
      pageSize = 20,
      sortBy = 'createdTime',
      sortOrder = 'desc',
    } = options;

    this.logger.log(
      `Finding job categories with options: ${JSON.stringify(options)}`,
    );

    const conditions = [];

    if (search) {
      conditions.push(
        or(
          ilike(jobCategoryTable.id, `%${search}%`),
          ilike(jobCategoryTable.description, `%${search}%`),
        ),
      );
    }

    if (status) {
      conditions.push(eq(jobCategoryTable.status, status));
    } else {
      conditions.push(sql`${jobCategoryTable.status} != 'deleted'`);
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const orderByColumn = this.getOrderByColumn(sortBy);
    const orderByClause = sortOrder === 'asc' ? asc(orderByColumn) : desc(orderByColumn);

    const offset = (page - 1) * pageSize;

    const results = await this.db
      .select()
      .from(jobCategoryTable)
      .where(whereClause)
      .orderBy(orderByClause)
      .limit(pageSize)
      .offset(offset);

    return results.map((r) => this.mapToEntity(r));
  }

  /**
   * 统计岗位类别总数(Count job categories)
   */
  async count(options: JobCategoryQueryOptions): Promise<number> {
    const { search, status } = options;

    const conditions = [];

    if (search) {
      conditions.push(
        or(
          ilike(jobCategoryTable.id, `%${search}%`),
          ilike(jobCategoryTable.description, `%${search}%`),
        ),
      );
    }

    if (status) {
      conditions.push(eq(jobCategoryTable.status, status));
    } else {
      conditions.push(sql`${jobCategoryTable.status} != 'deleted'`);
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const [result] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(jobCategoryTable)
      .where(whereClause);

    return result?.count || 0;
  }

  /**
   * 检查ID是否存在(Check if ID exists)
   */
  async existsById(id: string): Promise<boolean> {
    const result = await this.db
      .select({ id: jobCategoryTable.id })
      .from(jobCategoryTable)
      .where(eq(jobCategoryTable.id, id))
      .limit(1);

    return result.length > 0;
  }

  private mapToEntity(row: unknown): JobCategoryEntity {
    const r = row as Record<string, unknown>;
    return {
      id: String(r.id || ''),
      description: r.description ? String(r.description) : null,
      status: r.status ? String(r.status) : null,
      createdTime: r.createdTime ? (r.createdTime as Date) : null,
      modifiedTime: r.modifiedTime ? (r.modifiedTime as Date) : null,
      createdBy: r.createdBy ? String(r.createdBy) : null,
      updatedBy: r.updatedBy ? String(r.updatedBy) : null,
    };
  }

  private getOrderByColumn(sortBy: string) {
    switch (sortBy) {
      case 'id':
        return jobCategoryTable.id;
      case 'description':
        return jobCategoryTable.description;
      case 'status':
        return jobCategoryTable.status;
      case 'modifiedTime':
        return jobCategoryTable.modifiedTime;
      case 'createdTime':
      default:
        return jobCategoryTable.createdTime;
    }
  }
}

