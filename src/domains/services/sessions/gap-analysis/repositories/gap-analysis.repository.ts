import { Injectable, Inject } from '@nestjs/common';
import { eq, and, desc, ne, inArray } from 'drizzle-orm';
import type { DrizzleDatabase, DrizzleTransaction } from '@shared/types/database.types';
import { DATABASE_CONNECTION } from '@infrastructure/database/database.provider';
import { gapAnalysisSessions } from '@infrastructure/database/schema/gap-analysis-sessions.schema';
import { meetings } from '@infrastructure/database/schema/meetings.schema';
import { SessionStatus } from '../../shared/enums/session-type.enum';
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

  async findByStudentIds(
    studentIds: string[],
    excludeDeleted: boolean = true,
  ): Promise<(GapAnalysisSessionEntity & { meeting?: any })[]> {
    if (studentIds.length === 0) {
      return [];
    }

    const whereConditions = excludeDeleted
      ? and(
          inArray(gapAnalysisSessions.studentUserId, studentIds),
          ne(gapAnalysisSessions.status, SessionStatus.DELETED),
        )
      : inArray(gapAnalysisSessions.studentUserId, studentIds);

    // Manual LEFT JOIN with meetings table to include meeting details
    const results = await this.db
      .select({
        session: gapAnalysisSessions,
        meeting: meetings,
      })
      .from(gapAnalysisSessions)
      .leftJoin(meetings, eq(gapAnalysisSessions.meetingId, meetings.id))
      .where(whereConditions)
      .orderBy(desc(gapAnalysisSessions.scheduledAt));

    // Map results to include meeting data
    return results.map(row => ({
      ...row.session,
      meeting: row.meeting || undefined,
    }));
  }
}

