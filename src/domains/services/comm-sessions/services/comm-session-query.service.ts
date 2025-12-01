import { Injectable, Logger } from '@nestjs/common';
import { CommSessionRepository } from '../repositories/comm-session.repository';
import { CommSessionEntity, CommSessionStatus } from '../entities/comm-session.entity';

/**
 * Comm Session Query Service
 *
 * Single-module query service for comm_sessions table
 * Provides query operations with built-in filtering
 */
@Injectable()
export class CommSessionQueryService {
  private readonly logger = new Logger(CommSessionQueryService.name);

  constructor(private readonly commSessionRepository: CommSessionRepository) {}

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
   * Get session details by ID
   *
   * @param id - Session ID
   * @returns Session entity (includes deleted records for admin visibility)
   */
  async getSessionById(id: string): Promise<CommSessionEntity> {
    this.logger.log(`Getting comm session details: ${id}`);
    return this.commSessionRepository.findByIdOrThrow(id);
  }
}

