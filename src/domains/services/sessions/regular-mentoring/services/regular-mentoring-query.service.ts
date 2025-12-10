import { Injectable, Inject } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { RegularMentoringRepository } from '../repositories/regular-mentoring.repository';
import { RegularMentoringSessionEntity } from '../entities/regular-mentoring-session.entity';
import { SessionFiltersDto } from '../../shared/dto/session-query.dto';
import { SessionNotFoundException } from '../../shared/exceptions/session-not-found.exception';
import { DATABASE_CONNECTION } from '@infrastructure/database/database.provider';
import { regularMentoringSessions } from '@infrastructure/database/schema/regular-mentoring-sessions.schema';
import { meetings } from '@infrastructure/database/schema/meetings.schema';
import type { DrizzleDatabase } from '@shared/types/database.types';

/**
 * Regular Mentoring Query Service (CQRS - Query)
 * 
 * Handles read operations for regular mentoring sessions
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
  ): Promise<RegularMentoringSessionEntity[]> {
    const excludeDeleted = filters.excludeDeleted !== false;
    return this.repository.findByMentorId(mentorId, excludeDeleted);
  }

  async getStudentSessions(
    studentId: string,
    filters: SessionFiltersDto,
  ): Promise<RegularMentoringSessionEntity[]> {
    const excludeDeleted = filters.excludeDeleted !== false;
    return this.repository.findByStudentId(studentId, excludeDeleted);
  }

  /**
   * Get session by ID with meeting details (LEFT JOIN)
   * Includes complete meeting information for consistency checks
   * 
   * Key fields for update consistency:
   * - scheduledAt: Source value from regular_mentoring_sessions (may be stale after failed update)
   * - scheduleStartTime: Actual value from meetings table (reflects last successful meeting update)
   * 
   * During updateSession, we compare against scheduleStartTime from meetings table
   * to detect if previous meeting updates failed, enabling automatic retry on next modification
   * 
   * @param id - Session ID
   * @returns Session with meeting details (duration, scheduleStartTime for consistency checks)
   * @throws SessionNotFoundException if session not found
   */
  async getSessionById(id: string): Promise<RegularMentoringSessionEntity & { meeting?: any; duration?: number; scheduleStartTime?: string }> {
    // Query with LEFT JOIN to get meeting details including actual schedule_start_time
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
    return {
      ...row.session,
      meeting: row.meeting || undefined,
      duration: row.meeting?.scheduleDuration || undefined,
      // Store actual meeting schedule_start_time for consistency detection
      scheduleStartTime: row.meeting?.scheduleStartTime || undefined,
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
   * @returns Array of regular mentoring sessions
   */
  async getSessionsByStudentIds(
    studentIds: string[],
    filters: SessionFiltersDto,
  ): Promise<RegularMentoringSessionEntity[]> {
    const excludeDeleted = filters.excludeDeleted !== false;
    return this.repository.findByStudentIds(studentIds, excludeDeleted);
  }
}

