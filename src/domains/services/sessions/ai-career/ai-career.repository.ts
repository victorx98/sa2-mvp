import { Injectable, Inject } from '@nestjs/common';
import { eq, and, desc, ne } from 'drizzle-orm';
import type { DrizzleDatabase } from '@shared/types/database.types';
import { DATABASE_CONNECTION } from '@infrastructure/database/database.provider';
import { aiCareerSessions } from '@infrastructure/database/schema/ai-career-sessions.schema';
import { SessionStatus } from '../shared/enums/session-type.enum';
import type { AiCareerSessionEntity } from './entities/ai-career-session.entity';

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

  async update(id: string, data: Partial<AiCareerSessionEntity>): Promise<void> {
    await this.db
      .update(aiCareerSessions)
      .set(data)
      .where(eq(aiCareerSessions.id, id));
  }

  async findByMentorId(
    mentorId: string,
    excludeDeleted: boolean = true,
  ): Promise<AiCareerSessionEntity[]> {
    const whereConditions = excludeDeleted
      ? and(
          eq(aiCareerSessions.mentorUserId, mentorId),
          ne(aiCareerSessions.status, SessionStatus.DELETED),
        )
      : eq(aiCareerSessions.mentorUserId, mentorId);

    return this.db.query.aiCareerSessions.findMany({
      where: whereConditions,
      orderBy: desc(aiCareerSessions.scheduledAt),
    });
  }

  async findByStudentId(
    studentId: string,
    excludeDeleted: boolean = true,
  ): Promise<AiCareerSessionEntity[]> {
    const whereConditions = excludeDeleted
      ? and(
          eq(aiCareerSessions.studentUserId, studentId),
          ne(aiCareerSessions.status, SessionStatus.DELETED),
        )
      : eq(aiCareerSessions.studentUserId, studentId);

    return this.db.query.aiCareerSessions.findMany({
      where: whereConditions,
      orderBy: desc(aiCareerSessions.scheduledAt),
    });
  }
}
