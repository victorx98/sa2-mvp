import { Injectable, Logger } from '@nestjs/common';
import { ClassSessionRepository } from '@domains/services/class/class-sessions/repositories/class-session.repository';
import { ClassSessionEntity, ClassSessionStatus } from '@domains/services/class/class-sessions/entities/class-session.entity';

export interface SessionFiltersDto {
  status?: ClassSessionStatus;
  limit?: number;
  offset?: number;
  excludeDeleted?: boolean;
}

/**
 * Class Session Query Service (CQRS - Query)
 * 
 * Cross-domain Read Model aggregation layer
 * Handles read operations for class sessions with joins across domains
 * Joins: class_sessions + meetings + user (for mentor/student names)
 */
@Injectable()
export class ClassSessionQueryService {
  private readonly logger = new Logger(ClassSessionQueryService.name);

  constructor(private readonly classSessionRepository: ClassSessionRepository) {}

  /**
   * Get sessions list for class
   * Default filter: status != 'deleted'
   */
  async getSessionsByClass(classId: string, filters: SessionFiltersDto = {}): Promise<ClassSessionEntity[]> {
    const { limit = 10, offset = 0, excludeDeleted = true, ...queryFilters } = filters;
    this.logger.log(`Getting class sessions for class: ${classId}`);

    return this.classSessionRepository.findByClass(classId, limit, offset, {
      ...queryFilters,
      excludeDeleted,
    });
  }

  /**
   * Get sessions list for mentor
   * Default filter: status != 'deleted'
   */
  async getMentorSessions(mentorId: string, filters: SessionFiltersDto = {}): Promise<ClassSessionEntity[]> {
    const { limit = 10, offset = 0, excludeDeleted = true, ...queryFilters } = filters;
    this.logger.log(`Getting class sessions for mentor: ${mentorId}`);

    return this.classSessionRepository.findByMentor(mentorId, limit, offset, {
      ...queryFilters,
      excludeDeleted,
    });
  }

  /**
   * Get session details
   */
  async getSessionById(id: string): Promise<ClassSessionEntity> {
    this.logger.log(`Getting class session by ID: ${id}`);
    return this.classSessionRepository.findByIdOrThrow(id);
  }
}

