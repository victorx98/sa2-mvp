import { Injectable } from '@nestjs/common';
import { AiCareerRepository } from '../ai-career.repository';
import { AiCareerSessionEntity } from '../entities/ai-career-session.entity';
import { SessionFiltersDto } from '../../shared/dto/session-query.dto';
import { SessionNotFoundException } from '../../shared/exceptions/session-not-found.exception';

/**
 * AI Career Query Service (CQRS - Query)
 * 
 * Handles read operations for AI career sessions
 */
@Injectable()
export class AiCareerQueryService {
  constructor(
    private readonly repository: AiCareerRepository,
  ) {}

  async getMentorSessions(
    mentorId: string,
    filters: SessionFiltersDto,
  ): Promise<AiCareerSessionEntity[]> {
    const excludeDeleted = filters.excludeDeleted !== false;
    return this.repository.findByMentorId(mentorId, excludeDeleted);
  }

  async getStudentSessions(
    studentId: string,
    filters: SessionFiltersDto,
  ): Promise<AiCareerSessionEntity[]> {
    const excludeDeleted = filters.excludeDeleted !== false;
    return this.repository.findByStudentId(studentId, excludeDeleted);
  }

  async getSessionById(id: string): Promise<AiCareerSessionEntity> {
    const session = await this.repository.findOne(id);
    if (!session) {
      throw new SessionNotFoundException(id);
    }
    return session;
  }
}

