import { Inject, Injectable, Logger } from "@nestjs/common";
import { sql } from "drizzle-orm";
import { NodePgDatabase } from "drizzle-orm/node-postgres";
import { DATABASE_CONNECTION } from "@infrastructure/database/database.provider";
import * as schema from "@infrastructure/database/schema";
import { Country, Gender } from "@shared/types/identity-enums";

/**
 * 提供顾问列表相关的只读查询能力
 */
@Injectable()
export class CounselorQueryService {
  private readonly logger = new Logger(CounselorQueryService.name);

  constructor(
    @Inject(DATABASE_CONNECTION)
    private readonly db: NodePgDatabase<typeof schema>,
  ) {}

  async findAll(text?: string): Promise<CounselorListItem[]> {
    this.logger.log(
      `Querying counselors${text ? ` with text=${text}` : ""}`,
    );

    const searchFilter = this.buildSearchFilter(text);

    const result = await this.db.execute(sql`
      SELECT
        c.id,
        c.status,
        c.created_time,
        c.modified_time,
        u.email,
        u.name_en,
        u.name_zh,
        u.country,
        u.gender
      FROM counselor c
      LEFT JOIN "user" u ON c.id = u.id
      WHERE c.id IS NOT NULL
      ${searchFilter}
      ORDER BY c.created_time DESC
    `);

    return result.rows.map((row) => this.mapRowToCounselor(row));
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

  private mapRowToCounselor(row: Record<string, unknown>): CounselorListItem {
    return {
      id: String(row.id || ""),
      userId: String(row.id || ""), // id 就是 user.id
      status: row.status ? String(row.status) : undefined,
      createdAt: row.created_time as Date,
      modifiedAt: row.modified_time as Date,
      email: String(row.email || ""),
      nameEn: row.name_en ? String(row.name_en) : undefined,
      nameZh: row.name_zh ? String(row.name_zh) : undefined,
      country: row.country ? (row.country as Country) : undefined,
      gender: row.gender ? (row.gender as Gender) : undefined,
    };
  }
}

export interface CounselorListItem {
  id: string;
  userId: string;
  status?: string;
  createdAt: Date;
  modifiedAt: Date;
  email: string;
  nameEn?: string;
  nameZh?: string;
  country?: Country;
  gender?: Gender;
}

