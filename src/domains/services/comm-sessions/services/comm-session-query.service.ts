import { Injectable, Logger, Inject } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { CommSessionRepository } from '../repositories/comm-session.repository';
import { CommSessionEntity, CommSessionStatus } from '../entities/comm-session.entity';
import { DATABASE_CONNECTION } from '@infrastructure/database/database.provider';
import { commSessions } from '@infrastructure/database/schema/comm-sessions.schema';
import { meetings } from '@infrastructure/database/schema/meetings.schema';
import type { DrizzleDatabase } from '@shared/types/database.types';
import { CommSessionNotFoundException } from '../exceptions/comm-session-not-found.exception';

/**
 * Comm Session Query Service
 *
 * Single-module query service for comm_sessions table
 * Provides query operations with built-in filtering
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
   * Get mentor's comm sessions
   *
   * @param mentorId - Mentor user ID
   * @param filters - Filter options (status, excludeDeleted)
   * @param limit - Result limit (default: 10)
   * @param offset - Offset (default: 0)
   * @returns Array of session entities
   */
  async getMentorSessions(
    mentorId: string,
    filters?: {
      status?: CommSessionStatus;
      excludeDeleted?: boolean;
    },
    limit: number = 10,
    offset: number = 0,
  ): Promise<CommSessionEntity[]> {
    this.logger.log(`Getting comm sessions for mentor: ${mentorId}`);

    // Default: exclude deleted sessions
    const finalFilters = {
      excludeDeleted: true,
      ...filters,
    };

    return this.commSessionRepository.findByMentor(mentorId, limit, offset, finalFilters);
  }

  /**
   * Get student's comm sessions
   *
   * @param studentId - Student user ID
   * @param filters - Filter options (status, excludeDeleted)
   * @param limit - Result limit (default: 10)
   * @param offset - Offset (default: 0)
   * @returns Array of session entities
   */
  async getStudentSessions(
    studentId: string,
    filters?: {
      status?: CommSessionStatus;
      excludeDeleted?: boolean;
    },
    limit: number = 10,
    offset: number = 0,
  ): Promise<CommSessionEntity[]> {
    this.logger.log(`Getting comm sessions for student: ${studentId}`);

    // Default: exclude deleted sessions
    const finalFilters = {
      excludeDeleted: true,
      ...filters,
    };

    return this.commSessionRepository.findByStudent(studentId, limit, offset, finalFilters);
  }

  /**
   * Get comm sessions for multiple students
   * Used to retrieve all sessions for a counselor's students
   *
   * @param studentIds - Array of student user IDs
   * @param filters - Filter options (status, excludeDeleted)
   * @returns Array of session entities
   */
  async getSessionsByStudentIds(
    studentIds: string[],
    filters?: {
      status?: CommSessionStatus;
      excludeDeleted?: boolean;
    },
  ): Promise<CommSessionEntity[]> {
    this.logger.log(`Getting comm sessions for ${studentIds.length} students`);

    if (studentIds.length === 0) {
      return [];
    }

    // Default: exclude deleted sessions
    const finalFilters = {
      excludeDeleted: true,
      ...filters,
    };

    return this.commSessionRepository.findByStudentIds(studentIds, finalFilters);
  }

  /**
   * Get session by ID with meeting details (LEFT JOIN)
   * Includes complete meeting information for consistency checks
   * 
   * Key fields for update consistency:
   * - scheduledAt: Source value from comm_sessions (may be stale after failed update)
   * - scheduleStartTime: Actual value from meetings table (reflects last successful meeting update)
   * 
   * During updateSession, we compare against scheduleStartTime from meetings table
   * to detect if previous meeting updates failed, enabling automatic retry on next modification
   *
   * @param id - Session ID
   * @returns Session with meeting details (duration, scheduleStartTime for consistency checks)
   * @throws CommSessionNotFoundException if session not found
   */
  async getSessionById(id: string): Promise<CommSessionEntity & { meeting?: any; duration?: number; scheduleStartTime?: string; meetingProvider?: string }> {
    this.logger.log(`Getting comm session details with meeting info: ${id}`);
    
    // Query with LEFT JOIN to get meeting details including actual schedule_start_time
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

    const row = results[0];
    return {
      ...row.session,
      meeting: row.meeting || undefined,
      duration: row.meeting?.scheduleDuration || undefined,
      // Store actual meeting schedule_start_time for consistency detection
      scheduleStartTime: row.meeting?.scheduleStartTime || undefined,
      meetingProvider: row.meeting?.meetingProvider || undefined,
    } as any;
  }
}

