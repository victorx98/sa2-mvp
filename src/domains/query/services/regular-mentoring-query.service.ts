import { Injectable, Inject } from '@nestjs/common';
import { eq, inArray } from 'drizzle-orm';
import { RegularMentoringRepository } from '@domains/services/sessions/regular-mentoring/repositories/regular-mentoring.repository';
import { RegularMentoringSessionEntity } from '@domains/services/sessions/regular-mentoring/entities/regular-mentoring-session.entity';
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
 * Cross-domain Read Model aggregation layer
 * Handles read operations for regular mentoring sessions with joins across domains
 * Joins: regular_mentoring_sessions + meetings + user (for mentor/student names)
 */
@Injectable()
export class RegularMentoringQueryService {
  constructor(
    private readonly repository: RegularMentoringRepository,
    @Inject(DATABASE_CONNECTION)
    private readonly db: DrizzleDatabase,
  ) {}

  async getMentorSessions(
    mentorId: string,
    filters: SessionFiltersDto,
  ): Promise<any[]> {
    const excludeDeleted = filters.excludeDeleted !== false;
    const sessions = await this.repository.findByMentorId(mentorId, excludeDeleted);
    
    // Enrich sessions with user names
    return this.enrichSessionsWithUserNames(sessions);
  }

  async getStudentSessions(
    studentId: string,
    filters: SessionFiltersDto,
  ): Promise<any[]> {
    const excludeDeleted = filters.excludeDeleted !== false;
    const sessions = await this.repository.findByStudentId(studentId, excludeDeleted);
    
    // Enrich sessions with user names
    return this.enrichSessionsWithUserNames(sessions);
  }

  /**
   * Get session by ID with meeting details (LEFT JOIN)
   * Includes complete meeting information for consistency checks
   * Also includes user names (student, mentor, counselor)
   * 
   * Key fields for update consistency:
   * - scheduledAt: Source value from regular_mentoring_sessions (may be stale after failed update)
   * - scheduleStartTime: Actual value from meetings table (reflects last successful meeting update)
   * 
   * During updateSession, we compare against scheduleStartTime from meetings table
   * to detect if previous meeting updates failed, enabling automatic retry on next modification
   * 
   * @param id - Session ID
   * @returns Session with meeting details and user names
   * @throws SessionNotFoundException if session not found
   */
  async getSessionById(id: string): Promise<any> {
    // First get session with meeting details
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

    const row = results[0];
    const session = row.session;

    // Batch query user names
    const userIds = [session.studentUserId, session.mentorUserId, session.createdByCounselorId].filter(Boolean);
    const users = userIds.length > 0
      ? await this.db.select().from(userTable).where(inArray(userTable.id, userIds as any))
      : [];

    const userMap = new Map(users.map(u => [u.id, u]));

    // Helper function to format user name: name_en (name_zh)
    const formatUserName = (userId: string) => {
      const user = userMap.get(userId);
      if (!user) return null;
      const nameEn = user.nameEn || '';
      const nameZh = user.nameZh || '';
      return nameZh ? `${nameEn} (${nameZh})` : nameEn;
    };

    return {
      ...session,
      meeting: row.meeting || undefined,
      duration: row.meeting?.scheduleDuration || undefined,
      scheduleStartTime: row.meeting?.scheduleStartTime || undefined,
      // Add user names for frontend display in format: name_en (name_zh)
      studentName: formatUserName(session.studentUserId),
      mentorName: formatUserName(session.mentorUserId),
      counselorName: session.createdByCounselorId ? formatUserName(session.createdByCounselorId) : null,
    } as any;
  }

  async countSessions(filters: SessionFiltersDto): Promise<number> {
    // Implement based on specific requirements
    // For now, return 0 as placeholder
    return 0;
  }

  /**
   * Get sessions by multiple student IDs (batch query for counselor)
   * @param studentIds Array of student IDs
   * @param filters Query filters
   * @returns Array of regular mentoring sessions with user names
   */
  async getSessionsByStudentIds(
    studentIds: string[],
    filters: SessionFiltersDto,
  ): Promise<any[]> {
    const excludeDeleted = filters.excludeDeleted !== false;
    const sessions = await this.repository.findByStudentIds(studentIds, excludeDeleted);
    
    // Enrich sessions with user names
    return this.enrichSessionsWithUserNames(sessions);
  }

  /**
   * Private helper: Enrich sessions with user names
   * Batch query to avoid N+1 problem
   */
  private async enrichSessionsWithUserNames(sessions: RegularMentoringSessionEntity[]): Promise<any[]> {
    if (sessions.length === 0) return [];

    // Collect all unique user IDs
    const userIds = new Set<string>();
    sessions.forEach(session => {
      if (session.studentUserId) userIds.add(session.studentUserId);
      if (session.mentorUserId) userIds.add(session.mentorUserId);
      if (session.createdByCounselorId) userIds.add(session.createdByCounselorId);
    });

    // Batch query all users using IN clause
    const userIdsArray = Array.from(userIds);
    const users = userIdsArray.length > 0
      ? await this.db.select().from(userTable).where(inArray(userTable.id, userIdsArray as any))
      : [];

    // Create user map for quick lookup
    const userMap = new Map(users.map(u => [u.id, u]));

    // Helper function to format user name: name_en (name_zh)
    const formatUserName = (userId: string) => {
      const user = userMap.get(userId);
      if (!user) return null;
      const nameEn = user.nameEn || '';
      const nameZh = user.nameZh || '';
      return nameZh ? `${nameEn} (${nameZh})` : nameEn;
    };

    // Enrich sessions with user names
    return sessions.map(session => ({
      ...session,
      studentName: formatUserName(session.studentUserId),
      mentorName: formatUserName(session.mentorUserId),
      counselorName: session.createdByCounselorId ? formatUserName(session.createdByCounselorId) : null,
    }));
  }
}

