import { Injectable, Inject } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import type { DrizzleDatabase, DrizzleTransaction } from '@shared/types/database.types';
import { DATABASE_CONNECTION } from '@infrastructure/database/database.provider';
import { regularMentoringSessions } from '@infrastructure/database/schema/regular-mentoring-sessions.schema';
import type { RegularMentoringSessionEntity } from '../entities/regular-mentoring-session.entity';

@Injectable()
export class RegularMentoringRepository {
  constructor(
    @Inject(DATABASE_CONNECTION)
    private readonly db: DrizzleDatabase,
  ) {}

  async findOne(id: string): Promise<RegularMentoringSessionEntity | null> {
    const result = await this.db.query.regularMentoringSessions.findFirst({
      where: eq(regularMentoringSessions.id, id),
    });
    return result || null;
  }

  async findByMeetingId(meetingId: string): Promise<RegularMentoringSessionEntity | null> {
    const result = await this.db.query.regularMentoringSessions.findFirst({
      where: eq(regularMentoringSessions.meetingId, meetingId),
    });
    return result || null;
  }

  async create(data: Partial<RegularMentoringSessionEntity>, tx?: any): Promise<RegularMentoringSessionEntity> {
    const db = tx || this.db;
    const [result] = await db
      .insert(regularMentoringSessions)
      .values(data as any)
      .returning();
    return result;
  }

  async update(
    id: string,
    data: Partial<RegularMentoringSessionEntity>,
    tx?: DrizzleTransaction,
  ): Promise<void> {
    const db = tx || this.db;
    await db
      .update(regularMentoringSessions)
      .set(data)
      .where(eq(regularMentoringSessions.id, id));
  }

}

