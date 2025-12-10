import { Injectable, Inject } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { AiCareerRepository } from '../repositories/ai-career.repository';
import { AiCareerSessionEntity } from '../entities/ai-career-session.entity';
import { SessionFiltersDto } from '../../shared/dto/session-query.dto';
import { SessionNotFoundException } from '../../shared/exceptions/session-not-found.exception';
import { DATABASE_CONNECTION } from '@infrastructure/database/database.provider';
import { aiCareerSessions } from '@infrastructure/database/schema/ai-career-sessions.schema';
import { meetings } from '@infrastructure/database/schema/meetings.schema';
import type { DrizzleDatabase } from '@shared/types/database.types';

/**
 * AI Career Query Service (CQRS - Query)
 * 
 * Handles read operations for AI career sessions
 */
@Injectable()
export class AiCareerQueryService {
  constructor(
    private readonly repository: AiCareerRepository,
    @Inject(DATABASE_CONNECTION)
    private readonly db: DrizzleDatabase,
  ) {}

  async getMentorSessions(
    mentorId: string,
    filters: SessionFiltersDto,
  ): Promise<AiCareerSessionEntity[]> {
    const excludeDeleted = filters.excludeDeleted !== false;
    return this.repository.findByMentorId(mentorId, excludeDeleted);
  }

  async getStudentSessions(
    studentId: string,
    filters: SessionFiltersDto,
  ): Promise<AiCareerSessionEntity[]> {
    const excludeDeleted = filters.excludeDeleted !== false;
    return this.repository.findByStudentId(studentId, excludeDeleted);
  }

  async getSessionsByStudentIds(
    studentIds: string[],
    filters: SessionFiltersDto,
  ): Promise<AiCareerSessionEntity[]> {
    const excludeDeleted = filters.excludeDeleted !== false;
    return this.repository.findByStudentIds(studentIds, excludeDeleted);
  }

  /**
   * Get session by ID with meeting details (LEFT JOIN)
   * Includes complete meeting information for consistency checks
   * 
   * Key fields for update consistency:
   * - scheduledAt: Source value from ai_career_sessions (may be stale after failed update)
   * - scheduleStartTime: Actual value from meetings table (reflects last successful meeting update)
   * 
   * During updateSession, we compare against scheduleStartTime from meetings table
   * to detect if previous meeting updates failed, enabling automatic retry on next modification
   * 
   * @param id - Session ID
   * @returns Session with meeting details (duration, scheduleStartTime for consistency checks)
   * @throws SessionNotFoundException if session not found
   */
  async getSessionById(id: string): Promise<AiCareerSessionEntity & { meeting?: any; duration?: number; scheduleStartTime?: string }> {
    // Query with LEFT JOIN to get meeting details including actual schedule_start_time
    const results = await this.db
      .select({
        session: aiCareerSessions,
        meeting: meetings,
      })
      .from(aiCareerSessions)
      .leftJoin(meetings, eq(aiCareerSessions.meetingId, meetings.id))
      .where(eq(aiCareerSessions.id, id));

    if (results.length === 0) {
      throw new SessionNotFoundException(id);
    }

    const row = results[0];
    return {
      ...row.session,
      meeting: row.meeting || undefined,
      duration: row.meeting?.scheduleDuration || undefined,
      // Store actual meeting schedule_start_time for consistency detection
      scheduleStartTime: row.meeting?.scheduleStartTime || undefined,
    } as any;
  }
}

