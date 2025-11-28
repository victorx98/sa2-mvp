import { Inject, Injectable, Logger } from "@nestjs/common";
import { sql } from "drizzle-orm";
import { NodePgDatabase } from "drizzle-orm/node-postgres";
import { DATABASE_CONNECTION } from "@infrastructure/database/database.provider";
import * as schema from "@infrastructure/database/schema";

/**
 * School Query Service
 * 职责：
 * 1. 查询学校列表
 * 2. 支持按中英文名称搜索
 * 3. 返回扁平化的 Read Model
 */
@Injectable()
export class SchoolQueryService {
  private readonly logger = new Logger(SchoolQueryService.name);

  constructor(
    @Inject(DATABASE_CONNECTION)
    private readonly db: NodePgDatabase<typeof schema>,
  ) {}

  /**
   * 根据搜索关键词查询学校列表
   * 支持按中文名或英文名搜索
   */
  async search(search?: string): Promise<SchoolListItem[]> {
    this.logger.log(
      `Searching schools${search ? ` with search=${search}` : ""}`,
    );

    const searchFilter = this.buildSearchFilter(search);

    const result = await this.db.execute(sql`
      SELECT
        s.id,
        s.name_zh,
        s.name_en,
        s.country_code,
        s.created_time,
        s.modified_time
      FROM schools s
      WHERE 1=1
        ${searchFilter}
      ORDER BY s.name_en ASC, s.name_zh ASC
      LIMIT 100
    `);

    return result.rows.map((row) => this.mapRowToSchoolItem(row));
  }

  /**
   * 根据ID查询学校
   */
  async findById(id: string): Promise<SchoolListItem | null> {
    this.logger.log(`Finding school by id: ${id}`);

    const result = await this.db.execute(sql`
      SELECT
        s.id,
        s.name_zh,
        s.name_en,
        s.country_code,
        s.created_time,
        s.modified_time
      FROM schools s
      WHERE s.id = ${id}
      LIMIT 1
    `);

    if (result.rows.length === 0) {
      return null;
    }

    return this.mapRowToSchoolItem(result.rows[0]);
  }

  private buildSearchFilter(search?: string) {
    if (!search || search.trim().length === 0) {
      return sql``;
    }

    const searchTerm = `%${search.trim()}%`;
    return sql`
      AND (
        s.name_zh ILIKE ${searchTerm}
        OR s.name_en ILIKE ${searchTerm}
      )
    `;
  }

  private mapRowToSchoolItem(row: Record<string, unknown>): SchoolListItem {
    return {
      id: String(row.id || ""),
      nameZh: String(row.name_zh || ""),
      nameEn: String(row.name_en || ""),
      countryCode: row.country_code ? String(row.country_code) : null,
      createdAt: row.created_time as Date,
      modifiedAt: row.modified_time as Date,
    };
  }
}

/**
 * School List Item DTO
 * 扁平化的 Read Model，用于列表展示
 */
export interface SchoolListItem {
  id: string;
  nameZh: string;
  nameEn: string;
  countryCode: string | null;
  createdAt: Date;
  modifiedAt: Date;
}

