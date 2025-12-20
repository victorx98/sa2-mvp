import { Injectable, Logger } from '@nestjs/common';
import { CommSessionQueryService as DomainCommSessionQueryService } from '@domains/query/services/comm-session-query.service';
import { SessionStatus } from '@domains/services/comm-sessions/value-objects/session-status.vo';

/**
 * Application Layer - Comm Session Query Service
 *
 * Responsibility:
 * - Orchestrate comm session queries and aggregation
 * - Coordinate multiple domain query services if needed
 * - Format and transform data for API layer
 */
@Injectable()
export class CommSessionQueryService {
  private readonly logger = new Logger(CommSessionQueryService.name);

  constructor(
    private readonly domainCommSessionQueryService: DomainCommSessionQueryService,
  ) {}

  /**
   * Get sessions for a specific mentor
   */
  async getMentorSessions(mentorId: string, filters: {
    status?: SessionStatus;
    limit?: number;
    offset?: number;
  } = {}) {
    this.logger.debug(`Getting sessions for mentor: mentorId=${mentorId}`);
    return this.domainCommSessionQueryService.getMentorSessions(mentorId, filters);
  }

  /**
   * Get sessions for a specific student
   */
  async getStudentSessions(studentId: string, filters: {
    status?: SessionStatus;
    limit?: number;
    offset?: number;
  } = {}) {
    this.logger.debug(`Getting sessions for student: studentId=${studentId}`);
    return this.domainCommSessionQueryService.getStudentSessions(studentId, filters);
  }

  /**
   * Get session details
   */
  async getSessionById(sessionId: string) {
    this.logger.debug(`Getting session details: sessionId=${sessionId}`);
    return this.domainCommSessionQueryService.getSessionById(sessionId);
  }
}

