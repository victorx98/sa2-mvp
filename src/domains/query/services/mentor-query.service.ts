import { Inject, Injectable, Logger } from "@nestjs/common";
import { sql } from "drizzle-orm";
import { NodePgDatabase } from "drizzle-orm/node-postgres";
import { DATABASE_CONNECTION } from "@infrastructure/database/database.provider";
import * as schema from "@infrastructure/database/schema";

/**
 * 提供导师列表相关的只读查询能力
 */
@Injectable()
export class MentorQueryService {
  private readonly logger = new Logger(MentorQueryService.name);

  constructor(
    @Inject(DATABASE_CONNECTION)
    private readonly db: NodePgDatabase<typeof schema>,
  ) {}

  async findAll(search?: string): Promise<MentorListItem[]> {
    this.logger.log(
      `Querying mentors${search ? ` with search=${search}` : ""}`,
    );

    const searchFilter = this.buildSearchFilter(search);

    const result = await this.db.execute(sql`
      SELECT
        m.id,
        m.status,
        m.type,
        m.company,
        m.company_title,
        m.brief_intro,
        m.high_school,
        m.location,
        m.level,
        m.rating,
        m.created_time,
        m.modified_time,
        u.email,
        u.name_en,
        u.name_zh,
        u.country,
        u.gender
      FROM mentor m
      LEFT JOIN "user" u ON m.id = u.id
      WHERE m.id IS NOT NULL
      ${searchFilter}
      ORDER BY m.created_time DESC
    `);

    return result.rows.map((row) => this.mapRowToMentor(row));
  }

  /**
   * 根据学生ID查询导师列表
   * 通过 student_mentor 表关联，查找分配给该学生的导师
   */
  async findByStudentId(
    studentId: string,
    search?: string,
  ): Promise<MentorListItem[]> {
    this.logger.log(
      `Finding mentors for student: ${studentId}${
        search ? ` with search=${search}` : ""
      }`,
    );

    const searchFilter = this.buildSearchFilter(search);

    const result = await this.db.execute(sql`
      SELECT DISTINCT
        m.id,
        m.status,
        m.type,
        m.company,
        m.company_title,
        m.brief_intro,
        m.high_school,
        m.location,
        m.level,
        m.rating,
        m.created_time,
        m.modified_time,
        u.email,
        u.name_en,
        u.name_zh,
        u.country,
        u.gender
      FROM mentor m
      LEFT JOIN "user" u ON m.id = u.id
      INNER JOIN student_mentor sm ON m.id = sm.mentor_id
      INNER JOIN student s ON sm.student_id = s.id
      WHERE s.id = ${studentId}
        AND m.id IS NOT NULL
        ${searchFilter}
      ORDER BY m.created_time DESC
    `);

    return result.rows.map((row) => this.mapRowToMentor(row));
  }

  private buildSearchFilter(search?: string) {
    if (!search || search.trim().length === 0) {
      return sql``;
    }
    const term = `%${search.trim()}%`;
    return sql`
      AND (
        u.email ILIKE ${term}
        OR u.name_en ILIKE ${term}
        OR u.name_zh ILIKE ${term}
      )
    `;
  }

  private mapRowToMentor(row: Record<string, unknown>): MentorListItem {
    return {
      id: String(row.id || ""),
      userId: String(row.id || ""), // id 就是 user.id
      status: row.status ? String(row.status) : undefined,
      type: row.type ? String(row.type) : undefined,
      company: row.company ? String(row.company) : undefined,
      companyTitle: row.company_title ? String(row.company_title) : undefined,
      briefIntro: row.brief_intro ? String(row.brief_intro) : undefined,
      school: row.high_school ? String(row.high_school) : undefined, // 使用 high_school 字段
      location: row.location ? String(row.location) : undefined,
      level: row.level ? String(row.level) : undefined,
      rating:
        row.rating === null || row.rating === undefined
          ? null
          : Number(row.rating),
      createdAt: row.created_time as Date,
      modifiedAt: row.modified_time as Date,
      email: String(row.email || ""),
      nameEn: row.name_en ? String(row.name_en) : undefined,
      nameZh: row.name_zh ? String(row.name_zh) : undefined,
      country: row.country ? String(row.country) : undefined,
      gender: row.gender ? String(row.gender) : undefined,
    };
  }
}

export interface MentorListItem {
  id: string;
  userId: string;
  status?: string;
  type?: string;
  company?: string;
  companyTitle?: string;
  briefIntro?: string;
  school?: string;
  location?: string;
  level?: string;
  rating: number | null;
  createdAt: Date;
  modifiedAt: Date;
  email: string;
  nameEn?: string;
  nameZh?: string;
  country?: string;
  gender?: string;
}

