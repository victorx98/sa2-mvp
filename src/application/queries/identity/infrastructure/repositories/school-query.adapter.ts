/**
 * School Query Repository Implementation
 * 学校查询仓储实现 - 直接数据库查询
 */
import { Injectable, Inject } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import { IPaginatedResult } from '@shared/types/paginated-result';
import { ISchoolQueryRepository } from '../../interfaces/identity-query.repository.interface';
import { DATABASE_CONNECTION } from '@infrastructure/database/database.provider';
import type { DrizzleDatabase } from '@shared/types/database.types';

@Injectable()
export class DrizzleSchoolQueryRepository implements ISchoolQueryRepository {
  constructor(
    @Inject(DATABASE_CONNECTION)
    private readonly db: DrizzleDatabase,
  ) {}

  async listSchools(params: any): Promise<IPaginatedResult<any>> {
    const page = params?.page || 1;
    const pageSize = params?.pageSize || 50;
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
      FROM schools
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
        country,
        type,
        created_time,
        modified_time
      FROM schools
      WHERE id IS NOT NULL
        ${searchFilter}
      ORDER BY name_zh ASC
      LIMIT ${pageSize} OFFSET ${offset}
    `);

    const schools = result.rows.map((row) => ({
      id: String(row.id || ''),
      code: String(row.code || ''),
      nameZh: String(row.name_zh || ''),
      nameEn: String(row.name_en || ''),
      country: String(row.country || ''),
      type: String(row.type || ''),
      createdAt: row.created_time as Date,
      modifiedAt: row.modified_time as Date,
    }));

    return {
      data: schools,
      total,
      page,
      pageSize,
      totalPages: total === 0 ? 1 : Math.ceil(total / pageSize)
    };
  }
}

