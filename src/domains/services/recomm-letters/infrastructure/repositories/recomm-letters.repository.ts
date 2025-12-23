import { Injectable, Inject } from '@nestjs/common';
import { eq, and, ne, sql } from 'drizzle-orm';
import type { DrizzleDatabase } from '@shared/types/database.types';
import { DATABASE_CONNECTION } from '@infrastructure/database/database.provider';
import { IRecommLettersRepository } from '../../repositories/recomm-letters.repository.interface';

/**
 * Recommendation Letters Repository Implementation
 * 
 * Drizzle ORM implementation for recommendation letters data access
 */
@Injectable()
export class RecommLettersRepository implements IRecommLettersRepository {
  constructor(
    @Inject(DATABASE_CONNECTION)
    private readonly db: DrizzleDatabase,
  ) {}

  async countByStudentGroupByType(studentUserId: string): Promise<Record<string, number>> {
    const results = await this.db.execute(sql`
      SELECT service_type, COUNT(*)::int as count
      FROM recomm_letters
      WHERE student_user_id = ${studentUserId}
        AND status != 'deleted'
      GROUP BY service_type
    `);

    const counts: Record<string, number> = {};
    for (const row of results.rows) {
      counts[row.service_type as string] = row.count as number;
    }
    
    return counts;
  }
}

