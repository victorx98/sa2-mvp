import { Inject, Injectable, Logger } from "@nestjs/common";
import { sql } from "drizzle-orm";
import { NodePgDatabase } from "drizzle-orm/node-postgres";
import { DATABASE_CONNECTION } from "@infrastructure/database/database.provider";
import * as schema from "@infrastructure/database/schema";

/**
 * Student Query Service
 * 职责：
 * 1. 查询学生列表
 * 2. 支持按导师过滤（通过 student_mentor 表关联）
 * 3. 支持按顾问过滤（通过 student_counselor 表关联）
 * 4. 返回扁平化的 Read Model，包含用户信息和学生信息
 */
@Injectable()
export class StudentQueryService {
  private readonly logger = new Logger(StudentQueryService.name);

  constructor(
    @Inject(DATABASE_CONNECTION)
    private readonly db: NodePgDatabase<typeof schema>,
  ) {}

  /**
   * 根据导师ID获取学生列表
   * 通过 student_mentor 表关联，查找分配给该导师的学生
   */
  async findStudentsByMentorId(
    mentorId: string,
    search?: string,
  ): Promise<StudentListItem[]> {
    this.logger.log(
      `Finding students for mentor: ${mentorId}${
        search ? ` with search=${search}` : ""
      }`,
    );

    const searchFilter = this.buildSearchFilter(search);

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
        s.graduation_date,
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
      INNER JOIN student_mentor sm ON s.id = sm.student_id
      INNER JOIN mentor m ON sm.mentor_id = m.id
      WHERE m.id = ${mentorId}
        AND s.id IS NOT NULL
        ${searchFilter}
      ORDER BY s.created_time DESC
    `);

    return result.rows.map((row) => this.mapRowToStudentItem(row));
  }

  /**
   * 根据顾问ID获取学生列表
   * 通过 student_counselor 表关联，查找分配给该顾问的学生
   */
  async findStudentsByCounselorId(
    counselorId: string,
    search?: string,
  ): Promise<StudentListItem[]> {
    this.logger.log(
      `Finding students for counselor: ${counselorId}${
        search ? ` with search=${search}` : ""
      }`,
    );

    const searchFilter = this.buildSearchFilter(search);

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
        s.graduation_date,
        s.background_info,
        s.grades,
        s.created_time,
        s.modified_time,
        u.email,
        u.name_en,
        u.name_zh,
        u.country,
        u.gender,
        sc.status as counselor_status,
        sc.type as counselor_type
      FROM student s
      LEFT JOIN "user" u ON s.id = u.id
      INNER JOIN student_counselor sc ON s.id = sc.student_id
      INNER JOIN counselor c ON sc.counselor_id = c.id
      WHERE c.id = ${counselorId}
        AND s.id IS NOT NULL
        ${searchFilter}
      ORDER BY s.created_time DESC
    `);

    return result.rows.map((row) => ({
      ...this.mapRowToStudentItem(row),
      counselorStatus: String((row as Record<string, unknown>).counselor_status || ""),
      counselorType: String((row as Record<string, unknown>).counselor_type || ""),
    }));
  }

  /**
   * 获取所有学生列表（不带过滤）
   * 以 student 表为主表，关联 user 表获取用户信息
   * 可以根据需要添加分页和过滤逻辑
   */
  async findAllStudents(): Promise<StudentListItem[]> {
    this.logger.log("Finding all students");

    // 使用 SQL 查询，以 student 表为主表
    const result = await this.db.execute(sql`
      SELECT 
        s.id,
        s.status,
        s.under_major,
        s.under_college,
        s.graduate_major,
        s.graduate_college,
        s.ai_resume_summary,
        s.customer_importance,
        s.graduation_date,
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
      WHERE s.id IS NOT NULL
      ORDER BY s.created_time DESC
    `);

    return result.rows.map((row) => this.mapRowToStudentItem(row));
  }

  private buildSearchFilter(search?: string) {
    if (!search || search.trim().length === 0) {
      return sql``;
    }

    const searchTerm = `%${search.trim()}%`;
    return sql`
      AND (
        u.name_en ILIKE ${searchTerm}
        OR u.name_zh ILIKE ${searchTerm}
        OR u.email ILIKE ${searchTerm}
      )
    `;
  }

  private mapRowToStudentItem(row: Record<string, unknown>): StudentListItem {
    return {
      id: String(row.id || ""),
      status: String(row.status || ""),
      underMajor: String(row.under_major || ""),
      underCollege: String(row.under_college || ""),
      graduateMajor: String(row.graduate_major || ""),
      graduateCollege: String(row.graduate_college || ""),
      aiResumeSummary: String(row.ai_resume_summary || ""),
      customerImportance: String(row.customer_importance || ""),
      graduationDate: row.graduation_date
        ? new Date(String(row.graduation_date))
        : null,
      backgroundInfo: String(row.background_info || ""),
      grades: String(row.grades || ""),
      createdAt: row.created_time as Date,
      modifiedAt: row.modified_time as Date,
      email: String(row.email || ""),
      nameEn: String(row.name_en || ""),
      nameZh: String(row.name_zh || ""),
      country: String(row.country || ""),
      gender: String(row.gender || ""),
    };
  }
}

/**
 * Student List Item DTO
 * 扁平化的 Read Model，用于列表展示
 * 以 student 表的字段为主，user 表的字段作为补充信息
 */
export interface StudentListItem {
  // Student 表主要字段
  id: string; // student.id (主键，直接外键到 user.id)
  status: string; // student.status
  underMajor: string; // student.under_major
  underCollege: string; // student.under_college
  graduateMajor: string; // student.graduate_major
  graduateCollege: string; // student.graduate_college
  aiResumeSummary: string; // student.ai_resume_summary
  customerImportance: string; // student.customer_importance
  graduationDate: Date | null; // student.graduation_date
  backgroundInfo: string; // student.background_info
  grades: string; // student.grades
  createdAt: Date; // student.created_time
  modifiedAt: Date; // student.modified_time

  // User 表补充字段（通过 LEFT JOIN 获取）
  email: string; // user.email
  nameEn: string; // user.name_en
  nameZh: string; // user.name_zh
  country: string; // user.country
  gender: string; // user.gender

  // 关联信息
  counselorStatus?: string; // student_counselor.status (仅当通过顾问查询时)
  counselorType?: string; // student_counselor.type (仅当通过顾问查询时)
}
