import { Injectable, Inject } from '@nestjs/common';
import { eq, and, desc, ne, inArray } from 'drizzle-orm';
import type { DrizzleDatabase, DrizzleTransaction } from '@shared/types/database.types';
import { DATABASE_CONNECTION } from '@infrastructure/database/database.provider';
import { aiCareerSessions } from '@infrastructure/database/schema/ai-career-sessions.schema';
import { meetings } from '@infrastructure/database/schema/meetings.schema';
import { SessionStatus } from '../../shared/enums/session-type.enum';
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

  async findByStudentIds(
    studentIds: string[],
    excludeDeleted: boolean = true,
  ): Promise<(AiCareerSessionEntity & { meeting?: any })[]> {
    if (studentIds.length === 0) {
      return [];
    }

    const whereConditions = excludeDeleted
      ? and(
          inArray(aiCareerSessions.studentUserId, studentIds),
          ne(aiCareerSessions.status, SessionStatus.DELETED),
        )
      : inArray(aiCareerSessions.studentUserId, studentIds);

    // Manual LEFT JOIN with meetings table to include meeting details
    const results = await this.db
      .select({
        session: aiCareerSessions,
        meeting: meetings,
      })
      .from(aiCareerSessions)
      .leftJoin(meetings, eq(aiCareerSessions.meetingId, meetings.id))
      .where(whereConditions)
      .orderBy(desc(aiCareerSessions.scheduledAt));

    // Map results to include meeting data
    return results.map(row => ({
      ...row.session,
      meeting: row.meeting || undefined,
    }));
  }
}

