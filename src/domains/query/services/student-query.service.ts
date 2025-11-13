import { Inject, Injectable, Logger } from "@nestjs/common";
import { eq, and, sql, inArray } from "drizzle-orm";
import { NodePgDatabase } from "drizzle-orm/node-postgres";
import { DATABASE_CONNECTION } from "@infrastructure/database/database.provider";
import * as schema from "@infrastructure/database/schema";

/**
 * Student Query Service
 * 职责：
 * 1. 查询学生列表
 * 2. 支持按导师过滤（通过 sessions 表关联）
 * 3. 支持按顾问过滤（目前通过 sessions 表，未来可能需要专门的关联表）
 * 4. 返回扁平化的 Read Model
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
   * 通过 sessions 表关联，查找与导师有过会话的学生
   * 注意：sessions 表的 student_id 和 mentor_id 是 uuid 类型，而 user 表的 id 是 varchar(32)
   * 使用 SQL 查询直接 JOIN，通过类型转换匹配
   */
  async findStudentsByMentorId(mentorId: string): Promise<StudentListItem[]> {
    this.logger.log(`Finding students for mentor: ${mentorId}`);

    // 使用 SQL 直接查询，通过类型转换匹配 user.id (varchar) 和 sessions.student_id (uuid)
    // 假设 user.id 存储的是 UUID 格式的字符串
    const result = await this.db.execute(sql`
      SELECT DISTINCT
        u.id,
        u.email,
        u.nickname,
        u.cn_nickname,
        u.status,
        u.country,
        u.created_time,
        COUNT(DISTINCT s.id) as session_count
      FROM "user" u
      INNER JOIN sessions s ON u.id::uuid = s.student_id
      WHERE s.mentor_id::text = ${mentorId}
      GROUP BY u.id, u.email, u.nickname, u.cn_nickname, u.status, u.country, u.created_time
      ORDER BY u.created_time
    `);

    return result.rows.map((row: any) => ({
      id: row.id,
      email: row.email || "",
      nickname: row.nickname || "",
      cnNickname: row.cn_nickname || "",
      status: row.status || "",
      country: row.country || "",
      createdAt: row.created_time,
      sessionCount: Number(row.session_count) || 0,
    }));
  }

  /**
   * 根据顾问ID获取学生列表
   * 注意：目前系统中没有直接的顾问-学生关联表
   * 这里暂时返回空数组，或者可以通过其他业务逻辑关联
   * 未来可能需要创建专门的顾问-学生关联表
   */
  async findStudentsByCounselorId(
    counselorId: string,
  ): Promise<StudentListItem[]> {
    this.logger.log(`Finding students for counselor: ${counselorId}`);

    // TODO: 实现顾问-学生关联查询
    // 目前系统中没有直接的顾问-学生关联表
    // 可能的实现方式：
    // 1. 创建 counselor_assignments 表
    // 2. 或者通过其他业务逻辑关联（如 contracts 表）
    // 暂时返回空数组
    this.logger.warn(
      "Counselor-student relationship not yet implemented. Returning empty array.",
    );

    // 暂时返回空数组
    // 未来可以通过 contracts 表或其他关联表实现
    return [];
  }

  /**
   * 获取所有学生列表（不带过滤）
   * 可以根据需要添加分页和过滤逻辑
   */
  async findAllStudents(): Promise<StudentListItem[]> {
    this.logger.log("Finding all students");

    const result = await this.db
      .select({
        id: schema.userTable.id,
        email: schema.userTable.email,
        nickname: schema.userTable.nickname,
        cnNickname: schema.userTable.cnNickname,
        status: schema.userTable.status,
        country: schema.userTable.country,
        createdTime: schema.userTable.createdTime,
      })
      .from(schema.userTable)
      .orderBy(schema.userTable.createdTime);

    return result.map((row) => ({
      id: row.id,
      email: row.email || "",
      nickname: row.nickname || "",
      cnNickname: row.cnNickname || "",
      status: row.status || "",
      country: row.country || "",
      createdAt: row.createdTime,
      sessionCount: 0, // 全部学生列表不统计会话数量
    }));
  }
}

/**
 * Student List Item DTO
 * 扁平化的 Read Model，用于列表展示
 */
export interface StudentListItem {
  id: string;
  email: string;
  nickname: string;
  cnNickname: string;
  status: string;
  country: string;
  createdAt: Date;
  sessionCount?: number; // 可选字段，用于显示与导师/顾问的会话数量
}

