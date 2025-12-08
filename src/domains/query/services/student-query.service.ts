import { Inject, Injectable, Logger } from "@nestjs/common";
import { sql } from "drizzle-orm";
import { NodePgDatabase } from "drizzle-orm/node-postgres";
import { DATABASE_CONNECTION } from "@infrastructure/database/database.provider";
import * as schema from "@infrastructure/database/schema";
import { Country, Gender } from "@shared/types/identity-enums";
import { IPaginatedResult } from "@shared/types/paginated-result";
import { PrismaQueryService } from "@shared/query-builder";
import { WhereInput, IncludeConfig } from "@shared/query-builder/types";

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
    private readonly queryService: PrismaQueryService,
  ) {
    // 关系已自动从 schema 推断，无需手动定义
  }

  /**
   * 根据导师ID获取学生列表
   * 通过 student_mentor 表关联，查找分配给该导师的学生
   */
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
   * 使用通用查询构建器实现
   */
  async listOfCounselorView(
    counselorId?: string,
    text?: string,
    page: number = 1,
    pageSize: number = 20,
    studentId?: string,
    createdStart?: string,
    createdEnd?: string,
  ): Promise<IPaginatedResult<StudentCounselorViewItem>> {
    this.logger.log(
      `Listing students for counselor view${counselorId ? ` for counselor: ${counselorId}` : ""}${
        text ? ` with text=${text}` : ""
      }${studentId ? ` with studentId=${studentId}` : ""}${
        createdStart ? ` with createdStart=${createdStart}` : ""
      }${createdEnd ? ` with createdEnd=${createdEnd}` : ""} - page: ${page}, pageSize: ${pageSize}`,
    );

    // 构建 where 条件
    const whereConditions: WhereInput[] = [];

    // 学生ID过滤
    if (studentId) {
      whereConditions.push({ id: { equals: studentId } as any });
    }

    // 构建搜索条件（在 user 表的字段中搜索）
    if (text && text.trim().length > 0) {
      const searchTerm = text.trim();
      whereConditions.push({
        user: {
          is: {
            OR: [
              { nameEn: { contains: searchTerm, mode: "insensitive" } },
              { nameZh: { contains: searchTerm, mode: "insensitive" } },
              { email: { contains: searchTerm, mode: "insensitive" } },
            ],
          },
        } as any,
      });
    }

    // 如果有 counselorId，需要通过 student_counselor 表过滤
    if (counselorId) {
      // 使用关联过滤：通过 student_counselor 表过滤
      // 关系名为 "studentCounselors"（一对多关系）
      whereConditions.push({
        studentCounselors: {
          some: {
            counselorId: { equals: counselorId },
          },
        } as any,
      });
    }

    // 构建创建时间范围过滤条件
    if (createdStart || createdEnd) {
      const createdTimeFilter: Record<string, unknown> = {};
      
      if (createdStart) {
        try {
          const startDate = new Date(createdStart);
          if (!isNaN(startDate.getTime())) {
            createdTimeFilter.gte = startDate;
          }
        } catch (error) {
          this.logger.warn(`Invalid createdStart date format: ${createdStart}`, error);
        }
      }
      
      if (createdEnd) {
        try {
          const endDate = new Date(createdEnd);
          if (!isNaN(endDate.getTime())) {
            createdTimeFilter.lte = endDate;
          }
        } catch (error) {
          this.logger.warn(`Invalid createdEnd date format: ${createdEnd}`, error);
        }
      }
      
      if (Object.keys(createdTimeFilter).length > 0) {
        whereConditions.push({
          createdTime: createdTimeFilter as any,
        });
      }
    }

    const where: WhereInput = whereConditions.length > 0 ? ({ AND: whereConditions } as WhereInput) : {};

    // 构建 include 配置
    const include: IncludeConfig = {
      // 关联 user 表（一对一关系，student.id = user.id）
      user: {
        select: {
          email: true,
          nameEn: true,
          nameZh: true,
          country: true,
          gender: true,
        },
      },
      // 关联学校表（多个关系）
      underCollege: {
        select: {
          nameZh: true,
          nameEn: true,
        },
      },
      graduateCollege: {
        select: {
          nameZh: true,
          nameEn: true,
        },
      },
      highSchool: {
        select: {
          nameZh: true,
          nameEn: true,
        },
      },
      // 关联专业表
      underMajor: {
        select: {
          nameZh: true,
          nameEn: true,
        },
      },
      graduateMajor: {
        select: {
          nameZh: true,
          nameEn: true,
        },
      },
    };

    // 如果有 counselorId，需要包含 student_counselor 关联信息
    if (counselorId) {
      // 假设关系名为 "studentCounselors"
      include.studentCounselors = {
        where: {
          counselorId: { equals: counselorId },
        },
        select: {
          status: true,
          type: true,
        },
        take: 1, // 只取第一个匹配的记录
      };
    }

    // 执行查询
    const skip = (page - 1) * pageSize;
    const results = await this.queryService.findMany(schema.studentTable, {
      where,
      include,
      orderBy: { createdTime: "desc" },
      take: pageSize,
      skip,
      relationLoadStrategy: "join",
    });

    // 执行 count 查询
    const total = await this.queryService.count(schema.studentTable, { where });

    // 映射结果
    const data = results.map((row) => this.mapQueryResultToCounselorViewItem(row, counselorId));
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

  /**
   * 将通用查询构建器返回的嵌套结果映射为 StudentCounselorViewItem
   */
  private mapQueryResultToCounselorViewItem(
    row: Record<string, unknown>,
    counselorId?: string,
  ): StudentCounselorViewItem {
    const user = row.user as Record<string, unknown> | undefined;
    const underCollege = row.underCollege as Record<string, unknown> | undefined;
    const graduateCollege = row.graduateCollege as Record<string, unknown> | undefined;
    const highSchool = row.highSchool as Record<string, unknown> | undefined;
    const underMajor = row.underMajor as Record<string, unknown> | undefined;
    const graduateMajor = row.graduateMajor as Record<string, unknown> | undefined;
    
    // 获取 student_counselor 关联信息
    let counselorStatus = "";
    let counselorType = "";
    if (counselorId) {
      const studentCounselors = row.studentCounselors as Array<Record<string, unknown>> | undefined;
      if (studentCounselors && studentCounselors.length > 0) {
        const sc = studentCounselors[0];
        counselorStatus = String(sc.status || "");
        counselorType = String(sc.type || "");
      }
    }

    return {
      id: String(row.id || ""),
      status: String(row.status || ""),
      underMajor: String(row.underMajor || ""),
      underCollege: String(row.underCollege || ""),
      graduateMajor: String(row.graduateMajor || ""),
      graduateCollege: String(row.graduateCollege || ""),
      highSchool: String(row.highSchool || ""),
      aiResumeSummary: String(row.aiResumeSummary || ""),
      customerImportance: String(row.customerImportance || ""),
      graduationDate: row.graduationDate
        ? new Date(String(row.graduationDate))
        : null,
      backgroundInfo: String(row.backgroundInfo || ""),
      grades: String(row.grades || ""),
      createdAt: row.createdTime as Date,
      modifiedAt: row.modifiedTime as Date,
      email: user ? String(user.email || "") : "",
      nameEn: user ? String(user.nameEn || "") : "",
      nameZh: user ? String(user.nameZh || "") : "",
      country: user?.country ? (user.country as Country) : undefined,
      gender: user?.gender ? (user.gender as Gender) : undefined,
      // 学校名称
      underCollegeNameZh: underCollege ? String(underCollege.nameZh || "") : "",
      underCollegeNameEn: underCollege ? String(underCollege.nameEn || "") : "",
      graduateCollegeNameZh: graduateCollege ? String(graduateCollege.nameZh || "") : "",
      graduateCollegeNameEn: graduateCollege ? String(graduateCollege.nameEn || "") : "",
      highSchoolNameZh: highSchool ? String(highSchool.nameZh || "") : "",
      highSchoolNameEn: highSchool ? String(highSchool.nameEn || "") : "",
      // 专业名称
      underMajorNameZh: underMajor ? String(underMajor.nameZh || "") : "",
      underMajorNameEn: underMajor ? String(underMajor.nameEn || "") : "",
      graduateMajorNameZh: graduateMajor ? String(graduateMajor.nameZh || "") : "",
      graduateMajorNameEn: graduateMajor ? String(graduateMajor.nameEn || "") : "",
      // 顾问关联信息
      counselorStatus,
      counselorType,
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
  graduationDate: Date | null; // student.graduation_date
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
