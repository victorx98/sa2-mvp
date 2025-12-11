import { Injectable, Logger, Inject } from '@nestjs/common';
import { eq, inArray, and, desc, ne } from 'drizzle-orm';
import { ClassSessionRepository } from '@domains/services/class/class-sessions/repositories/class-session.repository';
import { ClassSessionEntity, ClassSessionStatus } from '@domains/services/class/class-sessions/entities/class-session.entity';
import { DATABASE_CONNECTION } from '@infrastructure/database/database.provider';
import { classSessions } from '@infrastructure/database/schema/class-sessions.schema';
import { meetings } from '@infrastructure/database/schema/meetings.schema';
import { userTable } from '@infrastructure/database/schema/user.schema';
import type { DrizzleDatabase } from '@shared/types/database.types';
import { ClassSessionNotFoundException } from '@domains/services/class/shared/exceptions/class-session-not-found.exception';

export interface SessionFiltersDto {
  status?: ClassSessionStatus;
  limit?: number;
  offset?: number;
  excludeDeleted?: boolean;
}

/**
 * Class Session Query Service (CQRS - Query)
 * 
 * Cross-domain Read Model aggregation layer
 * Handles read operations for class sessions with joins across domains
 * Joins: class_sessions + meetings + user (for mentor names)
 */
@Injectable()
export class ClassSessionQueryService {
  private readonly logger = new Logger(ClassSessionQueryService.name);

  constructor(
    private readonly classSessionRepository: ClassSessionRepository,
    @Inject(DATABASE_CONNECTION)
    private readonly db: DrizzleDatabase,
  ) {}

  /**
   * Get sessions list for class with meeting and mentor info
   * Default filter: status != 'deleted'
   */
  async getSessionsByClass(classId: string, filters: SessionFiltersDto = {}): Promise<any[]> {
    const { limit = 10, offset = 0, excludeDeleted = true, status } = filters;
    this.logger.log(`Getting class sessions for class: ${classId}`);

    // Build WHERE conditions
    const whereConditions: any[] = [eq(classSessions.classId, classId as any)];
    
    if (excludeDeleted) {
      whereConditions.push(ne(classSessions.status, ClassSessionStatus.DELETED));
    }
    
    if (status) {
      whereConditions.push(eq(classSessions.status, status));
    }

    // Query sessions with meetings (LEFT JOIN)
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

    // Extract sessions for user enrichment
    const sessions = results.map(r => r.session);
    
    // Enrich with user names
    const enrichedSessions = await this.enrichSessionsWithUserNames(sessions);
    
    // Merge meeting data
    return enrichedSessions.map((session, index) => ({
      ...session,
      meeting: results[index].meeting || undefined,
    }));
  }

  /**
   * Get sessions list for mentor with meeting info
   * Default filter: status != 'deleted'
   */
  async getMentorSessions(mentorId: string, filters: SessionFiltersDto = {}): Promise<any[]> {
    const { limit = 10, offset = 0, excludeDeleted = true, status } = filters;
    this.logger.log(`Getting class sessions for mentor: ${mentorId}`);

    // Build WHERE conditions
    const whereConditions: any[] = [eq(classSessions.mentorUserId, mentorId as any)];
    
    if (excludeDeleted) {
      whereConditions.push(ne(classSessions.status, ClassSessionStatus.DELETED));
    }
    
    if (status) {
      whereConditions.push(eq(classSessions.status, status));
    }

    // Query sessions with meetings (LEFT JOIN)
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

    // Extract sessions for user enrichment
    const sessions = results.map(r => r.session);
    
    // Enrich with user names
    const enrichedSessions = await this.enrichSessionsWithUserNames(sessions);
    
    // Merge meeting data
    return enrichedSessions.map((session, index) => ({
      ...session,
      meeting: results[index].meeting || undefined,
    }));
  }

  /**
   * Get session details with meeting and user info
   */
  async getSessionById(id: string): Promise<any> {
    this.logger.log(`Getting class session by ID: ${id}`);
    
    // Query session with meeting (LEFT JOIN)
    const results = await this.db
      .select({
        session: classSessions,
        meeting: meetings,
      })
      .from(classSessions)
      .leftJoin(meetings, eq(classSessions.meetingId, meetings.id))
      .where(eq(classSessions.id, id));

    if (results.length === 0) {
      throw new ClassSessionNotFoundException(id);
    }

    const row = results[0];
    const session = row.session;

    // Batch query user names (only mentor for class sessions)
    const userIds = [session.mentorUserId].filter(Boolean);
    const users = userIds.length > 0
      ? await this.db.select().from(userTable).where(inArray(userTable.id, userIds as any))
      : [];

    const userMap = new Map(users.map(u => [u.id, u]));

    // Helper function to format user name
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
      mentorName: formatUserName(session.mentorUserId),
    };
  }

  /**
   * Private helper: Enrich sessions with mentor names
   * Batch query to avoid N+1 problem
   */
  private async enrichSessionsWithUserNames(sessions: any[]): Promise<any[]> {
    if (sessions.length === 0) return [];

    // Collect all unique mentor IDs
    const mentorIds = new Set<string>();
    sessions.forEach(session => {
      if (session.mentorUserId) mentorIds.add(session.mentorUserId);
    });

    // Batch query all users using IN clause
    const mentorIdsArray = Array.from(mentorIds);
    const users = mentorIdsArray.length > 0
      ? await this.db.select().from(userTable).where(inArray(userTable.id, mentorIdsArray as any))
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

    // Enrich sessions with mentor names
    return sessions.map(session => ({
      ...session,
      mentorName: formatUserName(session.mentorUserId),
    }));
  }
}

