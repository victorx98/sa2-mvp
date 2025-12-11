import { Injectable, Logger } from '@nestjs/common';
import { RegularMentoringQueryService as DomainQueryService } from '@domains/query/services/regular-mentoring-query.service';

/**
 * Application Layer - Regular Mentoring Query Service
 *
 * Responsibility:
 * - Provide query operations for regular mentoring sessions
 * - Act as a facade to domain layer query service
 * - Apply application-level transformations if needed
 */
@Injectable()
export class RegularMentoringQueryService {
  private readonly logger = new Logger(RegularMentoringQueryService.name);

  constructor(
    private readonly domainQueryService: DomainQueryService,
  ) {}

  /**
   * Get sessions for a mentor
   *
   * @param mentorId Mentor ID
   * @param filters Query filters
   * @returns List of sessions
   */
  async getMentorSessions(mentorId: string, filters?: any) {
    this.logger.debug(`Fetching sessions for mentor: mentorId=${mentorId}`);
    return this.domainQueryService.getMentorSessions(mentorId, filters);
  }

  /**
   * Get sessions for a student
   *
   * @param studentId Student ID
   * @param filters Query filters
   * @returns List of sessions
   */
  async getStudentSessions(studentId: string, filters?: any) {
    this.logger.debug(`Fetching sessions for student: studentId=${studentId}`);
    return this.domainQueryService.getStudentSessions(studentId, filters);
  }

  /**
   * Get sessions by counselor (creator)
   *
   * @param counselorId Counselor ID
   * @param filters Query filters
   * @returns List of sessions
   */
  async getSessionsByCreator(counselorId: string, filters?: any) {
    this.logger.debug(`Fetching sessions created by counselor: counselorId=${counselorId}`);
    // Query sessions where created_by_counselor_id = counselorId
    return this.domainQueryService.getMentorSessions(counselorId, {
      ...filters,
      createdByCounselor: true,
    });
  }

  /**
   * Get session details by ID
   *
   * @param sessionId Session ID
   * @returns Session details
   */
  async getSessionById(sessionId: string) {
    this.logger.debug(`Fetching session details: sessionId=${sessionId}`);
    return this.domainQueryService.getSessionById(sessionId);
  }

  /**
   * Count sessions by filters
   *
   * @param filters Query filters
   * @returns Count of sessions
   */
  async countSessions(filters?: any) {
    this.logger.debug(`Counting sessions with filters: ${JSON.stringify(filters)}`);
    return this.domainQueryService.countSessions(filters);
  }

  /**
   * Get sessions by multiple student IDs (batch query)
   * Used when counselor queries all their students' sessions
   *
   * @param studentIds Array of student IDs
   * @param filters Query filters
   * @returns List of sessions
   */
  async getSessionsByStudentIds(studentIds: string[], filters?: any) {
    this.logger.debug(`Fetching sessions for ${studentIds.length} students`);
    return this.domainQueryService.getSessionsByStudentIds(studentIds, filters || {});
  }
}

