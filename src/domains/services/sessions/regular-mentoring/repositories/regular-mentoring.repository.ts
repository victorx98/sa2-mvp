import { Injectable, Inject } from '@nestjs/common';
import { eq, and, desc, ne, inArray } from 'drizzle-orm';
import type { DrizzleDatabase, DrizzleTransaction } from '@shared/types/database.types';
import { DATABASE_CONNECTION } from '@infrastructure/database/database.provider';
import { regularMentoringSessions } from '@infrastructure/database/schema/regular-mentoring-sessions.schema';
import { meetings } from '@infrastructure/database/schema/meetings.schema';
import { SessionStatus } from '../../shared/enums/session-type.enum';
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

  async findByMentorId(
    mentorId: string,
    excludeDeleted: boolean = true,
  ): Promise<(RegularMentoringSessionEntity & { meeting?: any })[]> {
    const whereConditions = excludeDeleted
      ? and(
          eq(regularMentoringSessions.mentorUserId, mentorId),
          ne(regularMentoringSessions.status, SessionStatus.DELETED),
        )
      : eq(regularMentoringSessions.mentorUserId, mentorId);

    // Manual LEFT JOIN with meetings table to include meeting details
    const results = await this.db
      .select({
        session: regularMentoringSessions,
        meeting: meetings,
      })
      .from(regularMentoringSessions)
      .leftJoin(meetings, eq(regularMentoringSessions.meetingId, meetings.id))
      .where(whereConditions)
      .orderBy(desc(regularMentoringSessions.scheduledAt));

    // Transform results to match expected format
    return results.map((row) => ({
      ...row.session,
      meeting: row.meeting || undefined,
    })) as any;
  }

  async findByStudentId(
    studentId: string,
    excludeDeleted: boolean = true,
  ): Promise<(RegularMentoringSessionEntity & { meeting?: any })[]> {
    const whereConditions = excludeDeleted
      ? and(
          eq(regularMentoringSessions.studentUserId, studentId),
          ne(regularMentoringSessions.status, SessionStatus.DELETED),
        )
      : eq(regularMentoringSessions.studentUserId, studentId);

    // Manual LEFT JOIN with meetings table to include meeting details
    const results = await this.db
      .select({
        session: regularMentoringSessions,
        meeting: meetings,
      })
      .from(regularMentoringSessions)
      .leftJoin(meetings, eq(regularMentoringSessions.meetingId, meetings.id))
      .where(whereConditions)
      .orderBy(desc(regularMentoringSessions.scheduledAt));

    // Transform results to match expected format
    return results.map((row) => ({
      ...row.session,
      meeting: row.meeting || undefined,
    })) as any;
  }

  /**
   * Find sessions by multiple student IDs (batch query for counselor)
   * Includes meeting details via LEFT JOIN
   * @param studentIds Array of student IDs
   * @param excludeDeleted Whether to exclude deleted sessions
   * @returns Array of regular mentoring sessions with meeting information
   */
  async findByStudentIds(
    studentIds: string[],
    excludeDeleted: boolean = true,
  ): Promise<(RegularMentoringSessionEntity & { meeting?: any })[]> {
    if (studentIds.length === 0) {
      return [];
    }

    const whereConditions = excludeDeleted
      ? and(
          inArray(regularMentoringSessions.studentUserId, studentIds),
          ne(regularMentoringSessions.status, SessionStatus.DELETED),
        )
      : inArray(regularMentoringSessions.studentUserId, studentIds);

    // Manual LEFT JOIN with meetings table to include meeting details
    const results = await this.db
      .select({
        session: regularMentoringSessions,
        meeting: meetings,
      })
      .from(regularMentoringSessions)
      .leftJoin(meetings, eq(regularMentoringSessions.meetingId, meetings.id))
      .where(whereConditions)
      .orderBy(desc(regularMentoringSessions.scheduledAt));

    // Transform results to match expected format
    return results.map((row) => ({
      ...row.session,
      meeting: row.meeting || undefined,
    })) as any;
  }
}

