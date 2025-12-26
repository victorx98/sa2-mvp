/**
 * Student Query Repository Implementation
 * 学生查询仓储实现 - 直接数据库查询
 */
import { Injectable, Inject } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import { IPaginatedResult } from '@shared/types/paginated-result';
import { IStudentQueryRepository } from '../../interfaces/identity-query.repository.interface';
import { DATABASE_CONNECTION } from '@infrastructure/database/database.provider';
import type { DrizzleDatabase } from '@shared/types/database.types';
import { Country, Gender } from '@shared/types/identity-enums';

@Injectable()
export class DrizzleStudentQueryRepository implements IStudentQueryRepository {
  constructor(
    @Inject(DATABASE_CONNECTION)
    private readonly db: DrizzleDatabase,
  ) {}

  async listStudents(params: any): Promise<IPaginatedResult<any>> {
    const page = params?.page || 1;
    const pageSize = params?.pageSize || 10;
    const offset = (page - 1) * pageSize;
    const keyword = params?.keyword;

    const filters = [sql`1 = 1`];
    if (keyword && keyword.trim()) {
      const term = `%${keyword.trim()}%`;
      filters.push(
        sql`(u.name_en ILIKE ${term} OR u.name_zh ILIKE ${term} OR u.email ILIKE ${term})`,
      );
    }

    const whereClause = sql`${sql.join([sql`s.id IS NOT NULL`, ...filters], sql` AND `)}`;

    const countResult = await this.db.execute(sql`
      SELECT COUNT(*) as count
      FROM student s
      LEFT JOIN "user" u ON s.id = u.id
      WHERE ${whereClause}
    `);
    const total = parseInt(countResult.rows[0].count.toString()) || 0;

    const result = await this.db.execute(sql`
      SELECT DISTINCT
        s.id,
        s.status,
        s.under_major,
        s.under_college,
        s.graduate_major,
        s.graduate_college,
        s.ai_resume_summary,
        s.customer_importance,
        s.under_graduation_date,
        s.graduate_graduation_date,
        s.background_info,
        s.grades,
        s.created_time,
        s.modified_time,
        u.email,
        u.name_en,
        u.name_zh,
        u.country,
        u.gender
      FROM student s
      LEFT JOIN "user" u ON s.id = u.id
      WHERE ${whereClause}
      ORDER BY s.created_time DESC
      LIMIT ${pageSize} OFFSET ${offset}
    `);

    const students = result.rows.map((row) => this.mapRowToStudent(row));

    return {
      data: students,
      total,
      page,
      pageSize,
      totalPages: total === 0 ? 1 : Math.ceil(total / pageSize)
    };
  }

  async listOfCounselorView(
    counselorId?: string,
    search?: string,
    page?: number,
    pageSize?: number,
    studentId?: string
  ): Promise<IPaginatedResult<any>> {
    const resolvedPage = page || 1;
    const resolvedPageSize = pageSize || 20;
    const offset = (resolvedPage - 1) * resolvedPageSize;

    const joins = counselorId
      ? sql`
        INNER JOIN student_counselor sc ON s.id = sc.student_id
        INNER JOIN counselor c ON sc.counselor_id = c.id AND c.id = ${counselorId}
      `
      : sql``;

    const filters = [sql`s.id IS NOT NULL`];
    if (search && search.trim()) {
      const term = `%${search.trim()}%`;
      filters.push(
        sql`(u.name_en ILIKE ${term} OR u.name_zh ILIKE ${term} OR u.email ILIKE ${term})`,
      );
    }
    if (studentId && studentId.trim()) {
      filters.push(sql`s.id = ${studentId.trim()}`);
    }

    const whereClause = sql`${sql.join(filters, sql` AND `)}`;

    const countResult = await this.db.execute(sql`
      SELECT COUNT(DISTINCT s.id) as total
      FROM student s
      LEFT JOIN "user" u ON s.id = u.id
      ${joins}
      WHERE ${whereClause}
    `);
    const total = parseInt(countResult.rows[0]?.total?.toString() || '0');

    const result = await this.db.execute(sql`
      SELECT DISTINCT
        s.id,
        s.status,
        s.under_major,
        s.under_college,
        s.graduate_major,
        s.graduate_college,
        s.high_school,
        s.ai_resume_summary,
        s.customer_importance,
        s.under_graduation_date,
        s.graduate_graduation_date,
        s.background_info,
        s.grades,
        s.created_time,
        s.modified_time,
        u.email,
        u.name_en,
        u.name_zh,
        u.country,
        u.gender,
        under_school.name_zh as under_college_name_zh,
        under_school.name_en as under_college_name_en,
        grad_school.name_zh as graduate_college_name_zh,
        grad_school.name_en as graduate_college_name_en,
        high_school.name_zh as high_school_name_zh,
        high_school.name_en as high_school_name_en,
        under_major.name_zh as under_major_name_zh,
        under_major.name_en as under_major_name_en,
        grad_major.name_zh as graduate_major_name_zh,
        grad_major.name_en as graduate_major_name_en,
        ${counselorId
          ? sql`sc.status as counselor_status, sc.type as counselor_type`
          : sql`NULL as counselor_status, NULL as counselor_type`}
      FROM student s
      LEFT JOIN "user" u ON s.id = u.id
      LEFT JOIN schools under_school ON s.under_college = under_school.id
      LEFT JOIN schools grad_school ON s.graduate_college = grad_school.id
      LEFT JOIN schools high_school ON s.high_school = high_school.id
      LEFT JOIN majors under_major ON s.under_major = under_major.id
      LEFT JOIN majors grad_major ON s.graduate_major = grad_major.id
      ${joins}
      WHERE ${whereClause}
      ORDER BY s.created_time DESC
      LIMIT ${resolvedPageSize} OFFSET ${offset}
    `);

    const students = result.rows.map((row) => this.mapRowToCounselorViewStudent(row));

    return {
      data: students,
      total,
      page: resolvedPage,
      pageSize: resolvedPageSize,
      totalPages: total === 0 ? 1 : Math.ceil(total / resolvedPageSize)
    };
  }

  async getStudentProfile(studentId: string): Promise<any> {
    const result = await this.listOfCounselorView(undefined, undefined, 1, 1, studentId);
    return result.data[0] || null;
  }

  private mapRowToStudent(row: Record<string, unknown>): any {
    return {
      id: String(row.id || ''),
      status: String(row.status || ''),
      underMajor: String(row.under_major || ''),
      underCollege: String(row.under_college || ''),
      graduateMajor: String(row.graduate_major || ''),
      graduateCollege: String(row.graduate_college || ''),
      aiResumeSummary: String(row.ai_resume_summary || ''),
      customerImportance: String(row.customer_importance || ''),
      underGraduationDate: row.under_graduation_date ? new Date(String(row.under_graduation_date)) : null,
      graduateGraduationDate: row.graduate_graduation_date ? new Date(String(row.graduate_graduation_date)) : null,
      backgroundInfo: String(row.background_info || ''),
      grades: String(row.grades || ''),
      createdAt: row.created_time as Date,
      modifiedAt: row.modified_time as Date,
      email: String(row.email || ''),
      nameEn: String(row.name_en || ''),
      nameZh: String(row.name_zh || ''),
      country: row.country ? (row.country as Country) : undefined,
      gender: row.gender ? (row.gender as Gender) : undefined,
    };
  }

  private mapRowToCounselorViewStudent(row: Record<string, unknown>): any {
    return {
      id: String(row.id || ''),
      status: String(row.status || ''),
      underMajor: String(row.under_major || ''),
      underCollege: String(row.under_college || ''),
      graduateMajor: String(row.graduate_major || ''),
      graduateCollege: String(row.graduate_college || ''),
      highSchool: String(row.high_school || ''),
      aiResumeSummary: String(row.ai_resume_summary || ''),
      customerImportance: String(row.customer_importance || ''),
      underGraduationDate: row.under_graduation_date ? new Date(String(row.under_graduation_date)) : null,
      graduateGraduationDate: row.graduate_graduation_date ? new Date(String(row.graduate_graduation_date)) : null,
      backgroundInfo: String(row.background_info || ''),
      grades: String(row.grades || ''),
      createdAt: row.created_time as Date,
      modifiedAt: row.modified_time as Date,
      email: String(row.email || ''),
      nameEn: String(row.name_en || ''),
      nameZh: String(row.name_zh || ''),
      country: row.country ? (row.country as Country) : undefined,
      gender: row.gender ? (row.gender as Gender) : undefined,
      underCollegeNameZh: String(row.under_college_name_zh || ''),
      underCollegeNameEn: String(row.under_college_name_en || ''),
      graduateCollegeNameZh: String(row.graduate_college_name_zh || ''),
      graduateCollegeNameEn: String(row.graduate_college_name_en || ''),
      highSchoolNameZh: String(row.high_school_name_zh || ''),
      highSchoolNameEn: String(row.high_school_name_en || ''),
      underMajorNameZh: String(row.under_major_name_zh || ''),
      underMajorNameEn: String(row.under_major_name_en || ''),
      graduateMajorNameZh: String(row.graduate_major_name_zh || ''),
      graduateMajorNameEn: String(row.graduate_major_name_en || ''),
      counselorStatus: String(row.counselor_status || ''),
      counselorType: String(row.counselor_type || ''),
    };
  }
}
