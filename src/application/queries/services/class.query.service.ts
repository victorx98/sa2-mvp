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

  /**
   * Get all classes with mentors and counselors details (paginated)
   * Aggregates: classes + mentors with names + counselors with names
   */
  async getAllClassesWithMembers(params: {
    page?: number;
    pageSize?: number;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
    status?: ClassStatus;
    type?: ClassType;
  } = {}) {
    const {
      page = 1,
      pageSize = 10,
      sortBy = 'createdAt',
      sortOrder = 'desc',
      status,
      type,
    } = params;

    this.logger.debug(`Getting all classes with members, params: ${JSON.stringify(params)}`);

    // Calculate offset
    const offset = (page - 1) * pageSize;

    // Get total count
    const total = await this.classRepository.count({ status, type });

    // Get classes list with pagination
    const classes = await this.classRepository.findAll(
      pageSize,
      offset,
      { status, type },
      sortBy,
      sortOrder,
    );

    // For each class, fetch mentors and counselors with names
    const classesWithMembers = await Promise.all(
      classes.map(async (classEntity) => {
        const [mentors, counselors] = await Promise.all([
          this.domainCrossQueryService.getClassMentorsWithNames(classEntity.id),
          this.domainCrossQueryService.getClassCounselorsWithNames(classEntity.id),
        ]);

        return {
          ...classEntity,
          mentors,
          counselors,
        };
      })
    );

    // Calculate pagination metadata
    const totalPages = Math.ceil(total / pageSize);
    const hasNext = page < totalPages;
    const hasPrev = page > 1;

    return {
      data: classesWithMembers,
      pagination: {
        page,
        pageSize,
        total,
        totalPages,
        hasNext,
        hasPrev,
      },
    };
  }
}

