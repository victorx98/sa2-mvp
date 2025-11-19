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
        m.user_id,
        m.status,
        m.type,
        m.company,
        m.company_title,
        m.brief_intro,
        m.school,
        m.location,
        m.level,
        m.rating,
        m.created_time,
        m.modified_time,
        u.email,
        u.nickname,
        u.cn_nickname,
        u.country,
        u.gender
      FROM mentor m
      LEFT JOIN "user" u ON m.user_id = u.id
      WHERE m.user_id IS NOT NULL
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
        OR u.nickname ILIKE ${term}
        OR u.cn_nickname ILIKE ${term}
      )
    `;
  }

  private mapRowToMentor(row: Record<string, unknown>): MentorListItem {
    return {
      id: String(row.id || ""),
      userId: String(row.user_id || ""),
      status: row.status ? String(row.status) : undefined,
      type: row.type ? String(row.type) : undefined,
      company: row.company ? String(row.company) : undefined,
      companyTitle: row.company_title ? String(row.company_title) : undefined,
      briefIntro: row.brief_intro ? String(row.brief_intro) : undefined,
      school: row.school ? String(row.school) : undefined,
      location: row.location ? String(row.location) : undefined,
      level: row.level ? String(row.level) : undefined,
      rating:
        row.rating === null || row.rating === undefined
          ? null
          : Number(row.rating),
      createdAt: row.created_time as Date,
      modifiedAt: row.modified_time as Date,
      email: String(row.email || ""),
      nickname: row.nickname ? String(row.nickname) : undefined,
      cnNickname: row.cn_nickname ? String(row.cn_nickname) : undefined,
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
  nickname?: string;
  cnNickname?: string;
  country?: string;
  gender?: string;
}

