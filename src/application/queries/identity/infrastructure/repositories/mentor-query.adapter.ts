/**
 * Mentor Query Repository Implementation
 * 导师查询仓储实现 - 直接数据库查询
 */
import { Injectable, Inject } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import { IPaginatedResult } from '@shared/types/paginated-result';
import { IMentorQueryRepository } from '../../interfaces/identity-query.repository.interface';
import { DATABASE_CONNECTION } from '@infrastructure/database/database.provider';
import type { DrizzleDatabase } from '@shared/types/database.types';
import { Country, Gender } from '@shared/types/identity-enums';

@Injectable()
export class DrizzleMentorQueryRepository implements IMentorQueryRepository {
  constructor(
    @Inject(DATABASE_CONNECTION)
    private readonly db: DrizzleDatabase,
  ) {}

  async listMentors(params: any): Promise<IPaginatedResult<any>> {
    const page = params?.page || 1;
    const pageSize = params?.pageSize || 10;
    const offset = (page - 1) * pageSize;
    const keyword = params?.keyword;

    const searchFilter = this.buildSearchFilter(keyword);

    // Calculate total count
    const countResult = await this.db.execute(sql`
      SELECT COUNT(*)
      FROM mentor m
      LEFT JOIN "user" u ON m.id = u.id
      WHERE m.id IS NOT NULL
      ${searchFilter}
    `);
    const total = parseInt(countResult.rows[0].count.toString()) || 0;

    // Fetch data
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
      LIMIT ${pageSize} OFFSET ${offset}
    `);

    const mentors = result.rows.map((row) => this.mapRowToMentor(row));

    return {
      data: mentors,
      total,
      page,
      pageSize,
      totalPages: total === 0 ? 1 : Math.ceil(total / pageSize)
    };
  }

  async getMentorItem(mentorId: string): Promise<any> {
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
      WHERE m.id = ${mentorId}
      LIMIT 1
    `);

    if (result.rows.length === 0) {
      return null;
    }

    return this.mapRowToMentor(result.rows[0]);
  }

  async getMentorProfile(mentorId: string): Promise<any> {
    return this.getMentorItem(mentorId);
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

  private mapRowToMentor(row: Record<string, unknown>): any {
    return {
      id: String(row.id || ''),
      userId: String(row.id || ''),
      status: row.status ? String(row.status) : undefined,
      type: row.type ? String(row.type) : undefined,
      company: row.company ? String(row.company) : undefined,
      companyTitle: row.company_title ? String(row.company_title) : undefined,
      briefIntro: row.brief_intro ? String(row.brief_intro) : undefined,
      school: row.high_school ? String(row.high_school) : undefined,
      location: row.location ? String(row.location) : undefined,
      level: row.level ? String(row.level) : undefined,
      rating: row.rating === null || row.rating === undefined ? null : Number(row.rating),
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

