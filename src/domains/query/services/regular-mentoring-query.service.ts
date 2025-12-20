import { Injectable, Inject } from '@nestjs/common';
import { eq, inArray, and, ne, desc } from 'drizzle-orm';
import { SessionFiltersDto } from '@domains/services/sessions/shared/dto/session-query.dto';
import { SessionNotFoundException } from '@domains/services/sessions/shared/exceptions/session-not-found.exception';
import { DATABASE_CONNECTION } from '@infrastructure/database/database.provider';
import { regularMentoringSessions } from '@infrastructure/database/schema/regular-mentoring-sessions.schema';
import { meetings } from '@infrastructure/database/schema/meetings.schema';
import { userTable } from '@infrastructure/database/schema/user.schema';
import type { DrizzleDatabase } from '@shared/types/database.types';

/**
 * Regular Mentoring Query Service (CQRS - Query)
 * 
 * Cross-domain Read Model: One-time JOIN across multiple domains
 * Directly queries: regular_mentoring_sessions + meetings + users
 * No dependency on Repository for read operations
 */
@Injectable()
export class RegularMentoringQueryService {
  constructor(
    @Inject(DATABASE_CONNECTION)
    private readonly db: DrizzleDatabase,
  ) {}

  /**
   * Get mentor's sessions with cross-domain data (one-time JOIN)
   */
  async getMentorSessions(
    mentorId: string,
    filters: SessionFiltersDto,
  ): Promise<any[]> {
    const excludeDeleted = filters.excludeDeleted !== false;
    
    const whereConditions = excludeDeleted
      ? and(
          eq(regularMentoringSessions.mentorUserId, mentorId),
          ne(regularMentoringSessions.status, 'deleted' as any),
        )
      : eq(regularMentoringSessions.mentorUserId, mentorId);

    // One-time cross-domain JOIN: sessions + meetings
    const results = await this.db
      .select({
        session: regularMentoringSessions,
        meeting: meetings,
      })
      .from(regularMentoringSessions)
      .leftJoin(meetings, eq(regularMentoringSessions.meetingId, meetings.id))
      .where(whereConditions)
      .orderBy(desc(regularMentoringSessions.scheduledAt));

    // Batch enrich user names
    return this.enrichWithUserNames(results);
  }

  /**
   * Get student's sessions with cross-domain data (one-time JOIN)
   */
  async getStudentSessions(
    studentId: string,
    filters: SessionFiltersDto,
  ): Promise<any[]> {
    const excludeDeleted = filters.excludeDeleted !== false;
    
    const whereConditions = excludeDeleted
      ? and(
          eq(regularMentoringSessions.studentUserId, studentId),
          ne(regularMentoringSessions.status, 'deleted' as any),
        )
      : eq(regularMentoringSessions.studentUserId, studentId);

    // One-time cross-domain JOIN: sessions + meetings
    const results = await this.db
      .select({
        session: regularMentoringSessions,
        meeting: meetings,
      })
      .from(regularMentoringSessions)
      .leftJoin(meetings, eq(regularMentoringSessions.meetingId, meetings.id))
      .where(whereConditions)
      .orderBy(desc(regularMentoringSessions.scheduledAt));

    // Batch enrich user names
    return this.enrichWithUserNames(results);
  }

  /**
   * Get single session by ID (cross-domain JOIN)
   * Consistency check: scheduledAt vs scheduleStartTime for detecting failed updates
   */
  async getSessionById(id: string): Promise<any> {
    // Cross-domain JOIN: sessions + meetings
    const results = await this.db
      .select({
        session: regularMentoringSessions,
        meeting: meetings,
      })
      .from(regularMentoringSessions)
      .leftJoin(meetings, eq(regularMentoringSessions.meetingId, meetings.id))
      .where(eq(regularMentoringSessions.id, id));

    if (results.length === 0) {
      throw new SessionNotFoundException(id);
    }

    // Batch enrich user names (single result)
    const enriched = await this.enrichWithUserNames(results);
    return enriched[0];
  }

  async countSessions(filters: SessionFiltersDto): Promise<number> {
    // Implement based on specific requirements
    // For now, return 0 as placeholder
    return 0;
  }

  /**
   * Get sessions by multiple student IDs (cross-domain JOIN)
   */
  async getSessionsByStudentIds(
    studentIds: string[],
    filters: SessionFiltersDto,
  ): Promise<any[]> {
    if (studentIds.length === 0) return [];

    const excludeDeleted = filters.excludeDeleted !== false;
    
    const whereConditions = excludeDeleted
      ? and(
          inArray(regularMentoringSessions.studentUserId, studentIds),
          ne(regularMentoringSessions.status, 'deleted' as any),
        )
      : inArray(regularMentoringSessions.studentUserId, studentIds);

    // One-time cross-domain JOIN: sessions + meetings
    const results = await this.db
      .select({
        session: regularMentoringSessions,
        meeting: meetings,
      })
      .from(regularMentoringSessions)
      .leftJoin(meetings, eq(regularMentoringSessions.meetingId, meetings.id))
      .where(whereConditions)
      .orderBy(desc(regularMentoringSessions.scheduledAt));

    // Batch enrich user names
    return this.enrichWithUserNames(results);
  }

  /**
   * Private: Batch enrich user names (avoid N+1)
   * Format: { en: "John", zh: "约翰" } for i18n support
   */
  private async enrichWithUserNames(
    results: Array<{ session: any; meeting: any }>,
  ): Promise<any[]> {
    if (results.length === 0) return [];

    // Collect all unique user IDs
    const userIds = new Set<string>();
    results.forEach(({ session }) => {
      if (session.studentUserId) userIds.add(session.studentUserId);
      if (session.mentorUserId) userIds.add(session.mentorUserId);
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
      studentName: formatUserName(session.studentUserId),
      mentorName: formatUserName(session.mentorUserId),
      counselorName: session.createdByCounselorId ? formatUserName(session.createdByCounselorId) : null,
    }));
  }
}

