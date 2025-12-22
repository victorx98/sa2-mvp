/**
 * Drizzle Job Application Repository (Drizzle投递申请仓储)
 * Implementation of IJobApplicationRepository using Drizzle ORM (使用Drizzle ORM实现IJobApplicationRepository)
 */

import { Injectable } from '@nestjs/common';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { eq, and, sql, desc, lt, gt, gte, lte, SQL } from 'drizzle-orm';
import { JobApplication } from '../../entities/job-application.entity';
import {
  IJobApplicationRepository,
  JobApplicationSearchCriteria,
  JobApplicationSearchResult,
  JOB_APPLICATION_REPOSITORY,
} from '../../repositories/job-application.repository.interface';
import { JobApplicationMapper } from '../../infrastructure/mappers/job-application.mapper';
import * as schema from '@infrastructure/database/schema';
import { DATABASE_CONNECTION } from '@infrastructure/database/database.provider';

@Injectable()
export class DrizzleJobApplicationRepository implements IJobApplicationRepository {
  constructor(
    private readonly db: NodePgDatabase<typeof schema>,
    private readonly mapper: JobApplicationMapper,
  ) {}

  /**
   * Find job application by ID (通过ID查找投递申请)
   */
  async findById(id: string): Promise<JobApplication | null> {
    const [record] = await this.db
      .select()
      .from(schema.jobApplications)
      .where(eq(schema.jobApplications.id, id));

    if (!record) {
      return null;
    }

    return this.mapper.toDomain(record);
  }

  /**
   * Find job applications by student ID (通过学生ID查找投递申请)
   */
  async findByStudentId(studentId: string): Promise<JobApplication[]> {
    const records = await this.db
      .select()
      .from(schema.jobApplications)
      .where(eq(schema.jobApplications.studentId, studentId))
      .orderBy(desc(schema.jobApplications.submittedAt));

    return records.map((record) => this.mapper.toDomain(record));
  }

  /**
   * Find job applications by job ID (通过岗位ID查找投递申请)
   */
  async findByJobId(jobId: string): Promise<JobApplication[]> {
    const records = await this.db
      .select()
      .from(schema.jobApplications)
      .where(eq(schema.jobApplications.jobId, jobId))
      .orderBy(desc(schema.jobApplications.submittedAt));

    return records.map((record) => this.mapper.toDomain(record));
  }

  /**
   * Find job applications by student and job ID (通过学生和岗位ID查找投递申请)
   */
  async findByStudentAndJob(studentId: string, jobId: string): Promise<JobApplication | null> {
    const [record] = await this.db
      .select()
      .from(schema.jobApplications)
      .where(
        and(
          eq(schema.jobApplications.studentId, studentId),
          eq(schema.jobApplications.jobId, jobId),
        ),
      );

    if (!record) {
      return null;
    }

    return this.mapper.toDomain(record);
  }

  /**
   * Search job applications by criteria (根据条件搜索投递申请)
   */
  async search(criteria: JobApplicationSearchCriteria): Promise<JobApplicationSearchResult> {
    const {
      studentId,
      jobId,
      status,
      applicationType,
      assignedMentorId,
      recommendedBy,
      submittedAfter,
      submittedBefore,
      page = 1,
      pageSize = 10,
      sortBy = 'submittedAt',
      sortOrder = 'DESC',
    } = criteria;

    // Build where conditions (构建where条件)
    const conditions: SQL[] = [];

    if (studentId) {
      conditions.push(eq(schema.jobApplications.studentId, studentId));
    }

    if (jobId) {
      conditions.push(eq(schema.jobApplications.jobId, jobId));
    }

    if (status) {
      conditions.push(sql`${schema.jobApplications.status} = ${status}`);
    }

    if (applicationType) {
      conditions.push(sql`${schema.jobApplications.applicationType} = ${applicationType}`);
    }

    if (assignedMentorId) {
      conditions.push(eq(schema.jobApplications.assignedMentorId, assignedMentorId));
    }

    if (recommendedBy) {
      conditions.push(eq(schema.jobApplications.recommendedBy, recommendedBy));
    }

    if (submittedAfter) {
      conditions.push(gte(schema.jobApplications.submittedAt, submittedAfter));
    }

    if (submittedBefore) {
      conditions.push(lte(schema.jobApplications.submittedAt, submittedBefore));
    }

    // Build base query (构建基础查询)
    const baseQuery = conditions.length > 0
      ? this.db.select().from(schema.jobApplications).where(and(...conditions))
      : this.db.select().from(schema.jobApplications);

    // Get total count (获取总数)
    const countResult = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(schema.jobApplications)
      .where(conditions.length > 0 ? and(...conditions) : undefined);

    const total = Number(countResult[0]?.count || 0);

    // Calculate pagination (计算分页)
    const skipCount = (page - 1) * pageSize;
    const totalPages = Math.ceil(total / pageSize);

    // Apply sorting (应用排序)
    let orderBy;
    switch (sortBy) {
      case 'studentId':
        orderBy = schema.jobApplications.studentId;
        break;
      case 'jobId':
        orderBy = schema.jobApplications.jobId;
        break;
      case 'status':
        orderBy = schema.jobApplications.status;
        break;
      case 'applicationType':
        orderBy = schema.jobApplications.applicationType;
        break;
      case 'submittedAt':
      default:
        orderBy = schema.jobApplications.submittedAt;
        break;
    }

    // Execute search query (执行搜索查询)
    const records = await baseQuery
      .orderBy(sortOrder === 'ASC' ? orderBy : desc(orderBy))
      .limit(pageSize)
      .offset(skipCount);

    // Convert records to domain entities (将记录转换为领域实体)
    const data = records.map((record) => this.mapper.toDomain(record));

    return {
      data,
      total,
      page,
      pageSize,
      totalPages,
    };
  }

  /**
   * Check if student has already applied to a job (检查学生是否已申请过某岗位)
   */
  async existsByStudentAndJob(studentId: string, jobId: string): Promise<boolean> {
    const [record] = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(schema.jobApplications)
      .where(
        and(
          eq(schema.jobApplications.studentId, studentId),
          eq(schema.jobApplications.jobId, jobId),
        ),
      );

    return Number(record.count) > 0;
  }

  /**
   * Save a new job application (保存新投递申请)
   */
  async save(application: JobApplication): Promise<JobApplication> {
    const record = this.mapper.toPersistence(application);

    const [result] = await this.db.insert(schema.jobApplications).values(record).returning();

    return this.mapper.toDomain(result);
  }

  /**
   * Update an existing job application (更新现有投递申请)
   */
  async update(application: JobApplication): Promise<JobApplication> {
    const record = this.mapper.toPersistence(application);

    const [result] = await this.db
      .update(schema.jobApplications)
      .set({
        ...record,
        updatedAt: new Date(),
      })
      .where(eq(schema.jobApplications.id, application.getId()))
      .returning();

    if (!result) {
      throw new Error(`Job application with ID ${application.getId()} not found`);
    }

    return this.mapper.toDomain(result);
  }

  /**
   * Execute operations within a transaction (在事务中执行操作)
   */
  async withTransaction<T>(fn: (repo: IJobApplicationRepository) => Promise<T>): Promise<T> {
    return await this.db.transaction(async (tx) => {
      // Create a new repository instance with the transaction (使用事务创建新的仓库实例)
      const transactionalRepo = new DrizzleJobApplicationRepository(
        tx as any,
        this.mapper,
      );
      return await fn(transactionalRepo);
    });
  }
}
