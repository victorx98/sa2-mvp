import { Injectable, Logger } from '@nestjs/common';
import { ClassQueryService as DomainClassQueryService } from '@domains/services/class-sessions/classes/services/class-query.service';
import { ClassStatus, ClassType } from '@domains/services/class-sessions/classes/entities/class.entity';

/**
 * Application Layer - Class Query Service
 *
 * Responsibility:
 * - Orchestrate class queries and aggregation
 * - Coordinate multiple domain query services if needed
 * - Format and transform data for API layer
 */
@Injectable()
export class ClassQueryService {
  private readonly logger = new Logger(ClassQueryService.name);

  constructor(
    private readonly domainClassQueryService: DomainClassQueryService,
  ) {}

  /**
   * Get class list with filters
   */
  async getClasses(filters: {
    status?: ClassStatus;
    type?: ClassType;
    limit?: number;
    offset?: number;
  } = {}) {
    this.logger.debug(`Getting classes with filters: ${JSON.stringify(filters)}`);
    return this.domainClassQueryService.getClasses(filters);
  }

  /**
   * Get class details with all related data
   * Includes mentors, students, counselors
   */
  async getClassById(classId: string) {
    this.logger.debug(`Getting class details: classId=${classId}`);
    return this.domainClassQueryService.getClassById(classId);
  }

  /**
   * Get mentors for class
   */
  async getClassMentors(classId: string) {
    this.logger.debug(`Getting mentors for class: classId=${classId}`);
    return this.domainClassQueryService.getClassMentors(classId);
  }

  /**
   * Get students for class
   */
  async getClassStudents(classId: string) {
    this.logger.debug(`Getting students for class: classId=${classId}`);
    return this.domainClassQueryService.getClassStudents(classId);
  }

  /**
   * Get counselors for class
   */
  async getClassCounselors(classId: string) {
    this.logger.debug(`Getting counselors for class: classId=${classId}`);
    return this.domainClassQueryService.getClassCounselors(classId);
  }
}

