import { Injectable, Inject } from '@nestjs/common';
import { eq, inArray, and, ne, desc } from 'drizzle-orm';
import { DATABASE_CONNECTION } from '@infrastructure/database/database.provider';
import { regularMentoringSessions } from '@infrastructure/database/schema/regular-mentoring-sessions.schema';
import { meetings } from '@infrastructure/database/schema/meetings.schema';
import { userTable } from '@infrastructure/database/schema/user.schema';
import type { DrizzleDatabase } from '@shared/types/database.types';
import {
  IRegularMentoringQueryRepository,
  REGULAR_MENTORING_QUERY_REPOSITORY,
  RegularMentoringQueryDto,
  RegularMentoringReadModel,
} from '../../interfaces/regular-mentoring-query.repository.interface';

@Injectable()
export class DrizzleRegularMentoringQueryRepository implements IRegularMentoringQueryRepository {
  constructor(
    @Inject(DATABASE_CONNECTION)
    private readonly db: DrizzleDatabase,
  ) {}

  async getMentorSessions(
    mentorId: string,
    filters?: RegularMentoringQueryDto,
  ): Promise<RegularMentoringReadModel[]> {
    const excludeDeleted = filters?.excludeDeleted !== false;
    const limit = filters?.limit || 10;
    const offset = filters?.offset || 0;

    const whereConditions: any[] = [eq(regularMentoringSessions.mentorUserId, mentorId)];
    if (excludeDeleted) {
      whereConditions.push(ne(regularMentoringSessions.status, 'deleted' as any));
    }
    if (filters?.status) {
      whereConditions.push(eq(regularMentoringSessions.status, filters.status));
    }

    const results = await this.db
      .select({
        session: regularMentoringSessions,
        meeting: meetings,
      })
      .from(regularMentoringSessions)
      .leftJoin(meetings, eq(regularMentoringSessions.meetingId, meetings.id))
      .where(and(...whereConditions))
      .orderBy(desc(regularMentoringSessions.scheduledAt))
      .limit(limit)
      .offset(offset);

    return this.enrichWithUserNames(results);
  }

  async getStudentSessions(
    studentId: string,
    filters?: RegularMentoringQueryDto,
  ): Promise<RegularMentoringReadModel[]> {
    const excludeDeleted = filters?.excludeDeleted !== false;
    const limit = filters?.limit || 10;
    const offset = filters?.offset || 0;

    const whereConditions: any[] = [eq(regularMentoringSessions.studentUserId, studentId)];
    if (excludeDeleted) {
      whereConditions.push(ne(regularMentoringSessions.status, 'deleted' as any));
    }
    if (filters?.status) {
      whereConditions.push(eq(regularMentoringSessions.status, filters.status));
    }

    const results = await this.db
      .select({
        session: regularMentoringSessions,
        meeting: meetings,
      })
      .from(regularMentoringSessions)
      .leftJoin(meetings, eq(regularMentoringSessions.meetingId, meetings.id))
      .where(and(...whereConditions))
      .orderBy(desc(regularMentoringSessions.scheduledAt))
      .limit(limit)
      .offset(offset);

    return this.enrichWithUserNames(results);
  }

  async getSessionsByStudentIds(
    studentIds: string[],
    filters?: RegularMentoringQueryDto,
  ): Promise<RegularMentoringReadModel[]> {
    if (studentIds.length === 0) return [];

    const excludeDeleted = filters?.excludeDeleted !== false;

    const whereConditions: any[] = [inArray(regularMentoringSessions.studentUserId, studentIds)];
    if (excludeDeleted) {
      whereConditions.push(ne(regularMentoringSessions.status, 'deleted' as any));
    }
    if (filters?.status) {
      whereConditions.push(eq(regularMentoringSessions.status, filters.status));
    }

    const results = await this.db
      .select({
        session: regularMentoringSessions,
        meeting: meetings,
      })
      .from(regularMentoringSessions)
      .leftJoin(meetings, eq(regularMentoringSessions.meetingId, meetings.id))
      .where(and(...whereConditions))
      .orderBy(desc(regularMentoringSessions.scheduledAt));

    return this.enrichWithUserNames(results);
  }

  async getSessionById(id: string): Promise<RegularMentoringReadModel> {
    const results = await this.db
      .select({
        session: regularMentoringSessions,
        meeting: meetings,
      })
      .from(regularMentoringSessions)
      .leftJoin(meetings, eq(regularMentoringSessions.meetingId, meetings.id))
      .where(eq(regularMentoringSessions.id, id));

    const enriched = await this.enrichWithUserNames(results);
    return enriched[0];
  }

  private async enrichWithUserNames(
    results: Array<{ session: any; meeting: any }>,
  ): Promise<RegularMentoringReadModel[]> {
    if (results.length === 0) return [];

    const userIds = new Set<string>();
    results.forEach(({ session }) => {
      if (session.studentUserId) userIds.add(session.studentUserId);
      if (session.mentorUserId) userIds.add(session.mentorUserId);
      if (session.createdByCounselorId) userIds.add(session.createdByCounselorId);
    });

    const userIdsArray = Array.from(userIds);
    const users = userIdsArray.length > 0
      ? await this.db.select().from(userTable).where(inArray(userTable.id, userIdsArray as any))
      : [];
    const userMap = new Map(users.map(u => [u.id, u]));

    const formatUserName = (userId: string) => {
      const user = userMap.get(userId);
      if (!user) return null;
      return {
        en: user.nameEn || '',
        zh: user.nameZh || '',
      };
    };

    return results.map(({ session, meeting }) => ({
      id: session.id,
      sessionType: session.sessionType,
      sessionTypeId: session.sessionTypeId,
      serviceType: session.serviceType,
      studentUserId: session.studentUserId,
      mentorUserId: session.mentorUserId,
      createdByCounselorId: session.createdByCounselorId,
      serviceHoldId: session.serviceHoldId,
      meetingId: session.meetingId,
      title: session.title,
      description: session.description,
      status: session.status,
      scheduledAt: session.scheduledAt ? session.scheduledAt.toISOString() : null,
      duration: meeting?.scheduleDuration || null,
      scheduleStartTime: meeting?.scheduleStartTime ? meeting.scheduleStartTime.toISOString() : null,
      meetingProvider: meeting?.meetingProvider || null,
      studentName: formatUserName(session.studentUserId),
      mentorName: formatUserName(session.mentorUserId),
      counselorName: session.createdByCounselorId ? formatUserName(session.createdByCounselorId) : null,
      meeting: meeting ? {
        id: meeting.id,
        meetingNo: meeting.meetingNo || '',
        meetingId: meeting.meetingId || '',
        meetingProvider: meeting.meetingProvider || '',
        topic: meeting.topic || '',
        meetingUrl: meeting.meetingUrl || '',
        ownerId: meeting.ownerId || '',
        scheduleStartTime: meeting.scheduleStartTime ? meeting.scheduleStartTime.toISOString() : null,
        scheduleDuration: meeting.scheduleDuration,
        status: meeting.status || '',
        createdAt: meeting.createdAt ? meeting.createdAt.toISOString() : '',
        updatedAt: meeting.updatedAt ? meeting.updatedAt.toISOString() : '',
      } : undefined,
      aiSummaries: session.aiSummaries || [],
      createdAt: session.createdAt.toISOString(),
      updatedAt: session.updatedAt.toISOString(),
    }));
  }
}
