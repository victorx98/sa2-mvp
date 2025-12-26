/**
 * Counselor Query Repository Implementation
 * 顾问查询仓储实现
 */
import { Injectable, Inject } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import { IPaginatedResult } from '@shared/types/paginated-result';
import { ICounselorQueryRepository } from '../../interfaces/identity-query.repository.interface';
import { DATABASE_CONNECTION } from '@infrastructure/database/database.provider';
import type { DrizzleDatabase } from '@shared/types/database.types';
import { Country, Gender } from '@shared/types/identity-enums';

@Injectable()
export class DrizzleCounselorQueryRepository implements ICounselorQueryRepository {
  constructor(
    @Inject(DATABASE_CONNECTION)
    private readonly db: DrizzleDatabase,
  ) {}

  async listCounselors(params: any): Promise<IPaginatedResult<any>> {
    const page = params?.page || 1;
    const pageSize = params?.pageSize || 10;
    const offset = (page - 1) * pageSize;

    const searchFilter = this.buildSearchFilter(params?.keyword);

    // Calculate total count
    const countResult = await this.db.execute(sql`
      SELECT COUNT(*)
      FROM counselor c
      LEFT JOIN "user" u ON c.id = u.id
      WHERE c.id IS NOT NULL
      ${searchFilter}
    `);
    const total = parseInt(countResult.rows[0].count.toString()) || 0;

    // Fetch data
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
      LIMIT ${pageSize} OFFSET ${offset}
    `);

    const counselors = result.rows.map((row) => this.mapRowToCounselor(row));

    return {
      data: counselors,
      total: parseInt(total.toString()),
      page,
      pageSize,
      totalPages: total === 0 ? 1 : Math.ceil(total / pageSize)
    };
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

  private mapRowToCounselor(row: Record<string, unknown>) {
    return {
      id: String(row.id || ''),
      userId: String(row.id || ''), // id 就是 user.id
      status: row.status ? String(row.status) : undefined,
      createdAt: row.created_time as Date,
      modifiedAt: row.modified_time as Date,
      email: String(row.email || ''),
      nameEn: row.name_en ? String(row.name_en) : undefined,
      nameZh: row.name_zh ? String(row.name_zh) : undefined,
      country: row.country ? (row.country as Country) : undefined,
      gender: row.gender ? (row.gender as Gender) : undefined,
    };
  }
}

