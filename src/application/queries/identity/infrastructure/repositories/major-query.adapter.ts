/**
 * Major Query Repository Implementation
 * 专业查询仓储实现 - 直接数据库查询
 */
import { Injectable, Inject } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import { IPaginatedResult } from '@shared/types/paginated-result';
import { IMajorQueryRepository } from '../../interfaces/identity-query.repository.interface';
import { DATABASE_CONNECTION } from '@infrastructure/database/database.provider';
import type { DrizzleDatabase } from '@shared/types/database.types';

@Injectable()
export class DrizzleMajorQueryRepository implements IMajorQueryRepository {
  constructor(
    @Inject(DATABASE_CONNECTION)
    private readonly db: DrizzleDatabase,
  ) {}

  async listMajors(params: any): Promise<IPaginatedResult<any>> {
    const page = params?.page || 1;
    const pageSize = params?.pageSize || 100;
    const offset = (page - 1) * pageSize;
    const keyword = params?.keyword;

    let searchFilter = sql``;
    if (keyword && keyword.trim().length > 0) {
      const term = `%${keyword.trim()}%`;
      searchFilter = sql`
        AND (
          name_zh ILIKE ${term}
          OR name_en ILIKE ${term}
          OR code ILIKE ${term}
        )
      `;
    }

    // Calculate total count
    const countResult = await this.db.execute(sql`
      SELECT COUNT(*) as total
      FROM majors
      WHERE id IS NOT NULL
      ${searchFilter}
    `);
    const total = parseInt(countResult.rows[0].total.toString()) || 0;

    // Fetch data
    const result = await this.db.execute(sql`
      SELECT
        id,
        code,
        name_zh,
        name_en,
        category,
        created_time,
        modified_time
      FROM majors
      WHERE id IS NOT NULL
        ${searchFilter}
      ORDER BY name_zh ASC
      LIMIT ${pageSize} OFFSET ${offset}
    `);

    const majors = result.rows.map((row) => ({
      id: String(row.id || ''),
      code: String(row.code || ''),
      nameZh: String(row.name_zh || ''),
      nameEn: String(row.name_en || ''),
      category: String(row.category || ''),
      createdAt: row.created_time as Date,
      modifiedAt: row.modified_time as Date,
    }));

    return {
      data: majors,
      total,
      page,
      pageSize,
      totalPages: total === 0 ? 1 : Math.ceil(total / pageSize)
    };
  }
}

