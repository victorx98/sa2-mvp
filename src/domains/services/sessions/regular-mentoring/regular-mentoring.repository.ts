import { Injectable, Inject } from '@nestjs/common';
import { eq, and, desc, ne } from 'drizzle-orm';
import type { DrizzleDatabase } from '@shared/types/database.types';
import { DATABASE_CONNECTION } from '@infrastructure/database/database.provider';
import { regularMentoringSessions } from '@infrastructure/database/schema/regular-mentoring-sessions.schema';
import { SessionStatus } from '../shared/enums/session-type.enum';
import type { RegularMentoringSessionEntity } from './entities/regular-mentoring-session.entity';

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

  async update(id: string, data: Partial<RegularMentoringSessionEntity>): Promise<void> {
    await this.db
      .update(regularMentoringSessions)
      .set(data)
      .where(eq(regularMentoringSessions.id, id));
  }

  async findByMentorId(
    mentorId: string,
    excludeDeleted: boolean = true,
  ): Promise<RegularMentoringSessionEntity[]> {
    const whereConditions = excludeDeleted
      ? and(
          eq(regularMentoringSessions.mentorUserId, mentorId),
          ne(regularMentoringSessions.status, SessionStatus.DELETED),
        )
      : eq(regularMentoringSessions.mentorUserId, mentorId);

    return this.db.query.regularMentoringSessions.findMany({
      where: whereConditions,
      orderBy: desc(regularMentoringSessions.scheduledAt),
    });
  }

  async findByStudentId(
    studentId: string,
    excludeDeleted: boolean = true,
  ): Promise<RegularMentoringSessionEntity[]> {
    const whereConditions = excludeDeleted
      ? and(
          eq(regularMentoringSessions.studentUserId, studentId),
          ne(regularMentoringSessions.status, SessionStatus.DELETED),
        )
      : eq(regularMentoringSessions.studentUserId, studentId);

    return this.db.query.regularMentoringSessions.findMany({
      where: whereConditions,
      orderBy: desc(regularMentoringSessions.scheduledAt),
    });
  }
}

