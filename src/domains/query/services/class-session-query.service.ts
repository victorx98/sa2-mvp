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
   * Get sessions list for class with cross-domain data (one-time JOIN)
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

    // One-time cross-domain JOIN: sessions + meetings
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

    // Batch enrich user names
    return this.enrichWithUserNames(results);
  }

  /**
   * Get mentor's sessions with cross-domain data (one-time JOIN)
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

    // One-time cross-domain JOIN: sessions + meetings
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

    // Batch enrich user names
    return this.enrichWithUserNames(results);
  }

  /**
   * Get single session by ID (cross-domain JOIN)
   */
  async getSessionById(id: string): Promise<any> {
    this.logger.log(`Getting class session by ID: ${id}`);
    
    // Cross-domain JOIN: sessions + meetings
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

    // Batch enrich user names (single result)
    const enriched = await this.enrichWithUserNames(results);
    return enriched[0];
  }

  /**
   * Private: Batch enrich user names (avoid N+1)
   * Format: { en: "John", zh: "约翰" } for i18n support
   * Note: class_session only has mentor, no student
   */
  private async enrichWithUserNames(
    results: Array<{ session: any; meeting: any }>,
  ): Promise<any[]> {
    if (results.length === 0) return [];

    // Collect all unique mentor IDs
    const mentorIds = new Set<string>();
    results.forEach(({ session }) => {
      if (session.mentorUserId) mentorIds.add(session.mentorUserId);
    });

    // Batch query all users
    const mentorIdsArray = Array.from(mentorIds);
    const users = mentorIdsArray.length > 0
      ? await this.db.select().from(userTable).where(inArray(userTable.id, mentorIdsArray as any))
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
      mentorName: formatUserName(session.mentorUserId),
    }));
  }
}

