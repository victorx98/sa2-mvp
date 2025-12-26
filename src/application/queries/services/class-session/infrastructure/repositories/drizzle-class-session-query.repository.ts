import { Injectable, Inject } from '@nestjs/common';
import { eq, and, ne, desc, inArray } from 'drizzle-orm';
import { DATABASE_CONNECTION } from '@infrastructure/database/database.provider';
import { classSessions } from '@infrastructure/database/schema/class-sessions.schema';
import { meetings } from '@infrastructure/database/schema/meetings.schema';
import { userTable } from '@infrastructure/database/schema/user.schema';
import type { DrizzleDatabase } from '@shared/types/database.types';
import { ClassSessionStatus } from '@domains/services/class';
import { ClassSessionNotFoundException } from '@domains/services/class/shared/exceptions/class-session-not-found.exception';
import {
  IClassSessionQueryRepository,
  CLASS_SESSION_QUERY_REPOSITORY,
  ClassSessionQueryDto,
  ClassSessionReadModel,
} from '../../interfaces/class-session-query.repository.interface';

@Injectable()
export class DrizzleClassSessionQueryRepository implements IClassSessionQueryRepository {
  constructor(
    @Inject(DATABASE_CONNECTION)
    private readonly db: DrizzleDatabase,
  ) {}

  async getSessionsByClass(
    classId: string,
    filters?: ClassSessionQueryDto,
  ): Promise<ClassSessionReadModel[]> {
    const excludeDeleted = filters?.excludeDeleted !== false;
    const limit = filters?.limit || 10;
    const offset = filters?.offset || 0;

    const whereConditions: any[] = [eq(classSessions.classId, classId as any)];
    if (excludeDeleted) {
      whereConditions.push(ne(classSessions.status, ClassSessionStatus.DELETED));
    }
    if (filters?.status) {
      whereConditions.push(eq(classSessions.status, filters.status));
    }

    const results = await this.db
      .select({
        session: classSessions,
        meeting: meetings,
      })
      .from(classSessions)
      .leftJoin(meetings, eq(classSessions.meetingId, meetings.id))
      .where(and(...whereConditions))
      .orderBy(desc(classSessions.scheduledAt))
      .limit(limit)
      .offset(offset);

    return this.enrichWithUserNames(results);
  }

  async getMentorSessions(
    mentorId: string,
    filters?: ClassSessionQueryDto,
  ): Promise<ClassSessionReadModel[]> {
    const excludeDeleted = filters?.excludeDeleted !== false;
    const limit = filters?.limit || 10;
    const offset = filters?.offset || 0;

    const whereConditions: any[] = [eq(classSessions.mentorUserId, mentorId as any)];
    if (excludeDeleted) {
      whereConditions.push(ne(classSessions.status, ClassSessionStatus.DELETED));
    }
    if (filters?.status) {
      whereConditions.push(eq(classSessions.status, filters.status));
    }

    const results = await this.db
      .select({
        session: classSessions,
        meeting: meetings,
      })
      .from(classSessions)
      .leftJoin(meetings, eq(classSessions.meetingId, meetings.id))
      .where(and(...whereConditions))
      .orderBy(desc(classSessions.scheduledAt))
      .limit(limit)
      .offset(offset);

    return this.enrichWithUserNames(results);
  }

  async getSessionById(id: string): Promise<ClassSessionReadModel> {
    const results = await this.db
      .select({
        session: classSessions,
        meeting: meetings,
      })
      .from(classSessions)
      .leftJoin(meetings, eq(classSessions.meetingId, meetings.id))
      .where(eq(classSessions.id, id));

    const enriched = await this.enrichWithUserNames(results);
    if (enriched.length === 0) {
      throw new ClassSessionNotFoundException(id);
    }
    return enriched[0];
  }

  private async enrichWithUserNames(
    results: Array<{ session: any; meeting: any }>,
  ): Promise<ClassSessionReadModel[]> {
    if (results.length === 0) return [];

    const userIds = new Set<string>();
    results.forEach(({ session }) => {
      if (session.mentorUserId) userIds.add(session.mentorUserId);
    });

    const userIdsArray = Array.from(userIds);
    const users = userIdsArray.length > 0
      ? await this.db
          .select()
          .from(userTable)
          .where(inArray(userTable.id, userIdsArray as any))
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
      classId: session.classId,
      meetingId: session.meetingId,
      mentorUserId: session.mentorUserId,
      createdByCounselorId: session.createdByCounselorId || null, // Add createdByCounselorId field
      title: session.title,
      description: session.description,
      status: session.status,
      scheduledAt: session.scheduledAt ? session.scheduledAt.toISOString() : null,
      duration: meeting?.scheduleDuration || null,
      scheduleStartTime: meeting?.scheduleStartTime ? meeting.scheduleStartTime.toISOString() : null,
      meetingProvider: meeting?.meetingProvider || null,
      mentorName: formatUserName(session.mentorUserId),
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
