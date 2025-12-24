import { Injectable, Inject, Logger } from '@nestjs/common';
import { eq, ilike, and, or, sql, desc, asc } from 'drizzle-orm';
import type { DrizzleDatabase } from '@shared/types/database.types';
import { DATABASE_CONNECTION } from '@infrastructure/database/database.provider';
import { jobTitleTable } from '@infrastructure/database/schema';
import type {
  JobTitleEntity,
  CreateJobTitleDto,
  UpdateJobTitleDto,
  JobTitleQueryOptions,
} from '../entities/job-title.entity';

/**
 * Job Title Repository
 * 岗位名称仓储(Job Title Repository)
 * 职责：数据访问层，封装数据库操作
 */
@Injectable()
export class JobTitleRepository {
  private readonly logger = new Logger(JobTitleRepository.name);

  constructor(
    @Inject(DATABASE_CONNECTION)
    private readonly db: DrizzleDatabase,
  ) {}

  /**
   * 创建岗位名称(Create job title)
   */
  async create(dto: CreateJobTitleDto): Promise<JobTitleEntity> {
    this.logger.log(`Creating job title: ${dto.id}`);

    const [result] = await this.db
      .insert(jobTitleTable)
      .values({
        id: dto.id,
        description: dto.description || null,
        jobCategoryId: dto.jobCategoryId || null,
        status: 'active',
        createdBy: dto.createdBy,
        updatedBy: dto.createdBy,
      })
      .returning();

    return this.mapToEntity(result);
  }

  /**
   * 更新岗位名称(Update job title)
   */
  async update(id: string, dto: UpdateJobTitleDto): Promise<JobTitleEntity> {
    this.logger.log(`Updating job title: ${id}`);

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
    if (dto.jobCategoryId !== undefined) {
      updateData.jobCategoryId = dto.jobCategoryId;
    }

    const [result] = await this.db
      .update(jobTitleTable)
      .set(updateData)
      .where(eq(jobTitleTable.id, id))
      .returning();

    if (!result) {
      throw new Error(`Job title not found: ${id}`);
    }

    return this.mapToEntity(result);
  }

  /**
   * 逻辑删除岗位名称(Soft delete job title)
   */
  async delete(id: string, deletedBy: string): Promise<JobTitleEntity> {
    this.logger.log(`Deleting job title: ${id}`);

    const [result] = await this.db
      .update(jobTitleTable)
      .set({
        status: 'deleted',
        updatedBy: deletedBy,
        modifiedTime: new Date(),
      })
      .where(eq(jobTitleTable.id, id))
      .returning();

    if (!result) {
      throw new Error(`Job title not found: ${id}`);
    }

    return this.mapToEntity(result);
  }

  /**
   * 根据ID查询岗位名称(Find job title by ID)
   */
  async findById(id: string): Promise<JobTitleEntity | null> {
    this.logger.log(`Finding job title by id: ${id}`);

    const result = await this.db.query.jobTitleTable.findFirst({
      where: eq(jobTitleTable.id, id),
    });

    return result ? this.mapToEntity(result) : null;
  }

  /**
   * 分页查询岗位名称(Find all job titles with pagination)
   */
  async findAll(options: JobTitleQueryOptions): Promise<JobTitleEntity[]> {
    const {
      search,
      status,
      jobCategoryId,
      page = 1,
      pageSize = 20,
      sortBy = 'createdTime',
      sortOrder = 'desc',
    } = options;

    this.logger.log(
      `Finding job titles with options: ${JSON.stringify(options)}`,
    );

    const conditions = [];

    if (search) {
      conditions.push(
        or(
          ilike(jobTitleTable.id, `%${search}%`),
          ilike(jobTitleTable.description, `%${search}%`),
        ),
      );
    }

    if (status) {
      conditions.push(eq(jobTitleTable.status, status));
    } else {
      conditions.push(sql`${jobTitleTable.status} != 'deleted'`);
    }

    if (jobCategoryId) {
      conditions.push(eq(jobTitleTable.jobCategoryId, jobCategoryId));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const orderByColumn = this.getOrderByColumn(sortBy);
    const orderByClause = sortOrder === 'asc' ? asc(orderByColumn) : desc(orderByColumn);

    const offset = (page - 1) * pageSize;

    const results = await this.db
      .select()
      .from(jobTitleTable)
      .where(whereClause)
      .orderBy(orderByClause)
      .limit(pageSize)
      .offset(offset);

    return results.map((r) => this.mapToEntity(r));
  }

  /**
   * 统计岗位名称总数(Count job titles)
   */
  async count(options: JobTitleQueryOptions): Promise<number> {
    const { search, status, jobCategoryId } = options;

    const conditions = [];

    if (search) {
      conditions.push(
        or(
          ilike(jobTitleTable.id, `%${search}%`),
          ilike(jobTitleTable.description, `%${search}%`),
        ),
      );
    }

    if (status) {
      conditions.push(eq(jobTitleTable.status, status));
    } else {
      conditions.push(sql`${jobTitleTable.status} != 'deleted'`);
    }

    if (jobCategoryId) {
      conditions.push(eq(jobTitleTable.jobCategoryId, jobCategoryId));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const [result] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(jobTitleTable)
      .where(whereClause);

    return result?.count || 0;
  }

  /**
   * 检查ID是否存在(Check if ID exists)
   */
  async existsById(id: string): Promise<boolean> {
    const result = await this.db
      .select({ id: jobTitleTable.id })
      .from(jobTitleTable)
      .where(eq(jobTitleTable.id, id))
      .limit(1);

    return result.length > 0;
  }

  private mapToEntity(row: unknown): JobTitleEntity {
    const r = row as Record<string, unknown>;
    return {
      id: String(r.id || ''),
      description: r.description ? String(r.description) : null,
      status: r.status ? String(r.status) : null,
      jobCategoryId: r.jobCategoryId ? String(r.jobCategoryId) : null,
      createdTime: r.createdTime ? (r.createdTime as Date) : null,
      modifiedTime: r.modifiedTime ? (r.modifiedTime as Date) : null,
      createdBy: r.createdBy ? String(r.createdBy) : null,
      updatedBy: r.updatedBy ? String(r.updatedBy) : null,
    };
  }

  private getOrderByColumn(sortBy: string) {
    switch (sortBy) {
      case 'id':
        return jobTitleTable.id;
      case 'description':
        return jobTitleTable.description;
      case 'status':
        return jobTitleTable.status;
      case 'jobCategoryId':
        return jobTitleTable.jobCategoryId;
      case 'modifiedTime':
        return jobTitleTable.modifiedTime;
      case 'createdTime':
      default:
        return jobTitleTable.createdTime;
    }
  }
}

