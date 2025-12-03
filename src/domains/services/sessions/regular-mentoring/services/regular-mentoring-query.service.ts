import { Injectable } from '@nestjs/common';
import { RegularMentoringRepository } from '../regular-mentoring.repository';
import { RegularMentoringSessionEntity } from '../entities/regular-mentoring-session.entity';
import { SessionFiltersDto } from '../../shared/dto/session-query.dto';
import { SessionNotFoundException } from '../../shared/exceptions/session-not-found.exception';

/**
 * Regular Mentoring Query Service (CQRS - Query)
 * 
 * Handles read operations for regular mentoring sessions
 */
@Injectable()
export class RegularMentoringQueryService {
  constructor(
    private readonly repository: RegularMentoringRepository,
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

  async getSessionById(id: string): Promise<RegularMentoringSessionEntity> {
    const session = await this.repository.findOne(id);
    if (!session) {
      throw new SessionNotFoundException(id);
    }
    return session;
  }

  async countSessions(_filters: SessionFiltersDto): Promise<number> {
    // Implement based on specific requirements
    // For now, return 0 as placeholder
    return 0;
  }
}

