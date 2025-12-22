import { Inject, Injectable, Logger } from "@nestjs/common";
import { sql } from "drizzle-orm";
import { NodePgDatabase } from "drizzle-orm/node-postgres";
import { DATABASE_CONNECTION } from "@infrastructure/database/database.provider";
import * as schema from "@infrastructure/database/schema";
import { Country, Gender } from "@shared/types/identity-enums";
import { IPaginatedResult } from "@shared/types/paginated-result";
import { Trace } from "@shared/decorators/trace.decorator";

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
  @Trace({
    name: 'domain.query.findStudentsByMentorId',
  })
  async findStudentsByMentorId(
    mentorId: string,
    text?: string,
  ): Promise<StudentListItem[]> {
    this.logger.log(
      `Finding students for mentor: ${mentorId}${
        text ? ` with text=${text}` : ""
      }`,
    );

    const searchFilter = this.buildSearchFilter(text);

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
  @Trace({
    name: 'domain.query.findStudentsByCounselorId',
  })
  async findStudentsByCounselorId(
    counselorId: string,
    text?: string,
  ): Promise<StudentListItem[]> {
    this.logger.log(
      `Finding students for counselor: ${counselorId}${
        text ? ` with text=${text}` : ""
      }`,
    );

    const searchFilter = this.buildSearchFilter(text);

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
  @Trace({
    name: 'domain.query.findAllStudents',
  })
  async findAllStudents(text?: string): Promise<StudentListItem[]> {
    this.logger.log(
      `Finding all students${text ? ` with text=${text}` : ""}`,
    );

    const searchFilter = this.buildSearchFilter(text);

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
      WHERE s.id IS NOT NULL
        ${searchFilter}
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

  private buildStudentIdFilter(studentId?: string) {
    if (!studentId || studentId.trim().length === 0) {
      return sql``;
    }

    return sql`AND s.id = ${studentId.trim()}`;
  }

  /**
   * 获取顾问视图的学生列表（带分页）
   * 关联查询 students、user、schools、majors 表
   * 返回包含学校名称和专业名称的完整信息，支持分页
   */
  async listOfCounselorView(
    counselorId?: string,
    text?: string,
    page: number = 1,
    pageSize: number = 20,
    studentId?: string,
  ): Promise<IPaginatedResult<StudentCounselorViewItem>> {
    this.logger.log(
      `Listing students for counselor view${counselorId ? ` for counselor: ${counselorId}` : ""}${
        text ? ` with text=${text}` : ""
      }${studentId ? ` with studentId=${studentId}` : ""} - page: ${page}, pageSize: ${pageSize}`,
    );

    const searchFilter = this.buildSearchFilter(text);
    const studentIdFilter = this.buildStudentIdFilter(studentId);
    const offset = (page - 1) * pageSize;

    // 并行执行 count 查询和 data 查询
    let countQuery: ReturnType<typeof this.db.execute>;
    let dataQuery: ReturnType<typeof this.db.execute>;

    if (counselorId) {
      // 构建 count 查询
      countQuery = this.db.execute(sql`
        SELECT COUNT(DISTINCT s.id) as total
        FROM student s
        LEFT JOIN "user" u ON s.id = u.id
        INNER JOIN student_counselor sc ON s.id = sc.student_id
        INNER JOIN counselor c ON sc.counselor_id = c.id
        WHERE c.id = ${counselorId}
          AND s.id IS NOT NULL
          ${searchFilter}
          ${studentIdFilter}
      `);

      // 构建 data 查询
      dataQuery = this.db.execute(sql`
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
          -- 本科学校信息
          under_school.name_zh as under_college_name_zh,
          under_school.name_en as under_college_name_en,
          -- 研究生学校信息
          grad_school.name_zh as graduate_college_name_zh,
          grad_school.name_en as graduate_college_name_en,
          -- 高中学校信息
          high_school.name_zh as high_school_name_zh,
          high_school.name_en as high_school_name_en,
          -- 本科专业信息
          under_major.name_zh as under_major_name_zh,
          under_major.name_en as under_major_name_en,
          -- 研究生专业信息
          grad_major.name_zh as graduate_major_name_zh,
          grad_major.name_en as graduate_major_name_en,
          -- 顾问关联信息
          sc.status as counselor_status,
          sc.type as counselor_type
        FROM student s
        LEFT JOIN "user" u ON s.id = u.id
        LEFT JOIN schools under_school ON s.under_college = under_school.id
        LEFT JOIN schools grad_school ON s.graduate_college = grad_school.id
        LEFT JOIN schools high_school ON s.high_school = high_school.id
        LEFT JOIN majors under_major ON s.under_major = under_major.id
        LEFT JOIN majors grad_major ON s.graduate_major = grad_major.id
        INNER JOIN student_counselor sc ON s.id = sc.student_id
        INNER JOIN counselor c ON sc.counselor_id = c.id
        WHERE c.id = ${counselorId}
          AND s.id IS NOT NULL
          ${searchFilter}
          ${studentIdFilter}
        ORDER BY s.created_time DESC
        LIMIT ${pageSize}
        OFFSET ${offset}
      `);
    } else {
      // 构建 count 查询
      countQuery = this.db.execute(sql`
        SELECT COUNT(DISTINCT s.id) as total
        FROM student s
        LEFT JOIN "user" u ON s.id = u.id
        WHERE s.id IS NOT NULL
          ${searchFilter}
          ${studentIdFilter}
      `);

      // 构建 data 查询
      dataQuery = this.db.execute(sql`
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
          -- 本科学校信息
          under_school.name_zh as under_college_name_zh,
          under_school.name_en as under_college_name_en,
          -- 研究生学校信息
          grad_school.name_zh as graduate_college_name_zh,
          grad_school.name_en as graduate_college_name_en,
          -- 高中学校信息
          high_school.name_zh as high_school_name_zh,
          high_school.name_en as high_school_name_en,
          -- 本科专业信息
          under_major.name_zh as under_major_name_zh,
          under_major.name_en as under_major_name_en,
          -- 研究生专业信息
          grad_major.name_zh as graduate_major_name_zh,
          grad_major.name_en as graduate_major_name_en,
          -- 顾问关联信息（当没有 counselorId 时为空）
          NULL as counselor_status,
          NULL as counselor_type
        FROM student s
        LEFT JOIN "user" u ON s.id = u.id
        LEFT JOIN schools under_school ON s.under_college = under_school.id
        LEFT JOIN schools grad_school ON s.graduate_college = grad_school.id
        LEFT JOIN schools high_school ON s.high_school = high_school.id
        LEFT JOIN majors under_major ON s.under_major = under_major.id
        LEFT JOIN majors grad_major ON s.graduate_major = grad_major.id
        WHERE s.id IS NOT NULL
          ${searchFilter}
          ${studentIdFilter}
        ORDER BY s.created_time DESC
        LIMIT ${pageSize}
        OFFSET ${offset}
      `);
    }

    // 并行执行 count 和 data 查询
    const [countResult, dataResult] = await Promise.all([countQuery, dataQuery]);

    const total = Number(countResult.rows[0]?.total || 0);
    const data = dataResult.rows.map((row) => this.mapRowToCounselorViewItem(row));
    const totalPages = Math.ceil(total / pageSize);

    return {
      data,
      total,
      page,
      pageSize,
      totalPages,
    };
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
      underGraduationDate: row.under_graduation_date
        ? new Date(String(row.under_graduation_date))
        : null,
      graduateGraduationDate: row.graduate_graduation_date
        ? new Date(String(row.graduate_graduation_date))
        : null,
      backgroundInfo: String(row.background_info || ""),
      grades: String(row.grades || ""),
      createdAt: row.created_time as Date,
      modifiedAt: row.modified_time as Date,
      email: String(row.email || ""),
      nameEn: String(row.name_en || ""),
      nameZh: String(row.name_zh || ""),
      country: row.country ? (row.country as Country) : undefined,
      gender: row.gender ? (row.gender as Gender) : undefined,
    };
  }

  private mapRowToCounselorViewItem(
    row: Record<string, unknown>,
  ): StudentCounselorViewItem {
    return {
      id: String(row.id || ""),
      status: String(row.status || ""),
      underMajor: String(row.under_major || ""),
      underCollege: String(row.under_college || ""),
      graduateMajor: String(row.graduate_major || ""),
      graduateCollege: String(row.graduate_college || ""),
      highSchool: String(row.high_school || ""),
      aiResumeSummary: String(row.ai_resume_summary || ""),
      customerImportance: String(row.customer_importance || ""),
      underGraduationDate: row.under_graduation_date
        ? new Date(String(row.under_graduation_date))
        : null,
      graduateGraduationDate: row.graduate_graduation_date
        ? new Date(String(row.graduate_graduation_date))
        : null,
      backgroundInfo: String(row.background_info || ""),
      grades: String(row.grades || ""),
      createdAt: row.created_time as Date,
      modifiedAt: row.modified_time as Date,
      email: String(row.email || ""),
      nameEn: String(row.name_en || ""),
      nameZh: String(row.name_zh || ""),
      country: row.country ? (row.country as Country) : undefined,
      gender: row.gender ? (row.gender as Gender) : undefined,
      // 学校名称
      underCollegeNameZh: String(row.under_college_name_zh || ""),
      underCollegeNameEn: String(row.under_college_name_en || ""),
      graduateCollegeNameZh: String(row.graduate_college_name_zh || ""),
      graduateCollegeNameEn: String(row.graduate_college_name_en || ""),
      highSchoolNameZh: String(row.high_school_name_zh || ""),
      highSchoolNameEn: String(row.high_school_name_en || ""),
      // 专业名称
      underMajorNameZh: String(row.under_major_name_zh || ""),
      underMajorNameEn: String(row.under_major_name_en || ""),
      graduateMajorNameZh: String(row.graduate_major_name_zh || ""),
      graduateMajorNameEn: String(row.graduate_major_name_en || ""),
      // 顾问关联信息
      counselorStatus: String(row.counselor_status || ""),
      counselorType: String(row.counselor_type || ""),
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
  underGraduationDate: Date | null; // student.under_graduation_date
  graduateGraduationDate: Date | null; // student.graduate_graduation_date
  backgroundInfo: string; // student.background_info
  grades: string; // student.grades
  createdAt: Date; // student.created_time
  modifiedAt: Date; // student.modified_time

  // User 表补充字段（通过 LEFT JOIN 获取）
  email: string; // user.email
  nameEn: string; // user.name_en
  nameZh: string; // user.name_zh
  country?: Country; // user.country
  gender?: Gender; // user.gender

  // 关联信息
  counselorStatus?: string; // student_counselor.status (仅当通过顾问查询时)
  counselorType?: string; // student_counselor.type (仅当通过顾问查询时)
}

/**
 * Student Counselor View Item DTO
 * 顾问视图的学生列表 Read Model
 * 包含完整的学校名称和专业名称信息
 */
export interface StudentCounselorViewItem {
  // Student 表主要字段
  id: string; // student.id (主键，直接外键到 user.id)
  status: string; // student.status
  underMajor: string; // student.under_major (UUID)
  underCollege: string; // student.under_college (UUID)
  graduateMajor: string; // student.graduate_major (UUID)
  graduateCollege: string; // student.graduate_college (UUID)
  highSchool: string; // student.high_school (UUID)
  aiResumeSummary: string; // student.ai_resume_summary
  customerImportance: string; // student.customer_importance
  underGraduationDate: Date | null; // student.under_graduation_date
  graduateGraduationDate: Date | null; // student.graduate_graduation_date
  backgroundInfo: string; // student.background_info
  grades: string; // student.grades
  createdAt: Date; // student.created_time
  modifiedAt: Date; // student.modified_time

  // User 表补充字段（通过 LEFT JOIN 获取）
  email: string; // user.email
  nameEn: string; // user.name_en
  nameZh: string; // user.name_zh
  country?: Country; // user.country
  gender?: Gender; // user.gender

  // 学校名称（通过 LEFT JOIN schools 表获取）
  underCollegeNameZh: string; // schools.name_zh (本科学校中文名)
  underCollegeNameEn: string; // schools.name_en (本科学校英文名)
  graduateCollegeNameZh: string; // schools.name_zh (研究生学校中文名)
  graduateCollegeNameEn: string; // schools.name_en (研究生学校英文名)
  highSchoolNameZh: string; // schools.name_zh (高中学校中文名)
  highSchoolNameEn: string; // schools.name_en (高中学校英文名)

  // 专业名称（通过 LEFT JOIN majors 表获取）
  underMajorNameZh: string; // majors.name_zh (本科专业中文名)
  underMajorNameEn: string; // majors.name_en (本科专业英文名)
  graduateMajorNameZh: string; // majors.name_zh (研究生专业中文名)
  graduateMajorNameEn: string; // majors.name_en (研究生专业英文名)

  // 顾问关联信息
  counselorStatus: string; // student_counselor.status
  counselorType: string; // student_counselor.type
}
