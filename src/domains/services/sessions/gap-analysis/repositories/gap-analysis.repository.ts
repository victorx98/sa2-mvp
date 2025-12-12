import { Injectable, Inject } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import type { DrizzleDatabase, DrizzleTransaction } from '@shared/types/database.types';
import { DATABASE_CONNECTION } from '@infrastructure/database/database.provider';
import { gapAnalysisSessions } from '@infrastructure/database/schema/gap-analysis-sessions.schema';
import type { GapAnalysisSessionEntity } from '../entities/gap-analysis-session.entity';

@Injectable()
export class GapAnalysisRepository {
  constructor(
    @Inject(DATABASE_CONNECTION)
    private readonly db: DrizzleDatabase,
  ) {}

  async findOne(id: string): Promise<GapAnalysisSessionEntity | null> {
    const result = await this.db.query.gapAnalysisSessions.findFirst({
      where: eq(gapAnalysisSessions.id, id),
    });
    return result || null;
  }

  async findByMeetingId(meetingId: string): Promise<GapAnalysisSessionEntity | null> {
    const result = await this.db.query.gapAnalysisSessions.findFirst({
      where: eq(gapAnalysisSessions.meetingId, meetingId),
    });
    return result || null;
  }

  async create(data: Partial<GapAnalysisSessionEntity>, tx?: any): Promise<GapAnalysisSessionEntity> {
    const db = tx || this.db;
    const [result] = await db
      .insert(gapAnalysisSessions)
      .values(data as any)
      .returning();
    return result;
  }

  async update(
    id: string,
    data: Partial<GapAnalysisSessionEntity>,
    tx?: DrizzleTransaction,
  ): Promise<void> {
    const db = tx || this.db;
    await db
      .update(gapAnalysisSessions)
      .set(data)
      .where(eq(gapAnalysisSessions.id, id));
  }

}

