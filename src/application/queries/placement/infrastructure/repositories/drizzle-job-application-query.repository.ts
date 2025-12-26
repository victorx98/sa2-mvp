/**
 * Drizzle Job Application Query Repository Implementation
 * 基于 Drizzle 的投递申请查询仓储实现
 * 
 * Infrastructure layer implements the repository interface
 * Handles all SQL queries and data mapping
 */
import { Inject, Injectable } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import { DrizzleDatabase } from '@shared/types/database.types';
import { DATABASE_CONNECTION } from '@infrastructure/database/database.provider';
import { IPaginatedResult } from '@shared/types/paginated-result';
import { IJobApplicationQueryRepository } from '../../interfaces/job-application-query.repository.interface';
import { JobApplicationReadModel } from '../../models/job-application-read.model';
import { QueryJobApplicationsDto } from '../../dto/query-job-applications.dto';

@Injectable()
export class DrizzleJobApplicationQueryRepository implements IJobApplicationQueryRepository {
  constructor(
    @Inject(DATABASE_CONNECTION)
    private readonly db: DrizzleDatabase,
  ) {}

  /**
   * Get database column name from camelCase field name
   */
  private getDbColumnName(fieldName: string): string | null {
    const fieldToColumnMap: Record<string, string> = {
      id: 'id',
      studentId: 'student_id',
      recommendedJobId: 'recommended_job_id',
      applicationType: 'application_type',
      coverLetter: 'cover_letter',
      customAnswers: 'custom_answers',
      status: 'status',
      result: 'result',
      resultReason: 'result_reason',
      submittedAt: 'submitted_at',
      updatedAt: 'updated_at',
      notes: 'notes',
      assignedMentorId: 'assigned_mentor_id',
      recommendedBy: 'recommended_by',
      recommendedAt: 'recommended_at',
      objectId: 'object_id',
      jobId: 'job_id',
      jobLink: 'job_link',
      jobType: 'job_type',
      jobTitle: 'job_title',
      companyName: 'company_name',
      location: 'location',
      jobCategories: 'job_categories',
      normalJobTitle: 'normal_job_title',
      level: 'level',
    };
    return fieldToColumnMap[fieldName] || null;
  }

  /**
   * Query job applications with filters, pagination and sorting
   */
  async queryJobApplications(dto: QueryJobApplicationsDto): Promise<IPaginatedResult<JobApplicationReadModel>> {
    const { filter, pagination, sort } = dto;

    // Build WHERE clause conditions
    const whereConditions: any[] = [];
    if (filter) {
      if (filter.status) {
        whereConditions.push(sql`ja.status = ${filter.status}`);
      }
      if (filter.applicationType) {
        whereConditions.push(sql`ja.application_type = ${filter.applicationType}`);
      }
      if (filter.studentId) {
        whereConditions.push(sql`ja.student_id = ${filter.studentId}`);
      }
      if (filter.assignedMentorId) {
        whereConditions.push(sql`ja.assigned_mentor_id = ${filter.assignedMentorId}`);
      }
      if (filter.recommendedBy) {
        whereConditions.push(sql`ja.recommended_by = ${filter.recommendedBy}`);
      }
      if (filter.startDate) {
        whereConditions.push(sql`ja.submitted_at >= ${new Date(filter.startDate)}`);
      }
      if (filter.endDate) {
        const endDate = new Date(filter.endDate);
        endDate.setDate(endDate.getDate() + 1);
        whereConditions.push(sql`ja.submitted_at <= ${endDate}`);
      }
    }
    const whereClause = whereConditions.length > 0 ? sql`WHERE ${sql.join(whereConditions, sql` AND `)}` : sql``;

    // Build ORDER BY clause
    let orderByColumn: string;
    let orderByDirection: string;
    if (sort && sort.field) {
      const dbColumnName = this.getDbColumnName(sort.field);
      if (dbColumnName) {
        orderByColumn = dbColumnName;
        orderByDirection = sort.direction === 'asc' ? 'ASC' : 'DESC';
      } else {
        orderByColumn = 'submitted_at';
        orderByDirection = 'DESC';
      }
    } else {
      orderByColumn = 'submitted_at';
      orderByDirection = 'DESC';
    }
    const safeOrderByClause = `ja.${orderByColumn} ${orderByDirection}`;

    // Apply pagination
    const page = pagination?.page || 1;
    const pageSize = pagination?.pageSize || 20;
    const offset = (page - 1) * pageSize;
    const limit = pageSize;

    // Execute main query with JOINs using raw SQL
    // Note: Using raw SQL because we need to cast varchar to uuid and join same table multiple times
    const baseQuery = sql`
      SELECT 
        ja.id,
        ja.student_id as "studentId",
        ja.recommended_job_id as "recommendedJobId",
        ja.application_type as "applicationType",
        ja.cover_letter as "coverLetter",
        ja.custom_answers as "customAnswers",
        ja.status,
        ja.result,
        ja.result_reason as "resultReason",
        ja.submitted_at as "submittedAt",
        ja.updated_at as "updatedAt",
        ja.notes,
        ja.assigned_mentor_id as "assignedMentorId",
        ja.recommended_by as "recommendedBy",
        ja.recommended_at as "recommendedAt",
        ja.object_id as "objectId",
        ja.job_id as "jobId",
        ja.job_link as "jobLink",
        ja.job_type as "jobType",
        ja.job_title as "jobTitle",
        ja.company_name as "companyName",
        ja.location,
        ja.job_categories as "jobCategories",
        ja.normal_job_title as "normalJobTitle",
        ja.level,
        student_user.id as "studentUserId",
        student_user.name_zh as "studentNameZh",
        student_user.name_en as "studentNameEn",
        mentor_user.id as "mentorUserId",
        mentor_user.name_zh as "mentorNameZh",
        mentor_user.name_en as "mentorNameEn",
        counselor_user.id as "counselorUserId",
        counselor_user.name_zh as "counselorNameZh",
        counselor_user.name_en as "counselorNameEn"
      FROM job_applications ja
      LEFT JOIN student s ON ja.student_id = s.id::text
      LEFT JOIN "user" student_user ON s.id = student_user.id
      LEFT JOIN mentor m ON ja.assigned_mentor_id = m.id::text
      LEFT JOIN "user" mentor_user ON m.id = mentor_user.id
      LEFT JOIN counselor c ON ja.recommended_by = c.id::text
      LEFT JOIN "user" counselor_user ON c.id = counselor_user.id
      ${whereClause}
    `;
    const orderByClause = sql.raw(`ORDER BY ${safeOrderByClause}`);
    const limitOffsetClause = sql`LIMIT ${limit} OFFSET ${offset}`;
    const finalQuery = sql`${baseQuery} ${orderByClause} ${limitOffsetClause}`;
    const results = await this.db.execute(finalQuery);

    // Get total count
    const countResult = await this.db.execute(sql`
      SELECT COUNT(*) as count
      FROM job_applications ja
      LEFT JOIN student s ON ja.student_id = s.id::text
      LEFT JOIN mentor m ON ja.assigned_mentor_id = m.id::text
      LEFT JOIN counselor c ON ja.recommended_by = c.id::text
      ${whereClause}
    `);

    const total = Number((countResult.rows[0] as any)?.count || 0);
    const totalPages = total === 0 ? 1 : Math.ceil(total / pageSize);

    // Map results to Read Model
    const data: JobApplicationReadModel[] = results.rows.map((row: any) => {
      const item: JobApplicationReadModel = {
        id: row.id,
        studentId: row.studentId,
        recommendedJobId: row.recommendedJobId || null,
        applicationType: row.applicationType,
        coverLetter: row.coverLetter || null,
        customAnswers: row.customAnswers || null,
        status: row.status,
        result: row.result || null,
        resultReason: row.resultReason || null,
        submittedAt: row.submittedAt instanceof Date
          ? row.submittedAt.toISOString()
          : typeof row.submittedAt === 'string'
            ? row.submittedAt
            : new Date().toISOString(),
        updatedAt: row.updatedAt instanceof Date
          ? row.updatedAt.toISOString()
          : typeof row.updatedAt === 'string'
            ? row.updatedAt
            : new Date().toISOString(),
        notes: row.notes || null,
        assignedMentorId: row.assignedMentorId || null,
        recommendedBy: row.recommendedBy || null,
        recommendedAt: row.recommendedAt
          ? (row.recommendedAt instanceof Date
              ? row.recommendedAt.toISOString()
              : typeof row.recommendedAt === 'string'
                ? row.recommendedAt
                : null)
          : null,
        objectId: row.objectId || null,
        jobId: row.jobId || null,
        jobLink: row.jobLink || null,
        jobType: row.jobType || null,
        jobTitle: row.jobTitle || null,
        companyName: row.companyName || null,
        location: row.location || null,
        jobCategories: row.jobCategories || null,
        normalJobTitle: row.normalJobTitle || null,
        level: row.level || null,
        student: {
          id: row.studentUserId || row.studentId,
          name_cn: row.studentNameZh || null,
          name_en: row.studentNameEn || null,
        },
        mentor: row.mentorUserId
          ? {
              id: row.mentorUserId,
              name_cn: row.mentorNameZh || null,
              name_en: row.mentorNameEn || null,
            }
          : null,
        counselor: row.counselorUserId
          ? {
              id: row.counselorUserId,
              name_cn: row.counselorNameZh || null,
              name_en: row.counselorNameEn || null,
            }
          : null,
      };
      return item;
    });

    return {
      data, // Unified field name (was "items" before)
      total,
      page,
      pageSize,
      totalPages,
    };
  }
}

