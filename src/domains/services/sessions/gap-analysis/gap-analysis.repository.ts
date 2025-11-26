import { Injectable, Inject } from '@nestjs/common';
import { eq, and, desc, ne } from 'drizzle-orm';
import type { DrizzleDatabase } from '@shared/types/database.types';
import { DATABASE_CONNECTION } from '@infrastructure/database/database.provider';
import { gapAnalysisSessions } from '@infrastructure/database/schema/gap-analysis-sessions.schema';
import { SessionStatus } from '../shared/enums/session-type.enum';
import type { GapAnalysisSessionEntity } from './entities/gap-analysis-session.entity';

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

  async update(id: string, data: Partial<GapAnalysisSessionEntity>): Promise<void> {
    await this.db
      .update(gapAnalysisSessions)
      .set(data)
      .where(eq(gapAnalysisSessions.id, id));
  }

  async findByMentorId(
    mentorId: string,
    excludeDeleted: boolean = true,
  ): Promise<GapAnalysisSessionEntity[]> {
    const whereConditions = excludeDeleted
      ? and(
          eq(gapAnalysisSessions.mentorUserId, mentorId),
          ne(gapAnalysisSessions.status, SessionStatus.DELETED),
        )
      : eq(gapAnalysisSessions.mentorUserId, mentorId);

    return this.db.query.gapAnalysisSessions.findMany({
      where: whereConditions,
      orderBy: desc(gapAnalysisSessions.scheduledAt),
    });
  }

  async findByStudentId(
    studentId: string,
    excludeDeleted: boolean = true,
  ): Promise<GapAnalysisSessionEntity[]> {
    const whereConditions = excludeDeleted
      ? and(
          eq(gapAnalysisSessions.studentUserId, studentId),
          ne(gapAnalysisSessions.status, SessionStatus.DELETED),
        )
      : eq(gapAnalysisSessions.studentUserId, studentId);

    return this.db.query.gapAnalysisSessions.findMany({
      where: whereConditions,
      orderBy: desc(gapAnalysisSessions.scheduledAt),
    });
  }
}
