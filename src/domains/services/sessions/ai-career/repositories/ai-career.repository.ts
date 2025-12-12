import { Injectable, Inject } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import type { DrizzleDatabase, DrizzleTransaction } from '@shared/types/database.types';
import { DATABASE_CONNECTION } from '@infrastructure/database/database.provider';
import { aiCareerSessions } from '@infrastructure/database/schema/ai-career-sessions.schema';
import type { AiCareerSessionEntity } from '../entities/ai-career-session.entity';

@Injectable()
export class AiCareerRepository {
  constructor(
    @Inject(DATABASE_CONNECTION)
    private readonly db: DrizzleDatabase,
  ) {}

  async findOne(id: string): Promise<AiCareerSessionEntity | null> {
    const result = await this.db.query.aiCareerSessions.findFirst({
      where: eq(aiCareerSessions.id, id),
    });
    return result || null;
  }

  async findByMeetingId(meetingId: string): Promise<AiCareerSessionEntity | null> {
    const result = await this.db.query.aiCareerSessions.findFirst({
      where: eq(aiCareerSessions.meetingId, meetingId),
    });
    return result || null;
  }

  async create(data: Partial<AiCareerSessionEntity>, tx?: any): Promise<AiCareerSessionEntity> {
    const db = tx || this.db;
    const [result] = await db
      .insert(aiCareerSessions)
      .values(data as any)
      .returning();
    return result;
  }

  async update(
    id: string,
    data: Partial<AiCareerSessionEntity>,
    tx?: DrizzleTransaction,
  ): Promise<void> {
    const db = tx || this.db;
    await db
      .update(aiCareerSessions)
      .set(data)
      .where(eq(aiCareerSessions.id, id));
  }

}

