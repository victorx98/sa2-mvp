import { Inject, Injectable, Logger } from "@nestjs/common";
import { sql } from "drizzle-orm";
import { NodePgDatabase } from "drizzle-orm/node-postgres";
import { DATABASE_CONNECTION } from "@infrastructure/database/database.provider";
import * as schema from "@infrastructure/database/schema";

/**
 * Major Query Service
 * 职责：
 * 1. 查询专业列表
 * 2. 支持按中英文名称搜索
 * 3. 返回扁平化的 Read Model
 */
@Injectable()
export class MajorQueryService {
  private readonly logger = new Logger(MajorQueryService.name);

  constructor(
    @Inject(DATABASE_CONNECTION)
    private readonly db: NodePgDatabase<typeof schema>,
  ) {}

  /**
   * 根据搜索关键词查询专业列表
   * 支持按中文名或英文名搜索
   */
  async search(search?: string): Promise<MajorListItem[]> {
    this.logger.log(
      `Searching majors${search ? ` with search=${search}` : ""}`,
    );

    const searchFilter = this.buildSearchFilter(search);

    const result = await this.db.execute(sql`
      SELECT
        m.id,
        m.name_zh,
        m.name_en,
        m.degree_level,
        m.created_time,
        m.modified_time
      FROM majors m
      WHERE 1=1
        ${searchFilter}
      ORDER BY m.name_en ASC, m.name_zh ASC
      LIMIT 100
    `);

    return result.rows.map((row) => this.mapRowToMajorItem(row));
  }

  /**
   * 根据ID查询专业
   */
  async findById(id: string): Promise<MajorListItem | null> {
    this.logger.log(`Finding major by id: ${id}`);

    const result = await this.db.execute(sql`
      SELECT
        m.id,
        m.name_zh,
        m.name_en,
        m.degree_level,
        m.created_time,
        m.modified_time
      FROM majors m
      WHERE m.id = ${id}
      LIMIT 1
    `);

    if (result.rows.length === 0) {
      return null;
    }

    return this.mapRowToMajorItem(result.rows[0]);
  }

  private buildSearchFilter(search?: string) {
    if (!search || search.trim().length === 0) {
      return sql``;
    }

    const searchTerm = `%${search.trim()}%`;
    return sql`
      AND (
        m.name_zh ILIKE ${searchTerm}
        OR m.name_en ILIKE ${searchTerm}
      )
    `;
  }

  private mapRowToMajorItem(row: Record<string, unknown>): MajorListItem {
    return {
      id: String(row.id || ""),
      nameZh: String(row.name_zh || ""),
      nameEn: String(row.name_en || ""),
      degreeLevel: row.degree_level ? String(row.degree_level) : null,
      createdAt: row.created_time as Date,
      modifiedAt: row.modified_time as Date,
    };
  }
}

/**
 * Major List Item DTO
 * 扁平化的 Read Model，用于列表展示
 */
export interface MajorListItem {
  id: string;
  nameZh: string;
  nameEn: string;
  degreeLevel: string | null;
  createdAt: Date;
  modifiedAt: Date;
}

