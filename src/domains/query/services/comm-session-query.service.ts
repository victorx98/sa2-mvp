import { Injectable, Logger, Inject } from '@nestjs/common';
import { eq, inArray, and, ne, desc } from 'drizzle-orm';
import { CommSessionRepository } from '@domains/services/comm-sessions/repositories/comm-session.repository';
import { CommSessionStatus } from '@domains/services/comm-sessions/entities/comm-session.entity';
import { DATABASE_CONNECTION } from '@infrastructure/database/database.provider';
import { commSessions } from '@infrastructure/database/schema/comm-sessions.schema';
import { meetings } from '@infrastructure/database/schema/meetings.schema';
import { userTable } from '@infrastructure/database/schema/user.schema';
import type { DrizzleDatabase } from '@shared/types/database.types';
import { CommSessionNotFoundException } from '@domains/services/comm-sessions/exceptions/comm-session-not-found.exception';

/**
 * Comm Session Query Service (CQRS - Query)
 * 
 * Cross-domain Read Model: One-time JOIN across multiple domains
 * Directly queries: comm_sessions + meetings + users
 * No dependency on Repository for read operations
 */
@Injectable()
export class CommSessionQueryService {
  private readonly logger = new Logger(CommSessionQueryService.name);

  constructor(
    private readonly commSessionRepository: CommSessionRepository,
    @Inject(DATABASE_CONNECTION)
    private readonly db: DrizzleDatabase,
  ) {}

  /**
   * Get mentor's sessions with cross-domain data (one-time JOIN)
   */
  async getMentorSessions(
    mentorId: string,
    filters?: {
      status?: CommSessionStatus;
      excludeDeleted?: boolean;
    },
    limit: number = 10,
    offset: number = 0,
  ): Promise<any[]> {
    this.logger.log(`Getting comm sessions for mentor: ${mentorId}`);

    const excludeDeleted = filters?.excludeDeleted !== false;
    
    const whereConditions: any[] = [eq(commSessions.mentorUserId, mentorId)];
    if (excludeDeleted) {
      whereConditions.push(ne(commSessions.status, CommSessionStatus.DELETED));
    }
    if (filters?.status) {
      whereConditions.push(eq(commSessions.status, filters.status));
    }

    // One-time cross-domain JOIN: sessions + meetings
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

    // Batch enrich user names
    return this.enrichWithUserNames(results);
  }

  /**
   * Get student's sessions with cross-domain data (one-time JOIN)
   */
  async getStudentSessions(
    studentId: string,
    filters?: {
      status?: CommSessionStatus;
      excludeDeleted?: boolean;
    },
    limit: number = 10,
    offset: number = 0,
  ): Promise<any[]> {
    this.logger.log(`Getting comm sessions for student: ${studentId}`);

    const excludeDeleted = filters?.excludeDeleted !== false;
    
    const whereConditions: any[] = [eq(commSessions.studentUserId, studentId)];
    if (excludeDeleted) {
      whereConditions.push(ne(commSessions.status, CommSessionStatus.DELETED));
    }
    if (filters?.status) {
      whereConditions.push(eq(commSessions.status, filters.status));
    }

    // One-time cross-domain JOIN: sessions + meetings
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

    // Batch enrich user names
    return this.enrichWithUserNames(results);
  }

  /**
   * Get sessions by multiple student IDs (cross-domain JOIN)
   */
  async getSessionsByStudentIds(
    studentIds: string[],
    filters?: {
      status?: CommSessionStatus;
      excludeDeleted?: boolean;
    },
  ): Promise<any[]> {
    this.logger.log(`Getting comm sessions for ${studentIds.length} students`);

    if (studentIds.length === 0) return [];

    const excludeDeleted = filters?.excludeDeleted !== false;
    
    const whereConditions: any[] = [inArray(commSessions.studentUserId, studentIds)];
    if (excludeDeleted) {
      whereConditions.push(ne(commSessions.status, CommSessionStatus.DELETED));
    }
    if (filters?.status) {
      whereConditions.push(eq(commSessions.status, filters.status));
    }

    // One-time cross-domain JOIN: sessions + meetings
    const results = await this.db
      .select({
        session: commSessions,
        meeting: meetings,
      })
      .from(commSessions)
      .leftJoin(meetings, eq(commSessions.meetingId, meetings.id))
      .where(and(...whereConditions))
      .orderBy(desc(commSessions.scheduledAt));

    // Batch enrich user names
    return this.enrichWithUserNames(results);
  }

  /**
   * Get single session by ID (cross-domain JOIN)
   * Consistency check: scheduledAt vs scheduleStartTime for detecting failed updates
   */
  async getSessionById(id: string): Promise<any> {
    this.logger.log(`Getting comm session details with meeting info: ${id}`);
    
    // Cross-domain JOIN: sessions + meetings
    const results = await this.db
      .select({
        session: commSessions,
        meeting: meetings,
      })
      .from(commSessions)
      .leftJoin(meetings, eq(commSessions.meetingId, meetings.id))
      .where(eq(commSessions.id, id));

    if (results.length === 0) {
      throw new CommSessionNotFoundException(id);
    }

    // Batch enrich user names (single result)
    const enriched = await this.enrichWithUserNames(results);
    return enriched[0];
  }

  /**
   * Private: Batch enrich user names (avoid N+1)
   * Format: { en: "John", zh: "约翰" } for i18n support
   */
  private async enrichWithUserNames(
    results: Array<{ session: any; meeting: any }>,
  ): Promise<any[]> {
    if (results.length === 0) return [];

    // Collect all unique user IDs (student, mentor, counselor)
    const userIds = new Set<string>();
    results.forEach(({ session }) => {
      if (session.studentUserId) userIds.add(session.studentUserId);
      if (session.mentorUserId) userIds.add(session.mentorUserId);
      if (session.counselorUserId) userIds.add(session.counselorUserId);
      if (session.createdByCounselorId) userIds.add(session.createdByCounselorId);
    });

    // Batch query all users
    const userIdsArray = Array.from(userIds);
    const users = userIdsArray.length > 0
      ? await this.db.select().from(userTable).where(inArray(userTable.id, userIdsArray as any))
      : [];
    const userMap = new Map(users.map(u => [u.id, u]));

    // Format user name helper: return structured i18n object
    const formatUserName = (userId: string) => {
      const user = userMap.get(userId);
      if (!user) return null;
      return {
        en: user.nameEn || '',
        zh: user.nameZh || '',
      };
    };

    // Merge all data
    return results.map(({ session, meeting }) => ({
      ...session,
      meeting: meeting || undefined,
      duration: meeting?.scheduleDuration || undefined,
      scheduleStartTime: meeting?.scheduleStartTime || undefined,
      meetingProvider: meeting?.meetingProvider || undefined,
      studentName: formatUserName(session.studentUserId),
      mentorName: session.mentorUserId ? formatUserName(session.mentorUserId) : null,
      counselorName: session.counselorUserId ? formatUserName(session.counselorUserId) : null,
      createdByCounselorName: session.createdByCounselorId ? formatUserName(session.createdByCounselorId) : null,
    }));
  }
}

