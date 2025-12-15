import { Injectable, Logger } from '@nestjs/common';
import { ClassQueryService as DomainCrossQueryService } from '@domains/query/services/class-query.service';
import { ClassRepository } from '@domains/services/class/classes/repositories/class.repository';
import { ClassStatus, ClassType } from '@domains/services/class/classes/entities/class.entity';

/**
 * Application Layer - Class Query Service
 *
 * Responsibility:
 * - Orchestrate class queries and aggregation
 * - Single-table queries use Repository directly
 * - Cross-domain queries use Query domain service
 */
@Injectable()
export class ClassQueryService {
  private readonly logger = new Logger(ClassQueryService.name);

  constructor(
    private readonly classRepository: ClassRepository,
    private readonly domainCrossQueryService: DomainCrossQueryService,
  ) {}

  /**
   * Get class list with filters (single-table query)
   */
  async getClasses(filters: {
    status?: ClassStatus;
    type?: ClassType;
    limit?: number;
    offset?: number;
  } = {}) {
    const { limit = 10, offset = 0, ...queryFilters } = filters;
    this.logger.debug(`Getting classes with filters: ${JSON.stringify(queryFilters)}`);
    return this.classRepository.findAll(limit, offset, queryFilters);
  }

  /**
   * Get class details with all related data
   * Aggregates: class + mentors + students + counselors
   */
  async getClassById(classId: string) {
    this.logger.debug(`Getting class details: classId=${classId}`);
    
    const classEntity = await this.classRepository.findByIdOrThrow(classId);
    const mentors = await this.classRepository.getMentors(classId);
    const students = await this.classRepository.getStudents(classId);
    const counselors = await this.classRepository.getCounselors(classId);

    return {
      ...classEntity,
      mentors,
      students,
      counselors,
    };
  }

  /**
   * Get mentors for class with user names (cross-domain query)
   */
  async getClassMentorsWithNames(classId: string) {
    this.logger.debug(`Getting mentors with names for class: classId=${classId}`);
    return this.domainCrossQueryService.getClassMentorsWithNames(classId);
  }

  /**
   * Get students for class with user names (cross-domain query)
   */
  async getClassStudentsWithNames(classId: string) {
    this.logger.debug(`Getting students with names for class: classId=${classId}`);
    return this.domainCrossQueryService.getClassStudentsWithNames(classId);
  }

  /**
   * Get counselors for class with user names (cross-domain query)
   */
  async getClassCounselorsWithNames(classId: string) {
    this.logger.debug(`Getting counselors with names for class: classId=${classId}`);
    return this.domainCrossQueryService.getClassCounselorsWithNames(classId);
  }

  /**
   * Get mentors for class (single-table query)
   */
  async getClassMentors(classId: string) {
    this.logger.debug(`Getting mentors for class: classId=${classId}`);
    return this.classRepository.getMentors(classId);
  }

  /**
   * Get students for class (single-table query)
   */
  async getClassStudents(classId: string) {
    this.logger.debug(`Getting students for class: classId=${classId}`);
    return this.classRepository.getStudents(classId);
  }

  /**
   * Get counselors for class (single-table query)
   */
  async getClassCounselors(classId: string) {
    this.logger.debug(`Getting counselors for class: classId=${classId}`);
    return this.classRepository.getCounselors(classId);
  }
}

