import { Injectable, Logger } from '@nestjs/common';
import { ClassSessionQueryService as DomainClassSessionQueryService } from '@domains/services/class-sessions/sessions/services/class-session-query.service';
import { ClassSessionStatus } from '@domains/services/class-sessions/sessions/entities/class-session.entity';

/**
 * Application Layer - Class Session Query Service
 *
 * Responsibility:
 * - Orchestrate class session queries and aggregation
 * - Coordinate multiple domain query services if needed
 * - Format and transform data for API layer
 */
@Injectable()
export class ClassSessionQueryService {
  private readonly logger = new Logger(ClassSessionQueryService.name);

  constructor(
    private readonly domainClassSessionQueryService: DomainClassSessionQueryService,
  ) {}

  /**
   * Get sessions for a specific class
   */
  async getSessionsByClass(classId: string, filters: {
    status?: ClassSessionStatus;
    limit?: number;
    offset?: number;
    excludeDeleted?: boolean;
  } = {}) {
    this.logger.debug(`Getting sessions for class: classId=${classId}`);
    return this.domainClassSessionQueryService.getSessionsByClass(classId, filters);
  }

  /**
   * Get sessions for a specific mentor
   */
  async getMentorSessions(mentorId: string, filters: {
    status?: ClassSessionStatus;
    limit?: number;
    offset?: number;
    excludeDeleted?: boolean;
  } = {}) {
    this.logger.debug(`Getting sessions for mentor: mentorId=${mentorId}`);
    return this.domainClassSessionQueryService.getMentorSessions(mentorId, filters);
  }

  /**
   * Get session details
   */
  async getSessionById(sessionId: string) {
    this.logger.debug(`Getting session details: sessionId=${sessionId}`);
    return this.domainClassSessionQueryService.getSessionById(sessionId);
  }
}

