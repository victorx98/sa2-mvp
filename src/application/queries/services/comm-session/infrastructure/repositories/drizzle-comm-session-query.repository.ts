import { Injectable, Inject } from '@nestjs/common';
import { eq, inArray, and, ne, desc } from 'drizzle-orm';
import { DATABASE_CONNECTION } from '@infrastructure/database/database.provider';
import { commSessions } from '@infrastructure/database/schema/comm-sessions.schema';
import { meetings } from '@infrastructure/database/schema/meetings.schema';
import { userTable } from '@infrastructure/database/schema/user.schema';
import type { DrizzleDatabase } from '@shared/types/database.types';
import { SessionStatus } from '@domains/services/comm-sessions/value-objects/session-status.vo';
import {
  ICommSessionQueryRepository,
  COMM_SESSION_QUERY_REPOSITORY,
  CommSessionQueryDto,
  CommSessionReadModel,
} from '../../interfaces/comm-session-query.repository.interface';

@Injectable()
export class DrizzleCommSessionQueryRepository implements ICommSessionQueryRepository {
  constructor(
    @Inject(DATABASE_CONNECTION)
    private readonly db: DrizzleDatabase,
  ) {}

  async getMentorSessions(
    mentorId: string,
    filters?: CommSessionQueryDto,
  ): Promise<CommSessionReadModel[]> {
    const excludeDeleted = filters?.excludeDeleted !== false;
    const limit = filters?.limit || 10;
    const offset = filters?.offset || 0;

    const whereConditions: any[] = [eq(commSessions.mentorUserId, mentorId)];
    if (excludeDeleted) {
      whereConditions.push(ne(commSessions.status, SessionStatus.DELETED));
    }
    if (filters?.status) {
      whereConditions.push(eq(commSessions.status, filters.status));
    }

    const results = await this.db
      .select({
        session: commSessions,
        meeting: meetings,
      })
      .from(commSessions)
      .leftJoin(meetings, eq(commSessions.meetingId, meetings.id))
      .where(and(...whereConditions))
      .orderBy(desc(commSessions.scheduledAt))
      .limit(limit)
      .offset(offset);

    return this.enrichWithUserNames(results);
  }

  async getStudentSessions(
    studentId: string,
    filters?: CommSessionQueryDto,
  ): Promise<CommSessionReadModel[]> {
    const excludeDeleted = filters?.excludeDeleted !== false;
    const limit = filters?.limit || 10;
    const offset = filters?.offset || 0;

    const whereConditions: any[] = [eq(commSessions.studentUserId, studentId)];
    if (excludeDeleted) {
      whereConditions.push(ne(commSessions.status, SessionStatus.DELETED));
    }
    if (filters?.status) {
      whereConditions.push(eq(commSessions.status, filters.status));
    }

    const results = await this.db
      .select({
        session: commSessions,
        meeting: meetings,
      })
      .from(commSessions)
      .leftJoin(meetings, eq(commSessions.meetingId, meetings.id))
      .where(and(...whereConditions))
      .orderBy(desc(commSessions.scheduledAt))
      .limit(limit)
      .offset(offset);

    return this.enrichWithUserNames(results);
  }

  async getSessionsByStudentIds(
    studentIds: string[],
    filters?: CommSessionQueryDto,
  ): Promise<CommSessionReadModel[]> {
    if (studentIds.length === 0) return [];

    const excludeDeleted = filters?.excludeDeleted !== false;

    const whereConditions: any[] = [inArray(commSessions.studentUserId, studentIds)];
    if (excludeDeleted) {
      whereConditions.push(ne(commSessions.status, SessionStatus.DELETED));
    }
    if (filters?.status) {
      whereConditions.push(eq(commSessions.status, filters.status));
    }

    const results = await this.db
      .select({
        session: commSessions,
        meeting: meetings,
      })
      .from(commSessions)
      .leftJoin(meetings, eq(commSessions.meetingId, meetings.id))
      .where(and(...whereConditions))
      .orderBy(desc(commSessions.scheduledAt));

    return this.enrichWithUserNames(results);
  }

  async getSessionById(id: string): Promise<CommSessionReadModel> {
    const results = await this.db
      .select({
        session: commSessions,
        meeting: meetings,
      })
      .from(commSessions)
      .leftJoin(meetings, eq(commSessions.meetingId, meetings.id))
      .where(eq(commSessions.id, id));

    const enriched = await this.enrichWithUserNames(results);
    return enriched[0];
  }

  private async enrichWithUserNames(
    results: Array<{ session: any; meeting: any }>,
  ): Promise<CommSessionReadModel[]> {
    if (results.length === 0) return [];

    const userIds = new Set<string>();
    results.forEach(({ session }) => {
      if (session.studentUserId) userIds.add(session.studentUserId);
      if (session.mentorUserId) userIds.add(session.mentorUserId);
      if (session.counselorUserId) userIds.add(session.counselorUserId);
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
      title: session.title,
      description: session.description,
      studentUserId: session.studentUserId,
      mentorUserId: session.mentorUserId,
      counselorUserId: session.counselorUserId,
      createdByCounselorId: session.createdByCounselorId,
      meetingId: session.meetingId,
      scheduledAt: session.scheduledAt ? session.scheduledAt.toISOString() : null,
      status: session.status,
      duration: meeting?.scheduleDuration || null,
      scheduleStartTime: meeting?.scheduleStartTime ? meeting.scheduleStartTime.toISOString() : null,
      meetingProvider: meeting?.meetingProvider || null,
      studentName: formatUserName(session.studentUserId),
      mentorName: session.mentorUserId ? formatUserName(session.mentorUserId) : null,
      counselorName: session.counselorUserId ? formatUserName(session.counselorUserId) : null,
      createdByCounselorName: session.createdByCounselorId ? formatUserName(session.createdByCounselorId) : null,
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
      createdAt: session.createdAt.toISOString(),
      updatedAt: session.updatedAt.toISOString(),
    }));
  }
}
